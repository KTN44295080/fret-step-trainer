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
  const phraseKey = glyphs.flatMap((glyph) => glyph.symbols ?? []).map((symbol) => symbol.text).join("|");
  const isOpeningPickup = glyphs.length === 3
    && slots[0] === 11
    && slots[1] === 13
    && slots[2] === 14
    && phraseKey === "7|9|7";
  if (isOpeningPickup) {
    // The time signature shifted the OCR x-coordinates in measure 1.
    // The score shows three evenly spaced eighth notes on slots 10, 12, 14.
    return glyphs.map((glyph, index) => ({ ...glyph, slot: 10 + index * 2 }));
  }

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

function phraseMeasureFingerprint(glyphs = []) {
  return glyphs.map((glyph) => {
    const symbols = (glyph.symbols ?? [])
      .map((symbol) => `${symbol.stringNo}:${symbol.text}:${symbol.durationSlots ?? ""}`)
      .join("+");
    return `${glyph.slot}:${glyph.technique ?? ""}:${symbols}`;
  }).join(",");
}

function phraseHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function phraseFingerprint(glyphRecord, startMeasure, measureCount = 1) {
  return Array.from({ length: measureCount }, (_, index) => (
    phraseMeasureFingerprint(glyphRecord[startMeasure + index] ?? [])
  )).join("/");
}

export function buildPhraseInstances(
  glyphRecord,
  sections,
  scope = "phrase",
  windowSizes = [4, 2, 1],
) {
  const sizes = [...new Set(windowSizes)]
    .filter((size) => Number.isInteger(size) && size > 0)
    .sort((left, right) => right - left);
  if (!sizes.includes(1)) sizes.push(1);

  const candidates = [];
  for (const section of sections) {
    const sectionSizes = sizes.filter((size) => size <= (section.phraseMeasures ?? Infinity));
    for (let measure = section.start; measure <= section.end; measure += 1) {
      for (const size of sectionSizes) {
        if (measure + size - 1 > section.end) continue;
        const fingerprint = phraseFingerprint(glyphRecord, measure, size);
        if (!fingerprint.replaceAll("/", "")) continue;
        candidates.push({ measure, size, fingerprint });
      }
    }
  }

  const counts = new Map();
  for (const candidate of candidates) {
    const key = `${candidate.size}:${candidate.fingerprint}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const instances = [];
  for (const section of sections) {
    const sectionSizes = sizes.filter((size) => size <= (section.phraseMeasures ?? Infinity));
    let measure = section.start;
    while (measure <= section.end) {
      const currentFingerprint = phraseFingerprint(glyphRecord, measure, 1);
      if (!currentFingerprint) {
        measure += 1;
        continue;
      }

      const repeated = sectionSizes.find((size) => {
        if (size === 1 || measure + size - 1 > section.end) return false;
        const fingerprint = phraseFingerprint(glyphRecord, measure, size);
        const halfSize = size / 2;
        if (Number.isInteger(halfSize)
          && phraseFingerprint(glyphRecord, measure, halfSize)
            === phraseFingerprint(glyphRecord, measure + halfSize, halfSize)) {
          return false;
        }
        return (counts.get(`${size}:${fingerprint}`) ?? 0) > 1;
      });
      const measureCount = repeated ?? 1;
      const fingerprint = phraseFingerprint(glyphRecord, measure, measureCount);
      const canonicalId = `${scope}:p${measureCount}-${phraseHash(fingerprint)}`;
      instances.push({
        id: `${scope}:m${measure}-${measure + measureCount - 1}`,
        canonicalId,
        fingerprint,
        sectionLabel: section.label,
        startMeasure: measure,
        endMeasure: measure + measureCount - 1,
        measureCount,
      });
      measure += measureCount;
    }
  }

  return instances;
}

function tabFret(text) {
  if (text.includes("×") || text.includes("AH")) return null;
  const numeric = text.match(/\d+/);
  if (!numeric || Number(numeric[0]) > 24) return null;
  return Number(numeric[0]);
}

/**
 * Keeps an independently selectable guitar staff intact while letting written
 * notes ring through otherwise empty space. A mute or the next picked note
 * stops the sound. A source-authored tie may carry it across one barline.
 */
export function sustainGuitarPart(part, firstMeasure, lastMeasure) {
  const sustained = Object.fromEntries(Object.entries(part).map(([measure, glyphs]) => [
    measure,
    glyphs.map((glyph) => ({
      ...glyph,
      symbols: glyph.symbols.map((symbol) => ({ ...symbol })),
    })),
  ]));

  const articulations = [];
  for (let measure = firstMeasure; measure <= lastMeasure; measure += 1) {
    for (const glyph of sustained[measure] ?? []) {
      if (glyph.technique !== "tie" && glyph.symbols.length > 0) {
        articulations.push({ measure, glyph, absoluteSlot: measure * 16 + glyph.slot });
      }
    }
  }

  articulations.forEach((entry, index) => {
    const nextArticulationSlot = articulations[index + 1]?.absoluteSlot ?? (lastMeasure + 1) * 16;
    entry.glyph.symbols = entry.glyph.symbols.map((symbol) => {
      const fret = tabFret(symbol.text);
      if (fret === null) return symbol;
      const matchingNextMeasureTie = (sustained[entry.measure + 1] ?? []).some((glyph) => (
        glyph.technique === "tie"
        && glyph.symbols.some((candidate) => (
          candidate.stringNo === symbol.stringNo
          && tabFret(candidate.text) === fret
        ))
      ));
      const barBoundary = matchingNextMeasureTie
        ? (entry.measure + 2) * 16
        : (entry.measure + 1) * 16;
      return {
        ...symbol,
        durationSlots: Math.max(2, Math.min(nextArticulationSlot, barBoundary) - entry.absoluteSlot),
      };
    });
  });

  return sustained;
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

export function extendDurationThroughFollowingTies({
  baseDurationSteps = 2,
  currentMeasureSteps,
  eventStep,
  stringNo,
  fret,
  followingMeasures,
}) {
  let durationSteps = baseDurationSteps;
  let sustain = false;
  for (const { measureSteps, glyphs } of followingMeasures) {
    const matchingTie = glyphs.find((glyph) => (
      glyph.technique === "tie"
      && glyph.symbols.some((symbol) => {
        const numeric = symbol.text.match(/\d+/);
        return symbol.stringNo === stringNo && numeric && Number(numeric[0]) === fret;
      })
    ));
    if (!matchingTie) break;

    sustain = true;
    const tieStep = Math.round((matchingTie.slot / 16) * measureSteps);
    const nextAttackStep = glyphs
      .filter((glyph) => glyph.technique !== "tie")
      .map((glyph) => Math.round((glyph.slot / 16) * measureSteps))
      .filter((step) => step > tieStep)
      .sort((left, right) => left - right)[0];
    durationSteps = Math.max(durationSteps, currentMeasureSteps - eventStep)
      + (nextAttackStep ?? measureSteps);
    if (nextAttackStep !== undefined) break;
  }
  return { durationSteps, sustain };
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
