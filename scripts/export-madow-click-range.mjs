import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const BPM = 194;
const START_MEASURE = 113;
const END_MEASURE = 128;
const SAMPLE_RATE = 48_000;
const CLICK_SECONDS = 0.05;
const CLICK_RAMP_SECONDS = 0.045;
const CLICK_START_GAIN = 0.1;
const CLICK_END_GAIN = 0.0001;
const STRONG_FREQUENCY = 1320;
const WEAK_FREQUENCY = 920;

const METER_MAP = {
  18: 6,
  117: 5,
  118: 5,
  119: 5,
  120: 6,
  121: 5,
  122: 5,
  123: 5,
  124: 6,
};

const outputPath = resolve(
  process.argv[2] ?? "exports/madow-click-measures-113-128-194bpm.wav",
);
const secondsPerBeat = 60 / BPM;
const clicks = [];
let beatOffset = 0;

for (let measure = START_MEASURE; measure <= END_MEASURE; measure += 1) {
  const beats = METER_MAP[measure] ?? 4;
  for (let beat = 0; beat < beats; beat += 1) {
    clicks.push({
      startSeconds: (beatOffset + beat) * secondsPerBeat,
      frequency: beat === 0 ? STRONG_FREQUENCY : WEAK_FREQUENCY,
    });
  }
  beatOffset += beats;
}

const durationSeconds = beatOffset * secondsPerBeat;
const frameCount = Math.ceil(durationSeconds * SAMPLE_RATE);
const pcm = new Float64Array(frameCount);

for (const click of clicks) {
  const startFrame = Math.round(click.startSeconds * SAMPLE_RATE);
  const clickFrames = Math.ceil(CLICK_SECONDS * SAMPLE_RATE);
  for (let frame = 0; frame < clickFrames && startFrame + frame < frameCount; frame += 1) {
    const time = frame / SAMPLE_RATE;
    const rampProgress = Math.min(1, time / CLICK_RAMP_SECONDS);
    const gain = CLICK_START_GAIN * ((CLICK_END_GAIN / CLICK_START_GAIN) ** rampProgress);
    const phase = 2 * Math.PI * click.frequency * time;
    const square = Math.sin(phase) >= 0 ? 1 : -1;
    pcm[startFrame + frame] += square * gain;
  }
}

const bytesPerSample = 2;
const dataBytes = frameCount * bytesPerSample;
const wav = Buffer.alloc(44 + dataBytes);
wav.write("RIFF", 0);
wav.writeUInt32LE(36 + dataBytes, 4);
wav.write("WAVE", 8);
wav.write("fmt ", 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(SAMPLE_RATE, 24);
wav.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28);
wav.writeUInt16LE(bytesPerSample, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(dataBytes, 40);

for (let frame = 0; frame < frameCount; frame += 1) {
  const sample = Math.max(-1, Math.min(1, pcm[frame]));
  wav.writeInt16LE(Math.round(sample * 32767), 44 + frame * bytesPerSample);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, wav);

console.log(JSON.stringify({
  outputPath,
  bpm: BPM,
  measures: `${START_MEASURE}-${END_MEASURE}`,
  beats: beatOffset,
  clicks: clicks.length,
  durationSeconds,
  sampleRate: SAMPLE_RATE,
  channels: 1,
  bitDepth: 16,
}));
