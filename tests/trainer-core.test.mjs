import test from "node:test";
import assert from "node:assert/strict";

import {
  centsBetween,
  frequencyFor,
  nearestPlaybackRate,
  playbackPositionSteps,
  positionToMeasure,
  videoTimeForPosition,
} from "../app/trainer-core.mjs";

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

test("playback playhead survives tempo changes and resume", () => {
  assert.equal(playbackPositionSteps(16, 10, 12, 120), 32);
  assert.equal(positionToMeasure(20, 30, 0), 20);
  assert.equal(positionToMeasure(20, 30, 33), 22);
});

test("YouTube playback rate snaps to a rate the player actually supports", () => {
  assert.equal(nearestPlaybackRate(0.61, [0.25, 0.5, 0.75, 1, 1.25]), 0.5);
  assert.equal(nearestPlaybackRate(0.7, [0.25, 0.5, 0.75, 1]), 0.75);
  assert.equal(nearestPlaybackRate(0.61, []), 0.61);
});

test("centsBetween reports one semitone as 100 cents", () => {
  assert.ok(Math.abs(centsBetween(440 * 2 ** (1 / 12), 440) - 100) < 0.0001);
});
