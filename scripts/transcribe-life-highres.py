"""Transcribe the native-resolution Life Over audit frames.

This is deliberately separate from the older 1280px OCR pass.  The source
score is clean enough that RapidOCR can read whole phrases, but vertical chord
boxes must be split against the six known string lines.  Treating every thin
connected component as a digit was the reason note stems were previously
misread as fret ``1``.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
LEGACY_PATH = ROOT / "scripts" / "transcribe-tab-audit.py"
OCR_TOOLS = ROOT / "audit" / "ocr-tools"
sys.path.insert(0, str(OCR_TOOLS))

spec = importlib.util.spec_from_file_location("tab_audit_legacy", LEGACY_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Cannot import {LEGACY_PATH}")
legacy = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = legacy
spec.loader.exec_module(legacy)


@dataclass(frozen=True)
class Track:
    name: str
    staff_lines: tuple[int, int, int, int, int, int]
    technique_top: int


TRACKS = (
    Track("lead", (758, 782, 806, 830, 854, 878), 705),
    Track("backing", (221, 245, 269, 293, 317, 341), 173),
    Track("third", (456, 480, 504, 528, 552, 576), 405),
)

TOKEN_RE = re.compile(r"\(\d+\)|<\d+>|\d+|[xX×亊]")
TECHNIQUES = (
    (re.compile(r"\bsl\.?\b", re.I), "sl."),
    (re.compile(r"\bfull\b", re.I), "full"),
    (re.compile(r"\bH\b"), "H"),
    (re.compile(r"harm", re.I), "harm."),
)


def normalize(raw: object) -> str:
    return (
        str(raw)
        .replace("（", "(")
        .replace("）", ")")
        .replace("Ｏ", "0")
        .replace("O", "0")
        .replace("o", "0")
        .replace("＜", "<")
        .replace("＞", ">")
        .replace("亊", "×")
        .replace("X", "×")
        .replace("x", "×")
        .replace(" ", "")
    )


def split_compact_digits(value: str, count: int) -> list[str] | None:
    """Split a compact OCR result into exactly ``count`` valid fret values."""

    candidates: list[list[str]] = []

    def visit(index: int, remaining: int, parsed: list[str]) -> None:
        if remaining == 0:
            if index == len(value):
                candidates.append(parsed.copy())
            return
        for width in (2, 1):
            token = value[index : index + width]
            if not token or (width == 2 and token.startswith("0")):
                continue
            number = int(token)
            if number > 24:
                continue
            parsed.append(token)
            visit(index + width, remaining - 1, parsed)
            parsed.pop()

    visit(0, count, [])
    if not candidates:
        return None
    # Prefer two-digit frets when the source has enough digits to require them.
    return max(candidates, key=lambda parts: (sum(len(part) == 2 for part in parts), parts))


def read_track(
    detections: list[tuple[list[list[float]], object, float]],
    track: Track,
    left: int,
    right: int,
) -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    gap = float(np.median(np.diff(track.staff_lines)))
    note_top = max(0, track.staff_lines[0] - 16)
    note_bottom = track.staff_lines[-1] + 17
    by_string: list[list[dict[str, object]]] = [[] for _ in range(6)]
    issues: list[dict[str, object]] = []

    for box, raw, confidence in detections:
        text = normalize(raw)
        xs = [float(point[0]) for point in box]
        ys = [float(point[1]) for point in box]
        box_left = min(xs)
        box_right = max(xs)
        box_top = min(ys)
        box_bottom = max(ys)
        center_x = (box_left + box_right) / 2
        center_y = (box_top + box_bottom) / 2
        height = box_bottom - box_top
        if center_y < note_top or center_y > note_bottom:
            continue
        matches = [match.replace("亊", "×") for match in TOKEN_RE.findall(text)]
        if not matches:
            continue

        # Fret numbers in the source are read with very high confidence.  The
        # quarter-rest glyph, on the other hand, is occasionally guessed as a
        # low-confidence 1 or 7.  Keeping those guesses was the main source of
        # phantom notes in the previous transcription.
        if float(confidence) < 0.60:
            continue

        vertical = height > gap * 1.55
        if vertical:
            line_indexes = [
                index
                for index, line_y in enumerate(track.staff_lines)
                if box_top <= line_y <= box_bottom
            ]
            if len(matches) == 1 and matches[0].isdigit() and len(matches[0]) > 2:
                split = split_compact_digits(matches[0], len(line_indexes))
                if split is not None:
                    matches = split
            elif len(matches) == 1 and set(matches[0]) == {"×"}:
                matches = ["×"] * len(line_indexes)
            if len(matches) != len(line_indexes):
                issues.append(
                    {
                        "reason": "ambiguous-vertical",
                        "raw": str(raw),
                        "normalized": text,
                        "strings": [index + 1 for index in line_indexes],
                        "x": round(center_x, 1),
                    }
                )
                continue
            for string_index, token in zip(line_indexes, matches):
                by_string[string_index].append(
                    {"x": center_x, "text": token, "confidence": float(confidence)}
                )
            continue

        string_index = int(np.argmin([abs(center_y - line_y) for line_y in track.staff_lines]))
        if abs(center_y - track.staff_lines[string_index]) > gap * 0.72:
            continue
        span = max(1.0, box_right - box_left)
        for match_index, token in enumerate(matches):
            token_x = box_left + span * ((match_index + 0.5) / len(matches))
            by_string[string_index].append(
                {"x": token_x, "text": token, "confidence": float(confidence)}
            )

    # Detect technique labels separately, outside the note boxes.
    techniques: list[tuple[float, str]] = []
    technique_bottom = track.staff_lines[0] - 17
    if technique_bottom - track.technique_top >= 10:
        for box, raw, _ in detections:
            center_y = float(np.mean([point[1] for point in box]))
            if not (track.technique_top <= center_y <= technique_bottom):
                continue
            label = next((label for pattern, label in TECHNIQUES if pattern.search(str(raw))), None)
            if label is not None:
                techniques.append((float(np.mean([point[0] for point in box])), label))

    # Overlapping OCR boxes occasionally describe the same printed token.
    for index, tokens in enumerate(by_string):
        tokens.sort(key=lambda token: (float(token["x"]), -float(token["confidence"])))
        deduped: list[dict[str, object]] = []
        for token in tokens:
            if deduped and abs(float(token["x"]) - float(deduped[-1]["x"])) < 6:
                if float(token["confidence"]) > float(deduped[-1]["confidence"]):
                    deduped[-1] = token
                continue
            deduped.append(token)
        by_string[index] = deduped

    glyphs = legacy.quantize_glyphs(by_string, left, right)
    legacy.attach_detected_techniques(glyphs, techniques, left, right)
    for glyph in glyphs:
        for symbol in glyph["symbols"]:
            text = str(symbol["text"])
            numeric = text.strip("()<>")
            if numeric.isdigit() and int(numeric) > 24:
                issues.append(
                    {
                        "reason": "impossible-fret",
                        "text": text,
                        "stringNo": symbol["stringNo"],
                        "slot": glyph["slot"],
                    }
                )
    return glyphs, issues


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--frames",
        type=Path,
        default=ROOT / "audit" / "high-res-life-over",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "audit" / "life-over-highres-transcription.json",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=ROOT / "audit" / "life-over-highres-report.json",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Replace only the life-over tracks in app/tab-audit-data.json.",
    )
    args = parser.parse_args()

    if not OCR_TOOLS.exists():
        raise SystemExit("RapidOCR is missing under audit/ocr-tools")
    ocr = legacy.RapidOCR()
    data: dict[str, dict[str, list[dict[str, object]]]] = {
        track.name: {} for track in TRACKS
    }
    report: dict[str, object] = {"source": str(args.frames), "resolution": "1920x1080", "tracks": {}}
    detection_cache: dict[int, tuple[int, int, list[tuple[list[list[float]], object, float]]]] = {}

    for track in TRACKS:
        track_issues: list[dict[str, object]] = []
        empty: list[int] = []
        for measure in range(1, 152):
            frame = args.frames / f"measure-{measure:03d}.jpg"
            image = cv2.imread(str(frame))
            if image is None:
                data[track.name][str(measure)] = []
                track_issues.append({"measure": measure, "reason": "missing-frame"})
                continue
            cached = detection_cache.get(measure)
            if cached is None:
                try:
                    left, right = legacy.yellow_bounds(image, (135, 975))
                except ValueError as error:
                    data[track.name][str(measure)] = []
                    track_issues.append({"measure": measure, "reason": str(error)})
                    continue
                score_top = 150
                score_bottom = 905
                detected, _ = ocr(
                    image[score_top:score_bottom, left:right],
                    box_thresh=0.18,
                    text_score=0.22,
                )
                detections = [
                    (
                        [[float(x) + left, float(y) + score_top] for x, y in box],
                        raw,
                        float(confidence),
                    )
                    for box, raw, confidence in (detected or [])
                ]
                detection_cache[measure] = (left, right, detections)
            else:
                left, right, detections = cached
            glyphs, issues = read_track(detections, track, left, right)
            data[track.name][str(measure)] = glyphs
            if not glyphs:
                empty.append(measure)
            track_issues.extend({"measure": measure, **issue} for issue in issues)
            if measure % 25 == 0 or measure == 151:
                print(f"{track.name}: {measure}/151", flush=True)
        report["tracks"][track.name] = {  # type: ignore[index]
            "issues": track_issues,
            "issueMeasures": sorted({int(issue["measure"]) for issue in track_issues}),
            "emptyMeasures": empty,
            "glyphs": sum(len(glyphs) for glyphs in data[track.name].values()),
        }

    args.output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {args.output}")
    print(f"wrote {args.report}")

    if args.apply:
        app_data_path = ROOT / "app" / "tab-audit-data.json"
        app_data = json.loads(app_data_path.read_text(encoding="utf-8"))
        app_data["life-over"] = data
        legacy.apply_manual_corrections(app_data)
        app_data_path.write_text(
            json.dumps(app_data, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        print(f"updated {app_data_path}")


if __name__ == "__main__":
    main()
