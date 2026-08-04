"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const middle: Array<[number, "note" | "rest", StringNumber?, number?, number?]> =
    variation === "high"
      ? [
          [1, "note", 2, 13], [2, "note", 1, 13], [3, "note", 1, 10, 2],
          [5, "note", 2, 13], [6, "note", 2, 10, 2],
        ]
      : variation === "low"
        ? [
            [1, "note", 2, 10], [2, "note", 3, 12], [3, "note", 3, 10, 2],
            [5, "note", 2, 10], [6, "note", 2, 10, 2],
          ]
        : [
            [1, "note", 2, 10], [2, "rest"], [3, "note", 2, 9, 2],
            [5, "note", 2, 9], [6, "note", 2, 9, 2],
          ];

  return [
    { id: `m${measure}-h1`, measure, tick: 0, kind: "hold", stringNo: 2, fret: 10 },
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

const PRACTICE_SECTIONS = [
  { label: "イントロ 1–4", measures: [1, 2, 3, 4] },
  { label: "イントロ 5–8", measures: [5, 6, 7, 8] },
  { label: "イントロ 9–12", measures: [9, 10, 11, 12] },
  { label: "イントロ 13–17", measures: [13, 14, 15, 16, 17] },
  { label: "サビ 34–37", measures: [34, 35, 36, 37] },
  { label: "サビ 38–41", measures: [38, 39, 40, 41] },
  { label: "サビ 42–45", measures: [42, 43, 44, 45] },
  { label: "サビ 46–49", measures: [46, 47, 48, 49] },
  { label: "間奏入り 50–53", measures: [50, 51, 52, 53] },
  { label: "2番入り 54–57", measures: [54, 55, 56, 57] },
  { label: "後半サビ 82–85", measures: [82, 83, 84, 85] },
  { label: "後半サビ 86–89", measures: [86, 87, 88, 89] },
  { label: "後半サビ 90–93", measures: [90, 91, 92, 93] },
  { label: "後半サビ 94–97", measures: [94, 95, 96, 97] },
  { label: "後半サビ 98–102", measures: [98, 99, 100, 101, 102] },
  { label: "後半サビ 103–105", measures: [103, 104, 105] },
  { label: "後半サビ 106–109", measures: [106, 107, 108, 109] },
  { label: "後半サビ 110–113", measures: [110, 111, 112, 113] },
  { label: "大サビ 117–120", measures: [117, 118, 119, 120] },
  { label: "大サビ 121–124", measures: [121, 122, 123, 124] },
  { label: "大サビ 125–128", measures: [125, 126, 127, 128] },
  { label: "大サビ 129–132", measures: [129, 130, 131, 132] },
  { label: "大サビ 133–136", measures: [133, 134, 135, 136] },
  { label: "大サビ 137–141", measures: [137, 138, 139, 140, 141] },
];

const TECHNIQUE_MEASURES = [
  { measure: 66, sequence: "休・休 ｜ 7/7 ｜ ×/× → 7〜", focus: "2音同時とミュート" },
  { measure: 67, sequence: "(7) → 9 ｜ 休 ｜ ×× → 7 → 9", focus: "タイを残して再開" },
  { measure: 68, sequence: "休 ｜ ×× → 7 ｜ 休 ｜ 7 → 10 → 9〜", focus: "弦をまたぐ移動" },
  { measure: 69, sequence: "(9) → 7 ｜ 休 ｜ × → 7 → 9 → 7 → 10", focus: "上の弦へ駆け上がる" },
  { measure: 70, sequence: "×/× → 12/9 → 11 → ×× → 7 → 9 → 7〜", focus: "2音と単音の切替" },
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
  { measure: 142, sequence: "(10) → 12 → 10 → 12 → 10 → 13", focus: "弦移動" },
  { measure: 143, sequence: "10 → 13 → 12 → 13 → 12 sl.10 → 10 → 10〜", focus: "下降スライド" },
  { measure: 144, sequence: "(10) → 12 → 10 → 10 ｜ 休 → 10", focus: "休符を切る" },
  { measure: 145, sequence: "12 → 10 → 13 → 10 → 12 → 10 → 12 → 10〜", focus: "8分音符ラン" },
  { measure: 146, sequence: "(10) → 12 → 10 → 12 sl.14 → 13 → 17", focus: "上昇スライド" },
  { measure: 147, sequence: "15 → 13 → 12 → 13 → 12 → 13 → 12 → 13", focus: "高音ポジション" },
  { measure: 148, sequence: "休 → 13/10 ｜ 休 → 13/10 → 13/10 → 13/10", focus: "最後の2音フレーズ" },
];

const NOTES = TAB_EVENTS.filter(
  (event): event is TabEvent & { stringNo: StringNumber; fret: number } =>
    event.kind === "note" && event.stringNo !== undefined && event.fret !== undefined,
);

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

function detectPitch(buffer: Float32Array, sampleRate: number) {
  let energy = 0;
  for (const sample of buffer) energy += sample * sample;
  const rms = Math.sqrt(energy / buffer.length);
  if (rms < 0.012) return null;

  const minimumLag = Math.floor(sampleRate / 1000);
  const maximumLag = Math.min(Math.floor(sampleRate / 70), Math.floor(buffer.length / 2));
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

  let bestLag = -1;
  for (let lag = minimumLag; lag < maximumLag; lag += 1) {
    if (normalized[lag] < 0.16 && normalized[lag] <= normalized[lag + 1]) {
      bestLag = lag;
      break;
    }
  }
  if (bestLag < 0) return null;

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
            gridColumn: `${event.tick + 1}`,
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
      <div className="flex justify-between px-3 py-2 text-[0.7rem] text-stone-500" aria-hidden="true">
        <span>1弦（細い）</span>
        <span>6弦（太い）</span>
      </div>
    </section>
  );
}

export function GuitarTrainer() {
  const [noteIndex, setNoteIndex] = useState(0);
  const [bpm, setBpm] = useState(85);
  const [playing, setPlaying] = useState(false);
  const [countIn, setCountIn] = useState(true);
  const [metronome, setMetronome] = useState(true);
  const [learnedIds, setLearnedIds] = useState<Set<string>>(new Set());
  const [inputEnabled, setInputEnabled] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [detectedFrequency, setDetectedFrequency] = useState<number | null>(null);
  const [detectedCents, setDetectedCents] = useState<number | null>(null);
  const [pitchMatched, setPitchMatched] = useState(false);
  const [inputError, setInputError] = useState("");
  const [autoAdvance, setAutoAdvance] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerIdsRef = useRef<number[]>([]);
  const inputStreamRef = useRef<MediaStream | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const currentNote = NOTES[noteIndex];
  const targetFrequency = frequencyFor(currentNote.stringNo, currentNote.fret);
  const learnedProgress = Math.round((learnedIds.size / NOTES.length) * 100);
  const currentSection = PRACTICE_SECTIONS.find((section) =>
    section.measures.includes(currentNote.measure),
  ) ?? PRACTICE_SECTIONS[0];
  const visibleMeasures = currentSection.measures;
  const fretRange = currentNote.fret >= 10
    ? [9, 10, 11, 12, 13]
    : [5, 6, 7, 8, 9];
  const tunerOffset = Math.max(-50, Math.min(50, detectedCents ?? 0)) * 1.4;
  const tunerMessage = playing
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
  const currentMeasureNotes = useMemo(
    () => NOTES.filter((note) => note.measure === currentNote.measure),
    [currentNote.measure],
  );

  const clearTimers = useCallback(() => {
    timerIdsRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timerIdsRef.current = [];
  }, []);

  const stopPlayback = useCallback(() => {
    clearTimers();
    setPlaying(false);
  }, [clearTimers]);

  useEffect(() => {
    return () => {
      clearTimers();
      inputStreamRef.current?.getTracks().forEach((track) => track.stop());
      inputSourceRef.current?.disconnect();
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
      const frequency = detectPitch(buffer, analyser.context.sampleRate);

      if (frequency) {
        const cents = 1200 * Math.log2(frequency / targetFrequency);
        const isCorrect = Math.abs(cents) <= 30 && !playing;
        setDetectedFrequency(frequency);
        setDetectedCents(cents);
        correctFrames = isCorrect ? correctFrames + 1 : 0;
        setPitchMatched(correctFrames >= 4);

        if (autoAdvance && correctFrames >= 8 && !advanced) {
          advanced = true;
          setLearnedIds((previous) => new Set(previous).add(currentNote.id));
          if (noteIndex < NOTES.length - 1) setNoteIndex(noteIndex + 1);
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
  }, [autoAdvance, currentNote.fret, currentNote.id, currentNote.stringNo, inputEnabled, noteIndex, playing, selectedDeviceId, targetFrequency]);

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
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);

      inputStreamRef.current = stream;
      inputSourceRef.current = source;
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
    analyserRef.current?.disconnect();
    inputStreamRef.current = null;
    inputSourceRef.current = null;
    analyserRef.current = null;
    setInputEnabled(false);
    setDetectedFrequency(null);
    setDetectedCents(null);
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
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.05);
  }

  function playCurrentNote() {
    const context = getAudioContext();
    void context.resume();
    schedulePluck(context, currentNote.stringNo, currentNote.fret, context.currentTime + 0.04, 0.7);
  }

  function playMeasure() {
    stopPlayback();
    const context = getAudioContext();
    void context.resume();
    const secondsPerTick = 30 / bpm;
    const countInTicks = countIn ? 8 : 0;
    const startAt = context.currentTime + 0.08;

    if (countIn) {
      for (let tick = 0; tick < countInTicks; tick += 2) {
        scheduleClick(context, startAt + tick * secondsPerTick, tick === 0);
      }
    }
    if (metronome) {
      for (let tick = 0; tick < 8; tick += 2) {
        scheduleClick(context, startAt + (countInTicks + tick) * secondsPerTick, tick === 0);
      }
    }

    currentMeasureNotes.forEach((note) => {
      const offset = countInTicks + note.tick;
      schedulePluck(
        context,
        note.stringNo,
        note.fret,
        startAt + offset * secondsPerTick,
        Math.max(0.12, (note.duration ?? 1) * secondsPerTick * 0.86),
      );
      const timerId = window.setTimeout(() => {
        setNoteIndex(NOTES.findIndex((candidate) => candidate.id === note.id));
      }, offset * secondsPerTick * 1000);
      timerIdsRef.current.push(timerId);
    });

    setPlaying(true);
    const endTimer = window.setTimeout(
      () => setPlaying(false),
      (countInTicks + 8.3) * secondsPerTick * 1000,
    );
    timerIdsRef.current.push(endTimer);
  }

  function selectNote(id: string) {
    stopPlayback();
    const nextIndex = NOTES.findIndex((note) => note.id === id);
    if (nextIndex >= 0) setNoteIndex(nextIndex);
  }

  function goBy(delta: number) {
    stopPlayback();
    setNoteIndex((index) => Math.min(NOTES.length - 1, Math.max(0, index + delta)));
  }

  function goToSection(firstMeasure: number) {
    stopPlayback();
    const nextIndex = NOTES.findIndex((note) => note.measure === firstMeasure);
    if (nextIndex >= 0) setNoteIndex(nextIndex);
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

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:px-8">
        <div className="min-w-0 space-y-6">
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

          <section className="rounded-2xl border border-stone-800 bg-stone-900 p-4 sm:p-6" aria-labelledby="tab-title">
            <div className="mb-6 overflow-x-auto pb-2">
              <div className="flex min-w-max gap-2" aria-label="練習区間を選ぶ">
                {PRACTICE_SECTIONS.map((section) => (
                  <button
                    className="min-h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm font-bold text-stone-300 data-[active=true]:border-lime-300 data-[active=true]:bg-lime-300 data-[active=true]:text-lime-950"
                    data-active={section.label === currentSection.label}
                    type="button"
                    onClick={() => goToSection(section.measures[0])}
                    key={section.label}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-bold text-lime-300">LEAD TAB</p>
                <h2 id="tab-title" className="mt-1 text-balance text-2xl font-black">スクショ下段 · {currentSection.label}</h2>
                <p className="mt-2 text-pretty text-sm text-stone-400">数字をタップすると、その音の押さえる場所へ移動します。</p>
              </div>
              <p className="text-sm font-bold text-stone-300">上 = 1弦 / 下 = 6弦</p>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {visibleMeasures.map((measure) => (
                <TabMeasure
                  measure={measure}
                  currentId={currentNote.id}
                  learnedIds={learnedIds}
                  onSelect={selectNote}
                  key={measure}
                />
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-stone-700 bg-stone-950 p-4 text-sm text-stone-300">
              <strong className="text-stone-100">読み取りメモ：</strong> <span className="font-black tabular-nums">(5)</span> や <span className="font-black tabular-nums">(10)</span> は前の音を伸ばす印です。もう一度ピッキングせず、音を残します。21〜32小節と58〜65小節の休みは練習区間から省き、114〜116小節と142〜148小節は奏法カードへ分けています。
            </div>
          </section>

          <section className="rounded-2xl border border-stone-800 bg-stone-900 p-4 sm:p-6" aria-labelledby="technique-title">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-bold text-lime-300">TECHNIQUE BLOCK</p>
                <h2 id="technique-title" className="mt-1 text-balance text-2xl font-black">66〜81小節 · リード奏法編</h2>
                <p className="mt-2 max-w-2xl text-pretty text-sm text-stone-400">ここからは音程だけでなく、ミュートや2音同時のタイミングが重要です。まず記号と動きだけを小節ごとに分解します。</p>
              </div>
              <span className="rounded-lg border border-stone-700 px-3 py-2 text-xs font-bold text-stone-400">66〜81小節 読み取り済み</span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {TECHNIQUE_MEASURES.map((item) => (
                <article className="rounded-xl border border-stone-700 bg-stone-950 p-4" key={item.measure}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-lime-300 tabular-nums">MEASURE {item.measure}</p>
                    <span className="text-xs font-bold text-stone-500">{item.focus}</span>
                  </div>
                  <p className="mt-3 text-pretty font-mono text-sm font-bold leading-7 text-stone-200">{item.sequence}</p>
                </article>
              ))}
            </div>

            <div className="mt-6 border-t border-stone-800 pt-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-lime-300">BRIDGE TECHNIQUE</p>
                  <h3 className="mt-1 text-xl font-black">114〜116小節 · 大サビ前の特殊奏法</h3>
                </div>
                <p className="max-w-xl text-pretty text-sm text-stone-400">複数の音が重なるため、ここはチューナーの自動送りを使わず、各構成音を1本ずつ確認してから同時に鳴らします。</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {BRIDGE_TECHNIQUE_MEASURES.map((item) => (
                  <article className="rounded-xl border border-stone-700 bg-stone-950 p-4" key={item.measure}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-lime-300 tabular-nums">MEASURE {item.measure}</p>
                      <span className="text-xs font-bold text-stone-500">{item.focus}</span>
                    </div>
                    <p className="mt-3 text-pretty font-mono text-sm font-bold leading-7 text-stone-200">{item.sequence}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="mt-6 border-t border-stone-800 pt-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-lime-300">FINAL PHRASE</p>
                  <h3 className="mt-1 text-xl font-black">142〜148小節 · 最後の変化フレーズ</h3>
                </div>
                <p className="max-w-xl text-pretty text-sm text-stone-400">149小節からリードは休みです。まず142〜145、次に146〜148へ分け、最後に接続します。</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {OUTRO_TECHNIQUE_MEASURES.map((item) => (
                  <article className="rounded-xl border border-stone-700 bg-stone-950 p-4" key={item.measure}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-lime-300 tabular-nums">MEASURE {item.measure}</p>
                      <span className="text-xs font-bold text-stone-500">{item.focus}</span>
                    </div>
                    <p className="mt-3 text-pretty font-mono text-sm font-bold leading-7 text-stone-200">{item.sequence}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-stone-800 p-4"><p className="font-black">× = ミュート</p><p className="mt-1 text-pretty text-sm text-stone-400">左手を弦に触れるだけ。フレットまで押し込まず、乾いた音を出します。</p></div>
              <div className="rounded-xl bg-stone-800 p-4"><p className="font-black">7/7 = 2音同時</p><p className="mt-1 text-pretty text-sm text-stone-400">上下に並んだ数字は同時に鳴らします。チューナー判定は1本ずつ確認します。</p></div>
              <div className="rounded-xl bg-stone-800 p-4"><p className="font-black">sl. / H</p><p className="mt-1 text-pretty text-sm text-stone-400">sl.は指を滑らせ、Hは右手で弾き直さず左手の指を打ちつけます。</p></div>
              <div className="rounded-xl bg-stone-800 p-4"><p className="font-black">full = 1音ベンド</p><p className="mt-1 text-pretty text-sm text-stone-400">弦を押し上げ、2フレット上と同じ高さまで音程を上げます。</p></div>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-stone-700 bg-stone-900 p-5" aria-labelledby="input-title">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-lime-300">LIVE INPUT</p>
                <h2 id="input-title" className="mt-1 text-balance text-xl font-black">Amperoで正誤判定</h2>
              </div>
              <span className="rounded-full border border-stone-700 px-2.5 py-1 text-xs font-bold text-stone-400">
                {inputEnabled ? "接続中" : "未接続"}
              </span>
            </div>

            {!inputEnabled ? (
              <div className="mt-5">
                <p className="text-pretty text-sm text-stone-400">ブラウザに入力を許可してから、入力一覧でAmpero Miniを選びます。</p>
                <button className="mt-4 min-h-12 w-full rounded-xl bg-lime-300 px-4 font-black text-lime-950 hover:bg-lime-200" type="button" onClick={() => void connectInput()}>
                  ギター入力を接続
                </button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <label className="block text-sm font-bold text-stone-300">
                  入力デバイス
                  <select
                    className="mt-2 min-h-12 w-full rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm text-stone-100"
                    value={selectedDeviceId}
                    onChange={(event) => void connectInput(event.target.value)}
                  >
                    {audioDevices.map((device, index) => (
                      <option value={device.deviceId} key={device.deviceId}>
                        {device.label || `音声入力 ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-stone-950 p-3">
                    <p className="text-xs font-bold text-stone-500">ねらう音</p>
                    <p className="mt-1 text-2xl font-black tabular-nums">{noteName(targetFrequency)}</p>
                    <p className="text-xs text-stone-500 tabular-nums">{targetFrequency.toFixed(1)} Hz</p>
                  </div>
                  <div className="rounded-xl bg-stone-950 p-3">
                    <p className="text-xs font-bold text-stone-500">入力された音</p>
                    <p className="mt-1 text-2xl font-black tabular-nums">{detectedFrequency ? noteName(detectedFrequency) : "—"}</p>
                    <p className="text-xs text-stone-500 tabular-nums">{detectedFrequency ? `${detectedFrequency.toFixed(1)} Hz` : "音を待っています"}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-stone-700 bg-stone-950 p-4" data-correct={pitchMatched}>
                  <div className="flex justify-between text-[0.68rem] font-bold text-stone-500"><span>低い</span><span>合ってる</span><span>高い</span></div>
                  <div className="relative mx-auto mt-3 h-3 w-36 rounded-full bg-stone-700" aria-hidden="true">
                    <span className="absolute left-1/2 top-[-0.35rem] h-6 w-px bg-stone-400" />
                    <span className="absolute left-1/2 top-[-0.2rem] size-5 rounded-full bg-lime-300" style={{ transform: `translateX(calc(-50% + ${tunerOffset}px))` }} />
                  </div>
                  <p className="mt-4 text-center text-sm font-black" aria-live="polite">{tunerMessage}</p>
                  {detectedCents !== null && <p className="mt-1 text-center text-xs text-stone-500 tabular-nums">{detectedCents > 0 ? "+" : ""}{detectedCents.toFixed(0)} cents</p>}
                </div>

                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-bold">
                  <input className="size-5" type="checkbox" checked={autoAdvance} onChange={(event) => setAutoAdvance(event.target.checked)} />
                  正解したら自動で次の音へ
                </label>
                <button className="min-h-11 w-full rounded-xl border border-stone-700 text-sm font-bold text-stone-300 hover:bg-stone-800" type="button" onClick={disconnectInput}>入力を切る</button>
              </div>
            )}

            {inputError && <p className="mt-3 rounded-lg border border-red-900 bg-red-950 p-3 text-pretty text-sm text-red-200" role="alert">{inputError}</p>}
            <p className="mt-4 text-pretty text-xs text-stone-500">判定時はAmperoをクリーン音にして、1音だけ鳴らしてください。歪み・和音・スピーカーからのお手本音は誤判定の原因になります。</p>
          </section>

          <section className="rounded-2xl border border-stone-800 bg-stone-900 p-5" aria-labelledby="tempo-title">
            <p className="text-sm font-bold text-lime-300">PRACTICE SPEED</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <h2 id="tempo-title" className="text-balance text-xl font-black">練習テンポ</h2>
              <p className="text-3xl font-black tabular-nums">{bpm}<span className="ml-1 text-xs text-stone-500">BPM</span></p>
            </div>
            <input className="mt-5 min-h-11 w-full" type="range" min="50" max="170" step="1" value={bpm} onChange={(event) => setBpm(Number(event.target.value))} aria-label="練習テンポ" />
            <div className="mt-2 flex justify-between text-xs text-stone-500 tabular-nums"><span>50</span><span>170</span></div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[85, 119, 170].map((value) => (
                <button className="min-h-11 rounded-lg border border-stone-700 bg-stone-950 text-sm font-bold data-[active=true]:border-lime-300 data-[active=true]:text-lime-300" data-active={bpm === value} type="button" onClick={() => setBpm(value)} key={value}>{Math.round((value / 170) * 100)}%</button>
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
