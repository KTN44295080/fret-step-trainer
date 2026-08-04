"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  const holdString: StringNumber = variation === "low" ? 3 : 2;
  const middle: Array<[number, "note" | "rest", StringNumber?, number?, number?]> =
    variation === "high"
      ? [
          [1, "note", 2, 13], [2, "note", 1, 13], [3, "note", 1, 10, 2],
          [5, "note", 2, 13], [6, "note", 2, 10, 2],
        ]
      : variation === "low"
        ? [
            [1, "note", 3, 10], [2, "note", 3, 12], [3, "note", 3, 10, 2],
            [5, "note", 3, 10], [6, "note", 3, 10, 2],
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

const SCORE_PAGES = Array.from({ length: Math.ceil(151 / 4) }, (_, page) => {
  const start = page * 4 + 1;
  return { start, end: Math.min(151, start + 3), measures: Array.from({ length: Math.min(4, 152 - start) }, (__, index) => start + index) };
});

const SONG_MAP = [
  { label: "イントロ", range: "1–17", start: 1, end: 17, kind: "notes" },
  { label: "休み", range: "18–33", start: 18, end: 33, kind: "rest" },
  { label: "サビ〜間奏", range: "34–57", start: 34, end: 57, kind: "notes" },
  { label: "休み", range: "58–65", start: 58, end: 65, kind: "rest" },
  { label: "奏法", range: "66–81", start: 66, end: 81, kind: "technique" },
  { label: "後半", range: "82–113", start: 82, end: 113, kind: "notes" },
  { label: "奏法", range: "114–116", start: 114, end: 116, kind: "technique" },
  { label: "大サビ", range: "117–141", start: 117, end: 141, kind: "notes" },
  { label: "Final", range: "142–148", start: 142, end: 148, kind: "technique" },
  { label: "END", range: "149–151", start: 149, end: 151, kind: "rest" },
];

const NOTES = TAB_EVENTS.filter(
  (event): event is TabEvent & { stringNo: StringNumber; fret: number } =>
    event.kind === "note" && event.stringNo !== undefined && event.fret !== undefined,
);

type PlaybackEvent = {
  measure: number;
  step: number;
  stringNo: StringNumber;
  fret: number;
  durationSteps: number;
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

const TAB_VIDEO_START_SECONDS = 215;
const ORIGINAL_BPM = 170;

function parseFretSymbol(text: string) {
  if (text.includes("×") || text.startsWith("(")) return null;
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function scorePlaybackEvents(measure: number): PlaybackEvent[] {
  const glyphs = TECHNIQUE_TAB_GLYPHS[measure];
  if (glyphs) {
    return glyphs.flatMap((glyph) => {
      if (glyph.technique === "tie") return [];
      return glyph.symbols.flatMap((symbol) => {
        const fret = parseFretSymbol(symbol.text);
        return fret === null
          ? []
          : [{ measure, step: glyph.slot, stringNo: symbol.stringNo, fret, durationSteps: 2 }];
      });
    });
  }

  return NOTES
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

function videoTimeForMeasure(measure: number) {
  return Math.round(TAB_VIDEO_START_SECONDS + ((measure - 1) * 4 * 60) / ORIGINAL_BPM);
}

function formatClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function rangeDuration(startMeasure: number, endMeasure: number, bpm: number) {
  return formatClock(((endMeasure - startMeasure + 1) * 4 * 60) / bpm);
}

const STRING_RANGE: StringNumber[] = [1, 2, 3, 4, 5, 6];
const OPEN_STRING_MIDI = [0, 64, 59, 55, 50, 45, 40];

function fingerHint(fret: number) {
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

function frequencyFor(stringNo: StringNumber, fret: number) {
  const midi = OPEN_STRING_MIDI[stringNo] + 3 + fret;
  return 440 * 2 ** ((midi - 69) / 12);
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
    cents: 1200 * Math.log2(frequency / targetFrequency),
  };
}

const TUNER_STRINGS = [
  { label: "6弦", name: "E2", frequency: 82.41 },
  { label: "5弦", name: "A2", frequency: 110 },
  { label: "4弦", name: "D3", frequency: 146.83 },
  { label: "3弦", name: "G3", frequency: 196 },
  { label: "2弦", name: "B3", frequency: 246.94 },
  { label: "1弦", name: "E4", frequency: 329.63 },
] as const;

function detectPitch(buffer: Float32Array, sampleRate: number, targetFrequency?: number) {
  let energy = 0;
  for (const sample of buffer) energy += sample * sample;
  const rms = Math.sqrt(energy / buffer.length);
  if (rms < 0.004) return null;

  const searchRatio = Math.SQRT2;
  const maximumFrequency = targetFrequency ? targetFrequency * searchRatio : 1100;
  const minimumFrequency = targetFrequency ? targetFrequency / searchRatio : 65;
  const minimumLag = Math.max(2, Math.floor(sampleRate / maximumFrequency));
  const maximumLag = Math.min(
    Math.ceil(sampleRate / minimumFrequency),
    Math.floor(buffer.length / 2),
  );
  const usableLength = buffer.length - maximumLag;
  const difference = new Float32Array(maximumLag + 1);
  const normalized = new Float32Array(maximumLag + 1);

  for (let lag = 1; lag <= maximumLag; lag += 1) {
    let sum = 0;
    for (let index = 0; index < usableLength; index += 1) {
      const delta = buffer[index] - buffer[index + lag];
      sum += delta * delta;
    }
    difference[lag] = sum;
  }

  let runningSum = 0;
  normalized[0] = 1;
  for (let lag = 1; lag <= maximumLag; lag += 1) {
    runningSum += difference[lag];
    normalized[lag] = runningSum === 0 ? 1 : (difference[lag] * lag) / runningSum;
  }

  let bestLag = minimumLag;
  if (targetFrequency) {
    for (let lag = minimumLag + 1; lag < maximumLag; lag += 1) {
      if (normalized[lag] < normalized[bestLag]) bestLag = lag;
    }
  } else {
    let firstStrongMinimum: number | null = null;
    for (let lag = minimumLag + 1; lag < maximumLag - 1; lag += 1) {
      if (
        normalized[lag] < 0.22
        && normalized[lag] <= normalized[lag - 1]
        && normalized[lag] < normalized[lag + 1]
      ) {
        firstStrongMinimum = lag;
        break;
      }
    }
    if (firstStrongMinimum !== null) {
      bestLag = firstStrongMinimum;
      const octaveLag = firstStrongMinimum * 2;
      if (
        octaveLag < maximumLag
        && normalized[octaveLag] < normalized[firstStrongMinimum] * 0.8
      ) bestLag = octaveLag;
    } else {
      for (let lag = minimumLag + 1; lag < maximumLag; lag += 1) {
        if (normalized[lag] < normalized[bestLag]) bestLag = lag;
      }
    }
  }
  if (normalized[bestLag] > (targetFrequency ? 0.34 : 0.28)) return null;

  const before = normalized[bestLag - 1] ?? normalized[bestLag];
  const center = normalized[bestLag];
  const after = normalized[bestLag + 1] ?? normalized[bestLag];
  const denominator = before - 2 * center + after;
  const adjustment = denominator === 0 ? 0 : (before - after) / (2 * denominator);
  return sampleRate / (bestLag + adjustment);
}

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
    <section className="overflow-x-auto rounded-xl border border-stone-700 bg-stone-900" aria-label={`${measure}小節目`}>
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
    <section className="overflow-x-auto rounded-xl border border-amber-700/70 bg-stone-900" aria-label={`${measure}小節目、特殊奏法`}>
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

function RestTabMeasure({ measure }: { measure: number }) {
  return (
    <section className="overflow-x-auto rounded-xl border border-stone-800 bg-stone-950" aria-label={`${measure}小節目、リードは休み`}>
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
  measure,
  currentId,
  learnedIds,
  onSelect,
  isPlaying,
}: {
  measure: number;
  currentId: string;
  learnedIds: Set<string>;
  onSelect: (id: string) => void;
  isPlaying: boolean;
}) {
  const score = TECHNIQUE_TAB_GLYPHS[measure]
    ? <TechniqueTabMeasure measure={measure} />
    : TAB_EVENTS.some((event) => event.measure === measure)
      ? <TabMeasure measure={measure} currentId={currentId} learnedIds={learnedIds} onSelect={onSelect} />
      : <RestTabMeasure measure={measure} />;

  return <div className="score-measure" data-playing={isPlaying}>{score}</div>;
}

function SongMap({ currentMeasure, onJump }: { currentMeasure: number; onJump: (measure: number) => void }) {
  return (
    <div className="song-map" aria-label="曲全体の構成">
      {SONG_MAP.map((part) => (
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
  const [noteIndex, setNoteIndex] = useState(0);
  const [scorePageIndex, setScorePageIndex] = useState(0);
  const [timelineMeasure, setTimelineMeasure] = useState(1);
  const [videoStart, setVideoStart] = useState(TAB_VIDEO_START_SECONDS);
  const [videoAutoplay, setVideoAutoplay] = useState(false);
  const [videoNonce, setVideoNonce] = useState(0);
  const [bpm, setBpm] = useState(85);
  const [playing, setPlaying] = useState(false);
  const [playbackMeasure, setPlaybackMeasure] = useState<number | null>(null);
  const [playbackLabel, setPlaybackLabel] = useState("");
  const [countIn, setCountIn] = useState(true);
  const [metronome, setMetronome] = useState(true);
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
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [guidedMode, setGuidedMode] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerIdsRef = useRef<number[]>([]);
  const activeNodesRef = useRef<Set<OscillatorNode>>(new Set());
  const playbackSessionRef = useRef<PlaybackSession | null>(null);
  const inputStreamRef = useRef<MediaStream | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const inputFilterRef = useRef<BiquadFilterNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const moveToNoteIndex = useCallback((nextIndex: number) => {
    const boundedIndex = Math.min(NOTES.length - 1, Math.max(0, nextIndex));
    const nextMeasure = NOTES[boundedIndex].measure;
    setNoteIndex(boundedIndex);
    setTimelineMeasure(nextMeasure);
    setScorePageIndex(Math.floor((nextMeasure - 1) / 4));
  }, []);

  const currentNote = NOTES[noteIndex];
  const targetFrequency = frequencyFor(currentNote.stringNo, currentNote.fret);
  const learnedProgress = Math.round((learnedIds.size / NOTES.length) * 100);
  const fretRange = currentNote.fret >= 10
    ? [9, 10, 11, 12, 13]
    : [5, 6, 7, 8, 9];
  const tunerOffset = Math.max(-50, Math.min(50, detectedCents ?? 0)) * 1.4;
  const nearestDetectedPitch = detectedFrequency ? nearestPitch(detectedFrequency) : null;
  const displayTargetFrequency = inputMode === "judge"
    ? targetFrequency
    : nearestDetectedPitch?.frequency ?? null;
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
  const selectedScorePage = SCORE_PAGES[scorePageIndex];
  const activeMeasure = playbackMeasure ?? timelineMeasure;
  const currentSongPart = SONG_MAP.find((part) => activeMeasure >= part.start && activeMeasure <= part.end) ?? SONG_MAP[0];

  const clearTimers = useCallback(() => {
    timerIdsRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timerIdsRef.current = [];
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
    setPlaying(false);
    setPlaybackMeasure(null);
    setPlaybackLabel("");
  }, [clearPlaybackSchedule]);

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
        inputMode === "judge" ? targetFrequency : undefined,
      );

      if (frequency) {
        const pitch = nearestPitch(frequency);
        const cents = inputMode === "judge"
          ? 1200 * Math.log2(frequency / targetFrequency)
          : pitch.cents;
        const isCorrect = Math.abs(cents) <= (inputMode === "judge" ? 30 : 5)
          && (inputMode === "tuner" || !playing);
        setDetectedFrequency(frequency);
        setDetectedCents(cents);
        correctFrames = isCorrect ? correctFrames + 1 : 0;
        setPitchMatched(correctFrames >= 4);

        if (inputMode === "judge" && (autoAdvance || guidedMode) && correctFrames >= 8 && !advanced) {
          advanced = true;
          setLearnedIds((previous) => new Set(previous).add(currentNote.id));
          if (noteIndex < NOTES.length - 1) moveToNoteIndex(noteIndex + 1);
          else setGuidedMode(false);
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
  }, [autoAdvance, currentNote.fret, currentNote.id, currentNote.stringNo, guidedMode, inputEnabled, inputMode, moveToNoteIndex, noteIndex, playing, selectedDeviceId, targetFrequency]);

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
    if (!inputEnabled) void connectInput(selectedDeviceId || undefined);
  }

  function stopGuidedMode() {
    setGuidedMode(false);
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
    const frequency = frequencyFor(stringNo, fret);

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
    const totalSteps = (endMeasure - startMeasure + 1) * 16;
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

    if (countIn && boundedPosition < 0) {
      for (let step = -16; step < 0; step += 4) {
        if (step + 0.001 >= boundedPosition) {
          scheduleClick(context, startAt + (step - boundedPosition) * secondsPerStep, step === -16);
        }
      }
    }

    for (let measure = startMeasure; measure <= endMeasure; measure += 1) {
      const measureOffset = (measure - startMeasure) * 16;
      if (metronome) {
        for (let step = 0; step < 16; step += 4) {
          const clickStep = measureOffset + step;
          if (clickStep + 0.001 >= boundedPosition) {
            scheduleClick(context, startAt + (clickStep - boundedPosition) * secondsPerStep, step === 0);
          }
        }
      }

      scorePlaybackEvents(measure).forEach((event) => {
        const eventOffset = measureOffset + event.step;
        if (eventOffset + 0.001 < boundedPosition) return;
        schedulePluck(
          context,
          event.stringNo,
          event.fret,
          startAt + (eventOffset - boundedPosition) * secondsPerStep,
          Math.max(0.12, event.durationSteps * secondsPerStep * 0.86),
        );
        if (event.noteId) {
          const timerId = window.setTimeout(() => {
            const nextIndex = NOTES.findIndex((candidate) => candidate.id === event.noteId);
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
        }, (measureOffset - boundedPosition) * secondsPerStep * 1000);
        timerIdsRef.current.push(measureTimer);
      }
    }

    const currentMeasure = startMeasure + Math.min(
      endMeasure - startMeasure,
      Math.max(0, Math.floor(boundedPosition / 16)),
    );
    setPlaying(true);
    setPlaybackLabel(label);
    setPlaybackMeasure(currentMeasure);
    setTimelineMeasure(currentMeasure);
    setScorePageIndex(Math.floor((currentMeasure - 1) / 4));
    const endTimer = window.setTimeout(
      () => {
        playbackSessionRef.current = null;
        setPlaying(false);
        setPlaybackMeasure(null);
        setPlaybackLabel("");
      },
      (totalSteps - boundedPosition + 0.3) * secondsPerStep * 1000,
    );
    timerIdsRef.current.push(endTimer);
  }

  function playRange(startMeasure: number, endMeasure: number, label: string) {
    stopPlayback();
    scheduleRange(startMeasure, endMeasure, label, bpm, countIn ? -16 : 0);
  }

  function changeBpm(nextBpm: number) {
    const session = playbackSessionRef.current;
    setBpm(nextBpm);
    if (!session) return;

    const context = getAudioContext();
    const elapsedSeconds = Math.max(0, context.currentTime - session.scheduledAt);
    const currentPosition = session.positionSteps + (elapsedSeconds * session.bpm) / 15;
    clearPlaybackSchedule();
    scheduleRange(
      session.startMeasure,
      session.endMeasure,
      session.label,
      nextBpm,
      currentPosition,
    );
  }

  function playMeasure() {
    playRange(currentNote.measure, currentNote.measure, `${currentNote.measure}小節`);
  }

  function selectNote(id: string) {
    stopPlayback();
    const nextIndex = NOTES.findIndex((note) => note.id === id);
    if (nextIndex >= 0) moveToNoteIndex(nextIndex);
  }

  function goBy(delta: number) {
    stopPlayback();
    moveToNoteIndex(noteIndex + delta);
  }

  function jumpScoreTo(measure: number) {
    stopPlayback();
    setTimelineMeasure(measure);
    setScorePageIndex(Math.floor((measure - 1) / 4));
    const exactIndex = NOTES.findIndex((note) => note.measure === measure);
    if (exactIndex >= 0) moveToNoteIndex(exactIndex);
    setVideoStart(videoTimeForMeasure(measure));
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
    const exactIndex = NOTES.findIndex((note) => note.measure === measure);
    if (exactIndex >= 0) moveToNoteIndex(exactIndex);
    setVideoStart(videoTimeForMeasure(measure));
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

  return (
    <main className="min-h-dvh bg-stone-950 pb-16 text-stone-50">
      <header className="border-b border-stone-800 bg-stone-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-lime-300 px-2.5 py-1 text-xs font-black text-lime-950">FRET / STEP</span>
              <span className="rounded-md border border-stone-700 px-2.5 py-1 text-xs font-bold text-stone-300">LEAD ONLY</span>
            </div>
            <h1 className="text-balance text-3xl font-black sm:text-4xl">人生オーバー</h1>
            <p className="mt-2 text-pretty text-sm text-stone-400 sm:text-base">harha Guitar TAB · まずは下段のリードだけ</p>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-stone-800 bg-stone-900 px-4 py-3">
              <dt className="text-[0.68rem] font-bold text-stone-500">ORIGINAL</dt>
              <dd className="mt-1 font-black tabular-nums">170 BPM</dd>
            </div>
            <div className="rounded-xl border border-stone-800 bg-stone-900 px-4 py-3">
              <dt className="text-[0.68rem] font-bold text-stone-500">CAPO</dt>
              <dd className="mt-1 font-black tabular-nums">3</dd>
            </div>
            <div className="rounded-xl border border-stone-800 bg-stone-900 px-4 py-3">
              <dt className="text-[0.68rem] font-bold text-stone-500">RHYTHM</dt>
              <dd className="mt-1 font-black tabular-nums">4 / 4</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="live-console sticky top-0 z-50 border-b border-stone-700 bg-stone-950/95 shadow-2xl backdrop-blur" aria-labelledby="live-console-title">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
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
                <button className="min-h-10 rounded-xl bg-lime-300 px-4 text-xs font-black text-lime-950" onClick={guidedMode ? stopGuidedMode : startGuidedMode} type="button">{guidedMode ? "■ 正解待ち停止" : "▶ 正解待ちで進む"}</button>
                <label className="flex min-h-10 cursor-pointer items-center gap-2 text-xs font-bold"><input className="size-4" type="checkbox" checked={autoAdvance} onChange={(event) => setAutoAdvance(event.target.checked)} />正解で次の音へ</label>
                <span className="text-xs font-bold text-stone-500">{guidedMode ? (pitchMatched ? "正解 → 次へ" : "違う音なら停止したまま待機") : "譜面を見ながら判定"}</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1" aria-label="標準チューニングの開放弦">
                {TUNER_STRINGS.map((string) => <span className="rounded-lg border border-stone-800 px-2 py-1 text-[0.65rem] font-black text-stone-400" key={string.label}>{string.label} {string.name}</span>)}
              </div>
            )}
            <p className="text-xs font-bold text-stone-600">Amperoはクリーン音・1音ずつ</p>
          </div>
          {inputError && <p className="mt-2 rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-xs font-bold text-red-200" role="alert">{inputError}</p>}
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:px-8">
        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-stone-800 bg-stone-900 p-4 sm:p-6" aria-labelledby="song-map-title">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-bold text-lime-300">SONG MAP</p>
                <h2 id="song-map-title" className="mt-1 text-balance text-2xl font-black">曲のどこを弾いているか</h2>
              </div>
              <p className="text-pretty text-sm text-stone-400">緑 = 単音TAB / 黄 = 特殊奏法 / 暗色 = リード休み</p>
            </div>
            <SongMap currentMeasure={activeMeasure} onJump={jumpScoreTo} />
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

          <section className="overflow-hidden rounded-2xl border border-stone-800 bg-stone-900" aria-labelledby="video-title">
            <div className="flex flex-col gap-4 border-b border-stone-800 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
              <div>
                <p className="text-sm font-bold text-lime-300">ORIGINAL VIDEO</p>
                <h2 id="video-title" className="mt-1 text-balance text-2xl font-black">原曲動画</h2>
                <p className="mt-2 text-pretty text-sm text-stone-400">共通位置は3:35を1小節目として170 BPMで換算。SONG MAPから選ぶと、動画も同じ小節の位置へ移動します。</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button className="min-h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm font-bold data-[active=true]:border-lime-300 data-[active=true]:text-lime-300" data-active={videoStart === 0} onClick={() => setVideoPreset(0)} type="button">演奏 0:00</button>
                <button className="min-h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm font-bold data-[active=true]:border-lime-300 data-[active=true]:text-lime-300" data-active={videoStart === TAB_VIDEO_START_SECONDS} onClick={() => setVideoPreset(TAB_VIDEO_START_SECONDS, 1)} type="button">TAB 3:35</button>
                <button className="min-h-11 rounded-xl border border-lime-300 bg-lime-300 px-3 text-sm font-black text-lime-950" onClick={() => playVideoFromMeasure(activeMeasure)} type="button">▶ {activeMeasure}小節</button>
              </div>
            </div>
            <div className="video-frame">
              <iframe
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                key={`${videoStart}-${videoNonce}`}
                loading="lazy"
                src={`https://www.youtube-nocookie.com/embed/6LfUfHSIiMw?start=${videoStart}&rel=0&autoplay=${videoAutoplay ? 1 : 0}`}
                title="人生オーバー harha Guitar TAB 動画"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-stone-700 bg-stone-900 p-4 shadow-xl sm:p-6" aria-labelledby="full-score-title">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-bold text-lime-300">LEAD TAB · 全曲</p>
                <h2 id="full-score-title" className="mt-1 text-balance text-2xl font-black">下段リードを1〜151小節</h2>
                <p className="mt-2 max-w-2xl text-pretty text-sm text-stone-400">貼ってもらったTABを1つのデータ譜に統合。6本の線・数字・拍・奏法記号を描画し、同じデータを連続再生にも使います。</p>
              </div>
              <label className="grid gap-1 text-xs font-bold text-stone-400">
                小節へ移動
                <select
                  className="min-h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm font-bold text-stone-100"
                  onChange={(event) => jumpScoreTo(SCORE_PAGES[Number(event.target.value)].start)}
                  value={scorePageIndex}
                >
                  {SCORE_PAGES.map((page, index) => <option value={index} key={page.start}>{page.start}〜{page.end}小節</option>)}
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
                      : `停止中 · 共通位置 ${activeMeasure}小節`}
                  </p>
                </div>
                {playing && (
                  <button className="min-h-11 rounded-xl border border-red-400 px-5 text-sm font-black text-red-300 hover:bg-red-400 hover:text-stone-950" onClick={stopPlayback} type="button">■ 停止</button>
                )}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <button className="min-h-14 rounded-xl border border-stone-700 bg-stone-900 px-4 py-2 text-left text-sm font-black hover:border-lime-300" onClick={() => playRange(selectedScorePage.start, selectedScorePage.end, `${selectedScorePage.start}〜${selectedScorePage.end}小節`)} type="button">
                  <span className="block">▶ 表示4小節</span>
                  <small className="mt-1 block font-bold text-stone-500">{selectedScorePage.start}〜{selectedScorePage.end} · {rangeDuration(selectedScorePage.start, selectedScorePage.end, bpm)}</small>
                </button>
                <button className="min-h-14 rounded-xl border border-stone-700 bg-stone-900 px-4 py-2 text-left text-sm font-black hover:border-lime-300" onClick={() => playRange(currentSongPart.start, currentSongPart.end, `${currentSongPart.label} ${currentSongPart.range}`)} type="button">
                  <span className="block">▶ この区間</span>
                  <small className="mt-1 block font-bold text-stone-500">{currentSongPart.label} {currentSongPart.range} · {rangeDuration(currentSongPart.start, currentSongPart.end, bpm)}</small>
                </button>
                <button className="min-h-14 rounded-xl bg-lime-300 px-4 py-2 text-left text-sm font-black text-lime-950 hover:bg-lime-200" onClick={() => playRange(1, 151, "曲全体 1〜151小節")} type="button">
                  <span className="block">▶ 曲全体 1〜151</span>
                  <small className="mt-1 block font-bold text-lime-800">休みも含む · {rangeDuration(1, 151, bpm)}</small>
                </button>
                <button className="min-h-14 rounded-xl border border-lime-300 bg-lime-300/10 px-4 py-2 text-left text-sm font-black text-lime-300 hover:bg-lime-300 hover:text-lime-950" onClick={() => playRange(activeMeasure, 151, `現在地 ${activeMeasure}〜151小節`)} type="button">
                  <span className="block">▶ 現在地から最後まで</span>
                  <small className="mt-1 block font-bold opacity-70">{activeMeasure}〜151 · {rangeDuration(activeMeasure, 151, bpm)}</small>
                </button>
              </div>
              <p className="mt-3 text-xs font-bold text-stone-500">再生位置はSONG MAPとTABに同期します。動画は上の「動画を○小節から」で同じ位置へ移動します。</p>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {selectedScorePage.measures.map((measure) => (
                <ScoreMeasure measure={measure} currentId={currentNote.id} learnedIds={learnedIds} onSelect={selectNote} isPlaying={playbackMeasure === measure} key={measure} />
              ))}
            </div>

            <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <button className="min-h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm font-bold disabled:opacity-40" disabled={scorePageIndex === 0} onClick={() => jumpScoreTo(SCORE_PAGES[Math.max(0, scorePageIndex - 1)].start)} type="button">← 前の4小節</button>
              <p className="px-2 text-center text-sm font-black tabular-nums">{selectedScorePage.start}–{selectedScorePage.end}</p>
              <button className="min-h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm font-bold disabled:opacity-40" disabled={scorePageIndex === SCORE_PAGES.length - 1} onClick={() => jumpScoreTo(SCORE_PAGES[Math.min(SCORE_PAGES.length - 1, scorePageIndex + 1)].start)} type="button">次の4小節 →</button>
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
                    NOTE {String(noteIndex + 1).padStart(2, "0")} / {NOTES.length}
                  </p>
                  <h2 id="current-note-title" className="mt-2 text-balance text-4xl font-black sm:text-5xl" aria-live="polite">
                    {currentNote.stringNo}弦 <span className="text-lime-300 tabular-nums">{currentNote.fret}</span>フレット
                  </h2>
                  <p className="mt-3 text-pretty text-stone-300">
                    {stringDescription(currentNote.stringNo)}。カポを0として、{currentNote.fret}つ先を押さえます。
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
                  <p className="mt-2 font-bold tabular-nums">カポ3 + TAB {currentNote.fret} = {currentNote.fret + 3}フレット位置</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 bg-stone-800/50 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
              <div className="grid grid-cols-3 gap-2">
                <button className="min-h-12 rounded-xl border border-stone-600 bg-stone-900 px-3 font-bold disabled:cursor-not-allowed disabled:opacity-40" type="button" onClick={() => goBy(-1)} disabled={noteIndex === 0}>← 前の音</button>
                <button className="min-h-12 rounded-xl bg-lime-300 px-3 font-black text-lime-950 hover:bg-lime-200" type="button" onClick={playCurrentNote}>音を聴く</button>
                <button className="min-h-12 rounded-xl border border-stone-600 bg-stone-900 px-3 font-bold disabled:cursor-not-allowed disabled:opacity-40" type="button" onClick={() => goBy(1)} disabled={noteIndex === NOTES.length - 1}>次の音 →</button>
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

          <section className="rounded-2xl border border-stone-800 bg-stone-900 p-4 sm:p-6" aria-labelledby="technique-title">
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
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-stone-800 bg-stone-900 p-5" aria-labelledby="tempo-title">
            <p className="text-sm font-bold text-lime-300">PRACTICE SPEED</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <h2 id="tempo-title" className="text-balance text-xl font-black">練習テンポ</h2>
              <p className="text-3xl font-black tabular-nums">{bpm}<span className="ml-1 text-xs text-stone-500">BPM</span></p>
            </div>
            <input className="mt-5 min-h-11 w-full" type="range" min="50" max="170" step="1" value={bpm} onChange={(event) => changeBpm(Number(event.target.value))} aria-label="練習テンポ" />
            <div className="mt-2 flex justify-between text-xs text-stone-500 tabular-nums"><span>50</span><span>170</span></div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[85, 119, 170].map((value) => (
                <button className="min-h-11 rounded-lg border border-stone-700 bg-stone-950 text-sm font-bold data-[active=true]:border-lime-300 data-[active=true]:text-lime-300" data-active={bpm === value} type="button" onClick={() => changeBpm(value)} key={value}>{Math.round((value / 170) * 100)}%</button>
              ))}
            </div>
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
              <p className="text-2xl font-black tabular-nums">{learnedIds.size}<span className="text-sm text-stone-500"> / {NOTES.length}</span></p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-800" role="progressbar" aria-label="覚えた音の進捗" aria-valuemin={0} aria-valuemax={NOTES.length} aria-valuenow={learnedIds.size}>
              <div className="progress-fill h-full rounded-full bg-lime-300" style={{ "--progress": `${learnedProgress}%` } as React.CSSProperties} />
            </div>
            <p className="mt-3 text-pretty text-sm text-stone-400">場所を見ずに3回続けて弾けたら「できた！」を付けよう。</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
