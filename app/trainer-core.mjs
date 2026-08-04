const OPEN_STRING_MIDI = {
  1: 64,
  2: 59,
  3: 55,
  4: 50,
  5: 45,
  6: 40,
};

export function frequencyFor(stringNo, fret, capo = 0) {
  const midi = OPEN_STRING_MIDI[stringNo] + capo + fret;
  return 440 * 2 ** ((midi - 69) / 12);
}

export function originalSecondsPerStep(originalBpm) {
  return 15 / originalBpm;
}

export function videoTimeForPosition(
  videoStartSeconds,
  originalBpm,
  measure,
  step = 0,
) {
  const absoluteStep = Math.max(0, (measure - 1) * 16 + step);
  return videoStartSeconds + absoluteStep * originalSecondsPerStep(originalBpm);
}

export function playbackPositionSteps(
  positionSteps,
  scheduledAt,
  now,
  bpm,
) {
  return positionSteps + Math.max(0, now - scheduledAt) * (bpm / 15);
}

export function positionToMeasure(
  startMeasure,
  endMeasure,
  positionSteps,
) {
  return Math.min(
    endMeasure,
    Math.max(startMeasure, startMeasure + Math.floor(Math.max(0, positionSteps) / 16)),
  );
}

export function nearestPlaybackRate(requestedRate, availableRates) {
  if (availableRates.length === 0) return requestedRate;
  return availableRates.reduce((nearest, candidate) =>
    Math.abs(candidate - requestedRate) < Math.abs(nearest - requestedRate)
      ? candidate
      : nearest,
  );
}

export function centsBetween(frequency, targetFrequency) {
  return 1200 * Math.log2(frequency / targetFrequency);
}

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
