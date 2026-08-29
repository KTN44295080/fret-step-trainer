#!/usr/bin/env python3
"""Import JoseLuRu's author-supplied Planet rhythm-guitar GP5 track.

The YouTube video uses Guitar Pro measures 3 through 210.  The trainer keeps
the existing 207-measure timeline by merging source measures 20 (4/4) and 21
(2/4) into canonical measure 18 (6/4).  All later source measures therefore
map with a +3 offset.

Install the parser outside the repository, then run for example:

  python -m pip install pyguitarpro --target C:\\TEMP\\pyguitarpro
  $env:PYTHONPATH = 'C:\\TEMP\\pyguitarpro'
  python scripts/import-madow-joseluru-gp5.py `
    --source C:\\TEMP\\Planet\\TABS.gp5 `
    --output app\\madow-backing-joseluru.json `
    --report audit\\madow-joseluru\\official-gp5-report.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


CANONICAL_MEASURES = 207
EXPECTED_SOURCE_MEASURES = 219
EXPECTED_TEMPO = 194
EXPECTED_TRACK = "GTR 2"
EXPECTED_TUNING = [64, 59, 55, 50, 45, 40]
EXPECTED_SOURCE_SHA256 = "8d2bb855ed80a584335a7a5254b567245aaf81e895356fb27b9e11cb3ad79852"


def source_measures_for(canonical_measure: int) -> list[int]:
    if 1 <= canonical_measure <= 17:
        return [canonical_measure + 2]
    if canonical_measure == 18:
        return [20, 21]
    if 19 <= canonical_measure <= CANONICAL_MEASURES:
        return [canonical_measure + 3]
    raise ValueError(f"canonical measure out of range: {canonical_measure}")


def rounded_slot(value: float) -> int | float:
    rounded = round(value, 6)
    integer = round(rounded)
    return integer if abs(rounded - integer) < 1e-6 else rounded


def note_text(note: Any) -> str:
    note_type = note.type.name
    if note_type == "dead":
        return "×"
    if note_type == "tie":
        return f"({note.value})"
    if note.effect.harmonic is not None:
        return f"<{note.value}>"
    return str(note.value)


def note_effects(note: Any) -> set[str]:
    effects: set[str] = set()
    if note.effect.slides:
        effects.add("sl.")
    if note.effect.bend is not None:
        effects.add("full")
    if note.effect.harmonic is not None:
        effects.add("harm.")
    if note.effect.tremoloPicking is not None:
        effects.add("tr.")
    if note.effect.palmMute:
        effects.add("P.M.")
    if note.effect.letRing:
        effects.add("let ring")
    return effects


def source_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def import_track(song: Any, track: Any) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    output: dict[str, list[dict[str, Any]]] = {}
    stats: Counter[str] = Counter()
    source_map: dict[str, list[int]] = {}

    for canonical_measure in range(1, CANONICAL_MEASURES + 1):
        source_numbers = source_measures_for(canonical_measure)
        source_map[str(canonical_measure)] = source_numbers
        source_objects = [track.measures[number - 1] for number in source_numbers]
        total_ticks = sum(measure.header.length for measure in source_objects)
        tick_offset = 0
        grouped: dict[tuple[int | float, bool], dict[str, Any]] = defaultdict(
            lambda: {"symbols": [], "effects": set()}
        )

        for source_measure in source_objects:
            for voice in source_measure.voices:
                for beat in voice.beats:
                    if not beat.notes:
                        continue
                    relative_tick = tick_offset + beat.start - source_measure.start
                    slot = rounded_slot(relative_tick / total_ticks * 16)
                    duration_slots = max(0.25, beat.duration.time / total_ticks * 16)

                    tied_notes = [note for note in beat.notes if note.type.name == "tie"]
                    attacked_notes = [note for note in beat.notes if note.type.name != "tie"]
                    for is_tie, notes in ((True, tied_notes), (False, attacked_notes)):
                        if not notes:
                            continue
                        bucket = grouped[(slot, is_tie)]
                        for note in notes:
                            text = note_text(note)
                            symbol: dict[str, Any] = {
                                "stringNo": note.string,
                                "text": text,
                            }
                            if not is_tie and text != "×":
                                symbol["durationSlots"] = rounded_slot(duration_slots)
                            bucket["symbols"].append(symbol)
                            bucket["effects"].update(note_effects(note))

                            stats["symbols"] += 1
                            stats[
                                "ties" if is_tie else "mutes" if text == "×" else "attacks"
                            ] += 1
                            for effect in note_effects(note):
                                stats[f"effect:{effect}"] += 1
            tick_offset += source_measure.header.length

        glyphs: list[dict[str, Any]] = []
        seen_string_slots: set[tuple[int | float, int]] = set()
        for (slot, is_tie), bucket in sorted(
            grouped.items(), key=lambda item: (float(item[0][0]), not item[0][1])
        ):
            symbols = sorted(bucket["symbols"], key=lambda symbol: symbol["stringNo"])
            for symbol in symbols:
                collision_key = (slot, symbol["stringNo"])
                if collision_key in seen_string_slots:
                    raise ValueError(
                        f"duplicate string event at canonical measure {canonical_measure}, "
                        f"slot {slot}, string {symbol['stringNo']}"
                    )
                seen_string_slots.add(collision_key)

            glyph: dict[str, Any] = {"slot": slot, "symbols": symbols}
            if is_tie:
                glyph["technique"] = "tie"
            effects = sorted(bucket["effects"])
            if effects:
                glyph["effects"] = effects
            glyphs.append(glyph)

        output[str(canonical_measure)] = glyphs
        stats["measures_with_events" if glyphs else "empty_measures"] += 1

    report = {
        "format": "guitar-pro-5",
        "track": track.name,
        "tempo": song.tempo,
        "canonicalMeasures": CANONICAL_MEASURES,
        "sourceMeasures": len(song.measureHeaders),
        "sourceMeasureRule": "1-17 => +2; 18 => 20+21; 19-207 => +3",
        "stats": dict(sorted(stats.items())),
        "emptyMeasures": [
            measure for measure in range(1, CANONICAL_MEASURES + 1)
            if not output[str(measure)]
        ],
        "sourceMap": source_map,
    }
    return output, report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()

    try:
        import guitarpro
    except ModuleNotFoundError as error:
        raise SystemExit(
            "pyguitarpro is required. Install it into a temporary PYTHONPATH as shown "
            "in this script's module docstring."
        ) from error

    actual_source_sha256 = source_sha256(args.source)
    if actual_source_sha256 != EXPECTED_SOURCE_SHA256:
        raise ValueError(
            "unexpected GP5 source file: "
            f"expected SHA-256 {EXPECTED_SOURCE_SHA256}, got {actual_source_sha256}"
        )

    song = guitarpro.parse(str(args.source))
    if song.tempo != EXPECTED_TEMPO:
        raise ValueError(f"expected tempo {EXPECTED_TEMPO}, got {song.tempo}")
    if len(song.measureHeaders) != EXPECTED_SOURCE_MEASURES:
        raise ValueError(
            f"expected {EXPECTED_SOURCE_MEASURES} source measures, got {len(song.measureHeaders)}"
        )
    tracks = [track for track in song.tracks if track.name == EXPECTED_TRACK]
    if len(tracks) != 1:
        raise ValueError(f"expected exactly one {EXPECTED_TRACK!r} track, got {len(tracks)}")
    track = tracks[0]
    tuning = [string.value for string in track.strings]
    if tuning != EXPECTED_TUNING:
        raise ValueError(f"expected standard tuning {EXPECTED_TUNING}, got {tuning}")

    output, report = import_track(song, track)
    report["sourceFile"] = args.source.name
    report["sourceSha256"] = actual_source_sha256
    report["sourcePost"] = "https://www.patreon.com/posts/bocchi-rock-band-111639773"

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report["stats"], ensure_ascii=False, sort_keys=True))
    print(f"wrote {args.output}")
    print(f"wrote {args.report}")


if __name__ == "__main__":
    main()
