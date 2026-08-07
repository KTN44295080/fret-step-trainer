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

export function beatsForMeasure(measure, meterMap = {}) {
  return meterMap[measure] ?? 4;
}

export function stepsForMeasure(measure, meterMap = {}) {
  return beatsForMeasure(measure, meterMap) * 4;
}

export function stepsBeforeMeasure(measure, meterMap = {}) {
  let steps = 0;
  for (let current = 1; current < Math.max(1, measure); current += 1) {
    steps += stepsForMeasure(current, meterMap);
  }
  return steps;
}

export function stepsInRange(startMeasure, endMeasure, meterMap = {}) {
  let steps = 0;
  for (let measure = startMeasure; measure <= endMeasure; measure += 1) {
    steps += stepsForMeasure(measure, meterMap);
  }
  return steps;
}

export function measurePosition(startMeasure, endMeasure, positionSteps, meterMap = {}) {
  const bounded = Math.max(0, positionSteps);
  let elapsed = 0;
  for (let measure = startMeasure; measure <= endMeasure; measure += 1) {
    const measureSteps = stepsForMeasure(measure, meterMap);
    if (bounded < elapsed + measureSteps || measure === endMeasure) {
      return { measure, step: Math.min(measureSteps, Math.max(0, bounded - elapsed)) };
    }
    elapsed += measureSteps;
  }
  return { measure: endMeasure, step: stepsForMeasure(endMeasure, meterMap) };
}

export function videoTimeForPosition(
  videoStartSeconds,
  originalBpm,
  measure,
  step = 0,
  meterMap = {},
) {
  const absoluteStep = Math.max(0, stepsBeforeMeasure(measure, meterMap) + step);
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
  meterMap = {},
) {
  return measurePosition(startMeasure, endMeasure, positionSteps, meterMap).measure;
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

export function detectPitch(buffer, sampleRate, targetFrequency, rmsThreshold = 0.004) {
  let mean = 0;
  for (const sample of buffer) mean += sample;
  mean /= buffer.length;

  let energy = 0;
  for (const sample of buffer) {
    const centered = sample - mean;
    energy += centered * centered;
  }
  const rms = Math.sqrt(energy / buffer.length);
  if (rms < rmsThreshold) return null;

  // Judge mode knows the expected pitch, so keep the correlation search close
  // to it. This prevents distorted Ampero tones from being reported as a low
  // sub-harmonic while still allowing roughly four semitones of tuning error.
  const searchRatio = targetFrequency ? 2 ** (4 / 12) : null;
  const maximumFrequency = targetFrequency ? targetFrequency * searchRatio : 1200;
  const minimumFrequency = targetFrequency ? targetFrequency / searchRatio : 65;
  const minimumLag = Math.max(2, Math.floor(sampleRate / maximumFrequency));
  const maximumLag = Math.min(
    Math.ceil(sampleRate / minimumFrequency),
    Math.floor(buffer.length / 2),
  );
  const usableLength = buffer.length - maximumLag;
  if (usableLength < 32 || maximumLag <= minimumLag + 2) return null;

  const difference = new Float32Array(maximumLag + 1);
  const normalized = new Float32Array(maximumLag + 1);
  for (let lag = 1; lag <= maximumLag; lag += 1) {
    let sum = 0;
    for (let index = 0; index < usableLength; index += 1) {
      const delta = (buffer[index] - mean) - (buffer[index + lag] - mean);
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

  let bestLag = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let lag = minimumLag + 1; lag < maximumLag - 1; lag += 1) {
    if (normalized[lag] > normalized[lag - 1] || normalized[lag] >= normalized[lag + 1]) continue;
    const frequency = sampleRate / lag;
    const targetPenalty = targetFrequency
      ? Math.abs(Math.log2(frequency / targetFrequency)) * 0.08
      : 0;
    const score = normalized[lag] + targetPenalty;
    if (score < bestScore) {
      bestScore = score;
      bestLag = lag;
      // In AUTO tuner mode the first clean YIN minimum is normally the
      // fundamental. Do not deliberately jump to a doubled lag (lower octave).
      if (!targetFrequency && normalized[lag] < 0.12) break;
    }
  }
  if (bestLag < 0) {
    for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
      if (normalized[lag] < bestScore) {
        bestScore = normalized[lag];
        bestLag = lag;
      }
    }
  }
  if (bestLag < 0 || bestScore > (targetFrequency ? 0.42 : 0.3)) return null;

  const before = normalized[bestLag - 1] ?? normalized[bestLag];
  const center = normalized[bestLag];
  const after = normalized[bestLag + 1] ?? normalized[bestLag];
  const denominator = before - 2 * center + after;
  const adjustment = denominator === 0 ? 0 : (before - after) / (2 * denominator);
  const frequency = sampleRate / (bestLag + adjustment);
  if (frequency < minimumFrequency * 0.98 || frequency > maximumFrequency * 1.02) return null;
  return frequency;
}

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
