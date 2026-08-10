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

export function normalizeLifeOverLeadEighthRun(glyphs) {
  const slots = glyphs.map((glyph) => glyph.slot);
  const isRepeatedEighthNoteRun = glyphs.length === 8
    && slots.slice(0, 7).every((slot, index) => slot === index * 2)
    && slots[7] === 15;
  if (isRepeatedEighthNoteRun) {
    // The OCR placed the last eighth note on the final sixteenth-note slot.
    // In the source score it belongs on the eighth-note grid at slot 14.
    return glyphs.map((glyph, index) => (
      index === 7 ? { ...glyph, slot: 14 } : glyph
    ));
  }

  const phraseKey = glyphs.flatMap((glyph) => glyph.symbols ?? []).map((symbol) => symbol.text).join("|");
  const chorusSlots = {
    "(10)|13|13|10|13|10": [0, 2, 4, 6, 10, 12],
    "(10)|10|12|10|10|10": [0, 2, 4, 6, 10, 12],
    "(10)|10|9|9|9": [0, 2, 6, 10, 12],
  }[phraseKey];
  if (!chorusSlots || chorusSlots.length !== glyphs.length) return glyphs;

  // Parenthesized notes are tied continuations on the downbeat. The following
  // attacks sit on the eighth-note grid; OCR x-coordinates shifted these bars
  // one sixteenth late (for example measures 35 and 37).
  return glyphs.map((glyph, index) => ({ ...glyph, slot: chorusSlots[index] }));
}

function tabFret(text) {
  if (text.includes("×") || text.includes("AH")) return null;
  const numeric = text.match(/\d+/);
  if (!numeric || Number(numeric[0]) > 24) return null;
  return Number(numeric[0]);
}

function numericTabSymbol(text) {
  return tabFret(text) !== null;
}

function leadArticulationOnString(glyph, stringNo) {
  return glyph.symbols.some((symbol) => (
    symbol.stringNo === stringNo
    && (numericTabSymbol(symbol.text) || symbol.text.includes("×"))
  ));
}

/**
 * Folds an optional, source-authored guitar staff into the lead part without
 * turning it into a three-hand transcription. The original lead wins every
 * simultaneous attack. Optional pitched notes may fill silence or replace a
 * mute-only attack, while optional mute-only strokes are omitted. Added notes
 * ring through empty space until the next optional attack or the next lead
 * articulation on the same string, including across a barline.
 */
export function mergeOptionalGuitarIntoLead(
  lead,
  optional,
  firstMeasure,
  lastMeasure,
) {
  const merged = { ...lead };
  const combinedByMeasure = {};
  const selected = [];

  for (let measure = firstMeasure; measure <= lastMeasure; measure += 1) {
    const combined = (lead[measure] ?? []).map((glyph) => ({
      ...glyph,
      symbols: glyph.symbols.map((symbol) => ({ ...symbol })),
    }));
    combinedByMeasure[measure] = combined;

    for (const optionalGlyph of optional[measure] ?? []) {
      // A tie is continuation information, not another pick attack. Its source
      // note is sustained by the cross-measure duration calculation below.
      if (optionalGlyph.technique === "tie") continue;
      const pitchedSymbols = optionalGlyph.symbols
        .filter((symbol) => numericTabSymbol(symbol.text))
        .map((symbol) => ({ ...symbol }));
      if (pitchedSymbols.length === 0) continue;

      const existingIndex = combined.findIndex((glyph) => glyph.slot === optionalGlyph.slot);
      const existing = combined[existingIndex];
      if (existing) {
        // Parenthesized lead ties still occupy the musical slot even though
        // they are not a new attack; do not cover them with the optional part.
        if (existing.symbols.some((symbol) => numericTabSymbol(symbol.text))) continue;
        // The optional pitched note is more useful than a mute-only placeholder
        // at the same instant, so replace that one glyph rather than stacking.
        combined.splice(existingIndex, 1);
      }

      const glyph = { ...optionalGlyph, symbols: pitchedSymbols };
      selected.push({ measure, glyph });
    }
  }

  selected.forEach((entry, index) => {
    const absoluteSlot = entry.measure * 16 + entry.glyph.slot;
    const nextOptional = selected[index + 1];
    const nextOptionalSlot = nextOptional
      ? nextOptional.measure * 16 + nextOptional.glyph.slot
      : (lastMeasure + 1) * 16;
    const symbols = entry.glyph.symbols.map((symbol) => {
      const sourceFret = tabFret(symbol.text);
      const matchingNextMeasureTie = (optional[entry.measure + 1] ?? []).some((glyph) => (
        glyph.technique === "tie"
        && glyph.symbols.some((candidate) => (
          candidate.stringNo === symbol.stringNo
          && tabFret(candidate.text) === sourceFret
        ))
      ));
      // Do not let a decorative harmony ring into a new backing chord unless
      // the source score explicitly ties it over the barline.
      const phraseBoundary = matchingNextMeasureTie
        ? Math.min(nextOptionalSlot, (entry.measure + 2) * 16)
        : Math.min(nextOptionalSlot, (entry.measure + 1) * 16);
      let nextLeadConflict;
      for (let measure = entry.measure; measure <= lastMeasure; measure += 1) {
        const conflict = (combinedByMeasure[measure] ?? [])
          .filter((glyph) => measure > entry.measure || glyph.slot > entry.glyph.slot)
          .find((glyph) => leadArticulationOnString(glyph, symbol.stringNo));
        if (conflict) {
          nextLeadConflict = measure * 16 + conflict.slot;
          break;
        }
      }
      const endSlot = Math.min(phraseBoundary, nextLeadConflict ?? phraseBoundary);
      return {
        ...symbol,
        durationSlots: Math.max(2, endSlot - absoluteSlot),
      };
    });
    combinedByMeasure[entry.measure].push({ ...entry.glyph, symbols });
  });

  for (let measure = firstMeasure; measure <= lastMeasure; measure += 1) {
    merged[measure] = combinedByMeasure[measure].sort((left, right) => left.slot - right.slot);
  }
  return merged;
}

export function extendDurationThroughNextMeasureTie({
  baseDurationSteps = 2,
  currentMeasureSteps,
  eventStep,
  stringNo,
  fret,
  nextMeasureSteps,
  nextGlyphs,
}) {
  const matchingTie = nextGlyphs.find((glyph) => (
    glyph.technique === "tie"
    && glyph.symbols.some((symbol) => {
      const numeric = symbol.text.match(/\d+/);
      return symbol.stringNo === stringNo && numeric && Number(numeric[0]) === fret;
    })
  ));
  if (!matchingTie) {
    return { durationSteps: baseDurationSteps, sustain: false };
  }

  const tieStep = Math.round((matchingTie.slot / 16) * nextMeasureSteps);
  const nextAttackStep = nextGlyphs
    .filter((glyph) => glyph.technique !== "tie")
    .map((glyph) => Math.round((glyph.slot / 16) * nextMeasureSteps))
    .filter((step) => step > tieStep)
    .sort((left, right) => left - right)[0] ?? nextMeasureSteps;

  return {
    durationSteps: Math.max(
      baseDurationSteps,
      currentMeasureSteps - eventStep + nextAttackStep,
    ),
    sustain: true,
  };
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
