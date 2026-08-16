"""Build original-source contact sheets for visually auditing Madow Star meter changes."""

from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "audit" / "measure-frames-highres"
OUTPUT_ROOT = ROOT / "audit" / "meter-contact-sheets"


def build(track: str, crop_top: int, crop_bottom: int) -> None:
    panels: list[np.ndarray] = []
    for measure in range(4, 208, 4):
        image = cv2.imread(str(SOURCE_ROOT / f"madow-{track}" / f"measure-{measure:03}.jpg"))
        if image is None:
            raise FileNotFoundError(measure)
        crop = image[crop_top:crop_bottom]
        crop = cv2.resize(crop, (960, crop.shape[0] // 2), interpolation=cv2.INTER_AREA)
        cv2.rectangle(crop, (0, 0), (150, 32), (0, 0, 0), -1)
        cv2.putText(crop, f"target {measure}", (8, 23), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 255), 2)
        panels.append(crop)

    columns = 4
    rows = (len(panels) + columns - 1) // columns
    blank = np.full_like(panels[0], 255)
    while len(panels) < rows * columns:
        panels.append(blank.copy())
    sheet = np.vstack([np.hstack(panels[row * columns : (row + 1) * columns]) for row in range(rows)])
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(OUTPUT_ROOT / f"madow-{track}-meters.jpg"), sheet, [cv2.IMWRITE_JPEG_QUALITY, 95])


def build_checkpoints(track: str, crop_top: int, crop_bottom: int) -> None:
    measures = [1, 18, 19, 20, 25, 50, 100, 117, 120, 121, 124, 125, 150, 200, 207]
    panels: list[np.ndarray] = []
    for measure in measures:
        image = cv2.imread(str(SOURCE_ROOT / f"madow-{track}" / f"measure-{measure:03}.jpg"))
        if image is None:
            raise FileNotFoundError(measure)
        crop = image[crop_top:crop_bottom]
        crop = cv2.resize(crop, (960, crop.shape[0] // 2), interpolation=cv2.INTER_AREA)
        cv2.rectangle(crop, (0, 0), (180, 32), (0, 0, 0), -1)
        cv2.putText(crop, f"target {measure}", (8, 23), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 255), 2)
        panels.append(crop)

    columns = 3
    rows = (len(panels) + columns - 1) // columns
    sheet = np.vstack([np.hstack(panels[row * columns : (row + 1) * columns]) for row in range(rows)])
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(OUTPUT_ROOT / f"madow-{track}-checkpoints.jpg"), sheet, [cv2.IMWRITE_JPEG_QUALITY, 98])


build("lead", 545, 1020)
build("backing", 520, 985)
build_checkpoints("lead", 545, 1020)
build_checkpoints("backing", 520, 985)
