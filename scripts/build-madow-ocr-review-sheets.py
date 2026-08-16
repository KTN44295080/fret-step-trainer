"""Render source-measure review sheets for every suspicious Madow OCR result."""

from __future__ import annotations

import json
import re
from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
FRAME_ROOT = ROOT / "audit" / "measure-frames-highres"
DATA = json.loads((ROOT / "audit" / "madow-retranscribed-v5.json").read_text(encoding="utf-8"))["madow"]
REPORT = json.loads((ROOT / "audit" / "madow-retranscription-v5-report.json").read_text(encoding="utf-8"))
OUTPUT_ROOT = ROOT / "audit" / "madow-ocr-review"


def yellow_bounds(image: np.ndarray) -> tuple[int, int]:
    blue, green, red = cv2.split(image[380:730])
    yellow = (red.astype(np.float32) + green.astype(np.float32) - 2 * blue.astype(np.float32)).mean(axis=0)
    selected = np.where(yellow > 12)[0]
    runs: list[tuple[int, int]] = []
    start = previous = int(selected[0])
    for value in selected[1:]:
        value = int(value)
        if value > previous + 2:
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
    image_height = 300
    scale = min(2.4, available_width / max(1, crop.shape[1]), image_height / max(1, crop.shape[0]))
    crop = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    canvas = np.full((390, available_width, 3), 250, dtype=np.uint8)
    x = max(0, (available_width - crop.shape[1]) // 2)
    resized = crop[:image_height, :available_width]
    canvas[:resized.shape[0], x:x + resized.shape[1]] = resized
    cv2.rectangle(canvas, (0, 0), (150, 30), (0, 0, 0), -1)
    cv2.putText(canvas, f"{track} m{measure}", (7, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.58, (0, 255, 255), 2)
    text = summary(DATA[track][str(measure)]) or "<EMPTY>"
    for line_index in range(2):
        line = text[line_index * 90:(line_index + 1) * 90]
        cv2.putText(canvas, line, (8, 330 + line_index * 26), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (20, 20, 20), 1)
    return canvas


def build(track: str) -> None:
    measures = review_measures(track)
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
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
        output = OUTPUT_ROOT / f"{track}-{page_index // per_page + 1:02}.png"
        cv2.imwrite(str(output), sheet)
    (OUTPUT_ROOT / f"{track}-measures.txt").write_text(
        ",".join(str(measure) for measure in measures), encoding="utf-8"
    )


build("lead")
build("backing")
