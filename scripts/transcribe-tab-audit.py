"""Convert the locally extracted Guitar Pro video frames into procedural TAB data.

The source frames are intentionally kept under ``audit/`` and are never shipped.
Only the compact, frame-derived glyph data is written to ``app/tab-audit-data.json``.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
OCR_TOOLS = ROOT / "audit" / "ocr-tools"
sys.path.insert(0, str(OCR_TOOLS))

from rapidocr_onnxruntime import RapidOCR  # type: ignore  # noqa: E402


@dataclass(frozen=True)
class Source:
    key: str
    directory: str
    measures: int
    staff_lines: tuple[int, int, int, int, int, int]
    yellow_rows: tuple[int, int]
    technique_top: int


SOURCES = (
    Source("life-over.lead", "life-over-lead", 151, (505, 521, 537, 553, 569, 585), (90, 650), 470),
    Source("life-over.backing", "life-over-backing", 151, (147, 163, 179, 195, 211, 227), (90, 650), 115),
    Source("life-over.third", "life-over-lead", 151, (304, 320, 336, 352, 368, 384), (90, 650), 270),
    Source("madow.lead", "madow-lead", 207, (606, 620, 634, 648, 662, 676), (390, 715), 555),
    Source("madow.backing", "madow-backing", 207, (579, 593, 607, 621, 635, 649), (390, 715), 535),
)


TOKEN_PATTERN = re.compile(r"\(\d+\)|<\d+>|\d+|[xX×]")
TECHNIQUES = (
    (re.compile(r"\bsl\.?\b", re.I), "sl."),
    (re.compile(r"\bfull\b", re.I), "full"),
    (re.compile(r"\bH\b"), "H"),
    (re.compile(r"harm", re.I), "harm."),
)


def yellow_bounds(image: np.ndarray, rows: tuple[int, int]) -> tuple[int, int]:
    top, bottom = rows
    blue, green, red = cv2.split(image[top:bottom])
    yellow = (
        red.astype(np.float32) + green.astype(np.float32) - 2 * blue.astype(np.float32)
    ).mean(axis=0)
    selected = np.where(yellow > 12)[0]
    if not len(selected):
        raise ValueError("highlighted measure was not found")

    runs: list[tuple[int, int]] = []
    start = previous = int(selected[0])
    for value in selected[1:]:
        value = int(value)
        if value > previous + 2:
            runs.append((start, previous))
            start = value
        previous = value
    runs.append((start, previous))
    left, right = max(runs, key=lambda run: run[1] - run[0])
    if right - left < 35:
        raise ValueError(f"highlight is too narrow: {left}-{right}")
    return left, right + 1


def recognize_token(ocr: RapidOCR, mask: np.ndarray, bounds: tuple[int, int, int, int]) -> tuple[str | None, float]:
    left, top, right, bottom = bounds
    crop = 255 - mask[max(0, top - 2) : min(mask.shape[0], bottom + 2), max(0, left - 2) : min(mask.shape[1], right + 2)]
    if not crop.size:
        return None, 0.0
    crop = cv2.resize(crop, None, fx=4, fy=4, interpolation=cv2.INTER_NEAREST)
    result, _ = ocr(crop, use_det=False, use_cls=False, use_rec=True)
    if not result:
        return None, 0.0
    raw, confidence = result[0]
    normalized = (
        str(raw)
        .replace("（", "(")
        .replace("）", ")")
        .replace("Ｏ", "0")
        .replace("O", "0")
        .replace("o", "0")
        .replace("＜", "<")
        .replace("＞", ">")
        .replace(" ", "")
    )
    matches = TOKEN_PATTERN.findall(normalized)
    if not matches:
        return None, float(confidence)
    token = "".join(matches)
    if token.lower() == "x":
        token = "×"
    return token, float(confidence)


def line_tokens(
    image: np.ndarray,
    ocr: RapidOCR,
    line_y: int,
    left: int,
    right: int,
) -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    gray = cv2.cvtColor(image[line_y - 10 : line_y + 11, left:right], cv2.COLOR_BGR2GRAY)
    mask = (gray < 105).astype(np.uint8) * 255
    count, _, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    components: list[tuple[int, int, int, int, int]] = []
    for index in range(1, count):
        x, y, width, height, area = (int(value) for value in stats[index])
        if area < 3 or height < 4 or width <= 2:
            continue
        components.append((x, y, width, height, area))
    components.sort()

    groups: list[list[tuple[int, int, int, int, int]]] = []
    for component in components:
        if groups and component[0] <= max(item[0] + item[2] for item in groups[-1]) + 6:
            groups[-1].append(component)
        else:
            groups.append([component])

    tokens: list[dict[str, object]] = []
    issues: list[dict[str, object]] = []
    width = right - left
    for group in groups:
        x = min(item[0] for item in group)
        y = min(item[1] for item in group)
        group_right = max(item[0] + item[2] for item in group)
        group_bottom = max(item[1] + item[3] for item in group)
        if x < 4 or group_right > width - 4 or group_right - x > 48:
            continue
        token, confidence = recognize_token(ocr, mask, (x, y, group_right, group_bottom))
        if token is None:
            if sum(item[4] for item in group) >= 12:
                issues.append({"x": x, "reason": "unread", "confidence": round(confidence, 3)})
            continue
        matches = TOKEN_PATTERN.findall(token)
        if len(matches) == 1:
            tokens.append({"x": left + (x + group_right) / 2, "text": matches[0].replace("X", "×").replace("x", "×"), "confidence": confidence})
            continue

        # A rare tightly-spaced pair can be recognized as one string. Preserve
        # both notes and distribute them over the recognized image width.
        span = max(1.0, group_right - x)
        for match_index, match in enumerate(matches):
            center = x + span * ((match_index + 0.5) / len(matches))
            tokens.append({"x": left + center, "text": match.replace("X", "×").replace("x", "×"), "confidence": confidence})
    return tokens, issues


def line_candidates(
    image: np.ndarray,
    line_y: int,
    left: int,
    right: int,
) -> tuple[list[tuple[np.ndarray, float, int]], list[dict[str, object]]]:
    """Extract likely fret-number images without invoking OCR."""

    gray = cv2.cvtColor(image[line_y - 10 : line_y + 11, left:right], cv2.COLOR_BGR2GRAY)
    mask = (gray < 105).astype(np.uint8) * 255
    count, _, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    components: list[tuple[int, int, int, int, int]] = []
    for index in range(1, count):
        x, y, width, height, area = (int(value) for value in stats[index])
        if area < 3 or height < 4 or width <= 2:
            continue
        components.append((x, y, width, height, area))
    components.sort()

    groups: list[list[tuple[int, int, int, int, int]]] = []
    for component in components:
        if groups and component[0] <= max(item[0] + item[2] for item in groups[-1]) + 6:
            groups[-1].append(component)
        else:
            groups.append([component])

    candidates: list[tuple[np.ndarray, float, int]] = []
    issues: list[dict[str, object]] = []
    width = right - left
    for group in groups:
        x = min(item[0] for item in group)
        y = min(item[1] for item in group)
        group_right = max(item[0] + item[2] for item in group)
        group_bottom = max(item[1] + item[3] for item in group)
        area = sum(item[4] for item in group)
        if x < 4 or group_right > width - 4 or group_right - x > 48:
            continue
        crop = 255 - mask[max(0, y - 2) : min(mask.shape[0], group_bottom + 2), max(0, x - 2) : min(mask.shape[1], group_right + 2)]
        if not crop.size:
            continue
        crop = cv2.resize(crop, None, fx=4, fy=4, interpolation=cv2.INTER_NEAREST)
        crop = cv2.cvtColor(crop, cv2.COLOR_GRAY2BGR)
        candidates.append((crop, left + (x + group_right) / 2, area))
    return candidates, issues


def measure_tokens(
    image: np.ndarray,
    ocr: RapidOCR,
    source: Source,
    left: int,
    right: int,
) -> tuple[list[list[dict[str, object]]], list[tuple[float, str]], list[dict[str, object]]]:
    """Read an active measure in one OCR pass and map text back to TAB lines.

    RapidOCR often returns a complete horizontal TAB phrase (for example
    ``(10)-10-12-10``) as one box. Splitting that result is both faster and more
    reliable than running the recognizer once for every connected component.
    """

    top = max(0, min(source.technique_top, source.staff_lines[0] - 12))
    bottom = min(image.shape[0], source.staff_lines[-1] + 12)
    crop = image[top:bottom, left:right]
    result, _ = ocr(crop, box_thresh=0.25, text_score=0.35)
    tokens_by_string: list[list[dict[str, object]]] = [[] for _ in range(6)]
    techniques: list[tuple[float, str]] = []
    issues: list[dict[str, object]] = []
    if not result:
        return tokens_by_string, techniques, [{"reason": "ocr-empty"}]

    for box, raw, confidence in result:
        text = (
            str(raw)
            .replace("（", "(")
            .replace("）", ")")
            .replace("Ｏ", "0")
            .replace("O", "0")
            .replace("o", "0")
            .replace("＜", "<")
            .replace("＞", ">")
        )
        center_x = left + float(np.mean([point[0] for point in box]))
        center_y = top + float(np.mean([point[1] for point in box]))
        technique = next((label for pattern, label in TECHNIQUES if pattern.search(text)), None)
        if technique is not None:
            techniques.append((center_x, technique))

        matches = TOKEN_PATTERN.findall(text)
        if not matches:
            continue
        string_index = int(np.argmin([abs(center_y - line_y) for line_y in source.staff_lines]))
        if abs(center_y - source.staff_lines[string_index]) > 12:
            continue
        xs = [float(point[0]) for point in box]
        box_left = left + min(xs)
        box_right = left + max(xs)
        span = max(1.0, box_right - box_left)
        for match_index, match in enumerate(matches):
            token_x = box_left + span * ((match_index + 0.5) / len(matches))
            token = match.replace("X", "×").replace("x", "×")
            tokens_by_string[string_index].append({
                "x": token_x,
                "text": token,
                "confidence": float(confidence),
            })

    for tokens in tokens_by_string:
        tokens.sort(key=lambda token: float(token["x"]))
    return tokens_by_string, techniques, issues


def full_measure_tokens(
    image: np.ndarray,
    ocr: RapidOCR,
    source: Source,
    left: int,
    right: int,
) -> tuple[list[list[dict[str, object]]], list[tuple[float, str]], list[dict[str, object]]]:
    """Read the compact 720p Madow TAB as horizontal or vertical OCR boxes."""

    line_gap = float(np.median(np.diff(source.staff_lines)))
    top = max(0, source.technique_top)
    bottom = min(image.shape[0], source.staff_lines[-1] + 10)
    result, _ = ocr(image[top:bottom, left:right], box_thresh=0.2, text_score=0.25)
    tokens_by_string: list[list[dict[str, object]]] = [[] for _ in range(6)]
    techniques: list[tuple[float, str]] = []
    issues: list[dict[str, object]] = []
    if not result:
        return tokens_by_string, techniques, [{"reason": "ocr-empty"}]

    for box, raw, confidence in result:
        text = (
            str(raw)
            .replace("（", "(")
            .replace("）", ")")
            .replace("Ｏ", "0")
            .replace("O", "0")
            .replace("o", "0")
            .replace("＜", "<")
            .replace("＞", ">")
            .replace(" ", "")
        )
        xs = [float(point[0]) for point in box]
        ys = [float(point[1]) for point in box]
        box_left = left + min(xs)
        box_right = left + max(xs)
        box_top = top + min(ys)
        box_bottom = top + max(ys)
        center_x = (box_left + box_right) / 2
        center_y = (box_top + box_bottom) / 2
        technique = next((label for pattern, label in TECHNIQUES if pattern.search(text)), None)
        if technique is not None:
            techniques.append((center_x, technique))

        matches = TOKEN_PATTERN.findall(text)
        if not matches:
            continue
        box_height = box_bottom - box_top
        box_width = box_right - box_left
        multi_line = box_height > line_gap * 1.65
        vertical = multi_line and box_width < line_gap * 2.2 and len(matches) <= 6
        if multi_line and not vertical:
            issues.append({"reason": "ambiguous-multiline-box", "text": text, "x": round(center_x, 1)})
            continue
        if vertical:
            if len(matches) == 1 and matches[0].isdigit() and len(matches[0]) >= 3:
                expected = max(2, min(6, round((box_height - 10) / line_gap) + 1))
                compact = matches[0]
                if len(compact) == expected:
                    matches = list(compact)
                else:
                    parsed: list[str] = []

                    def split_at(index: int, remaining: int) -> bool:
                        if remaining == 0:
                            return index == len(compact)
                        for width in (2, 1):
                            value = compact[index:index + width]
                            if not value or (len(value) > 1 and value.startswith("0")):
                                continue
                            if int(value) > 24:
                                continue
                            parsed.append(value)
                            if split_at(index + width, remaining - 1):
                                return True
                            parsed.pop()
                        return False

                    if split_at(0, expected):
                        matches = parsed
            first_center = box_top + min(line_gap * 0.55, (box_bottom - box_top) / max(2, len(matches)))
            first_string = int(np.argmin([abs(first_center - line_y) for line_y in source.staff_lines]))
            for offset, match in enumerate(matches):
                string_index = first_string + offset
                if string_index >= 6:
                    break
                tokens_by_string[string_index].append({
                    "x": center_x,
                    "text": match.replace("X", "×").replace("x", "×"),
                    "confidence": float(confidence),
                })
            continue

        string_index = int(np.argmin([abs(center_y - line_y) for line_y in source.staff_lines]))
        if abs(center_y - source.staff_lines[string_index]) > line_gap:
            continue
        if len(matches) == 1 and matches[0].isdigit() and len(matches[0]) >= 3:
            compact = matches[0]
            split_matches: list[str] = []
            index = 0
            while index < len(compact):
                pair = compact[index:index + 2]
                if len(pair) == 2 and pair[0] in "12" and 10 <= int(pair) <= 24:
                    split_matches.append(pair)
                    index += 2
                else:
                    split_matches.append(compact[index])
                    index += 1
            matches = split_matches
        span = max(1.0, box_right - box_left)
        for match_index, match in enumerate(matches):
            token_x = box_left + span * ((match_index + 0.5) / len(matches))
            tokens_by_string[string_index].append({
                "x": token_x,
                "text": match.replace("X", "×").replace("x", "×"),
                "confidence": float(confidence),
            })

    # Detection may produce overlapping boxes for the same printed number.
    for string_index, tokens in enumerate(tokens_by_string):
        tokens.sort(key=lambda token: (float(token["x"]), -float(token["confidence"])))
        deduped: list[dict[str, object]] = []
        for token in tokens:
            if deduped and abs(float(token["x"]) - float(deduped[-1]["x"])) < 4:
                if float(token["confidence"]) > float(deduped[-1]["confidence"]):
                    deduped[-1] = token
                continue
            deduped.append(token)
        tokens_by_string[string_index] = deduped
    return tokens_by_string, techniques, issues


def quantize_glyphs(tokens_by_string: list[list[dict[str, object]]], left: int, right: int) -> list[dict[str, object]]:
    width = right - left
    flattened: list[dict[str, object]] = []
    for string_index, tokens in enumerate(tokens_by_string, start=1):
        for token in tokens:
            flattened.append({**token, "stringNo": string_index})
    flattened.sort(key=lambda token: float(token["x"]))
    if not flattened:
        return []

    tolerance = max(4.0, width * 0.015)
    columns: list[list[dict[str, object]]] = []
    for token in flattened:
        if columns and abs(float(token["x"]) - np.mean([float(item["x"]) for item in columns[-1]])) <= tolerance:
            columns[-1].append(token)
        else:
            columns.append([token])

    padding = min(30.0, width * 0.13)
    usable = max(1.0, width - padding * 2)
    glyphs: list[dict[str, object]] = []
    previous_slot = -1
    for column in columns:
        center = float(np.mean([float(item["x"]) for item in column])) - left
        slot = int(round((center - padding) / usable * 15))
        slot = max(0, min(15, slot))
        if slot < previous_slot:
            slot = previous_slot
        symbols = [
            {"stringNo": int(item["stringNo"]), "text": str(item["text"])}
            for item in sorted(column, key=lambda item: int(item["stringNo"]))
        ]
        glyph: dict[str, object] = {"slot": slot, "symbols": symbols}
        if any(str(item["text"]).startswith("(") for item in column):
            glyph["technique"] = "tie"
        elif any(str(item["text"]).startswith("<") for item in column):
            glyph["technique"] = "harm."
        glyphs.append(glyph)
        previous_slot = slot
    return glyphs


def attach_techniques(
    image: np.ndarray,
    ocr: RapidOCR,
    glyphs: list[dict[str, object]],
    left: int,
    right: int,
    top: int,
    staff_top: int,
) -> None:
    if not glyphs or staff_top - top < 12:
        return
    crop = image[top:staff_top, left:right]
    result, _ = ocr(crop)
    if not result:
        return
    width = right - left
    padding = min(30.0, width * 0.13)
    usable = max(1.0, width - padding * 2)
    for box, raw, _ in result:
        technique = next((label for pattern, label in TECHNIQUES if pattern.search(str(raw))), None)
        if technique is None:
            continue
        center_x = float(np.mean([point[0] for point in box]))
        slot = max(0, min(15, int(round((center_x - padding) / usable * 15))))
        closest = min(glyphs, key=lambda glyph: abs(int(glyph["slot"]) - slot))
        if abs(int(closest["slot"]) - slot) <= 3:
            closest["technique"] = technique


def attach_detected_techniques(
    glyphs: list[dict[str, object]],
    techniques: list[tuple[float, str]],
    left: int,
    right: int,
) -> None:
    if not glyphs:
        return
    width = right - left
    padding = min(30.0, width * 0.13)
    usable = max(1.0, width - padding * 2)
    for center_x, technique in techniques:
        slot = max(0, min(15, int(round(((center_x - left) - padding) / usable * 15))))
        closest = min(glyphs, key=lambda glyph: abs(int(glyph["slot"]) - slot))
        if abs(int(closest["slot"]) - slot) <= 3:
            closest["technique"] = technique


def transcribe_source(source: Source, ocr: RapidOCR) -> tuple[dict[str, object], dict[str, object]]:
    source_dir = ROOT / "audit" / "measure-frames" / source.directory
    measures: dict[str, object] = {}
    report: dict[str, object] = {"measures": source.measures, "issues": [], "empty": [], "lowConfidence": []}
    confidence_values: list[float] = []
    if source.key.startswith("madow."):
        for measure in range(1, source.measures + 1):
            frame = source_dir / f"measure-{measure:03d}.jpg"
            image = cv2.imread(str(frame))
            if image is None:
                report["issues"].append({"measure": measure, "reason": "missing-frame"})
                measures[str(measure)] = []
                continue
            try:
                left, right = yellow_bounds(image, source.yellow_rows)
            except ValueError as error:
                report["issues"].append({"measure": measure, "reason": str(error)})
                measures[str(measure)] = []
                continue
            tokens_by_string, techniques, issues = full_measure_tokens(image, ocr, source, left, right)
            for issue in issues:
                report["issues"].append({"measure": measure, **issue})
            confidence_values.extend(float(token["confidence"]) for tokens in tokens_by_string for token in tokens)
            glyphs = quantize_glyphs(tokens_by_string, left, right)
            attach_detected_techniques(glyphs, techniques, left, right)
            measures[str(measure)] = glyphs
            if not glyphs:
                report["empty"].append(measure)
            low = [
                round(float(token["confidence"]), 3)
                for tokens in tokens_by_string
                for token in tokens
                if float(token["confidence"]) < 0.72
            ]
            if low:
                report["lowConfidence"].append({"measure": measure, "scores": low})
            if measure % 25 == 0 or measure == source.measures:
                print(f"{source.key}: full OCR {measure}/{source.measures}", flush=True)
        report["averageConfidence"] = round(float(np.mean(confidence_values)), 4) if confidence_values else 0
        report["glyphs"] = sum(len(glyphs) for glyphs in measures.values())
        report["symbols"] = sum(len(glyph["symbols"]) for glyphs in measures.values() for glyph in glyphs)
        return measures, report

    measure_contexts: dict[int, tuple[int, int, list[list[dict[str, object]]]]] = {}
    crops: list[np.ndarray] = []
    crop_meta: list[tuple[int, int, float, int]] = []

    for measure in range(1, source.measures + 1):
        frame = source_dir / f"measure-{measure:03d}.jpg"
        image = cv2.imread(str(frame))
        if image is None:
            report["issues"].append({"measure": measure, "reason": "missing-frame"})
            measures[str(measure)] = []
            continue
        try:
            left, right = yellow_bounds(image, source.yellow_rows)
        except ValueError as error:
            report["issues"].append({"measure": measure, "reason": str(error)})
            measures[str(measure)] = []
            continue

        tokens_by_string: list[list[dict[str, object]]] = [[] for _ in range(6)]
        measure_contexts[measure] = (left, right, tokens_by_string)
        for string_index, line_y in enumerate(source.staff_lines):
            candidates, issues = line_candidates(image, line_y, left, right)
            for issue in issues:
                report["issues"].append({"measure": measure, "stringNo": string_index + 1, **issue})
            for crop, center_x, area in candidates:
                crops.append(crop)
                crop_meta.append((measure, string_index, center_x, area))
        if measure % 25 == 0 or measure == source.measures:
            print(f"{source.key}: extracted {measure}/{source.measures}", flush=True)

    if crops:
        ocr.text_rec.rec_batch_num = 64
        recognition, _ = ocr.text_rec(crops)
    else:
        recognition = []
    for (raw, confidence), (measure, string_index, center_x, area) in zip(recognition, crop_meta):
        normalized = (
            str(raw)
            .replace("（", "(")
            .replace("）", ")")
            .replace("Ｏ", "0")
            .replace("O", "0")
            .replace("o", "0")
            .replace("＜", "<")
            .replace("＞", ">")
            .replace(" ", "")
        )
        matches = TOKEN_PATTERN.findall(normalized)
        if not matches:
            if area >= 12:
                report["issues"].append({
                    "measure": measure,
                    "stringNo": string_index + 1,
                    "x": round(center_x, 1),
                    "reason": "unread",
                    "confidence": round(float(confidence), 3),
                })
            continue
        left, right, tokens_by_string = measure_contexts[measure]
        spread = max(4.0, (right - left) * 0.018)
        for match_index, match in enumerate(matches):
            offset = (match_index - (len(matches) - 1) / 2) * spread
            tokens_by_string[string_index].append({
                "x": center_x + offset,
                "text": match.replace("X", "×").replace("x", "×"),
                "confidence": float(confidence),
            })
            confidence_values.append(float(confidence))

    for measure in range(1, source.measures + 1):
        context = measure_contexts.get(measure)
        if context is None:
            measures.setdefault(str(measure), [])
            continue
        left, right, tokens_by_string = context
        for tokens in tokens_by_string:
            tokens.sort(key=lambda token: float(token["x"]))
        glyphs = quantize_glyphs(tokens_by_string, left, right)
        measures[str(measure)] = glyphs
        if not glyphs:
            report["empty"].append(measure)
        low = [
            round(float(token["confidence"]), 3)
            for tokens in tokens_by_string
            for token in tokens
            if float(token["confidence"]) < 0.72
        ]
        if low:
            report["lowConfidence"].append({"measure": measure, "scores": low})

    report["averageConfidence"] = round(float(np.mean(confidence_values)), 4) if confidence_values else 0
    report["glyphs"] = sum(len(glyphs) for glyphs in measures.values())
    report["symbols"] = sum(len(glyph["symbols"]) for glyphs in measures.values() for glyph in glyphs)
    return measures, report


def set_nested(target: dict[str, object], key: str, value: object) -> None:
    song, track = key.split(".")
    target.setdefault(song, {})
    target[song][track] = value  # type: ignore[index]


def apply_manual_corrections(data: dict[str, object]) -> None:
    """Apply notes confirmed from the source video after OCR transcription."""
    life = data["life-over"]  # type: ignore[index]
    lead = life["lead"]  # type: ignore[index]
    backing = life["backing"]  # type: ignore[index]

    def glyph(
        slot: int,
        *symbols: tuple[int, str],
        technique: str | None = None,
    ) -> dict[str, object]:
        corrected: dict[str, object] = {
            "slot": slot,
            "symbols": [
                {"stringNo": string_no, "text": text}
                for string_no, text in symbols
            ],
        }
        if technique is not None:
            corrected["technique"] = technique
        return corrected

    # The narrow quarter-rest and note-stem shapes were the two recurring OCR
    # failures in the lead track.  The native 1920x1080 source frames confirm
    # that neither is a fret 1, and that the rest-shaped mark on string 3 is not
    # a fret 7 outside the muted-note technique passage (measures 66-81).
    for measure_text, measure_glyphs in lead.items():  # type: ignore[attr-defined]
        measure = int(measure_text)
        cleaned: list[dict[str, object]] = []
        for current in measure_glyphs:
            symbols = []
            for symbol in current["symbols"]:
                text = "×" if symbol["text"] == "亊" else symbol["text"]
                if text == "1":
                    continue
                if not 66 <= measure <= 81 and symbol["stringNo"] == 3 and text == "7":
                    continue
                symbols.append({"stringNo": symbol["stringNo"], "text": text})
            if symbols:
                replacement = {**current, "symbols": symbols}
                cleaned.append(replacement)
        lead[measure_text] = cleaned

    # Pickup and low-register phrases (the visible rests are intentionally not
    # represented as fret glyphs).
    lead["1"] = [
        glyph(11, (5, "7")),
        glyph(13, (5, "9")),
        glyph(14, (4, "7")),
    ]

    for measure in ("13", "53"):
        lead[measure][0] = {  # type: ignore[index]
            "slot": 0,
            "symbols": [{"stringNo": 5, "text": "(5)"}],
            "technique": "tie",
        }

    for measure in ("3", "5", "7", "9", "11", "13", "15", "17", "51", "53", "55", "57"):
        if lead[measure]:  # type: ignore[index]
            lead[measure][0] = glyph(0, (5, "(5)"), technique="tie")  # type: ignore[index]

    # Sustained all-string-3 phrase.  This explicitly covers the originally
    # reported measure 45 error.
    all_string_three = [
        glyph(1, (3, "(10)"), technique="tie"),
        glyph(3, (3, "10")),
        glyph(5, (3, "12")),
        glyph(7, (3, "10")),
        glyph(11, (3, "10")),
        glyph(13, (3, "10")),
    ]
    for measure in ("37", "45", "101", "109", "120", "128", "136"):
        lead[measure] = all_string_three

    # The companion cadence contains a printed rest between the second 10 and
    # the three 9s.  Older data rendered that rest as an extra fret 7.
    cadence = [
        glyph(1, (3, "(10)"), technique="tie"),
        glyph(3, (3, "10")),
        glyph(7, (3, "9")),
        glyph(11, (3, "9")),
        glyph(13, (3, "9")),
    ]
    for measure in ("41", "49", "89", "97", "105", "113", "124", "132", "140"):
        lead[measure] = cadence

    # Lead technique passage, measures 66-81.  These are native-frame visual
    # corrections for the places where rests, muted notes, and string numbers
    # cannot be distinguished reliably by OCR.
    lead["66"] = [
        glyph(8, (3, "7"), (4, "7")),
        glyph(12, (3, "×"), (4, "×")),
        glyph(14, (4, "7")),
    ]
    lead["67"] = [
        glyph(0, (4, "(7)"), technique="tie"),
        glyph(2, (4, "9")),
        glyph(8, (3, "×"), (4, "×")),
        glyph(9, (3, "×"), (4, "×")),
        glyph(10, (3, "7")),
        glyph(12, (4, "9")),
    ]
    lead["68"] = [
        glyph(2, (3, "×"), (4, "×")),
        glyph(3, (3, "×"), (4, "×")),
        glyph(4, (3, "7"), (4, "7")),
        glyph(8, (4, "7")),
        glyph(10, (5, "10")),
        glyph(14, (5, "9")),
    ]
    lead["69"] = [
        glyph(0, (5, "(9)"), technique="tie"),
        glyph(2, (4, "7")),
        glyph(6, (3, "×"), (4, "×")),
        glyph(8, (3, "7")),
        glyph(10, (3, "9")),
        glyph(12, (2, "7")),
        glyph(14, (2, "10")),
    ]
    lead["73"] = [
        glyph(2, (4, "7")),
        glyph(4, (4, "9")),
        glyph(6, (3, "7")),
        glyph(8, (3, "9")),
        glyph(9, (3, "11"), technique="sl."),
        glyph(10, (3, "9")),
        glyph(12, (3, "7")),
    ]
    lead["79"] = [
        glyph(3, (2, "12")),
        glyph(7, (1, "10")),
        glyph(9, (1, "12")),
        glyph(11, (1, "10")),
        glyph(13, (1, "12")),
    ]
    lead["80"] = [
        glyph(4, (2, "10"), technique="H"),
        glyph(5, (2, "12")),
        glyph(7, (2, "10")),
        glyph(9, (2, "×")),
        glyph(10, (2, "7")),
        glyph(12, (3, "9")),
        glyph(14, (3, "7")),
    ]

    # Final special figures and outro, checked directly against measures
    # 111-151 in the source video.
    if lead["111"]:  # type: ignore[index]
        lead["111"][-1] = glyph(13, (2, "10"))  # type: ignore[index]
    lead["114"] = [
        glyph(slot, (2, "14"), (4, "11"))
        for slot in (0, 4, 8, 10, 12, 14)
    ]
    lead["115"] = [
        glyph(2, (1, "12"), (3, "9")),
        glyph(6, (1, "12"), (3, "9")),
    ]
    lead["116"] = [
        glyph(9, (2, "<5>"), (3, "<5>"), (4, "<5>"), (5, "<5>"), technique="harm."),
    ]
    lead["142"] = [
        glyph(1, (3, "(10)"), technique="tie"),
        glyph(3, (4, "12")), glyph(5, (3, "10")), glyph(7, (3, "12")),
        glyph(9, (2, "10")), glyph(11, (2, "13")), glyph(13, (1, "13")),
    ]
    lead["143"] = [
        glyph(0, (1, "10")), glyph(2, (1, "13")), glyph(4, (1, "12")),
        glyph(6, (2, "13")), glyph(8, (3, "12"), technique="sl."),
        glyph(10, (3, "10")),
    ]
    lead["144"] = [
        glyph(1, (3, "(10)"), technique="tie"), glyph(3, (3, "12")),
        glyph(5, (2, "10")), glyph(7, (3, "10")), glyph(12, (4, "10")),
    ]
    lead["145"] = [
        glyph(0, (3, "12")), glyph(2, (2, "10")), glyph(4, (2, "13")),
        glyph(6, (2, "10")), glyph(8, (3, "12")), glyph(10, (3, "10")),
        glyph(12, (3, "12")), glyph(15, (3, "10")),
    ]
    lead["146"] = [
        glyph(0, (3, "(10)"), technique="tie"), glyph(3, (4, "12")),
        glyph(5, (3, "10")), glyph(7, (3, "12")),
        glyph(9, (3, "14"), technique="sl."), glyph(10, (2, "13")),
        glyph(13, (1, "17")),
    ]
    lead["147"] = [
        glyph(0, (2, "15")), glyph(2, (1, "13")), glyph(4, (1, "12")),
        glyph(6, (1, "13")), glyph(8, (1, "12")), glyph(10, (2, "13")),
    ]
    lead["148"] = [
        glyph(slot, (1, "13"), (3, "10")) for slot in (2, 6, 10, 12)
    ]
    for measure in ("149", "150", "151"):
        lead[measure] = []

    backing["11"][0] = {  # type: ignore[index]
        "slot": 0,
        "symbols": [
            {"stringNo": 2, "text": "(2)"},
            {"stringNo": 3, "text": "(3)"},
            {"stringNo": 4, "text": "(2)"},
            {"stringNo": 6, "text": "(2)"},
        ],
        "technique": "tie",
    }
    backing["37"][0] = {  # type: ignore[index]
        "slot": 0,
        "symbols": [
            {"stringNo": 2, "text": "(3)"},
            {"stringNo": 3, "text": "(2)"},
            {"stringNo": 4, "text": "(0)"},
            {"stringNo": 6, "text": "(3)"},
        ],
        "technique": "tie",
    }


def update_manifests(reports: dict[str, object]) -> None:
    for source in SOURCES:
        if source.key.endswith(".third"):
            continue
        manifest = ROOT / "audit" / "measure-frames" / source.directory / "manifest.csv"
        with manifest.open("r", encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))
        issue_measures = {
            int(issue["measure"])
            for issue in reports[source.key]["issues"]  # type: ignore[index]
        }
        low_measures = {
            int(item["measure"])
            for item in reports[source.key]["lowConfidence"]  # type: ignore[index]
        }
        for row in rows:
            measure = int(row["measure"])
            if measure in issue_measures:
                row["status"] = "needs-review"
            elif measure in low_measures:
                row["status"] = "frame-read-low-confidence"
            else:
                row["status"] = "frame-transcribed"
        with manifest.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=rows[0].keys(), lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT / "app" / "tab-audit-data.json")
    parser.add_argument("--report", type=Path, default=ROOT / "audit" / "transcription-report.json")
    parser.add_argument(
        "--repair-existing",
        action="store_true",
        help="apply native-frame corrections to the existing JSON without rerunning OCR",
    )
    args = parser.parse_args()

    if args.repair_existing:
        data = json.loads(args.output.read_text(encoding="utf-8"))
        apply_manual_corrections(data)
        args.output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"repaired {args.output}")
        return

    if not OCR_TOOLS.exists():
        raise SystemExit("OCR tools are missing. Install rapidocr_onnxruntime under audit/ocr-tools first.")
    ocr = RapidOCR()
    data: dict[str, object] = {}
    reports: dict[str, object] = {}
    for source in SOURCES:
        measures, report = transcribe_source(source, ocr)
        set_nested(data, source.key, measures)
        reports[source.key] = report

    apply_manual_corrections(data)
    args.output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    args.report.write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding="utf-8")
    update_manifests(reports)
    print(f"wrote {args.output}")
    print(f"wrote {args.report}")


if __name__ == "__main__":
    main()
