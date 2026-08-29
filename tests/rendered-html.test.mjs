import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the finished guitar trainer", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = (await response.text()).replaceAll("<!-- -->", "");
  assert.match(html, /<html lang="ja">/i);
  assert.match(html, /<title>FRET \/ STEP — ギターTABトレーナー<\/title>/i);
  assert.match(html, /人生オーバー/);
  assert.match(html, /170 BPM/);
  assert.match(html, />25%</);
  assert.match(html, /25 BPMまで落とせます/);
  assert.match(html, /Capo 3/);
  assert.match(html, /惑う星/);
  assert.match(html, /2曲通し（カポなし）/);
  assert.doesNotMatch(html, /3パート切替/);
  assert.doesNotMatch(html, /2パート切替/);
  assert.match(html, /ギターパートを選択/);
  assert.match(html, /バッキングギター/);
  assert.doesNotMatch(html, /動画・音源・判定を同時切替/);
  assert.match(html, /練習曲を選択/);
  assert.match(html, /Ampero入力・チューナー・TAB判定/);
  assert.match(html, /TAB判定/);
  assert.match(html, /チューナー/);
  assert.match(html, /ギター入力レベル/);
  assert.match(html, /奏法記号を「指の動き」で見る/);
  assert.match(html, /リードギター TAB/);
  assert.match(html, /1–156小節/);
  assert.match(html, /aria-label="曲の再生位置を小節で移動"/);
  assert.match(html, /▶ 現在地から再生/);
  assert.match(html, /aria-label="1小節から再生"/);
  assert.match(html, />カウント</);
  assert.match(html, />クリック</);
  assert.doesNotMatch(html, /1小節カウントしてから開始|再生中もクリック音を鳴らす/);
  assert.match(html, /クリックした拍へ移動/);
  assert.match(html, /再生位置/);
  assert.match(html, /表示4小節/);
  assert.match(html, /この区間/);
  assert.doesNotMatch(html, /曲全体 1〜156/);
  assert.match(html, /aria-label="再生範囲"/);
  assert.match(html, />表示4小節 1〜4</);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /aria-label="表示4小節 1〜4を再生"/);
  assert.match(html, /譜面を見ながら判定/);
  assert.match(html, /正解で曲を進める/);
  assert.doesNotMatch(html, /追加ギター（中央段）|GUITAR 3/);
  assert.doesNotMatch(html, /原動画フレーム読取|高解像度OCR転記|譜面の監査・訂正メモ/);
  assert.match(html, /原曲動画/);
  assert.match(html, /A\/B・動画同期/);
  assert.match(html, /TAB数字を実フレットとして判定/);
  assert.match(html, /現在の狙いは E3/);
  assert.doesNotMatch(html, /カポ3判定 G3/);
  assert.match(html, /学習ガイド/);
  assert.match(html, /PHRASE 01 \/ 58/);
  assert.match(html, /前のフレーズ/);
  assert.match(html, /次のフレーズ/);
  assert.match(html, /覚えたフレーズ/);
  assert.match(html, /aria-label="覚えたフレーズの進捗" aria-valuemin="0" aria-valuemax="32"/);
  assert.doesNotMatch(html, /覚えた音|\/ 706/);
  assert.match(html, /TABの基本・進捗/);
  assert.match(html, /Aメロ/);
  assert.match(html, /Bメロ/);
  assert.match(html, /2番サビ/);
  assert.match(html, /82–97/);
  assert.match(html, /Cメロ/);
  assert.match(html, /98–113/);
  assert.doesNotMatch(html, /82–113/);
  assert.match(html, /アウトロ/);
  assert.doesNotMatch(html, /サビ〜間奏/);
  assert.match(html, /6LfUfHSIiMw/);
  assert.match(html, /aria-label="1小節目、/);
  assert.doesNotMatch(html, /PROCEDURAL TAB|スクショ下段|動画で通し再生|TECHNIQUE BLOCK|66〜81小節 · リード奏法編/);
  assert.doesNotMatch(html, /tab-01\.png|tab-screenshots/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});

test("keeps the input meter, tuner, and audited TAB data in the client implementation", async () => {
  const [page, layout, trainer, trainerCore, tabDataText, madowBackingCorrectionsText, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/trainer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/trainer-core.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/tab-audit-data.json", import.meta.url), "utf8"),
    readFile(new URL("../app/madow-backing-manual-corrections.json", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  const tabData = JSON.parse(tabDataText);
  const madowBackingCorrections = JSON.parse(madowBackingCorrectionsText);

  assert.match(page, /<GuitarTrainer \/>/);
  assert.match(layout, /<html lang="ja">/);
  assert.match(layout, /FRET \/ STEP/);
  assert.match(trainer, /ギター入力レベル/);
  assert.match(trainer, /TUNER_STRINGS/);
  assert.match(trainer, /inputMode === "tuner"/);
  assert.match(trainerCore, /export function detectPitch/);
  assert.match(trainer, /function playRange/);
  assert.match(trainer, /const MIN_PRACTICE_BPM = 25/);
  assert.match(trainer, /min=\{MIN_PRACTICE_BPM\}/);
  assert.match(trainer, /\[0\.25, 0\.5, 0\.75, 1\]/);
  assert.match(trainer, /if \(videoSync && !supportsVideoSync\)/);
  assert.match(trainer, /setVideoSync\(false\)/);
  assert.match(trainer, /type SongId = "life-over" \| "madow"/);
  assert.match(trainer, /vPexB7CEMGY/);
  assert.match(trainer, /85ORTRtwmF4/);
  assert.match(trainer, /totalMeasures: 207/);
  assert.match(trainer, /tabAuditData/);
  assert.match(trainer, /AUDITED_TAB_DATA/);
  assert.match(trainer, /auditedGlyphRecord\("life-over", "third"\)/);
  assert.match(trainerCore, /export function sustainGuitarPart/);
  assert.match(trainerCore, /export function phraseFingerprint/);
  assert.match(trainerCore, /export function buildPhraseInstances/);
  assert.match(trainer, /learnedPhraseIds/);
  assert.match(trainer, /currentPhraseNotes/);
  assert.match(trainer, /function goByPhrase/);
  assert.match(trainer, /function togglePhraseLearned/);
  assert.match(trainer, /learnedPhraseIds: \[\.\.\.learnedPhraseIds\]/);
  assert.match(trainerCore, /notes ring through otherwise empty space/);
  assert.match(trainerCore, /durationSlots: Math\.max\(2, Math\.min\(nextArticulationSlot, barBoundary\) - entry\.absoluteSlot\)/);
  assert.match(trainer, /symbol\.durationSlots \?\? 2/);
  assert.doesNotMatch(trainer, /mergeOptionalGuitarIntoLead/);
  assert.match(trainer, /lead: LIFE_OVER_ORIGINAL_LEAD_GLYPHS/);
  assert.match(trainer, /third: LIFE_OVER_MIDDLE_GLYPHS/);
  assert.match(trainer, /66〜81小節だけ/);
  assert.match(trainer, /元リード/);
  assert.match(trainer, /中央段/);
  assert.match(trainer, /lifeLeadSectionMode === "middle" && measure >= 66 && measure <= 81/);
  assert.match(trainer, /saved\.trackId === "third" \? "lead" : saved\.trackId/);
  assert.match(trainer, /function switchSong/);
  assert.match(trainer, /function switchTrack/);
  assert.match(trainer, /function startMedley/);
  assert.match(trainer, /function startMadowMedley/);
  assert.match(trainer, /capo: 0, lifeLeadSectionMode, medleyPhase: "life"/);
  assert.match(trainer, /capo: 0, madowBackingVersion, medleyPhase: "madow"/);
  assert.match(trainer, /videoId: "qGDXx7x_7sc"/);
  assert.match(trainer, /作者TAB版（易しめ）/);
  assert.match(trainer, /useState<MadowBackingVersion>\("joseluru"\)/);
  assert.match(trainer, /effect !== "let ring"/);
  assert.match(trainer, /18: 6/);
  assert.match(trainer, /madowBackingVersion === "joseluru"/);
  assert.doesNotMatch(trainer, /transposeLifeLeadSymbolForNoCapo|LIFE_NO_CAPO/);
  assert.match(trainer, /const effectiveCapo = 0/);
  assert.match(trainer, /scheduledSongId === "life-over" \? 0 : scheduledSong\.capo/);
  assert.match(trainer, /setMedleySurface\("madow", "backing"/);
  assert.match(trainer, /type TrackId = "lead" \| "backing" \| "third"/);
  assert.match(trainer, /function toggleSelectedPlayback/);
  assert.match(trainer, /function toggleCurrentPositionPlayback/);
  assert.match(trainer, /onClick=\{toggleCurrentPositionPlayback\}/);
  assert.match(trainer, /timelineMeasure,\s*song\.totalMeasures/);
  assert.match(trainer, /bpm,\s*timelineStep/);
  assert.match(trainer, /if \(!medleyMode\) setPlaybackPreset\("remaining"\)/);
  assert.match(trainer, /function seekToMeasure/);
  assert.match(trainer, /function seekToScorePosition/);
  assert.match(trainer, /function playCurrentNote/);
  assert.doesNotMatch(trainer, /function playWrittenPitch|function cueOriginalPerformanceAtNote/);
  assert.match(trainer, /onSeek=\{seekToScorePosition\}/);

  const lifeMeasure91 = tabData["life-over"].lead["91"];
  const lastMeasure91Symbol = lifeMeasure91[lifeMeasure91.length - 1].symbols[0];
  assert.equal(lastMeasure91Symbol.stringNo, 2);
  assert.equal(lastMeasure91Symbol.text, "10");

  const symbolSignature = (glyph) => glyph.symbols
    .map((symbol) => `${symbol.stringNo}:${symbol.text}`)
    .join("+");
  const assertSixteenthRun = (measure, expected) => {
    assert.equal(measure.length, 16);
    assert.deepEqual(measure.map((glyph) => glyph.slot), [...Array(16).keys()]);
    assert.deepEqual(measure.map(symbolSignature), expected);
  };
  assertSixteenthRun(tabData.madow.lead["15"], [
    ...Array(8).fill("2:7+3:×+4:4"),
    ...Array(8).fill("2:8+3:×+4:5"),
  ]);
  assert.equal(tabData.madow.lead["124"].length, 18);
  assert.equal(new Set(tabData.madow.lead["124"].map((glyph) => glyph.slot)).size, 18);
  assert.deepEqual(tabData.madow.lead["124"].map(symbolSignature), [
    ...Array(12).fill("2:12+3:14"),
    ...Array(6).fill("2:15+3:17"),
  ]);
  assertSixteenthRun(tabData.madow.lead["150"], [
    ...Array(8).fill("3:7+4:×+5:5"),
    ...Array(6).fill("3:9+4:×+5:7"),
    ...Array(2).fill("3:11+4:×+5:9"),
  ]);
  assertSixteenthRun(tabData.madow.lead["156"], Array(16).fill("2:15+3:14"));
  assertSixteenthRun(tabData.madow.lead["173"], Array(16).fill("2:12+3:×+4:9"));
  assertSixteenthRun(tabData.madow.lead["206"], [
    ...Array(8).fill("2:10+3:12"),
    ...Array(8).fill("2:12+3:14"),
  ]);
  for (const measure of ["128", "132", "136"]) {
    assert.equal(tabData.madow.backing[measure][0].slot, 0);
    assert.equal(symbolSignature(tabData.madow.backing[measure][0]), "3:(0)");
  }
  assert.equal(madowBackingCorrections["1"][0].slot, 0);
  assert.equal(symbolSignature(madowBackingCorrections["1"][0]), "1:0+2:0+3:0+4:0+5:2+6:0");
  for (const measure of ["2", "3", "4", "5", "6"]) {
    assert.equal(madowBackingCorrections[measure][0].technique, "tie");
    assert.equal(symbolSignature(madowBackingCorrections[measure][0]), "1:(0)+2:(0)+3:(0)+4:(0)+5:(2)+6:(0)");
  }
  assertSixteenthRun(madowBackingCorrections["7"], Array(16).fill("3:4+4:4"));
  assertSixteenthRun(madowBackingCorrections["8"], Array(16).fill("3:7+4:7"));
  assertSixteenthRun(madowBackingCorrections["15"], Array(16).fill("3:4+4:4"));
  assertSixteenthRun(madowBackingCorrections["16"], Array(16).fill("3:7+4:7"));
  for (const measure of ["9", "10", "11", "12", "13", "14"]) {
    assert.deepEqual(madowBackingCorrections[measure].map((glyph) => glyph.slot), [0, 2, 4, 6, 8, 10, 12, 14]);
    assert.deepEqual(madowBackingCorrections[measure].map(symbolSignature), Array(8).fill("6:0"));
  }
  assertSixteenthRun(tabData.madow.backing["7"], Array(16).fill("3:4+4:4"));
  assertSixteenthRun(tabData.madow.backing["8"], Array(16).fill("3:7+4:7"));
  assert.equal(tabData.madow.backing["123"].length, 10);
  assert.deepEqual(tabData.madow.backing["123"].slice(2).map(symbolSignature), Array(8).fill("2:7+3:9"));
  assert.ok(tabData.madow.backing["123"].slice(2).every((glyph) => glyph.technique === "full"));
  assert.equal(tabData.madow.backing["124"].length, 18);
  assert.equal(new Set(tabData.madow.backing["124"].map((glyph) => glyph.slot)).size, 18);
  assert.deepEqual(tabData.madow.backing["124"].map(symbolSignature), [
    ...Array(12).fill("2:8+3:10"),
    ...Array(6).fill("2:12+3:14"),
  ]);
  assert.deepEqual(tabData.madow.backing["125"].map(symbolSignature), ["1:0+2:0+3:0+4:4+5:3"]);
  assert.deepEqual(tabData.madow.backing["129"].map(symbolSignature), ["1:0+2:0+3:0+4:4+5:×+6:0"]);
  assert.deepEqual(tabData.madow.backing["137"].map(symbolSignature), ["1:0+2:0+3:2+4:0+5:2+6:0"]);
  assert.deepEqual(tabData.madow.backing["149"].map((glyph) => glyph.slot), [0, 4, 8, 12]);
  assert.deepEqual(tabData.madow.backing["199"].map(symbolSignature), ["2:<7>+3:<7>+4:<7>+5:<7>"]);
  for (const measure of ["200", "201", "202"]) {
    assert.equal(tabData.madow.backing[measure][0].technique, "tie");
    assert.equal(symbolSignature(tabData.madow.backing[measure][0]), "2:(<7>)+3:(<7>)+4:(<7>)+5:(<7>)");
  }
  assert.equal(symbolSignature(tabData.madow.backing["203"][0]), "1:0+2:0+3:0+4:0+5:2+6:0");
  assert.equal(symbolSignature(tabData.madow.backing["204"][0]), "1:(0)+2:(0)+3:(0)+4:(0)+5:(2)+6:(0)");
  assertSixteenthRun(tabData.madow.backing["205"], Array(16).fill("3:4+4:4"));
  assertSixteenthRun(tabData.madow.backing["206"], Array(16).fill("3:7+4:7"));
  assert.deepEqual(tabData.madow.backing["207"], []);

  for (const [songId, song] of Object.entries(tabData)) {
    for (const [trackId, measures] of Object.entries(song)) {
      for (const [measureNo, glyphs] of Object.entries(measures)) {
        const signatures = glyphs.map((glyph) => [
          glyph.slot,
          glyph.technique ?? "",
          symbolSignature(glyph),
        ].join("|"));
        assert.equal(
          new Set(signatures).size,
          signatures.length,
          `duplicate TAB event: ${songId}/${trackId}/${measureNo}`,
        );
      }
    }
  }
  assert.match(trainer, /setPlaybackPreset\("remaining"\)/);
  assert.match(trainer, /aria-pressed=\{selected\}/);
  assert.match(trainer, /selected \? toggleSelectedPlayback\(\) : selectPlaybackPreset\(choice\.id\)/);
  assert.match(trainer, /selectedAndPlaying \? "停止" : canResumeSelected \? "再開" : "再生"/);
  assert.doesNotMatch(trainer, /onClick=\{\(\) => playRange\(1, 151/);
  assert.doesNotMatch(trainer, /live-console sticky|sticky top-0 z-50/);
  assert.match(trainer, /scorePlaybackEvents/);
  assert.match(trainer, /if \(!useVideoSync\) scorePlaybackEvents/);
  assert.match(trainer, /sendVideoCommand\("setVolume", \[guitarVolume\]\)/);
  assert.match(trainer, /activeNodesRef/);
  assert.match(trainer, /guidedMode/);
  assert.match(trainer, /checked=\{loopEnabled\}/);
  assert.match(trainer, />反復<\/label>/);
  assert.match(trainer, /動画同期/);
  assert.match(trainer, /enablejsapi=1/);
  assert.match(trainer, /fret-step-trainer:v2/);
  assert.match(trainer, /totalMeasures: 156/);
  assert.match(trainer, /range: "149–156", start: 149, end: 156, kind: "rest"/);
  assert.match(trainer, /Array\.from\(\{ length: SONGS\[songId\]\.totalMeasures \}/);
  assert.match(trainer, /auditNotes/);
  assert.match(trainer, /<details className="live-console/);
  assert.equal(Object.keys(tabData["life-over"].lead).length, 151);
  assert.equal(Object.keys(tabData["life-over"].backing).length, 151);
  assert.equal(Object.keys(tabData["life-over"].third).length, 151);
  assert.equal(Object.keys(tabData.madow.lead).length, 207);
  assert.equal(Object.keys(tabData.madow.backing).length, 207);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});

test("keeps the four-measure TAB stack compact", async () => {
  const [trainer, styles] = await Promise.all([
    readFile(new URL("../app/trainer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(styles, /grid-template-rows:\s*repeat\(6, 1\.05rem\)/);
  assert.doesNotMatch(styles, /grid-template-rows:\s*repeat\(6, 1\.55rem\)/);
  assert.match(trainer, /<div className="mt-3 grid gap-2">/);
});

test("uses separate low-halation colors for each mixed meter", async () => {
  const [trainer, styles] = await Promise.all([
    readFile(new URL("../app/trainer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(trainer, /const isMixedMeter = beats !== 4/);
  assert.match(trainer, /data-mixed-meter=\{isMixedMeter\}/);
  assert.match(trainer, /data-beats=\{beats\}/);
  assert.match(trainer, /border: "border-sky-300\/40"/);
  assert.match(trainer, /label: "text-sky-300"/);
  assert.match(trainer, /badge: "border-sky-300\/40 bg-sky-950\/60 text-sky-200"/);
  assert.match(trainer, /border: "border-rose-300\/40"/);
  assert.match(trainer, /label: "text-rose-300"/);
  assert.match(trainer, /badge: "border-rose-300\/40 bg-rose-950\/60 text-rose-200"/);
  assert.match(trainer, /\{beats\} \/ 4/);
  assert.doesNotMatch(trainer, /isMixedMeter \? "border-amber-400\/50"/);
  assert.doesNotMatch(trainer, /rounded bg-amber-400 px-1\.5 py-0\.5/);
  assert.match(styles, /--meter-five-accent:\s*#7dd3fc/);
  assert.match(styles, /--meter-six-accent:\s*#fda4af/);
  assert.match(styles, /section\[data-beats="5"\]/);
  assert.match(styles, /section\[data-beats="6"\]/);
  assert.match(styles, /outline-color:\s*color-mix\(in srgb, var\(--meter-five-accent\) 35%, transparent\)/);
  assert.match(styles, /outline-color:\s*color-mix\(in srgb, var\(--meter-six-accent\) 35%, transparent\)/);
});

test("keeps separate live guitar and click volume faders", async () => {
  const trainer = await readFile(new URL("../app/trainer.tsx", import.meta.url), "utf8");

  assert.match(trainer, /aria-label="ギター音量"/);
  assert.match(trainer, /aria-label="クリック音量"/);
  assert.match(trainer, /guitarGain\.gain\.value = guitarVolume \/ 100/);
  assert.match(trainer, /clickGain\.gain\.value = clickVolume \/ 100/);
  assert.match(trainer, /gain\.gain\.setTargetAtTime\(guitarVolume \/ 100/);
  assert.match(trainer, /gain\.gain\.setTargetAtTime\(clickVolume \/ 100/);
  assert.match(trainer, /guitarVolume,/);
  assert.match(trainer, /clickVolume,/);
});

test("schedules dense audio one measure at a time with lookahead", async () => {
  const trainer = await readFile(new URL("../app/trainer.tsx", import.meta.url), "utf8");

  assert.match(trainer, /const AUDIO_SCHEDULE_LOOKAHEAD_MS = 600/);
  assert.match(trainer, /const scheduleMeasureAudio = \(measure: number, measureOffset: number, measureSteps: number\)/);
  assert.match(trainer, /const audioTimer = window\.setTimeout/);
  assert.match(trainer, /- AUDIO_SCHEDULE_LOOKAHEAD_MS/);
  assert.match(trainer, /eventStartAt \+ 0\.02 < context\.currentTime/);
});

test("keeps the video-audited lead strings and the single live monitor", async () => {
  const [trainer, tabDataText] = await Promise.all([
    readFile(new URL("../app/trainer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/tab-audit-data.json", import.meta.url), "utf8"),
  ]);
  const tabData = JSON.parse(tabDataText);
  const measure45Symbols = tabData["life-over"].lead["45"].flatMap((glyph) => glyph.symbols);
  const allLeadSymbols = Object.values(tabData["life-over"].lead)
    .flatMap((measure) => measure)
    .flatMap((glyph) => glyph.symbols);
  const lifeCorrections = {
    lead13: tabData["life-over"].lead["13"][0],
    lead53: tabData["life-over"].lead["53"][0],
    backing11: tabData["life-over"].backing["11"][0],
    backing37: tabData["life-over"].backing["37"][0],
  };

  assert.deepEqual([...new Set(measure45Symbols.map((symbol) => symbol.stringNo))], [3]);
  assert.deepEqual(measure45Symbols.map((symbol) => symbol.text), ["(10)", "10", "12", "10", "10", "10"]);
  assert.equal(allLeadSymbols.some((symbol) => symbol.text === "1" || symbol.text === "亊"), false);
  assert.deepEqual(tabData["life-over"].lead["1"], [
    { slot: 11, symbols: [{ stringNo: 5, text: "7" }] },
    { slot: 13, symbols: [{ stringNo: 5, text: "9" }] },
    { slot: 14, symbols: [{ stringNo: 4, text: "7" }] },
  ]);
  assert.deepEqual(tabData["life-over"].lead["79"], [
    { slot: 2, symbols: [{ stringNo: 2, text: "12" }] },
    { slot: 6, symbols: [{ stringNo: 1, text: "10" }] },
    { slot: 8, symbols: [{ stringNo: 1, text: "12" }] },
    { slot: 10, symbols: [{ stringNo: 1, text: "10" }] },
    { slot: 12, symbols: [{ stringNo: 1, text: "12" }], technique: "full" },
  ]);
  assert.deepEqual(tabData["life-over"].lead["80"].map((glyph) => glyph.slot), [
    0, 4, 5, 6, 8, 9, 12, 14,
  ]);
  assert.deepEqual(tabData["life-over"].lead["80"].flatMap((glyph) => glyph.symbols), [
    { stringNo: 2, text: "10" },
    { stringNo: 2, text: "10" },
    { stringNo: 2, text: "12" },
    { stringNo: 2, text: "10" },
    { stringNo: 2, text: "×" },
    { stringNo: 2, text: "7" },
    { stringNo: 3, text: "9" },
    { stringNo: 3, text: "7" },
  ]);
  assert.deepEqual(tabData["life-over"].lead["87"], [
    { slot: 0, symbols: [{ stringNo: 2, text: "(10)" }], technique: "tie" },
    { slot: 2, symbols: [{ stringNo: 2, text: "13" }] },
    { slot: 4, symbols: [{ stringNo: 1, text: "13" }] },
    { slot: 6, symbols: [{ stringNo: 1, text: "10" }] },
    { slot: 10, symbols: [{ stringNo: 2, text: "13" }] },
    { slot: 12, symbols: [{ stringNo: 2, text: "10" }] },
  ]);
  assert.deepEqual(tabData["life-over"].lead["94"].map((glyph) => glyph.slot), [
    0, 2, 4, 6, 8, 10, 12, 14,
  ]);
  assert.deepEqual(tabData["life-over"].lead["116"], [
    {
      slot: 9,
      symbols: [
        { stringNo: 2, text: "<5>" },
        { stringNo: 3, text: "<5>" },
        { stringNo: 4, text: "<5>" },
        { stringNo: 5, text: "<5>" },
      ],
      technique: "harm.",
    },
  ]);
  assert.deepEqual(tabData["life-over"].third["69"], [
    { slot: 0, symbols: [{ stringNo: 3, text: "×" }, { stringNo: 5, text: "×" }] },
    { slot: 2, symbols: [{ stringNo: 3, text: "9" }, { stringNo: 5, text: "7" }] },
    { slot: 4, symbols: [{ stringNo: 3, text: "×" }, { stringNo: 5, text: "×" }] },
    { slot: 6, symbols: [{ stringNo: 3, text: "7" }, { stringNo: 5, text: "5" }] },
  ]);
  assert.deepEqual(tabData["life-over"].third["75"][0], {
    slot: 0,
    symbols: [{ stringNo: 1, text: "(12)" }],
    technique: "tie",
  });
  assert.deepEqual(tabData["life-over"].lead["114"][0].symbols, [
    { stringNo: 2, text: "14" },
    { stringNo: 4, text: "11" },
  ]);
  assert.deepEqual(tabData["life-over"].lead["116"][0].symbols, [
    { stringNo: 2, text: "<5>" },
    { stringNo: 3, text: "<5>" },
    { stringNo: 4, text: "<5>" },
    { stringNo: 5, text: "<5>" },
  ]);
  assert.deepEqual(tabData["life-over"].lead["147"].flatMap((glyph) => glyph.symbols), [
    { stringNo: 2, text: "15" },
    { stringNo: 1, text: "13" },
    { stringNo: 1, text: "12" },
    { stringNo: 1, text: "13" },
    { stringNo: 1, text: "12" },
    { stringNo: 2, text: "13" },
  ]);
  assert.deepEqual(lifeCorrections.lead13, {
    slot: 0,
    symbols: [{ stringNo: 5, text: "(5)" }],
    technique: "tie",
  });
  assert.deepEqual(lifeCorrections.lead53, lifeCorrections.lead13);
  assert.deepEqual(lifeCorrections.backing11.symbols, [
    { stringNo: 2, text: "(2)" },
    { stringNo: 3, text: "(3)" },
    { stringNo: 4, text: "(2)" },
    { stringNo: 6, text: "(2)" },
  ]);
  assert.deepEqual(lifeCorrections.backing37.symbols, [
    { stringNo: 2, text: "(3)" },
    { stringNo: 3, text: "(2)" },
    { stringNo: 4, text: "(0)" },
    { stringNo: 6, text: "(3)" },
  ]);
  assert.ok(tabData["life-over"].third["66"].length > 0);
  assert.ok(tabData.madow.lead["100"].length > 0);
  assert.ok(tabData.madow.backing["205"].length > 0);
  assert.equal((trainer.match(/LIVE MONITOR/g) ?? []).length, 1);
  assert.doesNotMatch(trainer, /input-title|LIVE INPUT|LIVE JUDGE/);
});

test("JoseLuRu backing transcription stays on the canonical score contract", async () => {
  const text = await readFile(
    new URL("../app/madow-backing-joseluru.json", import.meta.url),
    "utf8",
  );
  const score = JSON.parse(text);

  assert.equal(Object.keys(score).length, 207);
  assert.ok(score["18"].length > 0, "the combined 6/4 bar must contain notes");

  for (const [measure, glyphs] of Object.entries(score)) {
    for (const glyph of glyphs) {
      const strings = glyph.symbols.map((symbol) => symbol.stringNo);
      assert.equal(
        new Set(strings).size,
        strings.length,
        `measure ${measure}, slot ${glyph.slot} repeats a string`,
      );
      for (const symbol of glyph.symbols) {
        if (/^\d+$/.test(symbol.text)) {
          assert.ok(
            Number(symbol.text) <= 24,
            `measure ${measure}, slot ${glyph.slot} has invalid fret ${symbol.text}`,
          );
        }
      }
    }
  }
});
