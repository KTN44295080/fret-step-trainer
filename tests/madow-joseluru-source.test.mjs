import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tab = JSON.parse(await readFile(
  new URL("../app/madow-backing-joseluru.json", import.meta.url),
  "utf8",
));

const expectedEmptyMeasures = [20, 22, 24, 26, 28, 30, 32, 117, 118, 119, 120, 207];
const allowedEffects = new Set(["sl.", "full", "harm.", "tr.", "P.M.", "let ring"]);
const allowedSymbol = /^(?:×|\(?\d{1,2}\)?|<\d{1,2}>)$/;

test("JoseLuRu backing import covers the canonical 207-measure timeline", () => {
  assert.deepEqual(Object.keys(tab).map(Number), Array.from({ length: 207 }, (_, index) => index + 1));
  assert.deepEqual(
    Object.entries(tab).filter(([, glyphs]) => glyphs.length === 0).map(([measure]) => Number(measure)),
    expectedEmptyMeasures,
  );
});

test("JoseLuRu backing import contains every author-authored attack, mute, and tie", () => {
  const counts = { attacks: 0, mutes: 0, ties: 0, symbols: 0 };
  for (const glyphs of Object.values(tab)) {
    for (const glyph of glyphs) {
      for (const symbol of glyph.symbols) {
        counts.symbols += 1;
        if (glyph.technique === "tie") counts.ties += 1;
        else if (symbol.text === "×") counts.mutes += 1;
        else counts.attacks += 1;
      }
    }
  }
  assert.deepEqual(counts, { attacks: 3548, mutes: 301, ties: 372, symbols: 4221 });
});

test("JoseLuRu backing symbols and positions remain valid and collision-free", () => {
  for (const [measure, glyphs] of Object.entries(tab)) {
    const seen = new Set();
    for (const glyph of glyphs) {
      assert.equal(typeof glyph.slot, "number", `measure ${measure} slot type`);
      assert.ok(glyph.slot >= 0 && glyph.slot < 16, `measure ${measure} slot ${glyph.slot}`);
      assert.ok(glyph.symbols.length > 0, `measure ${measure} empty glyph`);
      for (const effect of glyph.effects ?? []) assert.ok(allowedEffects.has(effect), effect);
      for (const symbol of glyph.symbols) {
        assert.ok(Number.isInteger(symbol.stringNo) && symbol.stringNo >= 1 && symbol.stringNo <= 6);
        assert.match(symbol.text, allowedSymbol, `measure ${measure} symbol ${symbol.text}`);
        const key = `${glyph.slot}:${symbol.stringNo}`;
        assert.equal(seen.has(key), false, `measure ${measure} duplicate ${key}`);
        seen.add(key);
      }
    }
  }
});

test("JoseLuRu source landmarks match the video score and mixed-meter merge", () => {
  assert.deepEqual(tab["1"], [{
    slot: 0,
    symbols: [
      { stringNo: 1, text: "0", durationSlots: 16 },
      { stringNo: 2, text: "0", durationSlots: 16 },
      { stringNo: 3, text: "0", durationSlots: 16 },
      { stringNo: 4, text: "2", durationSlots: 16 },
      { stringNo: 5, text: "2", durationSlots: 16 },
      { stringNo: 6, text: "0", durationSlots: 16 },
    ],
  }]);

  assert.deepEqual(tab["17"].map(({ slot }) => slot), [0, 4, 6, 8, 10, 12]);
  assert.deepEqual(tab["17"][5].symbols.map(({ stringNo, text }) => [stringNo, text]), [
    [2, "10"], [3, "11"], [4, "10"], [5, "×"], [6, "11"],
  ]);
  assert.deepEqual(tab["18"].map(({ slot }) => slot), [
    0, 1.333333, 2.666667, 10.666667, 12, 13.333333, 14.666667,
  ]);
  assert.equal(tab["18"][2].technique, "tie");
  assert.deepEqual(tab["124"][0].effects, ["full", "tr."]);
});
