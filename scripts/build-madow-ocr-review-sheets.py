"""Render source-measure review sheets for suspicious or all Madow OCR results."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
FRAME_ROOT = ROOT / "audit" / "measure-frames-highres"
DATA = json.loads((ROOT / "audit" / "madow-retranscribed-v7.json").read_text(encoding="utf-8"))["madow"]
REPORT = json.loads((ROOT / "audit" / "madow-retranscription-v7-report.json").read_text(encoding="utf-8"))
DEFAULT_OUTPUT_ROOT = ROOT / "audit" / "madow-ocr-review"


def yellow_bounds(image: np.ndarray) -> tuple[int, int]:
    blue, green, red = cv2.split(image[380:730])
    yellow = (red.astype(np.float32) + green.astype(np.float32) - 2 * blue.astype(np.float32)).mean(axis=0)
    selected = np.where(yellow > 12)[0]
    runs: list[tuple[int, int]] = []
    start = previous = int(selected[0])
    for value in selected[1:]:
        value = int(value)
        if value > previous + 8:
            runs.append((start, previous))
            start = value
        previous = value
    runs.append((start, previous))
    return max(runs, key=lambda run: run[1] - run[0])


def summary(glyphs: list[dict[str, object]]) -> str:
    chunks: list[str] = []
    for glyph in glyphs:
        symbols = "+".join(f"s{item['stringNo']}:{item['text']}" for item in glyph["symbols"])
        chunks.append(f"{glyph['slot']}[{symbols}]")
    return " ".join(chunks)


def review_measures(track: str) -> list[int]:
    report = REPORT[f"madow.{track}"]
    measures = {int(item["measure"]) for item in report["issues"]}
    measures.update(int(item["measure"]) for item in report["lowConfidence"])
    for measure_text, glyphs in DATA[track].items():
        for glyph in glyphs:
            for symbol in glyph["symbols"]:
                raw = str(symbol["text"])
                digits = re.sub(r"\D", "", raw)
                if (digits and int(digits) > 24) or not re.fullmatch(r"\(\d+\)|<\d+>|\d+|×", raw):
                    measures.add(int(measure_text))
    return sorted(measures)


def render_current_tab(glyphs: list[dict[str, object]], width: int) -> np.ndarray:
    """Draw the stored procedural TAB so it can be compared with the source crop."""
    height = 168
    canvas = np.full((height, width, 3), 250, dtype=np.uint8)
    line_top = 28
    line_gap = 20
    left = 20
    right = width - 20
    for string_index in range(6):
        y = line_top + string_index * line_gap
        cv2.line(canvas, (left, y), (right, y), (178, 178, 178), 1)

    cv2.putText(canvas, "STORED TAB", (8, 17), cv2.FONT_HERSHEY_SIMPLEX, 0.43, (34, 100, 34), 1)
    if not glyphs:
        cv2.putText(canvas, "<EMPTY>", (width // 2 - 45, 86), cv2.FONT_HERSHEY_SIMPLEX, 0.58, (40, 40, 40), 1)

    for glyph in glyphs:
        slot = float(glyph["slot"])
        x = int(left + max(0.0, min(16.0, slot)) / 16.0 * (right - left))
        technique = str(glyph.get("technique", ""))
        if technique:
            cv2.putText(
                canvas,
                technique,
                (max(0, x - 10), line_top - 8),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.32,
                (40, 115, 40),
                1,
            )
        for symbol in glyph["symbols"]:
            string_no = int(symbol["stringNo"])
            # OpenCV's built-in Hershey font cannot draw the Japanese-style
            # mute mark.  Use its ASCII TAB equivalent in audit sheets so a
            # correct muted note never looks like an OCR/data error.
            text = str(symbol["text"]).replace("×", "x")
            y = line_top + (string_no - 1) * line_gap
            font_scale = 0.37 if len(text) >= 4 else 0.43
            (text_width, text_height), _ = cv2.getTextSize(
                text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 1
            )
            cv2.rectangle(
                canvas,
                (x - 2, y - text_height - 2),
                (x + text_width + 2, y + 3),
                (250, 250, 250),
                -1,
            )
            cv2.putText(
                canvas,
                text,
                (x, y + 1),
                cv2.FONT_HERSHEY_SIMPLEX,
                font_scale,
                (15, 15, 15),
                1,
            )

    for beat in range(5):
        x = int(left + beat / 4 * (right - left))
        cv2.line(canvas, (x, height - 18), (x, height - 12), (90, 90, 90), 1)
        if beat < 4:
            cv2.putText(
                canvas,
                str(beat + 1),
                (x + 2, height - 2),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.32,
                (70, 70, 70),
                1,
            )
    return canvas


def panel(track: str, measure: int) -> np.ndarray:
    image = cv2.imread(str(FRAME_ROOT / f"madow-{track}" / f"measure-{measure:03}.jpg"))
    if image is None:
        raise FileNotFoundError(measure)
    left, right = yellow_bounds(image)
    # These are native 1920x1080 audit frames.  Keep the six TAB lines (not the
    # standard notation above them) and a little room for technique labels.
    top, bottom = ((835, 1030) if track == "lead" else (805, 1000))
    crop = image[top:bottom, max(0, left - 36):min(image.shape[1], right + 36)]
    available_width = 620
    image_height = 285
    scale = min(2.4, available_width / max(1, crop.shape[1]), image_height / max(1, crop.shape[0]))
    crop = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    canvas = np.full((470, available_width, 3), 250, dtype=np.uint8)
    x = max(0, (available_width - crop.shape[1]) // 2)
    resized = crop[:image_height, :available_width]
    canvas[:resized.shape[0], x:x + resized.shape[1]] = resized
    cv2.rectangle(canvas, (0, 0), (150, 30), (0, 0, 0), -1)
    cv2.putText(canvas, f"{track} m{measure}", (7, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.58, (0, 255, 255), 2)
    rendered = render_current_tab(DATA[track][str(measure)], available_width)
    canvas[302:302 + rendered.shape[0]] = rendered
    return canvas


def build(track: str, output_root: Path, include_all: bool) -> None:
    measures = list(range(1, 208)) if include_all else review_measures(track)
    output_root.mkdir(parents=True, exist_ok=True)
    per_page = 9
    columns = 3
    for page_index in range(0, len(measures), per_page):
        selected = measures[page_index:page_index + per_page]
        panels = [panel(track, measure) for measure in selected]
        while len(panels) < per_page:
            panels.append(np.full_like(panels[0], 245))
        sheet = np.vstack([
            np.hstack(panels[row * columns:(row + 1) * columns])
            for row in range(per_page // columns)
        ])
        output = output_root / f"{track}-{page_index // per_page + 1:02}.png"
        cv2.imwrite(str(output), sheet)
    (output_root / f"{track}-measures.txt").write_text(
        ",".join(str(measure) for measure in measures), encoding="utf-8"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--all",
        action="store_true",
        help="render every measure instead of only OCR review candidates",
    )
    parser.add_argument(
        "--track",
        choices=("lead", "backing", "both"),
        default="both",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_ROOT)
    args = parser.parse_args()
    tracks = ("lead", "backing") if args.track == "both" else (args.track,)
    for track in tracks:
        build(track, args.output, args.all)


if __name__ == "__main__":
    main()
