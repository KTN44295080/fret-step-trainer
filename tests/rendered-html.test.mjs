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
  assert.match(html, />LEAD</);
  assert.match(html, /惑う星/);
  assert.match(html, /リード／バッキング/);
  assert.match(html, /ギターパートを選択/);
  assert.match(html, /バッキングギター/);
  assert.match(html, /動画・音源・判定を同時切替/);
  assert.match(html, /207小節/);
  assert.match(html, /練習曲を選択/);
  assert.match(html, /Ampero入力・チューナー・TAB判定/);
  assert.match(html, /TAB判定/);
  assert.match(html, /チューナー/);
  assert.match(html, /ギター入力レベル/);
  assert.match(html, /奏法記号を「指の動き」で見る/);
  assert.match(html, /LEAD TAB · 全曲/);
  assert.match(html, /リードギターを1〜151小節/);
  assert.match(html, /TAB音源でまとめ再生/);
  assert.match(html, /表示4小節/);
  assert.match(html, /この区間/);
  assert.match(html, /曲全体 1〜151/);
  assert.match(html, /再生範囲を選択/);
  assert.match(html, /選択中 · 表示4小節 1〜4/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /aria-label="表示4小節 1〜4を再生"/);
  assert.match(html, /譜面を見ながら判定/);
  assert.match(html, /お手本→正解で進む/);
  assert.match(html, /原曲動画/);
  assert.match(html, /Aメロ/);
  assert.match(html, /Bメロ/);
  assert.match(html, /2番サビ/);
  assert.match(html, /アウトロ/);
  assert.doesNotMatch(html, /サビ〜間奏/);
  assert.match(html, /6LfUfHSIiMw/);
  assert.match(html, /aria-label="1小節目"/);
  assert.doesNotMatch(html, /PROCEDURAL TAB|スクショ下段|動画で通し再生|TECHNIQUE BLOCK|66〜81小節 · リード奏法編/);
  assert.doesNotMatch(html, /tab-01\.png|tab-screenshots/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});

test("keeps the input meter and tuner in the client implementation", async () => {
  const [page, layout, trainer, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/trainer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<GuitarTrainer \/>/);
  assert.match(layout, /<html lang="ja">/);
  assert.match(layout, /FRET \/ STEP/);
  assert.match(trainer, /ギター入力レベル/);
  assert.match(trainer, /TUNER_STRINGS/);
  assert.match(trainer, /inputMode === "tuner"/);
  assert.match(trainer, /firstStrongMinimum/);
  assert.match(trainer, /function playRange/);
  assert.match(trainer, /type SongId = "life-over" \| "madow"/);
  assert.match(trainer, /vPexB7CEMGY/);
  assert.match(trainer, /85ORTRtwmF4/);
  assert.match(trainer, /totalMeasures: 207/);
  assert.match(trainer, /const MADOW_TAB_GLYPHS = buildMadowBackingTab\(\)/);
  assert.match(trainer, /const MADOW_LEAD_TAB_GLYPHS = buildMadowLeadTab\(\)/);
  assert.match(trainer, /const LIFE_BACKING_TAB_GLYPHS = buildLifeBackingTab\(\)/);
  assert.match(trainer, /tab\[202\] = backingChord\(\["<7>"/);
  assert.match(trainer, /tab\[205\] = backingDyad\(4\)/);
  assert.match(trainer, /tab\[206\] = backingDyad\(7\)/);
  assert.match(trainer, /function switchSong/);
  assert.match(trainer, /function switchTrack/);
  assert.match(trainer, /type TrackId = "lead" \| "backing"/);
  assert.match(trainer, /function toggleSelectedPlayback/);
  assert.match(trainer, /aria-pressed=\{selected\}/);
  assert.match(trainer, /playing \? "Ⅱ 一時停止" : canResumeSelected \? "▶ 再開" : "▶ 再生"/);
  assert.doesNotMatch(trainer, /onClick=\{\(\) => playRange\(1, 151/);
  assert.doesNotMatch(trainer, /live-console sticky|sticky top-0 z-50/);
  assert.match(trainer, /scorePlaybackEvents/);
  assert.match(trainer, /activeNodesRef/);
  assert.match(trainer, /guidedMode/);
  assert.match(trainer, /A\/Bを反復/);
  assert.match(trainer, /動画もBPM・位置に同期/);
  assert.match(trainer, /enablejsapi=1/);
  assert.match(trainer, /fret-step-trainer:v2/);
  assert.match(trainer, /auditNotes/);
  assert.match(trainer, /<details className="live-console/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});

test("keeps the video-audited lead strings and the single live monitor", async () => {
  const trainer = await readFile(new URL("../app/trainer.tsx", import.meta.url), "utf8");

  assert.match(trainer, /const holdString: StringNumber = variation === "low" \? 1 : 2/);
  assert.match(trainer, /\[1, "note", 1, 10\], \[2, "note", 1, 12\], \[3, "note", 1, 10, 2\]/);
  assert.match(trainer, /70: \[[\s\S]*?stringNo: 2, text: "7"[\s\S]*?stringNo: 3, text: "4"[\s\S]*?stringNo: 2, text: "8"[\s\S]*?stringNo: 3, text: "5"/);
  assert.match(trainer, /79: \[[\s\S]*?stringNo: 1, text: "12"[\s\S]*?technique: "full"/);
  assert.match(trainer, /142: \[[\s\S]*?stringNo: 4, text: "12"[\s\S]*?stringNo: 1, text: "13"/);
  assert.match(trainer, /148: \[[\s\S]*?stringNo: 1, text: "13"[\s\S]*?stringNo: 3, text: "10"/);
  assert.equal((trainer.match(/LIVE MONITOR/g) ?? []).length, 1);
  assert.doesNotMatch(trainer, /input-title|LIVE INPUT|LIVE JUDGE/);
});
