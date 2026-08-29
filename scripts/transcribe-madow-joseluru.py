"""Transcribe JoseLuRu's Madow rhythm TAB onto the canonical 207-bar map.

The source video numbers two count-in bars before the song and writes the
canonical 6/4 bar 18 as a 4/4 bar followed by a 2/4 bar.  The exported JSON
removes those count-in bars and combines the split pair so every other app
surface can keep using the existing 207-bar timeline and meter map.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
OCR_TOOLS = ROOT / "audit" / "ocr-tools-v2"
if not OCR_TOOLS.exists():
    OCR_TOOLS = ROOT / "audit" / "ocr-tools"
sys.path.insert(0, str(OCR_TOOLS))

LEGACY_SPEC = importlib.util.spec_from_file_location(
    "tab_audit_legacy",
    ROOT / "scripts" / "transcribe-tab-audit.py",
)
if LEGACY_SPEC is None or LEGACY_SPEC.loader is None:
    raise RuntimeError("Could not load transcribe-tab-audit.py")
legacy = importlib.util.module_from_spec(LEGACY_SPEC)
sys.modules[LEGACY_SPEC.name] = legacy
LEGACY_SPEC.loader.exec_module(legacy)

from rapidocr_onnxruntime import RapidOCR  # type: ignore  # noqa: E402


BPM = 194
CANONICAL_START_SECONDS = 4.8545
METER_MAP = {
    18: 6,
    117: 5,
    118: 5,
    119: 5,
    120: 6,
    121: 5,
    122: 5,
    123: 5,
    124: 6,
}
STAFF_LINES = (885, 903, 922, 940, 958, 977)
SOURCE = legacy.Source(
    "madow.joseluru",
    "madow-joseluru",
    207,
    STAFF_LINES,
    (700, 1075),
    805,
)


def beats_for_measure(measure: int) -> int:
    return METER_MAP.get(measure, 4)


def seconds_before_measure(measure: int) -> float:
    beats = sum(beats_for_measure(value) for value in range(1, measure))
    return beats * 60 / BPM


def frame_at(capture: cv2.VideoCapture, seconds: float) -> np.ndarray:
    capture.set(cv2.CAP_PROP_POS_MSEC, seconds * 1000)
    ok, frame = capture.read()
    if not ok or frame is None:
        raise RuntimeError(f"Could not decode source frame at {seconds:.3f}s")
    return frame


def red_cursor_x(image: np.ndarray) -> int:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    red = (
        ((hsv[:, :, 0] < 8) | (hsv[:, :, 0] > 172))
        & (hsv[:, :, 1] > 120)
        & (hsv[:, :, 2] > 80)
    )
    red[:700] = False
    counts = red.sum(axis=0)
    cursor = int(np.argmax(counts))
    if counts[cursor] < 120:
        raise ValueError(f"red cursor not found (best column={cursor}, pixels={int(counts[cursor])})")
    return cursor


def current_measure_bounds(image: np.ndarray, cursor: int) -> tuple[int, int]:
    gray = cv2.cvtColor(image[870:990], cv2.COLOR_BGR2GRAY)
    counts = (gray > 170).sum(axis=0)
    # Full bar lines cross all six TAB strings (about 98 bright pixels in this
    # crop).  A lower threshold also admits note stems and produces tiny,
    # incorrect crops around sustained chords.
    selected = np.where(counts >= 96)[0]
    runs: list[tuple[int, int]] = []
    if len(selected):
        start = previous = int(selected[0])
        for raw in selected[1:]:
            value = int(raw)
            if value > previous + 1:
                runs.append((start, previous))
                start = value
            previous = value
        runs.append((start, previous))
    centers = [round((left + right) / 2) for left, right in runs]
    # Double bars are two full-height rules a few pixels apart. Treat them as
    # one boundary so they cannot be mistaken for a 7-pixel measure.
    merged_centers: list[int] = []
    for value in centers:
        if merged_centers and value - merged_centers[-1] <= 12:
            merged_centers[-1] = round((merged_centers[-1] + value) / 2)
        else:
            merged_centers.append(value)
    centers = merged_centers
    left_candidates = [value for value in centers if value < cursor - 18]
    right_candidates = [value for value in centers if value > cursor + 18]
    if not left_candidates or not right_candidates:
        raise ValueError(f"measure bars not found around cursor {cursor}: {centers}")
    # A sustained note stem can also span nearly the full staff height. Pick
    # the tightest enclosing pair with a plausible on-screen measure width;
    # this rejects those stems without assuming every system has one width.
    pairs = [
        (right - left, left, right)
        for left in left_candidates
        for right in right_candidates
        if 150 <= right - left <= 550
    ]
    if not pairs:
        raise ValueError(f"measure bars not found around cursor {cursor}: {centers}")
    _, left, right = min(pairs)
    return left + 2, right - 1


def transcribe_crop(
    image: np.ndarray,
    ocr: RapidOCR,
) -> tuple[list[dict[str, object]], list[dict[str, object]], tuple[int, int]]:
    cursor = red_cursor_x(image)
    left, right = current_measure_bounds(image, cursor)
    tokens, techniques, issues = legacy.full_measure_tokens(image, ocr, SOURCE, left, right)
    glyphs = legacy.quantize_glyphs(tokens, left, right)
    legacy.attach_detected_techniques(glyphs, techniques, left, right)
    return glyphs, issues, (left, right)


def remap_split_glyphs(
    first: list[dict[str, object]],
    second: list[dict[str, object]],
) -> list[dict[str, object]]:
    merged: list[dict[str, object]] = []
    for glyph in first:
        merged.append({**glyph, "slot": min(15, round(int(glyph["slot"]) * 2 / 3))})
    for glyph in second:
        merged.append({
            **glyph,
            "slot": min(15, round(32 / 3 + int(glyph["slot"]) / 3)),
        })
    merged.sort(key=lambda glyph: int(glyph["slot"]))
    return merged


def native_measure_for(canonical_measure: int) -> str:
    if canonical_measure <= 17:
        return str(canonical_measure + 2)
    if canonical_measure == 18:
        return "20+21"
    return str(canonical_measure + 3)


def normalize_stacked_chords(
    measure: int,
    glyphs: list[dict[str, object]],
) -> list[dict[str, object]]:
    """Expand OCR boxes that contain a vertically stacked one-digit chord.

    RapidOCR occasionally returns e.g. ``33002`` for five fret digits on five
    adjacent strings.  The box still carries the top string, so the sequence
    can be restored deterministically.  Time-signature boxes at a meter change
    are removed before that expansion.
    """
    normalized: list[dict[str, object]] = []
    expected_signature = f"{beats_for_measure(measure)}4"
    for glyph in glyphs:
        symbols: list[dict[str, object]] = []
        for raw_symbol in glyph.get("symbols", []):
            symbol = dict(raw_symbol)
            text = str(symbol.get("text", ""))
            string_no = int(symbol.get("stringNo", 1))
            if int(glyph.get("slot", 0)) == 0 and string_no == 2 and text == expected_signature:
                continue
            # Two digits are normally one fret number (10-24).  Only expand
            # three-or-more digits: those cannot be a playable guitar fret and
            # are RapidOCR's vertically concatenated chord columns.
            if text.isdigit() and len(text) >= 3 and string_no + len(text) - 1 <= 6:
                symbols.extend(
                    {**symbol, "stringNo": string_no + offset, "text": digit}
                    for offset, digit in enumerate(text)
                )
            else:
                symbols.append(symbol)
        if symbols:
            # OCR can return both a stacked box and a tighter single-symbol box
            # for the same string.  The latter is appended later and is more
            # precise, so keep the final observation per string.
            unique_by_string: dict[int, dict[str, object]] = {}
            for symbol in symbols:
                unique_by_string[int(symbol["stringNo"])] = symbol
            normalized.append({
                **glyph,
                "symbols": [unique_by_string[key] for key in sorted(unique_by_string)],
            })
    return normalized


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("video", type=Path)
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "app" / "madow-backing-joseluru.json",
    )
    parser.add_argument(
        "--audit-dir",
        type=Path,
        default=ROOT / "audit" / "madow-joseluru",
    )
    args = parser.parse_args()

    capture = cv2.VideoCapture(str(args.video))
    if not capture.isOpened():
        raise SystemExit(f"Could not open {args.video}")
    args.audit_dir.mkdir(parents=True, exist_ok=True)
    ocr = RapidOCR()
    measures: dict[str, list[dict[str, object]]] = {}
    report: dict[str, object] = {
        "video": str(args.video),
        "bpm": BPM,
        "canonicalStartSeconds": CANONICAL_START_SECONDS,
        "canonicalMeasures": 207,
        "nativeMeasureRule": "1-17 => +2; 18 => 20+21; 19-207 => +3",
        "issues": [],
    }

    try:
        for measure in range(1, 208):
            start = CANONICAL_START_SECONDS + seconds_before_measure(measure)
            if measure == 18:
                first_time = start + 2 * 60 / BPM
                second_time = start + 5 * 60 / BPM
                first_frame = frame_at(capture, first_time)
                second_frame = frame_at(capture, second_time)
                first, first_issues, first_bounds = transcribe_crop(first_frame, ocr)
                second, second_issues, second_bounds = transcribe_crop(second_frame, ocr)
                glyphs = remap_split_glyphs(first, second)
                cv2.imwrite(str(args.audit_dir / "measure-018a-native-020.jpg"), first_frame[780:1080, first_bounds[0]:first_bounds[1]])
                cv2.imwrite(str(args.audit_dir / "measure-018b-native-021.jpg"), second_frame[780:1080, second_bounds[0]:second_bounds[1]])
                issues = [*first_issues, *second_issues]
            else:
                midpoint = start + beats_for_measure(measure) * 30 / BPM
                frame = frame_at(capture, midpoint)
                glyphs, issues, bounds = transcribe_crop(frame, ocr)
                cv2.imwrite(
                    str(args.audit_dir / f"measure-{measure:03d}-native-{native_measure_for(measure)}.jpg"),
                    frame[780:1080, bounds[0]:bounds[1]],
                )
            measures[str(measure)] = normalize_stacked_chords(measure, glyphs)
            for issue in issues:
                report["issues"].append({"measure": measure, **issue})  # type: ignore[union-attr]
            if measure % 10 == 0 or measure == 207:
                print(f"JoseLuRu: {measure}/207", flush=True)
    finally:
        capture.release()

    report["glyphs"] = sum(len(glyphs) for glyphs in measures.values())
    report["symbols"] = sum(len(glyph["symbols"]) for glyphs in measures.values() for glyph in glyphs)
    report["emptyMeasures"] = [int(measure) for measure, glyphs in measures.items() if not glyphs]
    args.output.write_text(json.dumps(measures, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (args.audit_dir / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("glyphs", "symbols", "emptyMeasures")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
