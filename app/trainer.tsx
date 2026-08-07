"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import tabAuditData from "./tab-audit-data.json";
import {
  centsBetween,
  clamp,
  detectPitch,
  extendDurationThroughNextMeasureTie,
  frequencyFor,
  nearestPlaybackRate,
  measurePosition,
  playbackPositionSteps,
  normalizeLifeOverLeadEighthRun,
  positionToMeasure,
  stepsBeforeMeasure,
  stepsForMeasure,
  stepsInRange,
  videoTimeForPosition,
} from "./trainer-core.mjs";

type StringNumber = 1 | 2 | 3 | 4 | 5 | 6;

type TabEvent = {
  id: string;
  measure: number;
  tick: number;
  kind: "note" | "hold" | "rest";
  stringNo?: StringNumber;
  fret?: number;
  duration?: number;
};

type ScoreGlyph = {
  slot: number;
  symbols: Array<{ stringNo: StringNumber; text: string }>;
  technique?: "sl." | "H" | "full" | "harm." | "tie";
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function alternatingMeasure(measure: number): TabEvent[] {
  return [
    { id: `m${measure}-n1`, measure, tick: 0, kind: "note", stringNo: 4, fret: 9 },
    { id: `m${measure}-r1`, measure, tick: 1, kind: "rest" },
    { id: `m${measure}-n2`, measure, tick: 2, kind: "note", stringNo: 4, fret: 7 },
    { id: `m${measure}-r2`, measure, tick: 3, kind: "rest" },
    { id: `m${measure}-n3`, measure, tick: 4, kind: "note", stringNo: 5, fret: 9 },
    { id: `m${measure}-r3`, measure, tick: 5, kind: "rest" },
    { id: `m${measure}-n4`, measure, tick: 6, kind: "note", stringNo: 5, fret: 7 },
    { id: `m${measure}-n5`, measure, tick: 7, kind: "note", stringNo: 5, fret: 5, duration: 2 },
  ];
}

function answerMeasure(measure: number, middleFret: 5 | 9): TabEvent[] {
  return [
    { id: `m${measure}-h1`, measure, tick: 0, kind: "hold", stringNo: 5, fret: 5 },
    { id: `m${measure}-n1`, measure, tick: 1, kind: "note", stringNo: 5, fret: 7 },
    { id: `m${measure}-r1`, measure, tick: 2, kind: "rest" },
    { id: `m${measure}-n2`, measure, tick: 3, kind: "note", stringNo: 5, fret: middleFret, duration: 2 },
    { id: `m${measure}-n3`, measure, tick: 5, kind: "note", stringNo: 5, fret: 7 },
    { id: `m${measure}-n4`, measure, tick: 6, kind: "note", stringNo: 5, fret: 9 },
    { id: `m${measure}-n5`, measure, tick: 7, kind: "note", stringNo: 4, fret: 7 },
  ];
}

function chorusRun(measure: number): TabEvent[] {
  const notes: Array<[StringNumber, number]> = [
    [3, 12], [2, 10], [2, 13], [2, 10],
    [3, 12], [3, 10], [4, 12], [2, 10],
  ];
  return notes.map(([stringNo, fret], tick) => ({
    id: `m${measure}-n${tick + 1}`,
    measure,
    tick,
    kind: "note" as const,
    stringNo,
    fret,
    duration: tick === 7 ? 2 : 1,
  }));
}

function chorusAnswer(
  measure: number,
  variation: "high" | "low" | "ending",
): TabEvent[] {
  const holdString: StringNumber = variation === "low" ? 1 : 2;
  const middle: Array<[number, "note" | "rest", StringNumber?, number?, number?]> =
    variation === "high"
      ? [
          [1, "note", 2, 13], [2, "note", 1, 13], [3, "note", 1, 10, 2],
          [5, "note", 2, 13], [6, "note", 2, 10, 2],
        ]
      : variation === "low"
        ? [
            [1, "note", 1, 10], [2, "note", 1, 12], [3, "note", 1, 10, 2],
            [5, "note", 1, 10], [6, "note", 1, 10, 2],
          ]
        : [
            [1, "note", 2, 10], [2, "rest"], [3, "note", 2, 9, 2],
            [5, "note", 2, 9], [6, "note", 2, 9, 2],
          ];

  return [
    { id: `m${measure}-h1`, measure, tick: 0, kind: "hold", stringNo: holdString, fret: 10 },
    ...middle.map(([tick, kind, stringNo, fret, duration], index) => ({
      id: `m${measure}-${kind === "rest" ? "r" : "n"}${index + 1}`,
      measure,
      tick,
      kind,
      stringNo,
      fret,
      duration,
    })),
  ];
}

const TAB_EVENTS = ([
  { id: "m1-r1", measure: 1, tick: 0, kind: "rest", duration: 4 },
  { id: "m1-r2", measure: 1, tick: 4, kind: "rest" },
  { id: "m1-n1", measure: 1, tick: 5, kind: "note", stringNo: 5, fret: 7 },
  { id: "m1-n2", measure: 1, tick: 6, kind: "note", stringNo: 5, fret: 9 },
  { id: "m1-n3", measure: 1, tick: 7, kind: "note", stringNo: 4, fret: 7 },
  ...[2, 4, 6, 8, 10, 12, 14, 16].flatMap(alternatingMeasure),
  ...[3, 7, 11, 15].flatMap((measure) => answerMeasure(measure, 9)),
  ...[5, 9, 13].flatMap((measure) => answerMeasure(measure, 5)),
  { id: "m17-h1", measure: 17, tick: 0, kind: "hold", stringNo: 5, fret: 5 },
  { id: "m17-n1", measure: 17, tick: 1, kind: "note", stringNo: 5, fret: 7 },
  { id: "m17-r1", measure: 17, tick: 2, kind: "rest" },
  { id: "m17-n2", measure: 17, tick: 3, kind: "note", stringNo: 5, fret: 5, duration: 2 },
  { id: "m17-r2", measure: 17, tick: 5, kind: "rest", duration: 3 },
  ...[34, 36, 38, 40, 42, 44, 46, 48].flatMap(chorusRun),
  ...[35, 39, 43, 47].flatMap((measure) => chorusAnswer(measure, "high")),
  ...[37, 45].flatMap((measure) => chorusAnswer(measure, "low")),
  ...[41, 49].flatMap((measure) => chorusAnswer(measure, "ending")),
  ...alternatingMeasure(50),
  ...answerMeasure(51, 9),
  ...alternatingMeasure(52),
  ...answerMeasure(53, 5),
  ...alternatingMeasure(54),
  ...answerMeasure(55, 9),
  ...alternatingMeasure(56),
  { id: "m57-h1", measure: 57, tick: 0, kind: "hold", stringNo: 5, fret: 5 },
  { id: "m57-n1", measure: 57, tick: 1, kind: "note", stringNo: 5, fret: 7 },
  { id: "m57-r1", measure: 57, tick: 2, kind: "rest" },
  { id: "m57-n2", measure: 57, tick: 3, kind: "note", stringNo: 5, fret: 5, duration: 5 },
  ...[82, 84, 86, 88, 90, 92, 94, 96, 98, 100, 102].flatMap(chorusRun),
  ...[83, 87, 91, 95, 99].flatMap((measure) => chorusAnswer(measure, "high")),
  ...[85, 93, 101].flatMap((measure) => chorusAnswer(measure, "low")),
  ...[89, 97].flatMap((measure) => chorusAnswer(measure, "ending")),
  ...[104, 106, 108, 110, 112, 117, 119, 121, 123, 125, 127, 129, 131, 133, 135, 137, 139, 141].flatMap(chorusRun),
  ...[103, 107, 111, 118, 122, 126, 130, 134].flatMap((measure) => chorusAnswer(measure, "high")),
  ...[109, 120, 128, 136].flatMap((measure) => chorusAnswer(measure, "low")),
  ...[105, 113, 124, 132, 140].flatMap((measure) => chorusAnswer(measure, "ending")),
] as TabEvent[]).sort((left, right) => left.measure - right.measure || left.tick - right.tick);

const TECHNIQUE_MEASURES = [
  { measure: 66, sequence: "休・休 ｜ 7/7 ｜ ×/× → 7〜", focus: "2音同時とミュート" },
  { measure: 67, sequence: "(7) → 9 ｜ 休 ｜ ×× → 7 → 9", focus: "タイを残して再開" },
  { measure: 68, sequence: "休 ｜ ×× → 7 ｜ 休 ｜ 7 → 10 → 9〜", focus: "弦をまたぐ移動" },
  { measure: 69, sequence: "(9) → 7 ｜ 休 ｜ × → 7 → 9 → 7 → 10", focus: "上の弦へ駆け上がる" },
  { measure: 70, sequence: "×/× → 12/9 → ×/× → 10/7 → ×/× → 7/4 → 8/5 → 10/7", focus: "2音コードの平行移動" },
  { measure: 71, sequence: "(7) → 9 → × → 11 → × → 7 → 7 → ××", focus: "短いミュートを挟む" },
  { measure: 72, sequence: "× → × → 12 ｜ ×× → 12 → 10 → 12 → 11", focus: "16分のミュート" },
  { measure: 73, sequence: "休 → 7 → 9 → 7 → 9 sl.11→9 → 7", focus: "スライド" },
  { measure: 74, sequence: "7 → ××→7 → ××→7 → ××→12/11", focus: "ミュートの粒を揃える" },
  { measure: 75, sequence: "××→12/11 を反復 ｜ 12/11 → ××", focus: "2音カッティング" },
  { measure: 76, sequence: "7/7 → ××→7/7 → ××→7/7 → ××→7/7", focus: "2音カッティング" },
  { measure: 77, sequence: "休 ｜ ××→10/10 sl.12/12→10/10", focus: "2音スライド" },
  { measure: 78, sequence: "7/7 → ××→7/7 → ××→7 → 9 → 7 → 7", focus: "コードから単音へ" },
  { measure: 79, sequence: "休 → 12 → 10 → 12 → 10 → 12 full", focus: "1音ベンド" },
  { measure: 80, sequence: "10 → 休 → 10 H 12 → 10 → × → 7 → 9 → 7", focus: "ハンマリング" },
  { measure: 81, sequence: "10/7 → ××→10/7 → ××→10/7 → ××→10/7", focus: "2音カッティング" },
];

const BRIDGE_TECHNIQUE_MEASURES = [
  { measure: 114, sequence: "14/11 をアクセント付きで6回", focus: "2音同時" },
  { measure: 115, sequence: "休 → 12/9 → 12/9を伸ばす → 休", focus: "タイと休符" },
  { measure: 116, sequence: "休 → <5>/<5>/<5>/<5>", focus: "5フレット・ハーモニクス" },
];

const OUTRO_TECHNIQUE_MEASURES = [
  { measure: 142, sequence: "(10) → 12 → 10 → 12 → 10 → 13 → 13", focus: "弦移動" },
  { measure: 143, sequence: "10 → 13 → 12 → 13 → 12 sl.10 → 10 → 10〜", focus: "下降スライド" },
  { measure: 144, sequence: "(10) → 12 → 10 → 10 ｜ 休 → 10", focus: "休符を切る" },
  { measure: 145, sequence: "12 → 10 → 13 → 10 → 12 → 10 → 12 → 10〜", focus: "8分音符ラン" },
  { measure: 146, sequence: "(10) → 12 → 10 → 12 sl.14 → 13 → 17", focus: "上昇スライド" },
  { measure: 147, sequence: "15 → 13 → 12 → 13 → 12 → 13 → 12 → 13", focus: "高音ポジション" },
  { measure: 148, sequence: "休 → 13/10 ｜ 休 → 13/10 → 13/10 → 13/10", focus: "最後の2音フレーズ" },
];

const TECHNIQUE_GUIDES = [
  { kind: "mute", symbol: "×", title: "ミュート", measure: 66, range: "66〜81", move: "触れる → ピック", tip: "左手は押し込まず、弦に触れたまま乾いた音を出す" },
  { kind: "double", symbol: "7 / 7", title: "2音同時", measure: 66, range: "66・74〜78", move: "2本を同時に", tip: "数字が縦に並んだら、上下の弦を同じタイミングで鳴らす" },
  { kind: "slide", symbol: "10 sl. 12", title: "スライド", measure: 73, range: "73・77・143・146", move: "10 ───▶ 12", tip: "最初だけ弾き、押さえた圧を保ったまま指を滑らせる" },
  { kind: "hammer", symbol: "10 H 12", title: "ハンマリング", measure: 80, range: "80", move: "10 ⌒ 12", tip: "10を弾いた後、右手で弾き直さず12へ指を打ちつける" },
  { kind: "bend", symbol: "12 full", title: "1音ベンド", measure: 79, range: "79", move: "12 ↗ +2フレット分", tip: "弦を押し上げ、14フレットと同じ高さまで音程を上げる" },
  { kind: "harmonic", symbol: "<5>", title: "ハーモニクス", measure: 116, range: "116", move: "◇ 5 → すぐ離す", tip: "5フレットの真上に軽く触れ、弾いた直後に指を離す" },
] as const;

const TECHNIQUE_TAB_GLYPHS: Record<number, ScoreGlyph[]> = {
  66: [
    { slot: 8, symbols: [{ stringNo: 3, text: "7" }, { stringNo: 4, text: "7" }] },
    { slot: 12, symbols: [{ stringNo: 3, text: "×" }, { stringNo: 4, text: "×" }] },
    { slot: 14, symbols: [{ stringNo: 4, text: "7" }], technique: "tie" },
  ],
  67: [
    { slot: 0, symbols: [{ stringNo: 4, text: "(7)" }] },
    { slot: 2, symbols: [{ stringNo: 4, text: "9" }] },
    { slot: 8, symbols: [{ stringNo: 3, text: "×" }, { stringNo: 4, text: "×" }] },
    { slot: 10, symbols: [{ stringNo: 4, text: "7" }] },
    { slot: 14, symbols: [{ stringNo: 4, text: "9" }] },
  ],
  68: [
    { slot: 2, symbols: [{ stringNo: 3, text: "×" }, { stringNo: 4, text: "×" }] },
    { slot: 4, symbols: [{ stringNo: 4, text: "7" }] },
    { slot: 10, symbols: [{ stringNo: 4, text: "7" }] },
    { slot: 12, symbols: [{ stringNo: 3, text: "10" }] },
    { slot: 14, symbols: [{ stringNo: 3, text: "9" }], technique: "tie" },
  ],
  69: [
    { slot: 0, symbols: [{ stringNo: 3, text: "(9)" }] },
    { slot: 2, symbols: [{ stringNo: 3, text: "7" }] },
    { slot: 6, symbols: [{ stringNo: 3, text: "×" }] },
    { slot: 8, symbols: [{ stringNo: 3, text: "7" }] },
    { slot: 10, symbols: [{ stringNo: 3, text: "9" }] },
    { slot: 12, symbols: [{ stringNo: 2, text: "7" }] },
    { slot: 14, symbols: [{ stringNo: 2, text: "10" }] },
  ],
  70: [
    { slot: 0, symbols: [{ stringNo: 2, text: "×" }, { stringNo: 3, text: "×" }] },
    { slot: 2, symbols: [{ stringNo: 2, text: "12" }, { stringNo: 3, text: "9" }] },
    { slot: 4, symbols: [{ stringNo: 2, text: "×" }, { stringNo: 3, text: "×" }] },
    { slot: 6, symbols: [{ stringNo: 2, text: "10" }, { stringNo: 3, text: "7" }] },
    { slot: 8, symbols: [{ stringNo: 2, text: "×" }, { stringNo: 3, text: "×" }] },
    { slot: 10, symbols: [{ stringNo: 2, text: "7" }, { stringNo: 3, text: "4" }] },
    { slot: 12, symbols: [{ stringNo: 2, text: "8" }, { stringNo: 3, text: "5" }] },
    { slot: 14, symbols: [{ stringNo: 2, text: "10" }, { stringNo: 3, text: "7" }] },
  ],
  71: [
    { slot: 0, symbols: [{ stringNo: 3, text: "(7)" }] },
    { slot: 2, symbols: [{ stringNo: 3, text: "9" }] },
    { slot: 4, symbols: [{ stringNo: 3, text: "×" }] },
    { slot: 6, symbols: [{ stringNo: 3, text: "11" }] },
    { slot: 8, symbols: [{ stringNo: 3, text: "×" }] },
    { slot: 10, symbols: [{ stringNo: 3, text: "7" }] },
    { slot: 12, symbols: [{ stringNo: 3, text: "7" }] },
    { slot: 14, symbols: [{ stringNo: 3, text: "×" }] },
  ],
  72: [
    { slot: 0, symbols: [{ stringNo: 3, text: "×" }] },
    { slot: 2, symbols: [{ stringNo: 3, text: "×" }] },
    { slot: 4, symbols: [{ stringNo: 2, text: "12" }] },
    { slot: 6, symbols: [{ stringNo: 2, text: "×" }] },
    { slot: 7, symbols: [{ stringNo: 2, text: "×" }] },
    { slot: 8, symbols: [{ stringNo: 2, text: "12" }] },
    { slot: 10, symbols: [{ stringNo: 2, text: "10" }] },
    { slot: 12, symbols: [{ stringNo: 3, text: "12" }] },
    { slot: 14, symbols: [{ stringNo: 3, text: "11" }] },
  ],
  73: [
    { slot: 3, symbols: [{ stringNo: 3, text: "7" }] },
    { slot: 5, symbols: [{ stringNo: 3, text: "9" }] },
    { slot: 8, symbols: [{ stringNo: 2, text: "9" }] },
    { slot: 10, symbols: [{ stringNo: 2, text: "11" }], technique: "sl." },
    { slot: 12, symbols: [{ stringNo: 2, text: "9" }] },
    { slot: 14, symbols: [{ stringNo: 3, text: "7" }] },
  ],
  74: [
    { slot: 0, symbols: [{ stringNo: 3, text: "7" }] },
    { slot: 4, symbols: [{ stringNo: 3, text: "×" }] },
    { slot: 5, symbols: [{ stringNo: 3, text: "×" }] },
    { slot: 6, symbols: [{ stringNo: 3, text: "7" }] },
    { slot: 9, symbols: [{ stringNo: 3, text: "×" }] },
    { slot: 10, symbols: [{ stringNo: 3, text: "×" }] },
    { slot: 11, symbols: [{ stringNo: 3, text: "7" }] },
    { slot: 15, symbols: [{ stringNo: 2, text: "12" }, { stringNo: 3, text: "11" }] },
  ],
  75: [
    { slot: 0, symbols: [{ stringNo: 2, text: "×" }, { stringNo: 3, text: "×" }] },
    { slot: 1, symbols: [{ stringNo: 2, text: "×" }, { stringNo: 3, text: "×" }] },
    { slot: 2, symbols: [{ stringNo: 2, text: "12" }, { stringNo: 3, text: "11" }] },
    { slot: 5, symbols: [{ stringNo: 2, text: "×" }, { stringNo: 3, text: "×" }] },
    { slot: 6, symbols: [{ stringNo: 2, text: "×" }, { stringNo: 3, text: "×" }] },
    { slot: 7, symbols: [{ stringNo: 2, text: "12" }, { stringNo: 3, text: "11" }] },
    { slot: 10, symbols: [{ stringNo: 2, text: "12" }, { stringNo: 3, text: "11" }] },
  ],
  76: [
    { slot: 0, symbols: [{ stringNo: 3, text: "7" }, { stringNo: 4, text: "7" }] },
    { slot: 4, symbols: [{ stringNo: 3, text: "×" }, { stringNo: 4, text: "×" }] },
    { slot: 5, symbols: [{ stringNo: 3, text: "×" }, { stringNo: 4, text: "×" }] },
    { slot: 6, symbols: [{ stringNo: 3, text: "7" }, { stringNo: 4, text: "7" }] },
    { slot: 9, symbols: [{ stringNo: 3, text: "×" }, { stringNo: 4, text: "×" }] },
    { slot: 10, symbols: [{ stringNo: 3, text: "×" }, { stringNo: 4, text: "×" }] },
    { slot: 11, symbols: [{ stringNo: 3, text: "7" }, { stringNo: 4, text: "7" }] },
  ],
  77: [
    { slot: 8, symbols: [{ stringNo: 3, text: "×" }, { stringNo: 4, text: "×" }] },
    { slot: 9, symbols: [{ stringNo: 3, text: "×" }, { stringNo: 4, text: "×" }] },
    { slot: 10, symbols: [{ stringNo: 3, text: "10" }, { stringNo: 4, text: "10" }] },
    { slot: 11, symbols: [{ stringNo: 3, text: "12" }, { stringNo: 4, text: "12" }], technique: "sl." },
    { slot: 12, symbols: [{ stringNo: 3, text: "10" }, { stringNo: 4, text: "10" }] },
  ],
  78: [
    { slot: 0, symbols: [{ stringNo: 3, text: "7" }, { stringNo: 4, text: "7" }] },
    { slot: 4, symbols: [{ stringNo: 3, text: "×" }, { stringNo: 4, text: "×" }] },
    { slot: 5, symbols: [{ stringNo: 3, text: "×" }, { stringNo: 4, text: "×" }] },
    { slot: 6, symbols: [{ stringNo: 3, text: "7" }, { stringNo: 4, text: "7" }] },
    { slot: 10, symbols: [{ stringNo: 3, text: "7" }] },
    { slot: 12, symbols: [{ stringNo: 3, text: "9" }] },
    { slot: 14, symbols: [{ stringNo: 3, text: "7" }] },
  ],
  79: [
    { slot: 2, symbols: [{ stringNo: 2, text: "12" }] },
    { slot: 4, symbols: [{ stringNo: 1, text: "10" }] },
    { slot: 6, symbols: [{ stringNo: 1, text: "12" }] },
    { slot: 8, symbols: [{ stringNo: 1, text: "10" }] },
    { slot: 10, symbols: [{ stringNo: 1, text: "12" }], technique: "full" },
  ],
  80: [
    { slot: 0, symbols: [{ stringNo: 1, text: "10" }] },
    { slot: 6, symbols: [{ stringNo: 2, text: "10" }] },
    { slot: 7, symbols: [{ stringNo: 2, text: "12" }], technique: "H" },
    { slot: 8, symbols: [{ stringNo: 2, text: "10" }] },
    { slot: 10, symbols: [{ stringNo: 2, text: "×" }] },
    { slot: 11, symbols: [{ stringNo: 2, text: "7" }] },
    { slot: 13, symbols: [{ stringNo: 3, text: "9" }] },
    { slot: 15, symbols: [{ stringNo: 3, text: "7" }] },
  ],
  81: [
    { slot: 0, symbols: [{ stringNo: 1, text: "10" }, { stringNo: 2, text: "7" }] },
    { slot: 4, symbols: [{ stringNo: 1, text: "×" }, { stringNo: 2, text: "×" }] },
    { slot: 5, symbols: [{ stringNo: 1, text: "×" }, { stringNo: 2, text: "×" }] },
    { slot: 6, symbols: [{ stringNo: 1, text: "10" }, { stringNo: 2, text: "7" }] },
    { slot: 9, symbols: [{ stringNo: 1, text: "×" }, { stringNo: 2, text: "×" }] },
    { slot: 10, symbols: [{ stringNo: 1, text: "×" }, { stringNo: 2, text: "×" }] },
    { slot: 11, symbols: [{ stringNo: 1, text: "10" }, { stringNo: 2, text: "7" }] },
  ],
  114: [
    { slot: 0, symbols: [{ stringNo: 2, text: "14" }, { stringNo: 3, text: "11" }] },
    { slot: 4, symbols: [{ stringNo: 2, text: "14" }, { stringNo: 3, text: "11" }] },
    { slot: 8, symbols: [{ stringNo: 2, text: "14" }, { stringNo: 3, text: "11" }] },
    { slot: 10, symbols: [{ stringNo: 2, text: "14" }, { stringNo: 3, text: "11" }] },
    { slot: 12, symbols: [{ stringNo: 2, text: "14" }, { stringNo: 3, text: "11" }] },
    { slot: 14, symbols: [{ stringNo: 2, text: "14" }, { stringNo: 3, text: "11" }] },
  ],
  115: [
    { slot: 4, symbols: [{ stringNo: 2, text: "12" }, { stringNo: 3, text: "9" }] },
    { slot: 8, symbols: [{ stringNo: 2, text: "12" }, { stringNo: 3, text: "9" }], technique: "tie" },
  ],
  116: [
    { slot: 10, symbols: [{ stringNo: 1, text: "<5>" }, { stringNo: 2, text: "<5>" }, { stringNo: 3, text: "<5>" }, { stringNo: 4, text: "<5>" }], technique: "harm." },
  ],
  142: [
    { slot: 0, symbols: [{ stringNo: 3, text: "(10)" }] }, { slot: 2, symbols: [{ stringNo: 4, text: "12" }] },
    { slot: 4, symbols: [{ stringNo: 3, text: "10" }] }, { slot: 6, symbols: [{ stringNo: 3, text: "12" }] },
    { slot: 8, symbols: [{ stringNo: 2, text: "10" }] }, { slot: 10, symbols: [{ stringNo: 2, text: "13" }] },
    { slot: 12, symbols: [{ stringNo: 1, text: "13" }] },
  ],
  143: [
    { slot: 0, symbols: [{ stringNo: 1, text: "10" }] }, { slot: 2, symbols: [{ stringNo: 1, text: "13" }] },
    { slot: 4, symbols: [{ stringNo: 1, text: "12" }] }, { slot: 6, symbols: [{ stringNo: 2, text: "13" }] },
    { slot: 8, symbols: [{ stringNo: 3, text: "12" }] }, { slot: 10, symbols: [{ stringNo: 3, text: "10" }], technique: "sl." },
    { slot: 12, symbols: [{ stringNo: 3, text: "10" }] }, { slot: 14, symbols: [{ stringNo: 3, text: "10" }], technique: "tie" },
  ],
  144: [
    { slot: 0, symbols: [{ stringNo: 3, text: "(10)" }] }, { slot: 2, symbols: [{ stringNo: 3, text: "12" }] },
    { slot: 4, symbols: [{ stringNo: 2, text: "10" }] }, { slot: 6, symbols: [{ stringNo: 3, text: "10" }] },
    { slot: 14, symbols: [{ stringNo: 4, text: "10" }] },
  ],
  145: [
    { slot: 0, symbols: [{ stringNo: 3, text: "12" }] }, { slot: 2, symbols: [{ stringNo: 2, text: "10" }] },
    { slot: 4, symbols: [{ stringNo: 2, text: "13" }] }, { slot: 6, symbols: [{ stringNo: 2, text: "10" }] },
    { slot: 8, symbols: [{ stringNo: 3, text: "12" }] }, { slot: 10, symbols: [{ stringNo: 3, text: "10" }] },
    { slot: 12, symbols: [{ stringNo: 4, text: "12" }] }, { slot: 14, symbols: [{ stringNo: 2, text: "10" }], technique: "tie" },
  ],
  146: [
    { slot: 0, symbols: [{ stringNo: 2, text: "(10)" }] }, { slot: 2, symbols: [{ stringNo: 3, text: "12" }] },
    { slot: 4, symbols: [{ stringNo: 2, text: "10" }] }, { slot: 6, symbols: [{ stringNo: 2, text: "12" }] },
    { slot: 8, symbols: [{ stringNo: 2, text: "14" }], technique: "sl." }, { slot: 10, symbols: [{ stringNo: 2, text: "13" }] },
    { slot: 14, symbols: [{ stringNo: 1, text: "17" }] },
  ],
  147: [
    { slot: 0, symbols: [{ stringNo: 1, text: "15" }] }, { slot: 2, symbols: [{ stringNo: 1, text: "13" }] },
    { slot: 4, symbols: [{ stringNo: 1, text: "12" }] }, { slot: 6, symbols: [{ stringNo: 1, text: "13" }] },
    { slot: 8, symbols: [{ stringNo: 1, text: "12" }] }, { slot: 10, symbols: [{ stringNo: 2, text: "13" }] },
    { slot: 12, symbols: [{ stringNo: 2, text: "12" }] }, { slot: 14, symbols: [{ stringNo: 2, text: "13" }] },
  ],
  148: [
    { slot: 4, symbols: [{ stringNo: 1, text: "13" }, { stringNo: 3, text: "10" }] },
    { slot: 8, symbols: [{ stringNo: 1, text: "13" }, { stringNo: 3, text: "10" }] },
    { slot: 12, symbols: [{ stringNo: 1, text: "13" }, { stringNo: 3, text: "10" }] },
    { slot: 14, symbols: [{ stringNo: 1, text: "13" }, { stringNo: 3, text: "10" }] },
  ],
};

type SongId = "life-over" | "madow";
type TrackId = "lead" | "backing" | "third";

type TrackInfo = {
  label: string;
  badge: string;
  videoId: string;
  videoStartSeconds: number;
  videoStartLabel: string;
  description: string;
};

type SongDefinition = {
  title: string;
  artist: string;
  totalMeasures: number;
  originalBpm: number;
  capo: number;
  meterMap: Record<number, number>;
  map: SongPart[];
  defaultTrack: TrackId;
  tracks: Partial<Record<TrackId, TrackInfo>>;
};

type SongPart = {
  label: string;
  range: string;
  start: number;
  end: number;
  kind: "notes" | "rest" | "technique";
};

function scorePages(totalMeasures: number) {
  return Array.from({ length: Math.ceil(totalMeasures / 4) }, (_, page) => {
    const start = page * 4 + 1;
    const end = Math.min(totalMeasures, start + 3);
    return { start, end, measures: Array.from({ length: end - start + 1 }, (__, index) => start + index) };
  });
}

const LIFE_OVER_SONG_MAP: SongPart[] = [
  { label: "イントロ", range: "1–17", start: 1, end: 17, kind: "notes" },
  { label: "Aメロ", range: "18–25", start: 18, end: 25, kind: "rest" },
  { label: "Bメロ", range: "26–33", start: 26, end: 33, kind: "rest" },
  { label: "サビ", range: "34–49", start: 34, end: 49, kind: "notes" },
  { label: "間奏", range: "50–57", start: 50, end: 57, kind: "notes" },
  { label: "2番Aメロ", range: "58–65", start: 58, end: 65, kind: "rest" },
  { label: "2番Bメロ", range: "66–81", start: 66, end: 81, kind: "technique" },
  { label: "2番サビ", range: "82–113", start: 82, end: 113, kind: "notes" },
  { label: "ブレイク", range: "114–116", start: 114, end: 116, kind: "technique" },
  { label: "大サビ", range: "117–141", start: 117, end: 141, kind: "notes" },
  { label: "アウトロ", range: "142–148", start: 142, end: 148, kind: "technique" },
  { label: "エンド", range: "149–151", start: 149, end: 151, kind: "rest" },
];

const LIFE_OVER_NOTES = TAB_EVENTS.filter(
  (event): event is TabEvent & { stringNo: StringNumber; fret: number } =>
    event.kind === "note" && event.stringNo !== undefined && event.fret !== undefined,
);

type BackingFret = number | "×" | `<${number}>` | null;

function backingChord(frets: BackingFret[], slots: number[] = [0, 4, 6, 10, 12, 14]): ScoreGlyph[] {
  return slots.map((slot) => ({
    slot,
    symbols: frets.flatMap((fret, index) => fret === null
      ? []
      : [{ stringNo: (index + 1) as StringNumber, text: String(fret) }]),
  }));
}

function backingDyad(fret: number, slots = Array.from({ length: 16 }, (_, slot) => slot)): ScoreGlyph[] {
  return backingChord([null, null, null, fret, fret, null], slots);
}

function backingArpeggio(measure: number, high = false): ScoreGlyph[] {
  const lowPattern: Array<[StringNumber, number]> = [[6, 0], [5, 2], [4, 2], [3, 0], [2, 3], [1, 3], [2, 3], [3, 0]];
  const highPattern: Array<[StringNumber, number]> = [[4, 10], [3, 12], [2, 10], [2, 13], [1, 12], [2, 10], [3, 12], [4, 10]];
  return (high ? highPattern : lowPattern).map(([stringNo, fret], index) => ({
    slot: index * 2,
    symbols: [{ stringNo, text: String(fret + (measure % 2 === 0 && high ? 2 : 0)) }],
  }));
}

function buildMadowBackingTab() {
  const tab: Record<number, ScoreGlyph[]> = {};
  const openChord: BackingFret[] = [0, 0, 0, 0, 2, 0];
  const voicingA: BackingFret[] = [2, 3, 2, 4, 2, null];
  const voicingB: BackingFret[] = [3, 5, 4, 5, 3, null];
  const voicingC: BackingFret[] = [3, 3, 0, 0, 2, 3];
  const voicingD: BackingFret[] = [5, 5, 4, 5, 4, null];
  const voicingE: BackingFret[] = [2, 0, 2, 2, 0, null];
  const pulseCycle = [voicingA, openChord, voicingC, voicingB, voicingD, voicingE];

  for (let measure = 1; measure <= 6; measure += 1) tab[measure] = backingChord(openChord, [0]);
  tab[7] = backingDyad(4);
  tab[8] = backingDyad(7);
  for (let measure = 9; measure <= 14; measure += 1) tab[measure] = backingChord([null, null, null, null, null, 0], [0, 2, 4, 6, 8, 10, 12, 14]);
  tab[15] = backingDyad(4);
  tab[16] = backingDyad(7);
  tab[17] = [...backingChord(voicingB, [0, 8]), ...backingChord(["×", "×", "×", "×", "×", "×"], [14])];
  tab[18] = [];

  for (let measure = 19; measure <= 42; measure += 1) {
    const phase = (measure - 19) % 4;
    tab[measure] = phase === 1 || phase === 3
      ? []
      : backingChord(phase === 0 ? voicingA : openChord, phase === 0 ? [0, 8] : [8, 10, 12, 14]);
  }

  for (let measure = 43; measure <= 76; measure += 1) {
    tab[measure] = backingChord(pulseCycle[(measure - 43) % pulseCycle.length]);
  }
  for (let measure = 77; measure <= 84; measure += 1) {
    tab[measure] = backingChord(pulseCycle[(measure - 77) % pulseCycle.length], [0, 8]);
  }
  for (let measure = 85; measure <= 92; measure += 1) {
    tab[measure] = [
      ...backingChord(pulseCycle[(measure - 85) % pulseCycle.length], [0, 4, 8, 12]),
      ...backingChord(["×", "×", "×", "×", "×", "×"], [2, 6, 10, 14]),
    ];
  }
  for (let measure = 93; measure <= 100; measure += 1) tab[measure] = backingArpeggio(measure);
  for (let measure = 101; measure <= 124; measure += 1) tab[measure] = backingChord(pulseCycle[(measure - 101) % pulseCycle.length]);
  for (let measure = 125; measure <= 134; measure += 1) tab[measure] = backingChord(pulseCycle[(measure - 125) % pulseCycle.length], [0, 8]);
  for (let measure = 135; measure <= 146; measure += 1) tab[measure] = backingChord(pulseCycle[(measure - 135) % pulseCycle.length]);
  for (let measure = 147; measure <= 163; measure += 1) tab[measure] = backingArpeggio(measure, true);
  for (let measure = 164; measure <= 191; measure += 1) tab[measure] = backingChord(pulseCycle[(measure - 164) % pulseCycle.length]);
  for (let measure = 192; measure <= 201; measure += 1) {
    tab[measure] = measure % 2 === 0
      ? backingChord(pulseCycle[(measure - 192) % pulseCycle.length], [0, 4, 8, 12])
      : backingChord(["×", "×", "×", "×", "×", "×"], [2, 6, 10, 14]);
  }
  tab[202] = backingChord(["<7>", "<7>", "<7>", "<7>", "<7>", null], [0]);
  tab[203] = [];
  tab[204] = backingChord(openChord, [0]);
  tab[205] = backingDyad(4);
  tab[206] = backingDyad(7);
  tab[207] = [];
  return tab;
}

const MADOW_TAB_GLYPHS = buildMadowBackingTab();

function singleNoteRun(notes: Array<[StringNumber, number | string]>, slots?: number[]): ScoreGlyph[] {
  return notes.map(([stringNo, fret], index) => ({
    slot: slots?.[index] ?? Math.min(15, index * 2),
    symbols: [{ stringNo, text: String(fret) }],
  }));
}

function buildLifeBackingTab() {
  const tab: Record<number, ScoreGlyph[]> = {};
  const voicing2: BackingFret[] = [2, 3, 2, null, 2, 2];
  const voicing3: BackingFret[] = [3, 2, 0, null, 2, 3];
  const voicing4: BackingFret[] = [4, 4, 4, null, 4, 4];
  const voicing5: BackingFret[] = [5, 4, null, 4, 4, null];
  const open2: BackingFret[] = [3, 2, 0, 2, null, 3];
  const introCycle = [voicing4, voicing4, voicing5, voicing2];
  const chorusCycle = [voicing3, [3, 2, 0, 2, null, 3] as BackingFret[], [3, 2, 0, null, 3, 3] as BackingFret[], open2];

  tab[1] = [];
  for (let measure = 2; measure <= 33; measure += 1) {
    if ([10, 19, 31, 33].includes(measure)) tab[measure] = [];
    else tab[measure] = backingChord(introCycle[(measure - 2) % introCycle.length], [0, 4, 8, 12, 14]);
  }
  for (let measure = 34; measure <= 49; measure += 1) {
    tab[measure] = backingChord(chorusCycle[(measure - 34) % chorusCycle.length], [0, 4, 6, 10, 12, 14]);
  }
  for (let measure = 50; measure <= 58; measure += 1) {
    tab[measure] = backingChord(introCycle[(measure - 50) % introCycle.length], [0, 4, 8, 12, 14]);
  }
  for (let measure = 59; measure <= 65; measure += 1) {
    tab[measure] = measure % 2 === 1 ? [] : backingChord(voicing5, [8, 10, 12, 14]);
  }
  for (let measure = 66; measure <= 81; measure += 1) {
    tab[measure] = measure % 2 === 1
      ? []
      : backingChord(measure % 4 === 0 ? voicing2 : voicing4, [0, 6, 10, 12, 14]);
  }
  for (let measure = 82; measure <= 97; measure += 1) {
    tab[measure] = backingChord(chorusCycle[(measure - 82) % chorusCycle.length], [0, 4, 6, 10, 12, 14]);
  }
  for (let measure = 98; measure <= 113; measure += 1) {
    const slideMeasure = measure % 2 === 0;
    tab[measure] = slideMeasure
      ? singleNoteRun([[3, 2], [3, 4], [3, 2], [3, 4], [3, 2], [3, 4], [3, 2], [3, 4]])
          .map((glyph, index) => ({ ...glyph, technique: index % 2 === 0 ? "sl." : undefined }))
      : singleNoteRun([[3, 4], [3, 4], [3, 5], [3, 4], [3, 0], [3, 2], [3, 0]]);
  }
  for (let measure = 114; measure <= 119; measure += 1) {
    tab[measure] = measure === 116
      ? []
      : backingChord(measure % 2 === 0 ? voicing2 : voicing3, [0, 6, 10, 12, 14]);
  }
  for (let measure = 120; measure <= 148; measure += 1) {
    tab[measure] = backingChord(chorusCycle[(measure - 120) % chorusCycle.length], [0, 4, 6, 10, 12, 14]);
  }
  tab[149] = backingChord(voicing3, [0, 6, 10, 12, 14]);
  tab[150] = [];
  tab[151] = [];
  return tab;
}

function buildMadowLeadTab() {
  const tab: Record<number, ScoreGlyph[]> = {};
  const melodicA: Array<[StringNumber, number]> = [[3, 12], [2, 10], [2, 13], [2, 10], [3, 12], [3, 10], [4, 12], [2, 10]];
  const melodicB: Array<[StringNumber, number]> = [[2, 10], [2, 13], [1, 13], [1, 10], [2, 13], [2, 10], [3, 12], [2, 10]];
  const bassRun: Array<[StringNumber, number]> = [[6, 3], [6, 0], [6, 2], [6, 4], [5, 5], [5, 7], [5, 8], [5, 10]];
  const dyadChug = (root: number, slots = [0, 2, 4, 6, 8, 10, 12, 14]) => backingChord(
    [null, null, root + 3, root, null, null],
    slots,
  );

  for (let measure = 1; measure <= 4; measure += 1) tab[measure] = [];
  tab[5] = backingChord(["<7>", "<7>", "<7>", "<7>", null, null], [0]);
  tab[6] = [];
  for (let measure = 7; measure <= 16; measure += 1) tab[measure] = dyadChug(measure % 2 === 0 ? 7 : 4);
  tab[17] = [...dyadChug(7, [0, 4, 8, 12]), ...backingChord(["×", "×", "×", "×", null, null], [14])];
  tab[18] = [];
  for (let measure = 19; measure <= 40; measure += 1) {
    tab[measure] = singleNoteRun((measure % 2 === 0 ? melodicB : melodicA).map(([stringNo, fret]) => [stringNo, fret]));
  }
  for (let measure = 41; measure <= 50; measure += 1) tab[measure] = dyadChug(measure % 2 === 0 ? 10 : 12);
  for (let measure = 51; measure <= 54; measure += 1) tab[measure] = singleNoteRun(bassRun);
  for (let measure = 55; measure <= 58; measure += 1) tab[measure] = dyadChug(measure % 2 === 0 ? 7 : 9);
  for (let measure = 59; measure <= 66; measure += 1) tab[measure] = singleNoteRun(measure % 2 === 0 ? melodicA : melodicB);
  for (let measure = 67; measure <= 76; measure += 1) tab[measure] = dyadChug(measure % 3 === 0 ? 12 : 9);
  for (let measure = 77; measure <= 83; measure += 1) tab[measure] = [];
  tab[84] = backingChord(["<7>", "<7>", "<7>", "<7>", null, null], [0]);
  for (let measure = 85; measure <= 98; measure += 1) tab[measure] = singleNoteRun(measure % 2 === 0 ? melodicB : melodicA);
  for (let measure = 99; measure <= 108; measure += 1) tab[measure] = dyadChug(measure % 2 === 0 ? 10 : 12);
  for (let measure = 109; measure <= 112; measure += 1) tab[measure] = singleNoteRun(bassRun);
  for (let measure = 113; measure <= 119; measure += 1) tab[measure] = dyadChug(measure % 2 === 0 ? 7 : 9);
  tab[120] = [];
  tab[121] = backingChord([0, 0, 0, 0, 2, 0], [0]);
  tab[122] = backingChord([2, 3, 2, 4, 2, null], [0, 8]);
  for (let measure = 123; measure <= 126; measure += 1) {
    tab[measure] = singleNoteRun([[2, 7], [2, 9], [2, 10], [2, 12], [2, 15], [2, 17]], [0, 2, 4, 6, 10, 14])
      .map((glyph) => ({ ...glyph, technique: "full" }));
  }
  for (let measure = 127; measure <= 146; measure += 1) {
    tab[measure] = measure % 4 === 0
      ? backingChord(["<12>", "<12>", "<12>", null, null, null], [0])
      : singleNoteRun(measure % 2 === 0 ? melodicB : melodicA);
  }
  for (let measure = 147; measure <= 190; measure += 1) {
    tab[measure] = dyadChug([3, 9, 10, 12, 14][measure % 5]);
  }
  for (let measure = 191; measure <= 196; measure += 1) tab[measure] = singleNoteRun(measure % 2 === 0 ? melodicA : melodicB);
  for (let measure = 197; measure <= 203; measure += 1) {
    tab[measure] = singleNoteRun([[2, 12], [2, 15], [2, 14], [2, 17], [2, 15], [2, 18]], [0, 2, 6, 8, 12, 14])
      .map((glyph, index) => ({ ...glyph, technique: index % 2 === 0 ? "full" : "vib." }));
  }
  tab[204] = backingChord([0, 0, 0, 0, 2, 0], [0]);
  tab[205] = singleNoteRun([[2, 7], [2, 9], [2, 7], [2, 9], [2, 7], [2, 9], [2, 7], [2, 9]])
    .map((glyph) => ({ ...glyph, technique: "full" }));
  tab[206] = singleNoteRun([[2, 8], [2, 10], [2, 8], [2, 10], [2, 10], [2, 12], [2, 10], [2, 12]])
    .map((glyph) => ({ ...glyph, technique: "full" }));
  tab[207] = [];
  return tab;
}

const LIFE_BACKING_TAB_GLYPHS = buildLifeBackingTab();
const MADOW_LEAD_TAB_GLYPHS = buildMadowLeadTab();

function notesFromGlyphs(glyphMap: Record<number, ScoreGlyph[]>, prefix: string) {
  return Object.entries(glyphMap).flatMap(([measureText, glyphs]) => {
  const measure = Number(measureText);
  return glyphs.flatMap((glyph, glyphIndex) => {
    const root = [...glyph.symbols]
      .reverse()
      .map((symbol) => ({ symbol, fret: parseFretSymbol(symbol.text) }))
      .find((item) => item.fret !== null);
    return root?.fret === null || !root
      ? []
      : [{
          id: `${prefix}-m${measure}-g${glyphIndex}`,
          measure,
          tick: glyph.slot / 2,
          kind: "note" as const,
          stringNo: root.symbol.stringNo,
          fret: root.fret,
          duration: 1,
        }];
  });
  });
}

const LIFE_BACKING_NOTES = notesFromGlyphs(LIFE_BACKING_TAB_GLYPHS, "life-backing");
const MADOW_BACKING_NOTES = notesFromGlyphs(MADOW_TAB_GLYPHS, "madow-backing");
const MADOW_LEAD_NOTES = notesFromGlyphs(MADOW_LEAD_TAB_GLYPHS, "madow-lead");

const MADOW_SONG_MAP: SongPart[] = [
  { label: "イントロ", range: "1–18", start: 1, end: 18, kind: "notes" },
  { label: "Aメロ", range: "19–42", start: 19, end: 42, kind: "notes" },
  { label: "Bメロ", range: "43–76", start: 43, end: 76, kind: "notes" },
  { label: "サビ", range: "77–100", start: 77, end: 100, kind: "technique" },
  { label: "間奏", range: "101–124", start: 101, end: 124, kind: "notes" },
  { label: "2番Aメロ", range: "125–146", start: 125, end: 146, kind: "notes" },
  { label: "2番Bメロ", range: "147–163", start: 147, end: 163, kind: "technique" },
  { label: "2番サビ", range: "164–191", start: 164, end: 191, kind: "notes" },
  { label: "アウトロ", range: "192–207", start: 192, end: 207, kind: "technique" },
];

const SONGS: Record<SongId, SongDefinition> = {
  "life-over": {
    title: "人生オーバー",
    artist: "harha Guitar TAB",
    totalMeasures: 151,
    originalBpm: 170,
    capo: 3,
    meterMap: {},
    map: LIFE_OVER_SONG_MAP,
    defaultTrack: "lead",
    tracks: {
      lead: {
        label: "リードギター",
        badge: "LEAD",
        videoId: "6LfUfHSIiMw",
        videoStartSeconds: 215,
        videoStartLabel: "TAB 3:35",
        description: "貼ってもらったTABを1つのデータ譜に統合。6本の線・数字・拍・奏法記号を描画し、同じデータを連続再生にも使います。",
      },
      backing: {
        label: "バッキングギター",
        badge: "BACKING",
        videoId: "6LfUfHSIiMw",
        videoStartSeconds: 215,
        videoStartLabel: "TAB 3:35",
        description: "同じ動画の上段を区間ごとに照合した練習用バッキングTAB。小節位置はリードと共通なので、切り替えても同じ位置を保ちます。",
      },
      third: {
        label: "追加ギター（中央段）",
        badge: "GUITAR 3",
        videoId: "6LfUfHSIiMw",
        videoStartSeconds: 215,
        videoStartLabel: "TAB 3:35",
        description: "原動画の中央段に譜面が現れる区間だけを抽出した第3ギターTAB。空の小節は休みとしてそのまま残します。",
      },
    },
  },
  madow: {
    title: "惑う星",
    artist: "結束バンド · JINZO-TABS",
    totalMeasures: 207,
    originalBpm: 194,
    capo: 0,
    meterMap: {
      18: 6,
      117: 5,
      118: 5,
      119: 5,
      120: 6,
      121: 5,
      122: 5,
      123: 5,
      124: 6,
    },
    map: MADOW_SONG_MAP,
    defaultTrack: "backing",
    tracks: {
      lead: {
        label: "リードギター",
        badge: "LEAD",
        videoId: "85ORTRtwmF4",
        videoStartSeconds: 1.2,
        videoStartLabel: "TAB 約0:01",
        description: "送ってもらったリード動画を全207小節ぶんフレーム抽出し、6本の弦・フレット・奏法記号を読んだデータ譜です。表示・連続再生・判定はすべてこの同じデータを使います。",
      },
      backing: {
        label: "リズムギター（バッキング）",
        badge: "BACKING",
        videoId: "vPexB7CEMGY",
        videoStartSeconds: 1,
        videoStartLabel: "TAB 約0:01",
        description: "バッキング動画を全207小節ぶんフレーム抽出して作ったリズムギターTABです。コードの縦積みも弦ごとに保持し、リードと同じ小節位置のまま切り替えられます。",
      },
    },
  },
};

function trackFor(song: SongDefinition, trackId: TrackId): TrackInfo {
  return song.tracks[trackId] ?? song.tracks[song.defaultTrack]!;
}

type PlaybackEvent = {
  measure: number;
  step: number;
  stringNo: StringNumber;
  fret: number;
  durationSteps: number;
  sustain?: boolean;
  noteId?: string;
};

type PlaybackSession = {
  startMeasure: number;
  endMeasure: number;
  label: string;
  bpm: number;
  positionSteps: number;
  scheduledAt: number;
};

type PlaybackPreset = "page" | "section" | "full" | "remaining" | "loop";

function parseFretSymbol(text: string) {
  if (text.includes("×") || text.startsWith("(")) return null;
  const match = text.match(/\d+/);
  if (!match) return null;
  const fret = Number(match[0]);
  return Number.isInteger(fret) && fret >= 0 && fret <= 24 ? fret : null;
}

type AuditedTabData = Record<SongId, Partial<Record<TrackId, Record<string, ScoreGlyph[]>>>>;
const AUDITED_TAB_DATA = tabAuditData as AuditedTabData;
const AUDIT_REVIEW_MEASURES = new Set<string>();
const MADOW_NATIVE_FRAME_CONFIRMED = new Set<string>([
  ...[7, 57, 73, 93, 149, 184, 200, 201, 202, 204, 207].map((measure) => `madow:lead:${measure}`),
  ...[78, 79, 138, 143, 146, 147, 171, 176].map((measure) => `madow:backing:${measure}`),
]);
const MADOW_NEEDS_REVIEW = new Set<string>([
  ...[2, 3, 17, 18, 22, 26, 40, 60, 64, 68, 76, 77, 78, 79, 80, 81, 82,
    97, 110, 113, 114, 115, 119, 120, 121, 122, 124, 129, 133, 137, 141,
    144, 148, 158, 165, 171, 183, 196, 197, 203].map((measure) => `madow:lead:${measure}`),
  ...[2, 3, 4, 5, 6, 8, 9, 11, 12, 14, 16, 20, 22, 24, 26, 28, 30, 32,
    34, 39, 40, 56, 67, 68, 80, 82, 85, 87, 88, 90, 91, 97, 117, 118, 119,
    120, 121, 130, 140, 141, 142, 144, 145, 149, 158, 197, 199, 200, 202,
    204, 206, 207].map((measure) => `madow:backing:${measure}`),
]);

function auditedGlyphRecord(songId: SongId, trackId: TrackId) {
  const source = AUDITED_TAB_DATA[songId]?.[trackId] ?? {};
  return Object.fromEntries(Object.entries(source).map(([measure, glyphs]) => {
    const timedGlyphs = songId === "life-over" && trackId === "lead"
      ? normalizeLifeOverLeadEighthRun(glyphs)
      : glyphs;
    const safeGlyphs = timedGlyphs.map((glyph) => ({
      ...glyph,
      symbols: glyph.symbols.map((symbol) => {
        const numeric = symbol.text.replace(/[^0-9]/g, "");
        if (!numeric || Number(numeric) <= 24) return symbol;
        AUDIT_REVIEW_MEASURES.add(`${songId}:${trackId}:${measure}`);
        return { ...symbol, text: "?" };
      }),
    }));
    return [Number(measure), safeGlyphs];
  })) as Record<number, ScoreGlyph[]>;
}

const AUDITED_GLYPHS: Record<SongId, Partial<Record<TrackId, Record<number, ScoreGlyph[]>>>> = {
  "life-over": {
    lead: auditedGlyphRecord("life-over", "lead"),
    backing: auditedGlyphRecord("life-over", "backing"),
    third: auditedGlyphRecord("life-over", "third"),
  },
  madow: {
    lead: auditedGlyphRecord("madow", "lead"),
    backing: auditedGlyphRecord("madow", "backing"),
  },
};

const AUDITED_NOTES: Record<SongId, Partial<Record<TrackId, ReturnType<typeof notesFromGlyphs>>>> = {
  "life-over": {
    lead: notesFromGlyphs(AUDITED_GLYPHS["life-over"].lead!, "life-lead-audit"),
    backing: notesFromGlyphs(AUDITED_GLYPHS["life-over"].backing!, "life-backing-audit"),
    third: notesFromGlyphs(AUDITED_GLYPHS["life-over"].third!, "life-third-audit"),
  },
  madow: {
    lead: notesFromGlyphs(AUDITED_GLYPHS.madow.lead!, "madow-lead-audit"),
    backing: notesFromGlyphs(AUDITED_GLYPHS.madow.backing!, "madow-backing-audit"),
  },
};

function glyphsForTrack(songId: SongId, trackId: TrackId, measure: number) {
  return AUDITED_GLYPHS[songId]?.[trackId]?.[measure] ?? [];
}

function notesForTrack(songId: SongId, trackId: TrackId) {
  return AUDITED_NOTES[songId]?.[trackId] ?? [];
}

function scoreAuditStatus(songId: SongId, trackId: TrackId, measure: number) {
  const glyphs = AUDITED_GLYPHS[songId]?.[trackId]?.[measure] ?? [];
  const auditKey = `${songId}:${trackId}:${measure}`;
  if (MADOW_NATIVE_FRAME_CONFIRMED.has(auditKey)) {
    return { label: "1920×1080原動画で目視確認", tone: "verified" as const };
  }
  if (AUDIT_REVIEW_MEASURES.has(auditKey) || MADOW_NEEDS_REVIEW.has(auditKey)) {
    return { label: "数字を動画で要確認", tone: "review" as const };
  }
  if (songId === "madow") {
    return glyphs.length > 0
      ? { label: "高解像度OCR転記・未目視", tone: "review" as const }
      : { label: "譜面未転記・要確認", tone: "review" as const };
  }
  return glyphs.length > 0
    ? { label: "原動画フレーム読取", tone: "verified" as const }
    : { label: "原動画上で休み", tone: "rest" as const };
}

function scorePlaybackEvents(songId: SongId, trackId: TrackId, measure: number): PlaybackEvent[] {
  const glyphs = glyphsForTrack(songId, trackId, measure);
  if (glyphs) {
    const measureSteps = stepsForMeasure(measure, SONGS[songId].meterMap);
    const baseEvents = glyphs.flatMap((glyph) => {
      if (glyph.technique === "tie") return [];
      return glyph.symbols.flatMap((symbol) => {
        const fret = parseFretSymbol(symbol.text);
        return fret === null
          ? []
          : [{
              measure,
              step: Math.round((glyph.slot / 16) * measureSteps),
              stringNo: symbol.stringNo,
              fret,
              durationSteps: 2,
            }];
      });
    });
    const nextMeasure = measure + 1;
    const nextGlyphs = glyphsForTrack(songId, trackId, nextMeasure);
    const nextMeasureSteps = stepsForMeasure(nextMeasure, SONGS[songId].meterMap);
    return baseEvents.map((event) => {
      const hasLaterMatchingAttack = baseEvents.some((candidate) => (
        candidate.step > event.step
        && candidate.stringNo === event.stringNo
        && candidate.fret === event.fret
      ));
      if (hasLaterMatchingAttack) return event;

      const extension = extendDurationThroughNextMeasureTie({
        baseDurationSteps: event.durationSteps,
        currentMeasureSteps: measureSteps,
        eventStep: event.step,
        stringNo: event.stringNo,
        fret: event.fret,
        nextMeasureSteps,
        nextGlyphs,
      });
      return { ...event, ...extension };
    });
  }

  if (songId !== "life-over" || trackId !== "lead") return [];

  return LIFE_OVER_NOTES
    .filter((note) => note.measure === measure)
    .map((note) => ({
      measure,
      step: note.tick * 2,
      stringNo: note.stringNo,
      fret: note.fret,
      durationSteps: (note.duration ?? 1) * 2,
      noteId: note.id,
    }));
}

function videoTimeForMeasure(song: SongDefinition, track: TrackInfo, measure: number) {
  return Math.round(videoTimeForPosition(track.videoStartSeconds, song.originalBpm, measure, 0, song.meterMap));
}

function formatClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function rangeDuration(startMeasure: number, endMeasure: number, bpm: number, meterMap: Record<number, number>) {
  return formatClock((stepsInRange(startMeasure, endMeasure, meterMap) * 15) / bpm);
}

const STRING_RANGE: StringNumber[] = [1, 2, 3, 4, 5, 6];

function fingerHint(fret: number) {
  if (fret === 0) return "開放弦。左手は触れず、隣の弦を鳴らさないように弾く";
  if (fret <= 4) return "人差し指を基準にして、フレットのすぐ左を押さえる";
  if (fret === 5) return "人差し指。ここで手を少し左へ移動";
  if (fret === 7) return "人差し指か中指。力まずフレットのすぐ左を押さえる";
  if (fret === 9) return "薬指か小指。7フレットの指はなるべく残す";
  if (fret === 10) return "人差し指。サビはここを基準位置にする";
  if (fret === 12) return "薬指。10フレットの人差し指を残すと安定する";
  return "小指。10フレットを人差し指で押さえたまま届かせる";
}

function stringDescription(stringNo: StringNumber) {
  if (stringNo === 5) return "太い方から2本目";
  if (stringNo === 4) return "太い方から3本目";
  return `${stringNo}弦`;
}


function noteName(frequency: number) {
  const names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function nearestPitch(frequency: number) {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const targetFrequency = 440 * 2 ** ((midi - 69) / 12);
  return {
    name: noteName(targetFrequency),
    frequency: targetFrequency,
    cents: centsBetween(frequency, targetFrequency),
  };
}

const TUNER_STRINGS = [
  { stringNo: 6 as const, label: "6弦", name: "E2", frequency: 82.41 },
  { stringNo: 5 as const, label: "5弦", name: "A2", frequency: 110 },
  { stringNo: 4 as const, label: "4弦", name: "D3", frequency: 146.83 },
  { stringNo: 3 as const, label: "3弦", name: "G3", frequency: 196 },
  { stringNo: 2 as const, label: "2弦", name: "B3", frequency: 246.94 },
  { stringNo: 1 as const, label: "1弦", name: "E4", frequency: 329.63 },
] as const;

function TabMeasure({
  measure,
  currentId,
  learnedIds,
  onSelect,
}: {
  measure: number;
  currentId: string;
  learnedIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const events = TAB_EVENTS.filter((event) => event.measure === measure);

  return (
    <section className="overflow-hidden rounded-xl border border-stone-700 bg-stone-900" aria-label={`${measure}小節目`}>
      <div className="flex items-center justify-between border-b border-stone-700 px-4 py-2">
        <p className="text-sm font-bold tabular-nums">MEASURE {String(measure).padStart(2, "0")}</p>
        <p className="text-xs text-stone-400">4 / 4</p>
      </div>
      <div className="tab-measure">
        {STRING_RANGE.map((stringNo) => (
          <div
            className="tab-string-line"
            key={`line-${measure}-${stringNo}`}
            style={{ gridRow: stringNo }}
            aria-hidden="true"
          />
        ))}
        {events.map((event) => {
          const style = {
            gridColumn: `${event.tick * 2 + 1}`,
            gridRow: event.stringNo ?? 3,
          };
          if (event.kind === "rest") {
            return (
              <span className="tab-symbol tab-rest" key={event.id} style={style} aria-label="休符">
                休
              </span>
            );
          }
          if (event.kind === "hold") {
            return (
              <span className="tab-symbol" key={event.id} style={style} aria-label="前の音を伸ばす">
                ({event.fret})
              </span>
            );
          }
          return (
            <button
              className="tab-symbol"
              data-current={event.id === currentId}
              data-learned={learnedIds.has(event.id)}
              key={event.id}
              style={style}
              onClick={() => onSelect(event.id)}
              aria-label={`${measure}小節、${event.stringNo}弦${event.fret}フレット`}
            >
              {event.fret}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-8 border-t border-stone-800 px-2 py-2 text-center text-[0.65rem] font-bold text-stone-500" aria-hidden="true">
        {['1', '＆', '2', '＆', '3', '＆', '4', '＆'].map((beat, index) => <span key={`${measure}-beat-${index}`}>{beat}</span>)}
      </div>
    </section>
  );
}

function TechniqueTabMeasure({ measure }: { measure: number }) {
  const glyphs = TECHNIQUE_TAB_GLYPHS[measure] ?? [];
  const description = [...TECHNIQUE_MEASURES, ...BRIDGE_TECHNIQUE_MEASURES, ...OUTRO_TECHNIQUE_MEASURES]
    .find((item) => item.measure === measure);

  return (
    <section className="overflow-hidden rounded-xl border border-amber-700/70 bg-stone-900" aria-label={`${measure}小節目、特殊奏法`}>
      <div className="flex items-center justify-between border-b border-stone-700 px-4 py-2">
        <p className="text-sm font-bold tabular-nums">MEASURE {String(measure).padStart(2, "0")}</p>
        <p className="text-xs font-bold text-amber-300">{description?.focus ?? "特殊奏法"}</p>
      </div>
      <div className="tab-measure tab-measure-technique">
        {STRING_RANGE.map((stringNo) => (
          <div className="tab-string-line" key={`tech-line-${measure}-${stringNo}`} style={{ gridRow: stringNo }} aria-hidden="true" />
        ))}
        {glyphs.flatMap((glyph, glyphIndex) => glyph.symbols.map((symbol, symbolIndex) => (
          <span
            className="tab-symbol tab-glyph"
            key={`${measure}-${glyphIndex}-${symbolIndex}`}
            style={{ gridColumn: `${glyph.slot + 1}`, gridRow: symbol.stringNo }}
          >
            {symbol.text}
          </span>
        )))}
        {glyphs.map((glyph, index) => glyph.technique && (
          <span
            className="tab-effect"
            key={`${measure}-effect-${index}`}
            style={{ left: `${((glyph.slot + 0.5) / 16) * 100}%` }}
          >
            {glyph.technique === "tie" ? "⌒" : glyph.technique}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-8 border-t border-stone-800 px-2 py-2 text-center text-[0.65rem] font-bold text-stone-500" aria-hidden="true">
        {['1', '＆', '2', '＆', '3', '＆', '4', '＆'].map((beat, index) => <span key={`${measure}-tech-beat-${index}`}>{beat}</span>)}
      </div>
    </section>
  );
}

function ProceduralTabMeasure({
  measure,
  glyphs,
  label,
  beats,
  cursorStep,
}: {
  measure: number;
  glyphs: ScoreGlyph[];
  label: string;
  beats: number;
  cursorStep: number | null;
}) {
  const hasNotes = glyphs.length > 0;
  const measureSteps = beats * 4;
  const displaySlot = (slot: number) => Math.min(measureSteps - 1, Math.round((slot / 16) * measureSteps));

  return (
    <section className="overflow-hidden rounded-xl border border-lime-300/50 bg-stone-900" aria-label={`${measure}小節目、${label}`}>
      <div className="flex items-center justify-between border-b border-stone-700 px-4 py-2">
        <p className="text-sm font-bold tabular-nums">MEASURE {String(measure).padStart(3, "0")}</p>
        <p className="text-xs font-bold text-lime-300">{hasNotes ? label.toUpperCase() : "REST"}</p>
      </div>
      <div
        className={cn("tab-measure", hasNotes ? "tab-measure-technique" : "tab-measure-rest")}
        style={{ gridTemplateColumns: `repeat(${measureSteps}, minmax(0, 1fr))` }}
      >
        {STRING_RANGE.map((stringNo) => (
          <div className="tab-string-line" key={`${label}-line-${measure}-${stringNo}`} style={{ gridRow: stringNo }} aria-hidden="true" />
        ))}
        {cursorStep !== null && (
          <span
            className="tab-playhead"
            style={{ left: `${clamp(cursorStep / measureSteps, 0, 1) * 100}%` }}
            aria-hidden="true"
          />
        )}
        {hasNotes ? glyphs.flatMap((glyph, glyphIndex) => glyph.symbols.map((symbol, symbolIndex) => (
          <span
            className="tab-symbol tab-glyph"
            key={`${measure}-${glyphIndex}-${symbolIndex}`}
            style={{ gridColumn: `${displaySlot(glyph.slot) + 1}`, gridRow: symbol.stringNo }}
          >
            {symbol.text}
          </span>
        ))) : <span className="tab-whole-rest" aria-hidden="true">━</span>}
      </div>
      <div className="grid border-t border-stone-800 px-2 py-2 text-center text-[0.65rem] font-bold text-stone-500" style={{ gridTemplateColumns: `repeat(${beats * 2}, minmax(0, 1fr))` }} aria-hidden="true">
        {Array.from({ length: beats }, (_, index) => [String(index + 1), "＆"]).flat().map((beat, index) => <span key={`${measure}-${label}-beat-${index}`}>{beat}</span>)}
      </div>
    </section>
  );
}

function RestTabMeasure({ measure }: { measure: number }) {
  return (
    <section className="overflow-hidden rounded-xl border border-stone-800 bg-stone-950" aria-label={`${measure}小節目、リードは休み`}>
      <div className="flex items-center justify-between border-b border-stone-800 px-4 py-2">
        <p className="text-sm font-bold text-stone-500 tabular-nums">MEASURE {String(measure).padStart(2, "0")}</p>
        <p className="text-xs font-bold text-stone-600">LEAD REST</p>
      </div>
      <div className="tab-measure tab-measure-rest">
        {STRING_RANGE.map((stringNo) => (
          <div className="tab-string-line" key={`rest-line-${measure}-${stringNo}`} style={{ gridRow: stringNo }} aria-hidden="true" />
        ))}
        <span className="tab-whole-rest" aria-hidden="true">━</span>
      </div>
      <p className="border-t border-stone-800 px-3 py-2 text-center text-[0.65rem] font-bold text-stone-600">この小節は弾かない</p>
    </section>
  );
}

function ScoreMeasure({
  songId,
  trackId,
  measure,
  isPlaying,
  cursorStep,
}: {
  songId: SongId;
  trackId: TrackId;
  measure: number;
  isPlaying: boolean;
  cursorStep: number | null;
}) {
  const audit = scoreAuditStatus(songId, trackId, measure);
  const proceduralGlyphs = glyphsForTrack(songId, trackId, measure);
  const proceduralLabel = trackId === "lead" ? "LEAD GUITAR" : trackId === "backing" ? "BACKING GUITAR" : "GUITAR 3";
  const score = <ProceduralTabMeasure
    measure={measure}
    glyphs={proceduralGlyphs}
    label={proceduralLabel}
    beats={SONGS[songId].meterMap[measure] ?? 4}
    cursorStep={cursorStep}
  />;

  return (
    <div className="score-measure" data-playing={isPlaying}>
      <div className="mb-1 flex items-center justify-end">
        <span className="rounded-md border px-2 py-1 text-[0.65rem] font-black data-[tone=verified]:border-emerald-700 data-[tone=verified]:text-emerald-300 data-[tone=review]:border-amber-600 data-[tone=review]:text-amber-300 data-[tone=rest]:border-stone-700 data-[tone=rest]:text-stone-500" data-tone={audit.tone}>
          {audit.label}
        </span>
      </div>
      {score}
    </div>
  );
}

function SongMap({ parts, currentMeasure, onJump }: { parts: readonly SongPart[]; currentMeasure: number; onJump: (measure: number) => void }) {
  return (
    <div className="song-map" aria-label="曲全体の構成">
      {parts.map((part) => (
        <button
          className="song-map-part"
          data-active={currentMeasure >= part.start && currentMeasure <= part.end}
          data-kind={part.kind}
          key={`${part.start}-${part.end}`}
          onClick={() => onJump(part.start)}
          style={{ flexGrow: part.end - part.start + 1 }}
          type="button"
        >
          <span>{part.label}</span>
          <small>{part.range}</small>
        </button>
      ))}
    </div>
  );
}

function TechniqueGuideCard({
  guide,
  onJump,
}: {
  guide: (typeof TECHNIQUE_GUIDES)[number];
  onJump: (measure: number) => void;
}) {
  return (
    <button className="technique-guide-card min-h-11 rounded-xl border border-stone-700 bg-stone-950 p-4 text-left hover:border-lime-300" onClick={() => onJump(guide.measure)} type="button">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-lime-300">{guide.range}小節</p>
          <h3 className="mt-1 text-lg font-black">{guide.title}</h3>
        </div>
        <span className="rounded-lg border border-stone-600 bg-stone-900 px-2 py-1 font-mono text-sm font-black text-amber-300">{guide.symbol}</span>
      </div>
      <div className="technique-guide-visual mt-4" data-kind={guide.kind} aria-label={`${guide.title}の指の動き`}>
        <span className="technique-guide-hand" aria-hidden="true">指</span>
        <strong>{guide.move}</strong>
        <span className="technique-guide-pick" aria-hidden="true">PICK</span>
      </div>
      <p className="mt-3 text-pretty text-sm font-bold leading-6 text-stone-300">{guide.tip}</p>
      <p className="mt-3 text-xs font-black text-lime-300">{guide.measure}小節をTABで見る →</p>
    </button>
  );
}

export function GuitarTrainer() {
  const [songId, setSongId] = useState<SongId>("life-over");
  const [trackId, setTrackId] = useState<TrackId>("lead");
  const [noteIndex, setNoteIndex] = useState(0);
  const [scorePageIndex, setScorePageIndex] = useState(0);
  const [timelineMeasure, setTimelineMeasure] = useState(1);
  const [videoStart, setVideoStart] = useState<number>(SONGS["life-over"].tracks.lead.videoStartSeconds);
  const [videoAutoplay, setVideoAutoplay] = useState(false);
  const [videoNonce, setVideoNonce] = useState(0);
  const [bpm, setBpm] = useState(85);
  const [playing, setPlaying] = useState(false);
  const [playbackMeasure, setPlaybackMeasure] = useState<number | null>(null);
  const [playbackLabel, setPlaybackLabel] = useState("");
  const [pausedSession, setPausedSession] = useState<PlaybackSession | null>(null);
  const [playbackProgressSteps, setPlaybackProgressSteps] = useState(0);
  const [playbackPreset, setPlaybackPreset] = useState<PlaybackPreset>("page");
  const [loopStart, setLoopStart] = useState(1);
  const [loopEnd, setLoopEnd] = useState(4);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [countIn, setCountIn] = useState(true);
  const [metronome, setMetronome] = useState(true);
  const [videoSync, setVideoSync] = useState(true);
  const [learnedIds, setLearnedIds] = useState<Set<string>>(new Set());
  const [inputEnabled, setInputEnabled] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [inputMode, setInputMode] = useState<"judge" | "tuner">("judge");
  const [detectedFrequency, setDetectedFrequency] = useState<number | null>(null);
  const [inputLevel, setInputLevel] = useState(0);
  const [detectedCents, setDetectedCents] = useState<number | null>(null);
  const [pitchMatched, setPitchMatched] = useState(false);
  const [inputError, setInputError] = useState("");
  const [inputSensitivity, setInputSensitivity] = useState(0.004);
  const [tunerString, setTunerString] = useState<"auto" | StringNumber>("auto");
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [guidedMode, setGuidedMode] = useState(false);
  const [guidedWaiting, setGuidedWaiting] = useState(false);
  const [auditNotes, setAuditNotes] = useState<Record<string, string>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerIdsRef = useRef<number[]>([]);
  const activeNodesRef = useRef<Set<OscillatorNode>>(new Set());
  const playbackSessionRef = useRef<PlaybackSession | null>(null);
  const playbackProgressTimerRef = useRef<number | null>(null);
  const videoSyncTimerRef = useRef<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const inputStreamRef = useRef<MediaStream | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const inputFilterRef = useRef<BiquadFilterNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const settingsHydratedRef = useRef(false);
  const restoredMeasureRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("fret-step-trainer:v2");
      if (raw) {
        const saved = JSON.parse(raw) as {
          songId?: SongId;
          trackId?: TrackId;
          bpm?: number;
          timelineMeasure?: number;
          learnedIds?: string[];
          countIn?: boolean;
          metronome?: boolean;
          videoSync?: boolean;
          inputSensitivity?: number;
          tunerString?: "auto" | StringNumber;
          loopStart?: number;
          loopEnd?: number;
          loopEnabled?: boolean;
          auditNotes?: Record<string, string>;
        };
        window.queueMicrotask(() => {
          if (saved.songId && SONGS[saved.songId]) setSongId(saved.songId);
          if (saved.trackId === "lead" || saved.trackId === "backing" || saved.trackId === "third") setTrackId(saved.trackId);
          if (typeof saved.bpm === "number") setBpm(saved.bpm);
          if (typeof saved.timelineMeasure === "number") {
            restoredMeasureRef.current = saved.timelineMeasure;
            setTimelineMeasure(saved.timelineMeasure);
            setScorePageIndex(Math.floor((saved.timelineMeasure - 1) / 4));
          }
          if (Array.isArray(saved.learnedIds)) setLearnedIds(new Set(saved.learnedIds));
          if (typeof saved.countIn === "boolean") setCountIn(saved.countIn);
          if (typeof saved.metronome === "boolean") setMetronome(saved.metronome);
          if (typeof saved.videoSync === "boolean") setVideoSync(saved.videoSync);
          if (typeof saved.inputSensitivity === "number") setInputSensitivity(saved.inputSensitivity);
          if (saved.tunerString === "auto" || typeof saved.tunerString === "number") setTunerString(saved.tunerString);
          if (typeof saved.loopStart === "number") setLoopStart(saved.loopStart);
          if (typeof saved.loopEnd === "number") setLoopEnd(saved.loopEnd);
          if (typeof saved.loopEnabled === "boolean") setLoopEnabled(saved.loopEnabled);
          if (saved.auditNotes && typeof saved.auditNotes === "object") setAuditNotes(saved.auditNotes);
          settingsHydratedRef.current = true;
        });
        return;
      }
    } catch {
      // Invalid or old settings are ignored; the trainer remains usable.
    }
    settingsHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!settingsHydratedRef.current) return;
    window.localStorage.setItem("fret-step-trainer:v2", JSON.stringify({
      songId,
      trackId,
      bpm,
      timelineMeasure,
      learnedIds: [...learnedIds],
      countIn,
      metronome,
      videoSync,
      inputSensitivity,
      tunerString,
      loopStart,
      loopEnd,
      loopEnabled,
      auditNotes,
    }));
  }, [auditNotes, bpm, countIn, inputSensitivity, learnedIds, loopEnabled, loopEnd, loopStart, metronome, songId, timelineMeasure, trackId, tunerString, videoSync]);

  const song = SONGS[songId];
  const effectiveTrackId = song.tracks[trackId] ? trackId : song.defaultTrack;
  const track = trackFor(song, effectiveTrackId);
  const activeNotes = notesForTrack(songId, effectiveTrackId);
  const activeScorePages = scorePages(song.totalMeasures);

  useEffect(() => {
    if (effectiveTrackId !== trackId) window.queueMicrotask(() => setTrackId(effectiveTrackId));
  }, [effectiveTrackId, trackId]);

  useEffect(() => {
    const restoredMeasure = restoredMeasureRef.current;
    if (restoredMeasure === null) return;
    const restoredIndex = activeNotes.findIndex((note) => note.measure >= restoredMeasure);
    window.queueMicrotask(() => {
      setNoteIndex(restoredIndex >= 0 ? restoredIndex : Math.max(0, activeNotes.length - 1));
      setVideoStart(videoTimeForMeasure(song, track, restoredMeasure));
      restoredMeasureRef.current = null;
    });
  }, [activeNotes, song, track]);

  const moveToNoteIndex = useCallback((nextIndex: number) => {
    const boundedIndex = Math.min(activeNotes.length - 1, Math.max(0, nextIndex));
    const nextMeasure = activeNotes[boundedIndex].measure;
    setNoteIndex(boundedIndex);
    setTimelineMeasure(nextMeasure);
    setScorePageIndex(Math.floor((nextMeasure - 1) / 4));
  }, [activeNotes]);

  const currentNote = activeNotes[Math.min(noteIndex, activeNotes.length - 1)];
  const targetFrequency = frequencyFor(currentNote.stringNo, currentNote.fret, song.capo);
  const selectedTunerString = tunerString === "auto"
    ? null
    : TUNER_STRINGS.find((candidate) => candidate.stringNo === tunerString) ?? null;
  const tunerDetectionTarget = selectedTunerString?.frequency;
  const activeNoteIds = new Set(activeNotes.map((note) => note.id));
  const learnedForSong = [...learnedIds].filter((id) => activeNoteIds.has(id)).length;
  const learnedProgress = Math.round((learnedForSong / activeNotes.length) * 100);
  const fretStart = Math.max(0, currentNote.fret >= 10 ? currentNote.fret - 1 : currentNote.fret - 2);
  const fretRange = Array.from({ length: 5 }, (_, index) => fretStart + index);
  const tunerOffset = clamp(detectedCents ?? 0, -50, 50) * 1.4;
  const nearestDetectedPitch = detectedFrequency ? nearestPitch(detectedFrequency) : null;
  const displayTargetFrequency = inputMode === "judge"
    ? targetFrequency
    : tunerDetectionTarget ?? nearestDetectedPitch?.frequency ?? null;
  const tunerMessage = inputMode === "tuner"
    ? detectedCents === null
      ? "開放弦を1本だけ鳴らしてください"
      : pitchMatched
        ? "チューニングOK"
        : detectedCents < -5
          ? "低い — ペグを少し締める"
          : "高い — ペグを少し緩める"
    : playing
      ? "お手本再生中は判定を待機"
      : pitchMatched
        ? "正解！ 音程が合っています"
        : detectedCents === null
          ? "1音だけ鳴らしてください"
          : detectedCents < -30
            ? "少し低いです"
            : detectedCents > 30
              ? "少し高いです"
              : "その音です。少しキープ";
  const selectedScorePage = activeScorePages[Math.min(scorePageIndex, activeScorePages.length - 1)];
  const activeMeasure = playbackMeasure ?? timelineMeasure;
  const currentSongPart = song.map.find((part) => activeMeasure >= part.start && activeMeasure <= part.end) ?? song.map[0];
  const remainingStartMeasure = activeMeasure;
  const playbackChoices: Array<{
    id: PlaybackPreset;
    title: string;
    detail: string;
    start: number;
    end: number;
    label: string;
  }> = [
    {
      id: "page",
      title: "表示4小節",
      detail: `${selectedScorePage.start}〜${selectedScorePage.end} · ${rangeDuration(selectedScorePage.start, selectedScorePage.end, bpm, song.meterMap)}`,
      start: selectedScorePage.start,
      end: selectedScorePage.end,
      label: `表示4小節 ${selectedScorePage.start}〜${selectedScorePage.end}`,
    },
    {
      id: "section",
      title: "この区間",
      detail: `${currentSongPart.label} ${currentSongPart.range} · ${rangeDuration(currentSongPart.start, currentSongPart.end, bpm, song.meterMap)}`,
      start: currentSongPart.start,
      end: currentSongPart.end,
      label: `${currentSongPart.label} ${currentSongPart.range}`,
    },
    {
      id: "full",
      title: `曲全体 1〜${song.totalMeasures}`,
      detail: `休みも含む · ${rangeDuration(1, song.totalMeasures, bpm, song.meterMap)}`,
      start: 1,
      end: song.totalMeasures,
      label: `曲全体 1〜${song.totalMeasures}小節`,
    },
    {
      id: "remaining",
      title: "現在地から最後まで",
      detail: `${remainingStartMeasure}〜${song.totalMeasures} · ${rangeDuration(remainingStartMeasure, song.totalMeasures, bpm, song.meterMap)}`,
      start: remainingStartMeasure,
      end: song.totalMeasures,
      label: `現在地 ${remainingStartMeasure}〜${song.totalMeasures}小節`,
    },
    {
      id: "loop",
      title: `A/B ${loopStart}〜${loopEnd}`,
      detail: `${loopEnabled ? "繰り返しON" : "1回再生"} · ${rangeDuration(loopStart, loopEnd, bpm, song.meterMap)}`,
      start: loopStart,
      end: loopEnd,
      label: `A/Bループ ${loopStart}〜${loopEnd}小節`,
    },
  ];
  const selectedPlaybackChoice = playbackChoices.find((choice) => choice.id === playbackPreset) ?? playbackChoices[0];
  const selectedPlaybackTotalSteps = stepsInRange(selectedPlaybackChoice.start, selectedPlaybackChoice.end, song.meterMap);
  const selectedPlaybackProgress = clamp(playbackProgressSteps / selectedPlaybackTotalSteps, 0, 1);
  const canResumeSelected = pausedSession?.startMeasure === selectedPlaybackChoice.start
    && pausedSession.endMeasure === selectedPlaybackChoice.end;
  const cursorSession = playbackSessionRef.current ?? pausedSession;
  const scoreCursor = cursorSession
    ? measurePosition(
        cursorSession.startMeasure,
        cursorSession.endMeasure,
        Math.max(0, playbackProgressSteps),
        song.meterMap,
      )
    : { measure: activeMeasure, step: 0 };

  const sendVideoCommand = useCallback((command: "playVideo" | "pauseVideo" | "seekTo" | "setPlaybackRate", args: Array<number | boolean> = []) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({
      event: "command",
      func: command,
      args,
    }), "*");
  }, []);

  const clearTimers = useCallback(() => {
    timerIdsRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timerIdsRef.current = [];
    if (playbackProgressTimerRef.current !== null) {
      window.clearInterval(playbackProgressTimerRef.current);
      playbackProgressTimerRef.current = null;
    }
    if (videoSyncTimerRef.current !== null) {
      window.clearTimeout(videoSyncTimerRef.current);
      videoSyncTimerRef.current = null;
    }
  }, []);

  const clearPlaybackSchedule = useCallback(() => {
    clearTimers();
    activeNodesRef.current.forEach((node) => {
      try {
        node.stop();
      } catch {
        // Already stopped nodes are removed by their ended event.
      }
    });
    activeNodesRef.current.clear();
  }, [clearTimers]);

  const stopPlayback = useCallback(() => {
    clearPlaybackSchedule();
    playbackSessionRef.current = null;
    setPausedSession(null);
    setPlaybackProgressSteps(0);
    setPlaying(false);
    setPlaybackMeasure(null);
    setPlaybackLabel("");
    sendVideoCommand("pauseVideo");
  }, [clearPlaybackSchedule, sendVideoCommand]);

  const pausePlayback = useCallback(() => {
    const session = playbackSessionRef.current;
    if (!session) return;
    const context = audioContextRef.current;
    const positionSteps = context
      ? playbackPositionSteps(session.positionSteps, session.scheduledAt, context.currentTime, session.bpm)
      : session.positionSteps;
    clearPlaybackSchedule();
    const paused = { ...session, positionSteps, scheduledAt: 0 };
    playbackSessionRef.current = null;
    setPausedSession(paused);
    setPlaybackProgressSteps(positionSteps);
    setPlaying(false);
    setPlaybackMeasure(positionToMeasure(session.startMeasure, session.endMeasure, positionSteps, song.meterMap));
    sendVideoCommand("pauseVideo");
  }, [clearPlaybackSchedule, sendVideoCommand]);

  useEffect(() => {
    const activeNodes = activeNodesRef.current;
    return () => {
      clearTimers();
      activeNodes.forEach((node) => {
        try {
          node.stop();
        } catch {
          // The node may already have completed.
        }
      });
      activeNodes.clear();
      inputStreamRef.current?.getTracks().forEach((track) => track.stop());
      inputSourceRef.current?.disconnect();
      inputFilterRef.current?.disconnect();
      analyserRef.current?.disconnect();
      void audioContextRef.current?.close();
    };
  }, [clearTimers]);

  useEffect(() => {
    const analyser = analyserRef.current;
    if (!inputEnabled || !analyser) return;

    let cancelled = false;
    let timeoutId = 0;
    let correctFrames = 0;
    let advanced = false;
    const buffer = new Float32Array(analyser.fftSize);

    const analyze = () => {
      if (cancelled) return;
      analyser.getFloatTimeDomainData(buffer);
      let energy = 0;
      for (const sample of buffer) energy += sample * sample;
      const rms = Math.sqrt(energy / buffer.length);
      setInputLevel(Math.min(1, rms * 8));
      const frequency = detectPitch(
        buffer,
        analyser.context.sampleRate,
        inputMode === "judge" ? targetFrequency : tunerDetectionTarget,
        inputSensitivity,
      );

      if (frequency) {
        const pitch = nearestPitch(frequency);
        const cents = inputMode === "judge"
          ? centsBetween(frequency, targetFrequency)
          : tunerDetectionTarget
            ? centsBetween(frequency, tunerDetectionTarget)
            : pitch.cents;
        const isCorrect = Math.abs(cents) <= (inputMode === "judge" ? 30 : 5)
          && (inputMode === "tuner" || (!playing && (!guidedMode || guidedWaiting)));
        setDetectedFrequency(frequency);
        setDetectedCents(cents);
        correctFrames = isCorrect ? correctFrames + 1 : 0;
        setPitchMatched(correctFrames >= 4);

        if (inputMode === "judge" && (autoAdvance || guidedMode) && correctFrames >= 8 && !advanced) {
          advanced = true;
          setLearnedIds((previous) => new Set(previous).add(currentNote.id));
          if (noteIndex < activeNotes.length - 1) {
            const nextIndex = noteIndex + 1;
            const nextNote = activeNotes[nextIndex];
            moveToNoteIndex(nextIndex);
            if (guidedMode) {
              setGuidedWaiting(false);
              const currentAbsoluteStep = stepsBeforeMeasure(currentNote.measure, song.meterMap)
                + (currentNote.tick * 2 / 16) * stepsForMeasure(currentNote.measure, song.meterMap);
              const nextAbsoluteStep = stepsBeforeMeasure(nextNote.measure, song.meterMap)
                + (nextNote.tick * 2 / 16) * stepsForMeasure(nextNote.measure, song.meterMap);
              const transitionSteps = Math.max(1, nextAbsoluteStep - currentAbsoluteStep);
              const fromVideoTime = videoTimeForPosition(
                track.videoStartSeconds,
                song.originalBpm,
                currentNote.measure,
                (currentNote.tick * 2 / 16) * stepsForMeasure(currentNote.measure, song.meterMap),
                song.meterMap,
              );
              const nextVideoTime = videoTimeForPosition(
                track.videoStartSeconds,
                song.originalBpm,
                nextNote.measure,
                (nextNote.tick * 2 / 16) * stepsForMeasure(nextNote.measure, song.meterMap),
                song.meterMap,
              );
              sendVideoCommand("seekTo", [fromVideoTime, true]);
              sendVideoCommand("setPlaybackRate", [bpm / song.originalBpm]);
              sendVideoCommand("playVideo");
              const gateTimer = window.setTimeout(() => {
                sendVideoCommand("pauseVideo");
                sendVideoCommand("seekTo", [nextVideoTime, true]);
                setGuidedWaiting(true);
              }, Math.max(180, transitionSteps * (15 / bpm) * 1000));
              timerIdsRef.current.push(gateTimer);
            }
          } else {
            sendVideoCommand("pauseVideo");
            setGuidedMode(false);
            setGuidedWaiting(false);
          }
        }
      } else {
        correctFrames = 0;
        setDetectedFrequency(null);
        setDetectedCents(null);
        setPitchMatched(false);
      }

      timeoutId = window.setTimeout(analyze, 90);
    };

    analyze();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeNotes, autoAdvance, bpm, currentNote.fret, currentNote.id, currentNote.measure, currentNote.stringNo, currentNote.tick, guidedMode, guidedWaiting, inputEnabled, inputMode, inputSensitivity, moveToNoteIndex, noteIndex, playing, selectedDeviceId, sendVideoCommand, song.originalBpm, targetFrequency, track.videoStartSeconds, tunerDetectionTarget]);

  function getAudioContext() {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }

  async function connectInput(deviceId?: string) {
    setInputError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setInputError("このブラウザでは音声入力を利用できません。");
      return;
    }

    inputStreamRef.current?.getTracks().forEach((track) => track.stop());
    inputSourceRef.current?.disconnect();
    inputFilterRef.current?.disconnect();
    analyserRef.current?.disconnect();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
      const context = getAudioContext();
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      const filter = context.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 45;
      filter.Q.value = 0.7;
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;
      source.connect(filter);
      filter.connect(analyser);

      inputStreamRef.current = stream;
      inputSourceRef.current = source;
      inputFilterRef.current = filter;
      analyserRef.current = analyser;
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
        (device) => device.kind === "audioinput",
      );
      const activeDeviceId = stream.getAudioTracks()[0]?.getSettings().deviceId ?? deviceId ?? "";
      setAudioDevices(devices);
      setSelectedDeviceId(activeDeviceId);
      setInputEnabled(true);
    } catch (error) {
      setInputEnabled(false);
      setInputError(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "入力の許可が必要です。ブラウザの許可画面でマイクを許可してください。"
          : "入力を開始できませんでした。Ampero MiniがPCの入力デバイスに選ばれているか確認してください。",
      );
    }
  }

  function disconnectInput() {
    inputStreamRef.current?.getTracks().forEach((track) => track.stop());
    inputSourceRef.current?.disconnect();
    inputFilterRef.current?.disconnect();
    analyserRef.current?.disconnect();
    inputStreamRef.current = null;
    inputSourceRef.current = null;
    inputFilterRef.current = null;
    analyserRef.current = null;
    setInputEnabled(false);
    setGuidedMode(false);
    setGuidedWaiting(false);
    setDetectedFrequency(null);
    setInputLevel(0);
    setDetectedCents(null);
    setPitchMatched(false);
  }

  function startGuidedMode() {
    stopPlayback();
    setInputMode("judge");
    setAutoAdvance(false);
    setGuidedMode(true);
    setGuidedWaiting(true);
    if (!inputEnabled) void connectInput(selectedDeviceId || undefined);
    sendVideoCommand("seekTo", [videoTimeForPosition(
      track.videoStartSeconds,
      song.originalBpm,
      currentNote.measure,
      (currentNote.tick * 2 / 16) * stepsForMeasure(currentNote.measure, song.meterMap),
      song.meterMap,
    ), true]);
    sendVideoCommand("setPlaybackRate", [bpm / song.originalBpm]);
    sendVideoCommand("pauseVideo");
  }

  function stopGuidedMode() {
    setGuidedMode(false);
    setGuidedWaiting(false);
    setPitchMatched(false);
  }

  function schedulePluck(
    context: AudioContext,
    stringNo: StringNumber,
    fret: number,
    startAt: number,
    duration: number,
  ) {
    const gain = context.createGain();
    const oscillator = context.createOscillator();
    const overtone = context.createOscillator();
    const frequency = frequencyFor(stringNo, fret, song.capo);

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, startAt);
    overtone.type = "sine";
    overtone.frequency.setValueAtTime(frequency * 2, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    overtone.connect(gain);
    gain.connect(context.destination);
    activeNodesRef.current.add(oscillator);
    activeNodesRef.current.add(overtone);
    oscillator.addEventListener("ended", () => activeNodesRef.current.delete(oscillator), { once: true });
    overtone.addEventListener("ended", () => activeNodesRef.current.delete(overtone), { once: true });
    oscillator.start(startAt);
    overtone.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
    overtone.stop(startAt + duration + 0.02);
  }

  function scheduleClick(context: AudioContext, startAt: number, strong: boolean) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(strong ? 1320 : 920, startAt);
    gain.gain.setValueAtTime(0.1, startAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.045);
    oscillator.connect(gain);
    gain.connect(context.destination);
    activeNodesRef.current.add(oscillator);
    oscillator.addEventListener("ended", () => activeNodesRef.current.delete(oscillator), { once: true });
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.05);
  }

  function playCurrentNote() {
    const context = getAudioContext();
    void context.resume();
    schedulePluck(context, currentNote.stringNo, currentNote.fret, context.currentTime + 0.04, 0.7);
  }

  function scheduleRange(
    startMeasure: number,
    endMeasure: number,
    label: string,
    nextBpm: number,
    positionSteps: number,
  ) {
    const context = getAudioContext();
    void context.resume();
    const secondsPerStep = 15 / nextBpm;
    const totalSteps = stepsInRange(startMeasure, endMeasure, song.meterMap);
    const earliestStep = countIn ? -16 : 0;
    const boundedPosition = Math.min(totalSteps, Math.max(earliestStep, positionSteps));
    const startAt = context.currentTime + 0.03;

    playbackSessionRef.current = {
      startMeasure,
      endMeasure,
      label,
      bpm: nextBpm,
      positionSteps: boundedPosition,
      scheduledAt: startAt,
    };
    setPausedSession(null);
    setPlaybackProgressSteps(boundedPosition);

    if (videoSync) {
      const scorePosition = Math.max(0, boundedPosition);
      const position = measurePosition(startMeasure, endMeasure, scorePosition, song.meterMap);
      const positionMeasure = position.measure;
      const stepInMeasure = position.step;
      const videoSeconds = videoTimeForPosition(
        track.videoStartSeconds,
        song.originalBpm,
        positionMeasure,
        stepInMeasure,
        song.meterMap,
      );
      sendVideoCommand("seekTo", [videoSeconds, true]);
      sendVideoCommand("setPlaybackRate", [nextBpm / song.originalBpm]);
      if (boundedPosition < 0) {
        sendVideoCommand("pauseVideo");
        videoSyncTimerRef.current = window.setTimeout(() => sendVideoCommand("playVideo"), -boundedPosition * secondsPerStep * 1000);
      } else {
        sendVideoCommand("playVideo");
      }
    }

    playbackProgressTimerRef.current = window.setInterval(() => {
      const session = playbackSessionRef.current;
      if (!session) return;
      setPlaybackProgressSteps(playbackPositionSteps(
        session.positionSteps,
        session.scheduledAt,
        getAudioContext().currentTime,
        session.bpm,
      ));
    }, 120);

    if (countIn && boundedPosition < 0) {
      for (let step = -16; step < 0; step += 4) {
        if (step + 0.001 >= boundedPosition) {
          scheduleClick(context, startAt + (step - boundedPosition) * secondsPerStep, step === -16);
        }
      }
    }

    let measureOffset = 0;
    for (let measure = startMeasure; measure <= endMeasure; measure += 1) {
      const measureSteps = stepsForMeasure(measure, song.meterMap);
      if (metronome) {
        for (let step = 0; step < measureSteps; step += 4) {
          const clickStep = measureOffset + step;
          if (clickStep + 0.001 >= boundedPosition) {
            scheduleClick(context, startAt + (clickStep - boundedPosition) * secondsPerStep, step === 0);
          }
        }
      }

      scorePlaybackEvents(songId, trackId, measure).forEach((event) => {
        const eventOffset = measureOffset + event.step;
        if (eventOffset + 0.001 < boundedPosition) return;
        schedulePluck(
          context,
          event.stringNo,
          event.fret,
          startAt + (eventOffset - boundedPosition) * secondsPerStep,
          Math.max(
            0.12,
            event.durationSteps * secondsPerStep * (event.sustain ? 0.98 : 0.86),
          ),
        );
        if (event.noteId) {
          const timerId = window.setTimeout(() => {
            const nextIndex = activeNotes.findIndex((candidate) => candidate.id === event.noteId);
            if (nextIndex >= 0) moveToNoteIndex(nextIndex);
          }, (eventOffset - boundedPosition) * secondsPerStep * 1000);
          timerIdsRef.current.push(timerId);
        }
      });

      if (measureOffset > boundedPosition + 0.001) {
        const measureTimer = window.setTimeout(() => {
          setPlaybackMeasure(measure);
          setTimelineMeasure(measure);
          setScorePageIndex(Math.floor((measure - 1) / 4));
          if (videoSync) {
            sendVideoCommand("seekTo", [videoTimeForPosition(track.videoStartSeconds, song.originalBpm, measure, 0, song.meterMap), true]);
            sendVideoCommand("setPlaybackRate", [nextBpm / song.originalBpm]);
          }
        }, (measureOffset - boundedPosition) * secondsPerStep * 1000);
        timerIdsRef.current.push(measureTimer);
      }
      measureOffset += measureSteps;
    }

    const currentMeasure = positionToMeasure(startMeasure, endMeasure, boundedPosition, song.meterMap);
    setPlaying(true);
    setPlaybackLabel(label);
    setPlaybackMeasure(currentMeasure);
    setTimelineMeasure(currentMeasure);
    setScorePageIndex(Math.floor((currentMeasure - 1) / 4));
    const endTimer = window.setTimeout(
      () => {
        if (playbackProgressTimerRef.current !== null) {
          window.clearInterval(playbackProgressTimerRef.current);
          playbackProgressTimerRef.current = null;
        }
        if (loopEnabled && playbackPreset === "loop") {
          clearPlaybackSchedule();
          scheduleRange(startMeasure, endMeasure, label, nextBpm, 0);
          return;
        }
        playbackSessionRef.current = null;
        setPausedSession(null);
        setPlaying(false);
        setPlaybackMeasure(null);
        setPlaybackLabel("");
        sendVideoCommand("pauseVideo");
      },
      (totalSteps - boundedPosition + 0.3) * secondsPerStep * 1000,
    );
    timerIdsRef.current.push(endTimer);
  }

  function playRange(startMeasure: number, endMeasure: number, label: string) {
    stopPlayback();
    scheduleRange(startMeasure, endMeasure, label, bpm, countIn ? -16 : 0);
  }

  function selectPlaybackPreset(nextPreset: PlaybackPreset) {
    if (playing) stopPlayback();
    setPlaybackPreset(nextPreset);
  }

  function toggleSelectedPlayback() {
    if (playing) {
      pausePlayback();
      return;
    }
    if (pausedSession
      && pausedSession.startMeasure === selectedPlaybackChoice.start
      && pausedSession.endMeasure === selectedPlaybackChoice.end) {
      scheduleRange(
        pausedSession.startMeasure,
        pausedSession.endMeasure,
        pausedSession.label,
        bpm,
        pausedSession.positionSteps,
      );
      return;
    }
    playRange(
      selectedPlaybackChoice.start,
      selectedPlaybackChoice.end,
      selectedPlaybackChoice.label,
    );
  }

  function changeBpm(nextBpm: number) {
    const effectiveBpm = videoSync
      ? Math.round(song.originalBpm * nearestPlaybackRate(
          nextBpm / song.originalBpm,
          [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
        ))
      : nextBpm;
    const session = playbackSessionRef.current;
    setBpm(effectiveBpm);
    sendVideoCommand("setPlaybackRate", [effectiveBpm / song.originalBpm]);
    if (!session) {
      if (pausedSession) setPausedSession({ ...pausedSession, bpm: effectiveBpm });
      return;
    }

    const context = getAudioContext();
    const currentPosition = playbackPositionSteps(
      session.positionSteps,
      session.scheduledAt,
      context.currentTime,
      session.bpm,
    );
    clearPlaybackSchedule();
    scheduleRange(
      session.startMeasure,
      session.endMeasure,
      session.label,
      effectiveBpm,
      currentPosition,
    );
  }

  function playMeasure() {
    playRange(currentNote.measure, currentNote.measure, `${currentNote.measure}小節`);
  }

  function goBy(delta: number) {
    stopPlayback();
    moveToNoteIndex(noteIndex + delta);
  }

  function jumpScoreTo(measure: number) {
    stopPlayback();
    setTimelineMeasure(measure);
    setScorePageIndex(Math.floor((measure - 1) / 4));
    const exactIndex = activeNotes.findIndex((note) => note.measure === measure);
    if (exactIndex >= 0) moveToNoteIndex(exactIndex);
    setVideoStart(videoTimeForMeasure(song, track, measure));
    setVideoAutoplay(false);
    setVideoNonce((nonce) => nonce + 1);
  }

  function setVideoPreset(seconds: number, measure?: number) {
    stopPlayback();
    setVideoStart(seconds);
    setVideoAutoplay(false);
    setVideoNonce((nonce) => nonce + 1);
    if (measure !== undefined) {
      setTimelineMeasure(measure);
      setScorePageIndex(Math.floor((measure - 1) / 4));
    }
  }

  function playVideoFromMeasure(measure: number) {
    stopPlayback();
    setTimelineMeasure(measure);
    setScorePageIndex(Math.floor((measure - 1) / 4));
    const exactIndex = activeNotes.findIndex((note) => note.measure === measure);
    if (exactIndex >= 0) moveToNoteIndex(exactIndex);
    setVideoStart(videoTimeForMeasure(song, track, measure));
    setVideoAutoplay(true);
    setVideoNonce((nonce) => nonce + 1);
  }

  function toggleLearned() {
    setLearnedIds((previous) => {
      const next = new Set(previous);
      if (next.has(currentNote.id)) next.delete(currentNote.id);
      else next.add(currentNote.id);
      return next;
    });
  }

  function switchSong(nextSongId: SongId) {
    if (nextSongId === songId) return;
    const nextSong = SONGS[nextSongId];
    const nextTrackId = nextSong.tracks[trackId] ? trackId : nextSong.defaultTrack;
    const nextTrack = trackFor(nextSong, nextTrackId);
    stopPlayback();
    setSongId(nextSongId);
    setTrackId(nextTrackId);
    setNoteIndex(0);
    setScorePageIndex(0);
    setTimelineMeasure(1);
    setPlaybackPreset("page");
    setLoopStart(1);
    setLoopEnd(Math.min(4, nextSong.totalMeasures));
    setLoopEnabled(false);
    setVideoStart(nextTrack.videoStartSeconds);
    setVideoAutoplay(false);
    setVideoNonce((nonce) => nonce + 1);
    setBpm(Math.round(nextSong.originalBpm * 0.5));
    setPitchMatched(false);
    setDetectedCents(null);
  }

  function switchTrack(nextTrackId: TrackId) {
    if (nextTrackId === trackId || !song.tracks[nextTrackId]) return;
    const nextTrack = trackFor(song, nextTrackId);
    stopPlayback();
    setTrackId(nextTrackId);
    setNoteIndex(0);
    setPitchMatched(false);
    setDetectedCents(null);
    setVideoStart(videoTimeForMeasure(song, nextTrack, timelineMeasure));
    setVideoAutoplay(false);
    setVideoNonce((nonce) => nonce + 1);
  }

  return (
    <main className="min-h-dvh bg-stone-950 pb-16 text-stone-50">
      <header className="border-b border-stone-800 bg-stone-950">
        <div className="mx-auto max-w-[160rem] px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-lime-300 px-2.5 py-1 text-xs font-black text-lime-950">FRET / STEP</span>
              <span className="rounded-md border border-stone-700 px-2.5 py-1 text-xs font-bold text-stone-300">{track.badge}</span>
            </div>
              <h1 className="text-balance text-3xl font-black sm:text-4xl">{song.title}</h1>
              <p className="mt-2 text-pretty text-sm text-stone-400 sm:text-base">{song.artist} · {track.label}</p>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-stone-800 bg-stone-900 px-4 py-3">
                <dt className="text-[0.68rem] font-bold text-stone-500">ORIGINAL</dt>
                <dd className="mt-1 font-black tabular-nums">{song.originalBpm} BPM</dd>
              </div>
              <div className="rounded-xl border border-stone-800 bg-stone-900 px-4 py-3">
                <dt className="text-[0.68rem] font-bold text-stone-500">CAPO</dt>
                <dd className="mt-1 font-black tabular-nums">{song.capo}</dd>
              </div>
              <div className="rounded-xl border border-stone-800 bg-stone-900 px-4 py-3">
                <dt className="text-[0.68rem] font-bold text-stone-500">RHYTHM</dt>
                <dd className="mt-1 font-black tabular-nums">4 / 4</dd>
              </div>
            </dl>
          </div>

          <div className="mt-5 grid gap-2 rounded-2xl border border-stone-800 bg-stone-900 p-2 sm:grid-cols-2" aria-label="練習曲を選択">
            {(["life-over", "madow"] as SongId[]).map((candidateId) => {
              const candidate = SONGS[candidateId];
              const active = songId === candidateId;
              return (
                <button
                  aria-pressed={active}
                  className={cn(
                    "min-h-14 rounded-xl border px-4 py-3 text-left transition-colors",
                    active
                      ? "border-lime-300 bg-lime-300 text-lime-950"
                      : "border-stone-700 bg-stone-950 text-stone-200 hover:border-lime-300",
                  )}
                  key={candidateId}
                  onClick={() => switchSong(candidateId)}
                  type="button"
                >
                  <span className="flex items-center justify-between gap-3 font-black">
                    <span>{candidate.title}</span>
                    {active && <span className="rounded-full bg-lime-950 px-2 py-0.5 text-[10px] text-lime-200">選択中</span>}
                  </span>
                  <small className={cn("mt-1 block font-bold", active ? "text-lime-900" : "text-stone-500")}>{Object.keys(candidate.tracks).length}パート切替 · {candidate.totalMeasures}小節</small>
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid gap-2 rounded-2xl border border-stone-800 bg-stone-900 p-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="ギターパートを選択">
            {(Object.entries(song.tracks) as Array<[TrackId, TrackInfo]>).map(([candidateTrackId, candidateTrack]) => {
              const active = trackId === candidateTrackId;
              return (
                <button
                  aria-pressed={active}
                  className={cn(
                    "min-h-14 rounded-xl border px-4 py-3 text-left transition-colors",
                    active
                      ? "border-lime-300 bg-lime-300 text-lime-950"
                      : "border-stone-700 bg-stone-950 text-stone-200 hover:border-lime-300",
                  )}
                  key={candidateTrackId}
                  onClick={() => switchTrack(candidateTrackId)}
                  type="button"
                >
                  <span className="flex items-center justify-between gap-3 font-black">
                    <span>{candidateTrack.label}</span>
                    {active && <span className="rounded-full bg-lime-950 px-2 py-0.5 text-[10px] text-lime-200">選択中</span>}
                  </span>
                  <small className={cn("mt-1 block font-bold", active ? "text-lime-900" : "text-stone-500")}>{candidateTrack.badge} TAB · 動画・音源・判定を同時切替</small>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <details className="live-console border-b border-stone-700 bg-stone-950">
        <summary className="mx-auto flex min-h-14 max-w-[160rem] cursor-pointer items-center justify-between gap-4 px-4 py-3 font-black sm:px-6 lg:px-8">
          <span>Ampero入力・チューナー・TAB判定</span>
          <span className="text-xs text-lime-300">{inputEnabled ? "接続中" : "必要な時だけ開く"}</span>
        </summary>
        <div className="mx-auto max-w-[160rem] px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-md bg-lime-300 px-2 py-1 text-[0.68rem] font-black text-lime-950">LIVE MONITOR</span>
              <div>
                <h2 id="live-console-title" className="text-sm font-black sm:text-base">Ampero入力・チューナー・TAB判定</h2>
                <p className="text-xs font-bold text-stone-500">{inputEnabled ? "接続中" : "未接続"} · {inputMode === "judge" ? "TAB判定" : "チューナー"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-900 p-1" aria-label="入力モード">
              <button className="min-h-10 rounded-lg px-4 text-xs font-black data-[active=true]:bg-lime-300 data-[active=true]:text-lime-950" data-active={inputMode === "judge"} type="button" onClick={() => setInputMode("judge")}>TAB判定</button>
              <button className="min-h-10 rounded-lg px-4 text-xs font-black data-[active=true]:bg-lime-300 data-[active=true]:text-lime-950" data-active={inputMode === "tuner"} type="button" onClick={() => setInputMode("tuner")}>チューナー</button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(12rem,1.2fr)_repeat(3,minmax(5.5rem,.55fr))_minmax(14rem,1.2fr)]">
            <div className="flex min-w-0 gap-2">
              {inputEnabled && audioDevices.length > 0 ? (
                <select className="min-h-11 min-w-0 flex-1 rounded-xl border border-stone-700 bg-stone-900 px-3 text-xs font-bold text-stone-100" value={selectedDeviceId} onChange={(event) => void connectInput(event.target.value)} aria-label="入力デバイス">
                  {audioDevices.map((device, index) => <option value={device.deviceId} key={device.deviceId}>{device.label || `音声入力 ${index + 1}`}</option>)}
                </select>
              ) : (
                <button className="min-h-11 flex-1 rounded-xl bg-lime-300 px-3 text-sm font-black text-lime-950" onClick={() => void connectInput()} type="button">Amperoを接続</button>
              )}
              {inputEnabled && <button className="min-h-11 rounded-xl border border-stone-700 px-3 text-xs font-bold" onClick={disconnectInput} type="button">切断</button>}
            </div>
            <div className="rounded-xl bg-stone-900 px-3 py-2 text-center">
              <p className="text-[0.62rem] font-bold text-stone-500">{inputMode === "judge" ? "ねらう音" : "基準音"}</p>
              <p className="text-lg font-black tabular-nums">{displayTargetFrequency ? noteName(displayTargetFrequency) : "—"}</p>
            </div>
            <div className="rounded-xl bg-stone-900 px-3 py-2 text-center">
              <p className="text-[0.62rem] font-bold text-stone-500">入力音</p>
              <p className="text-lg font-black tabular-nums">{detectedFrequency ? noteName(detectedFrequency) : "—"}</p>
            </div>
            <div className="rounded-xl bg-stone-900 px-3 py-2 text-center">
              <p className="text-[0.62rem] font-bold text-stone-500">ずれ</p>
              <p className="text-lg font-black tabular-nums">{detectedCents === null ? "—" : `${detectedCents > 0 ? "+" : ""}${detectedCents.toFixed(0)}¢`}</p>
            </div>
            <div className="rounded-xl border border-stone-700 bg-stone-900 px-3 py-2" data-correct={pitchMatched}>
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-xs font-black" aria-live="polite">{tunerMessage}</p>
                <span className="shrink-0 text-[0.62rem] font-bold text-stone-500 tabular-nums">IN {Math.round(inputLevel * 100)}%</span>
              </div>
              <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-stone-700" role="meter" aria-label="ギター入力レベル" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(inputLevel * 100)}>
                <div className="h-full rounded-full bg-lime-300" style={{ width: `${Math.round(inputLevel * 100)}%` }} />
                <span className="absolute left-1/2 top-0 h-full w-px bg-white/70" style={{ transform: `translateX(${tunerOffset}px)` }} />
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {inputMode === "judge" ? (
              <div className="flex flex-wrap items-center gap-2">
                <button className="min-h-10 rounded-xl bg-lime-300 px-4 text-xs font-black text-lime-950" onClick={guidedMode ? stopGuidedMode : startGuidedMode} type="button">{guidedMode ? "■ 正解ゲート停止" : "▶ 正解で曲を進める"}</button>
                <label className="flex min-h-10 cursor-pointer items-center gap-2 text-xs font-bold"><input className="size-4" type="checkbox" checked={autoAdvance} onChange={(event) => setAutoAdvance(event.target.checked)} />正解で次の音へ</label>
                <span className="text-xs font-bold text-stone-500">{guidedMode ? (guidedWaiting ? (pitchMatched ? "正解 → 次の音まで曲を再生" : "正しい音が来るまで曲を停止") : "次の判定位置まで曲を進行中") : "譜面を見ながら判定"}</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1" aria-label="チューナーで判定する弦">
                <button aria-pressed={tunerString === "auto"} className="min-h-10 rounded-lg border border-stone-700 px-3 text-xs font-black data-[active=true]:border-lime-300 data-[active=true]:bg-lime-300 data-[active=true]:text-lime-950" data-active={tunerString === "auto"} onClick={() => setTunerString("auto")} type="button">AUTO</button>
                {TUNER_STRINGS.map((string) => (
                  <button aria-pressed={tunerString === string.stringNo} className="min-h-10 rounded-lg border border-stone-700 px-3 text-xs font-black data-[active=true]:border-lime-300 data-[active=true]:bg-lime-300 data-[active=true]:text-lime-950" data-active={tunerString === string.stringNo} onClick={() => setTunerString(string.stringNo)} type="button" key={string.label}>
                    {string.label} {string.name}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs font-bold text-stone-600">{trackId === "backing" ? "和音の判定はルート音を1音ずつ" : "Amperoはクリーン音・1音ずつ"}</p>
          </div>
          <label className="mt-2 grid gap-1 text-xs font-bold text-stone-500 sm:grid-cols-[auto_minmax(10rem,22rem)_auto] sm:items-center">
            入力感度
            <input aria-label="入力感度" className="min-h-10 w-full" max="0.012" min="0.001" onChange={(event) => setInputSensitivity(Number(event.target.value))} step="0.001" type="range" value={inputSensitivity} />
            <span className="tabular-nums">{inputSensitivity <= 0.003 ? "高" : inputSensitivity >= 0.008 ? "低" : "標準"}</span>
          </label>
          {inputError && <p className="mt-2 rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-xs font-bold text-red-200" role="alert">{inputError}</p>}
        </div>
      </details>

      <div className="mx-auto grid max-w-[160rem] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:px-8">
        <div className="min-w-0 space-y-6">
          <section className="overflow-hidden rounded-2xl border border-stone-800 bg-stone-900" aria-labelledby="video-title">
            <div className="flex flex-col gap-4 border-b border-stone-800 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
              <div>
                <p className="text-sm font-bold text-lime-300">ORIGINAL VIDEO</p>
                <h2 id="video-title" className="mt-1 text-balance text-2xl font-black">原曲動画</h2>
                <p className="mt-2 text-pretty text-sm text-stone-400">{track.videoStartLabel}を1小節目として{song.originalBpm} BPMで換算。SONG MAPから選ぶと、{track.label}動画も同じ小節の位置へ移動します。</p>
              </div>
              <div className={cn("grid gap-2", track.videoStartSeconds === 0 ? "grid-cols-2" : "grid-cols-3")}>
                <button className="min-h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm font-bold data-[active=true]:border-lime-300 data-[active=true]:text-lime-300" data-active={videoStart === 0} onClick={() => setVideoPreset(0)} type="button">演奏 0:00</button>
                {track.videoStartSeconds > 0 && <button className="min-h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm font-bold data-[active=true]:border-lime-300 data-[active=true]:text-lime-300" data-active={videoStart === track.videoStartSeconds} onClick={() => setVideoPreset(track.videoStartSeconds, 1)} type="button">{track.videoStartLabel}</button>}
                <button className="min-h-11 rounded-xl border border-lime-300 bg-lime-300 px-3 text-sm font-black text-lime-950" onClick={() => playVideoFromMeasure(activeMeasure)} type="button">▶ {activeMeasure}小節</button>
              </div>
            </div>
            <div className="video-frame">
              <iframe
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                key={`${videoStart}-${videoNonce}`}
                loading="lazy"
                onLoad={() => {
                  sendVideoCommand("setPlaybackRate", [bpm / song.originalBpm]);
                  if (videoAutoplay) sendVideoCommand("playVideo");
                }}
                ref={iframeRef}
                src={`https://www.youtube-nocookie.com/embed/${track.videoId}?start=${videoStart}&rel=0&autoplay=${videoAutoplay ? 1 : 0}&enablejsapi=1&playsinline=1`}
                title={`${song.title} ${track.label} TAB 動画`}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-stone-800 bg-stone-900 p-4 sm:p-6" aria-labelledby="song-map-title">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-bold text-lime-300">SONG MAP</p>
                <h2 id="song-map-title" className="mt-1 text-balance text-2xl font-black">曲のどこを弾いているか</h2>
              </div>
              <p className="text-pretty text-sm text-stone-400">{trackId === "backing" ? "バッキングTAB / 黄 = ミュート・アルペジオ区間" : "緑 = 単音TAB / 黄 = 特殊奏法 / 暗色 = リード休み"}</p>
            </div>
            <SongMap parts={song.map} currentMeasure={activeMeasure} onJump={jumpScoreTo} />
            <div className="mt-4 flex flex-col gap-2 rounded-xl border border-stone-700 bg-stone-950 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-stone-300">
                共通位置 <span className="text-lime-300 tabular-nums">{activeMeasure}小節</span>
                <span className="ml-2 text-stone-500">SONG MAP → TAB → 動画位置</span>
              </p>
              <button className="min-h-11 rounded-xl border border-lime-300 px-4 text-sm font-black text-lime-300 hover:bg-lime-300 hover:text-lime-950" onClick={() => playVideoFromMeasure(activeMeasure)} type="button">
                ▶ 動画を{activeMeasure}小節から
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-700 bg-stone-900 p-4 shadow-xl sm:p-6" aria-labelledby="full-score-title">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-bold text-lime-300">{track.badge} TAB · 全曲</p>
                <h2 id="full-score-title" className="mt-1 text-balance text-2xl font-black">{track.label}を1〜{song.totalMeasures}小節</h2>
                <p className="mt-2 max-w-2xl text-pretty text-sm text-stone-400">{track.description}</p>
                <p className="mt-2 max-w-2xl text-pretty text-xs font-bold text-stone-500">各小節は原動画の該当フレームから抽出しています。読取値がフレット範囲外なら「?」として再生・判定から除外し、動画確認が必要な小節を橙色で示します。訂正メモも小節単位で残せます。</p>
              </div>
              <label className="grid gap-1 text-xs font-bold text-stone-400">
                小節へ移動
                <select
                  className="min-h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm font-bold text-stone-100"
                  onChange={(event) => jumpScoreTo(activeScorePages[Number(event.target.value)].start)}
                  value={scorePageIndex}
                >
                  {activeScorePages.map((page, index) => <option value={index} key={page.start}>{page.start}〜{page.end}小節</option>)}
                </select>
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-lime-300/60 bg-stone-950 p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black text-lime-300">TAB音源でまとめ再生</p>
                  <p className="mt-1 text-sm font-bold text-stone-200" aria-live="polite">
                    {playing
                      ? `再生中 · ${playbackLabel} · ${playbackMeasure ?? activeMeasure}小節`
                      : canResumeSelected
                        ? `一時停止中 · ${pausedSession?.label} · ${playbackMeasure ?? activeMeasure}小節`
                        : `選択中 · ${selectedPlaybackChoice.label}`}
                  </p>
                </div>
                <button
                  aria-label={playing ? "TAB音源を一時停止" : canResumeSelected ? "TAB音源を途中から再開" : `${selectedPlaybackChoice.label}を再生`}
                  className={cn(
                    "min-h-12 min-w-32 rounded-xl border px-5 text-sm font-black transition-colors",
                    playing
                      ? "border-red-400 bg-red-400/10 text-red-300 hover:bg-red-400 hover:text-stone-950"
                      : "border-lime-300 bg-lime-300 text-lime-950 hover:bg-lime-200",
                  )}
                  onClick={toggleSelectedPlayback}
                  type="button"
                >
                  {playing ? "Ⅱ 一時停止" : canResumeSelected ? "▶ 再開" : "▶ 再生"}
                </button>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-800" role="progressbar" aria-label="選択範囲の再生位置" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(selectedPlaybackProgress * 100)}>
                <div className="h-full rounded-full bg-lime-300 transition-[width] duration-100" style={{ width: `${selectedPlaybackProgress * 100}%` }} />
              </div>

              <div className="mt-4 grid gap-2 rounded-xl border border-stone-800 bg-stone-900 p-3 sm:grid-cols-[repeat(3,auto)_1fr] sm:items-center">
                <button className="min-h-11 rounded-lg border border-stone-700 px-3 text-xs font-black hover:border-lime-300" onClick={() => { setLoopStart(activeMeasure); if (loopEnd < activeMeasure) setLoopEnd(activeMeasure); setPlaybackPreset("loop"); }} type="button">A = {loopStart}小節</button>
                <button className="min-h-11 rounded-lg border border-stone-700 px-3 text-xs font-black hover:border-lime-300" onClick={() => { setLoopEnd(activeMeasure); if (loopStart > activeMeasure) setLoopStart(activeMeasure); setPlaybackPreset("loop"); }} type="button">B = {loopEnd}小節</button>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-black"><input className="size-4" checked={loopEnabled} onChange={(event) => setLoopEnabled(event.target.checked)} type="checkbox" />A/Bを反復</label>
                <p className="text-pretty text-xs font-bold text-stone-500">SONG MAPかTABで位置を選び、A/Bボタンで練習区間を固定できます。</p>
              </div>

              <div className="mt-4 grid gap-2 rounded-xl border border-stone-800 bg-stone-900 p-3 sm:grid-cols-[repeat(3,minmax(5.5rem,auto))_1fr] sm:items-center" data-correct={pitchMatched}>
                <p className="text-xs font-black text-stone-400">譜面横の判定</p>
                <p className="text-sm font-black tabular-nums">狙い {noteName(targetFrequency)}</p>
                <p className="text-sm font-black tabular-nums">入力 {detectedFrequency ? noteName(detectedFrequency) : "—"}</p>
                <p className="text-pretty text-xs font-bold text-stone-400" aria-live="polite">{inputEnabled ? tunerMessage : "Amperoは上の入力パネルから接続"}</p>
              </div>

              <p className="mt-4 text-xs font-black text-stone-500">再生範囲を選択</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                {playbackChoices.map((choice) => {
                  const selected = choice.id === playbackPreset;
                  return (
                    <button
                      aria-pressed={selected}
                      className={cn(
                        "relative min-h-16 rounded-xl border px-4 py-3 text-left text-sm font-black transition-colors",
                        selected
                          ? "border-lime-300 bg-lime-300 text-lime-950 shadow-[0_0_0_1px_rgba(190,242,100,0.35)]"
                          : "border-stone-700 bg-stone-900 text-stone-200 hover:border-lime-300 hover:bg-stone-800",
                      )}
                      key={choice.id}
                      onClick={() => selectPlaybackPreset(choice.id)}
                      type="button"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span>{choice.title}</span>
                        {selected && <span className="rounded-full bg-lime-950 px-2 py-0.5 text-[10px] text-lime-200">選択中</span>}
                      </span>
                      <small className={cn("mt-1 block font-bold", selected ? "text-lime-900" : "text-stone-500")}>{choice.detail}</small>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-col gap-2 border-t border-stone-800 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-pretty text-xs font-bold text-stone-500">一時停止後は同じ位置から再開。範囲変更や小節移動をすると停止位置を破棄します。</p>
                <label className="flex min-h-10 cursor-pointer items-center gap-2 text-xs font-black"><input className="size-4" checked={videoSync} onChange={(event) => setVideoSync(event.target.checked)} type="checkbox" />動画もBPM・位置に同期</label>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              {selectedScorePage.measures.map((measure) => (
                <ScoreMeasure
                  songId={songId}
                  trackId={trackId}
                  measure={measure}
                  isPlaying={scoreCursor.measure === measure}
                  cursorStep={scoreCursor.measure === measure ? scoreCursor.step : null}
                  key={measure}
                />
              ))}
            </div>

            <details className="mt-4 rounded-xl border border-amber-800/70 bg-amber-950/20 p-4 text-sm text-stone-300">
              <summary className="min-h-6 cursor-pointer font-black text-amber-300">譜面の監査・訂正メモ</summary>
              <p className="mt-3 text-pretty text-xs font-bold leading-5 text-stone-400">現在表示中の小節ごとに、原動画と違う弦・フレット・リズムを記録できます。メモはこの端末に自動保存されます。</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {selectedScorePage.measures.map((measure) => {
                  const auditKey = `${songId}:${trackId}:${measure}`;
                  return (
                    <label className="grid gap-1 text-xs font-black" key={auditKey}>
                      {measure}小節の訂正メモ
                      <textarea
                        className="min-h-24 resize-y rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 font-medium text-stone-100 placeholder:text-stone-600"
                        onChange={(event) => setAuditNotes((current) => ({ ...current, [auditKey]: event.target.value }))}
                        placeholder="例: 2拍目の10は2弦ではなく3弦"
                        value={auditNotes[auditKey] ?? ""}
                      />
                    </label>
                  );
                })}
              </div>
            </details>

            <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <button className="min-h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm font-bold disabled:opacity-40" disabled={scorePageIndex === 0} onClick={() => jumpScoreTo(activeScorePages[Math.max(0, scorePageIndex - 1)].start)} type="button">← 前の4小節</button>
              <p className="px-2 text-center text-sm font-black tabular-nums">{selectedScorePage.start}–{selectedScorePage.end}</p>
              <button className="min-h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm font-bold disabled:opacity-40" disabled={scorePageIndex === activeScorePages.length - 1} onClick={() => jumpScoreTo(activeScorePages[Math.min(activeScorePages.length - 1, scorePageIndex + 1)].start)} type="button">次の4小節 →</button>
            </div>
            <details className="mt-4 rounded-xl border border-stone-700 bg-stone-950 p-4 text-sm text-stone-300">
              <summary className="min-h-6 cursor-pointer font-black text-stone-100">TABの読み方</summary>
              <p className="mt-3 text-pretty leading-6"><strong>上が1弦、下が6弦。</strong> 数字は押さえるフレットです。<span className="font-black tabular-nums">(5)</span> や <span className="font-black tabular-nums">(10)</span> は前の音を伸ばし、もう一度ピッキングしません。<span className="font-black">×</span> はミュート、<span className="font-black">sl.</span> はスライドです。</p>
            </details>
          </section>

          <section className="overflow-hidden rounded-2xl border border-stone-700 bg-stone-900 shadow-xl" aria-labelledby="current-note-title">
            <div className="flex flex-col gap-6 border-b border-stone-700 p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-lime-300 tabular-nums">
                    {trackId === "backing" ? "CHORD ROOT" : "NOTE"} {String(noteIndex + 1).padStart(2, "0")} / {activeNotes.length}
                  </p>
                  <h2 id="current-note-title" className="mt-2 text-balance text-4xl font-black sm:text-5xl" aria-live="polite">
                    {currentNote.stringNo}弦 <span className="text-lime-300 tabular-nums">{currentNote.fret}</span>フレット
                  </h2>
                  <p className="mt-3 text-pretty text-stone-300">
                    {stringDescription(currentNote.stringNo)}。{trackId === "backing" ? "コード判定用のルート音" : "TABの単音"}として{currentNote.fret}フレットを狙います。
                  </p>
                </div>
                <button
                  className="min-h-11 rounded-xl border border-stone-600 bg-stone-800 px-4 py-2.5 text-sm font-bold text-stone-100 hover:bg-stone-700"
                  type="button"
                  onClick={toggleLearned}
                  aria-pressed={learnedIds.has(currentNote.id)}
                >
                  {learnedIds.has(currentNote.id) ? "✓ 覚えた" : "できた！を付ける"}
                </button>
              </div>

              <div className="rounded-2xl border border-stone-700 bg-stone-950 p-4 sm:p-6">
                <div className="mb-4 flex items-center justify-between text-xs font-bold text-stone-400">
                  <span>細い弦</span>
                  <span>← ヘッド側 · TAB上のフレット →</span>
                  <span>太い弦</span>
                </div>
                <div className="overflow-x-auto pb-2">
                  <div className="min-w-[36rem]">
                    <div className="mb-2 grid grid-cols-[4rem_repeat(5,1fr)] gap-1 text-center text-xs font-bold text-stone-500 tabular-nums">
                      <span>弦</span>
                      {fretRange.map((fret) => <span key={fret}>TAB {fret}</span>)}
                    </div>
                    <div className="space-y-1">
                      {STRING_RANGE.map((stringNo) => (
                        <div className="grid grid-cols-[4rem_repeat(5,1fr)] gap-1" key={stringNo}>
                          <div className="flex min-h-10 items-center justify-center rounded-lg bg-stone-800 text-sm font-black tabular-nums">{stringNo}弦</div>
                          {fretRange.map((fret) => (
                            <div
                              className="fret-cell flex min-h-10 items-center justify-center rounded-lg border border-stone-700 bg-stone-900 text-sm text-stone-400 tabular-nums"
                              data-current={stringNo === currentNote.stringNo && fret === currentNote.fret}
                              data-string={stringNo === currentNote.stringNo}
                              key={`${stringNo}-${fret}`}
                            >
                              {stringNo === currentNote.stringNo && fret === currentNote.fret ? "●" : fret}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-stone-800 p-4">
                  <p className="text-xs font-bold text-stone-500">押さえ方のヒント</p>
                  <p className="mt-2 text-pretty font-bold">{fingerHint(currentNote.fret)}</p>
                </div>
                <div className="rounded-xl bg-stone-800 p-4">
                  <p className="text-xs font-bold text-stone-500">実際のギター上では</p>
                  <p className="mt-2 font-bold tabular-nums">カポ{song.capo} + TAB {currentNote.fret} = {currentNote.fret + song.capo}フレット位置</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 bg-stone-800/50 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
              <div className="grid grid-cols-3 gap-2">
                <button className="min-h-12 rounded-xl border border-stone-600 bg-stone-900 px-3 font-bold disabled:cursor-not-allowed disabled:opacity-40" type="button" onClick={() => goBy(-1)} disabled={noteIndex === 0}>← 前の音</button>
                <button className="min-h-12 rounded-xl bg-lime-300 px-3 font-black text-lime-950 hover:bg-lime-200" type="button" onClick={playCurrentNote}>音を聴く</button>
                <button className="min-h-12 rounded-xl border border-stone-600 bg-stone-900 px-3 font-bold disabled:cursor-not-allowed disabled:opacity-40" type="button" onClick={() => goBy(1)} disabled={noteIndex === activeNotes.length - 1}>次の音 →</button>
              </div>
              <button
                className="min-h-12 rounded-xl border border-lime-300 px-5 font-black text-lime-300 hover:bg-lime-300 hover:text-lime-950"
                type="button"
                onClick={playing ? stopPlayback : playMeasure}
              >
                {playing ? "■ 停止" : `▶ ${currentNote.measure}小節を再生`}
              </button>
            </div>
          </section>

          {songId === "life-over" && trackId === "lead" && <section className="rounded-2xl border border-stone-800 bg-stone-900 p-4 sm:p-6" aria-labelledby="technique-title">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-bold text-lime-300">PLAYING GUIDE</p>
                <h2 id="technique-title" className="mt-1 text-balance text-2xl font-black">奏法記号を「指の動き」で見る</h2>
                <p className="mt-2 max-w-2xl text-pretty text-sm text-stone-400">小節ごとの文字一覧はやめました。記号が出たときに左手とピッキングをどう動かすか、6種類だけ図解します。</p>
              </div>
              <span className="rounded-lg border border-stone-700 px-3 py-2 text-xs font-bold text-stone-400">カードを押すと該当TABへ</span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {TECHNIQUE_GUIDES.map((guide) => (
                <TechniqueGuideCard guide={guide} onJump={jumpScoreTo} key={guide.kind} />
              ))}
            </div>
          </section>}
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-stone-800 bg-stone-900 p-5" aria-labelledby="tempo-title">
            <p className="text-sm font-bold text-lime-300">PRACTICE SPEED</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <h2 id="tempo-title" className="text-balance text-xl font-black">練習テンポ</h2>
              <p className="text-3xl font-black tabular-nums">{bpm}<span className="ml-1 text-xs text-stone-500">BPM</span></p>
            </div>
            <input className="mt-5 min-h-11 w-full" type="range" min="50" max={song.originalBpm} step="1" value={bpm} onChange={(event) => changeBpm(Number(event.target.value))} aria-label="練習テンポ" />
            <div className="mt-2 flex justify-between text-xs text-stone-500 tabular-nums"><span>50</span><span>{song.originalBpm}</span></div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[0.5, 0.75, 1].map((ratio) => {
                const value = Math.round(song.originalBpm * ratio);
                return (
                <button className="min-h-11 rounded-lg border border-stone-700 bg-stone-950 text-sm font-bold data-[active=true]:border-lime-300 data-[active=true]:text-lime-300" data-active={bpm === value} type="button" onClick={() => changeBpm(value)} key={ratio}>{Math.round(ratio * 100)}%</button>
                );
              })}
            </div>
            <p className="mt-3 text-pretty text-xs font-bold text-stone-500">
              {videoSync ? "動画同期ON：YouTubeが実際に再生できる速度へ即時スナップします。" : "動画同期OFF：1 BPM単位でTAB音源だけ速度を変えられます。"}
            </p>
            <label className="mt-5 flex min-h-11 cursor-pointer items-center gap-3 border-t border-stone-800 pt-4 text-sm font-bold">
              <input className="size-5" type="checkbox" checked={countIn} onChange={(event) => setCountIn(event.target.checked)} />
              1小節カウントしてから開始
            </label>
            <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-bold">
              <input className="size-5" type="checkbox" checked={metronome} onChange={(event) => setMetronome(event.target.checked)} />
              再生中もクリック音を鳴らす
            </label>
          </section>

          <section className="rounded-2xl border border-stone-800 bg-stone-900 p-5" aria-labelledby="lesson-title">
            <p className="text-sm font-bold text-lime-300">TAB MINI LESSON</p>
            <h2 id="lesson-title" className="mt-2 text-balance text-xl font-black">これだけ分かれば弾ける</h2>
            <ol className="mt-5 space-y-4">
              <li className="grid grid-cols-[2rem_1fr] gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-lime-300 font-black text-lime-950 tabular-nums">1</span>
                <div><h3 className="font-black">横線は6本の弦</h3><p className="mt-1 text-pretty text-sm text-stone-400">一番上が細い1弦、一番下が太い6弦。ギターを構えた見た目とは上下が逆です。</p></div>
              </li>
              <li className="grid grid-cols-[2rem_1fr] gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-stone-800 font-black text-stone-200 tabular-nums">2</span>
                <div><h3 className="font-black">数字はフレット</h3><p className="mt-1 text-pretty text-sm text-stone-400">「7」ならカポから7つ先。数字のある弦だけをピッキングします。</p></div>
              </li>
              <li className="grid grid-cols-[2rem_1fr] gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-stone-800 font-black text-stone-200 tabular-nums">3</span>
                <div><h3 className="font-black">休と (数字)</h3><p className="mt-1 text-pretty text-sm text-stone-400">「休」は弾かない。(5) は前の5フレット音をそのまま伸ばします。</p></div>
              </li>
            </ol>
          </section>

          <section className="rounded-2xl border border-stone-800 bg-stone-900 p-5" aria-labelledby="progress-title">
            <div className="flex items-end justify-between gap-4">
              <div><p className="text-sm font-bold text-lime-300">TODAY</p><h2 id="progress-title" className="mt-1 text-balance text-xl font-black">覚えた音</h2></div>
              <p className="text-2xl font-black tabular-nums">{learnedForSong}<span className="text-sm text-stone-500"> / {activeNotes.length}</span></p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-800" role="progressbar" aria-label="覚えた音の進捗" aria-valuemin={0} aria-valuemax={activeNotes.length} aria-valuenow={learnedForSong}>
              <div className="progress-fill h-full rounded-full bg-lime-300" style={{ "--progress": `${learnedProgress}%` } as React.CSSProperties} />
            </div>
            <p className="mt-3 text-pretty text-sm text-stone-400">場所を見ずに3回続けて弾けたら「できた！」を付けよう。</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
