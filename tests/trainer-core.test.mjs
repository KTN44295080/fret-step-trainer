import test from "node:test";
import assert from "node:assert/strict";

import {
  beatsForMeasure,
  buildPhraseInstances,
  centsBetween,
  detectPitch,
  extendDurationThroughNextMeasureTie,
  extendDurationThroughFollowingTies,
  frequencyFor,
  measurePosition,
  sustainGuitarPart,
  nearestPlaybackRate,
  normalizeLifeOverLeadEighthRun,
  phraseFingerprint,
  playbackPositionSteps,
  positionToMeasure,
  stepsBeforeMeasure,
  stepsInRange,
  videoTimeForPosition,
} from "../app/trainer-core.mjs";

test("phrase grouping prefers repeated four- and two-measure patterns", () => {
  const glyph = (text, slot = 0) => [{ slot, symbols: [{ stringNo: 2, text }] }];
  const record = {
    1: glyph("7"), 2: glyph("9"), 3: glyph("10"), 4: glyph("12"),
    5: glyph("7"), 6: glyph("9"), 7: glyph("10"), 8: glyph("12"),
    9: glyph("3"), 10: glyph("5"), 11: glyph("3"), 12: glyph("5"),
    13: glyph("14"),
    14: [],
  };
  const instances = buildPhraseInstances(record, [
    { label: "chorus", start: 1, end: 8 },
    { label: "intro", start: 9, end: 12 },
    { label: "unique", start: 13, end: 14 },
  ], "test");

  assert.deepEqual(instances.map((phrase) => phrase.measureCount), [4, 4, 2, 2, 1]);
  assert.equal(instances[0].canonicalId, instances[1].canonicalId);
  assert.equal(instances[2].canonicalId, instances[3].canonicalId);
  assert.notEqual(instances[1].canonicalId, instances[2].canonicalId);
  assert.equal(instances.some((phrase) => phrase.startMeasure === 14), false);
});

test("phrase fingerprints require exact TAB positions and pitches", () => {
  const original = { 1: [{ slot: 0, symbols: [{ stringNo: 3, text: "7" }] }] };
  const transposed = { 1: [{ slot: 0, symbols: [{ stringNo: 3, text: "9" }] }] };
  const late = { 1: [{ slot: 2, symbols: [{ stringNo: 3, text: "7" }] }] };
  assert.notEqual(phraseFingerprint(original, 1), phraseFingerprint(transposed, 1));
  assert.notEqual(phraseFingerprint(original, 1), phraseFingerprint(late, 1));
});

test("phrase grouping keeps a repeated two-bar motif at its primitive length", () => {
  const glyph = (text) => [{ slot: 0, symbols: [{ stringNo: 2, text }] }];
  const record = Object.fromEntries(Array.from({ length: 8 }, (_, index) => [
    index + 1,
    glyph(index % 2 === 0 ? "7" : "9"),
  ]));
  const instances = buildPhraseInstances(
    record,
    [{ label: "intro", start: 1, end: 8 }],
    "primitive",
  );

  assert.deepEqual(instances.map((phrase) => phrase.measureCount), [2, 2, 2, 2]);
  assert.equal(new Set(instances.map((phrase) => phrase.canonicalId)).size, 1);
});

test("phrase grouping honors a section's authored phrase length", () => {
  const glyph = (text) => [{ slot: 0, symbols: [{ stringNo: 2, text }] }];
  const record = Object.fromEntries(["7", "9", "10", "12", "7", "9", "10", "12"]
    .map((text, index) => [index + 1, glyph(text)]));
  const instances = buildPhraseInstances(
    record,
    [{ label: "intro", start: 1, end: 8, phraseMeasures: 2 }],
    "authored",
  );

  assert.deepEqual(instances.map((phrase) => phrase.measureCount), [2, 2, 2, 2]);
});

test("frequencyFor respects each song's capo instead of assuming capo 3", () => {
  assert.ok(Math.abs(frequencyFor(6, 0, 0) - 82.4069) < 0.001);
  assert.ok(Math.abs(frequencyFor(6, 0, 3) - 97.9989) < 0.001);
  assert.ok(Math.abs(frequencyFor(2, 10, 0) - 440) < 0.001);
});

test("video position uses the original score clock", () => {
  assert.equal(videoTimeForPosition(215, 170, 1), 215);
  assert.equal(videoTimeForPosition(215, 170, 2), 215 + (4 * 60) / 170);
  assert.equal(videoTimeForPosition(0, 194, 5, 8), (72 * 15) / 194);
});

test("mixed-meter timing keeps the Madow Star bridge aligned", () => {
  const meterMap = { 18: 6, 117: 5, 118: 5, 119: 5, 120: 6, 121: 5, 122: 5, 123: 5, 124: 6 };
  assert.equal(beatsForMeasure(18, meterMap), 6);
  assert.equal(beatsForMeasure(116, meterMap), 4);
  assert.equal(beatsForMeasure(120, meterMap), 6);
  assert.equal(stepsInRange(117, 124, meterMap), 168);
  assert.equal(stepsBeforeMeasure(125, meterMap), 2032);
  assert.equal(videoTimeForPosition(1.2, 194, 125, 0, meterMap), 1.2 + (2032 * 15) / 194);
  assert.deepEqual(measurePosition(117, 124, 20, meterMap), { measure: 118, step: 0 });
  assert.equal(positionToMeasure(117, 124, 116, meterMap), 122);
});

test("playback playhead survives tempo changes and resume", () => {
  assert.equal(playbackPositionSteps(16, 10, 12, 120), 32);
  assert.equal(positionToMeasure(20, 30, 0), 20);
  assert.equal(positionToMeasure(20, 30, 33), 22);
});

test("life-over OCR timing keeps eighth-note runs evenly spaced", () => {
  const openingPickup = [
    { slot: 11, symbols: [{ text: "7" }] },
    { slot: 13, symbols: [{ text: "9" }] },
    { slot: 14, symbols: [{ text: "7" }] },
  ];
  assert.deepEqual(
    normalizeLifeOverLeadEighthRun(openingPickup).map((glyph) => glyph.slot),
    [10, 12, 14],
  );

  const glyphs = [0, 2, 4, 6, 8, 10, 12, 15].map((slot) => ({ slot }));
  assert.deepEqual(
    normalizeLifeOverLeadEighthRun(glyphs).map((glyph) => glyph.slot),
    [0, 2, 4, 6, 8, 10, 12, 14],
  );
  assert.deepEqual(
    normalizeLifeOverLeadEighthRun([{ slot: 0 }, { slot: 15 }]),
    [{ slot: 0 }, { slot: 15 }],
  );

  const lateChorusBar = [
    { slot: 1, technique: "tie", symbols: [{ text: "(10)" }] },
    { slot: 3, symbols: [{ text: "10" }] },
    { slot: 5, symbols: [{ text: "12" }] },
    { slot: 7, symbols: [{ text: "10" }] },
    { slot: 11, symbols: [{ text: "10" }] },
    { slot: 13, symbols: [{ text: "10" }] },
  ];
  assert.deepEqual(
    normalizeLifeOverLeadEighthRun(lateChorusBar).map((glyph) => glyph.slot),
    [0, 2, 4, 6, 10, 12],
  );
});

test("a parenthesized chorus note sustains the previous attack across the barline", () => {
  const nextGlyphs = [
    { slot: 1, technique: "tie", symbols: [{ stringNo: 2, text: "(10)" }] },
    { slot: 3, symbols: [{ stringNo: 2, text: "13" }] },
  ];
  assert.deepEqual(
    extendDurationThroughNextMeasureTie({
      currentMeasureSteps: 16,
      eventStep: 14,
      stringNo: 2,
      fret: 10,
      nextMeasureSteps: 16,
      nextGlyphs,
    }),
    { durationSteps: 5, sustain: true },
  );
  assert.deepEqual(
    extendDurationThroughNextMeasureTie({
      currentMeasureSteps: 16,
      eventStep: 14,
      stringNo: 3,
      fret: 10,
      nextMeasureSteps: 16,
      nextGlyphs,
    }),
    { durationSteps: 2, sustain: false },
  );
});

test("a held chord sustains through several tied measures", () => {
  const tiedOpenChord = [{
    slot: 0,
    technique: "tie",
    symbols: [{ stringNo: 5, text: "(2)" }],
  }];
  assert.deepEqual(
    extendDurationThroughFollowingTies({
      baseDurationSteps: 2,
      currentMeasureSteps: 16,
      eventStep: 0,
      stringNo: 5,
      fret: 2,
      followingMeasures: [
        { measureSteps: 16, glyphs: tiedOpenChord },
        { measureSteps: 16, glyphs: tiedOpenChord },
        { measureSteps: 16, glyphs: tiedOpenChord },
        { measureSteps: 16, glyphs: [] },
      ],
    }),
    { durationSteps: 64, sustain: true },
  );
});

test("an independently selectable guitar part sustains notes through empty space", () => {
  const part = {
    69: [
      { slot: 0, symbols: [{ stringNo: 3, text: "×" }, { stringNo: 5, text: "×" }] },
      { slot: 2, symbols: [{ stringNo: 3, text: "9" }, { stringNo: 5, text: "7" }] },
      { slot: 4, symbols: [{ stringNo: 3, text: "×" }, { stringNo: 5, text: "×" }] },
      { slot: 6, symbols: [{ stringNo: 3, text: "7" }, { stringNo: 5, text: "5" }] },
    ],
    70: [],
  };

  const sustained = sustainGuitarPart(part, 69, 70);
  assert.deepEqual(sustained[69].find((glyph) => glyph.slot === 6).symbols, [
    { stringNo: 3, text: "7", durationSlots: 10 },
    { stringNo: 5, text: "5", durationSlots: 10 },
  ]);
  assert.equal(sustained[69].some((glyph) => glyph.symbols.some((symbol) => symbol.text === "×")), true);
});

test("an independently selectable guitar part honors a written tie across the barline", () => {
  const sustained = sustainGuitarPart(
    {
      74: [{ slot: 14, symbols: [{ stringNo: 1, text: "12" }] }],
      75: [
        { slot: 0, technique: "tie", symbols: [{ stringNo: 1, text: "(12)" }] },
        { slot: 2, symbols: [{ stringNo: 1, text: "14" }] },
      ],
    },
    74,
    75,
  );
  assert.deepEqual(sustained[74][0].symbols, [{ stringNo: 1, text: "12", durationSlots: 4 }]);
  assert.equal(sustained[75][0].technique, "tie");
  assert.deepEqual(sustained[75][1].symbols, [{ stringNo: 1, text: "14", durationSlots: 14 }]);
});

test("YouTube playback rate snaps to a rate the player actually supports", () => {
  assert.equal(nearestPlaybackRate(0.61, [0.25, 0.5, 0.75, 1, 1.25]), 0.5);
  assert.equal(nearestPlaybackRate(0.7, [0.25, 0.5, 0.75, 1]), 0.75);
  assert.equal(nearestPlaybackRate(0.61, []), 0.61);
});

test("centsBetween reports one semitone as 100 cents", () => {
  assert.ok(Math.abs(centsBetween(440 * 2 ** (1 / 12), 440) - 100) < 0.0001);
});

function guitarLikeWave(frequency, sampleRate = 48000, length = 4096) {
  return Float32Array.from({ length }, (_, index) => {
    const phase = 2 * Math.PI * frequency * index / sampleRate;
    return 0.35 * Math.sin(phase) + 0.55 * Math.sin(phase * 2) + 0.18 * Math.sin(phase * 3);
  });
}

test("pitch detection keeps high guitar notes in their real octave", () => {
  const detected = detectPitch(guitarLikeWave(329.63), 48000);
  assert.ok(detected);
  assert.ok(Math.abs(centsBetween(detected, 329.63)) < 8);
});

test("targeted TAB judging rejects a low sub-harmonic", () => {
  const detected = detectPitch(guitarLikeWave(220), 48000, 220);
  assert.ok(detected);
  assert.ok(Math.abs(centsBetween(detected, 220)) < 8);
  assert.equal(detectPitch(guitarLikeWave(77.78), 48000, 220), null);
});
