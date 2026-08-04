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

  const html = await response.text();
  assert.match(html, /<html lang="ja">/i);
  assert.match(html, /<title>FRET \/ STEP — 人生オーバー Lead Trainer<\/title>/i);
  assert.match(html, /人生オーバー/);
  assert.match(html, /LEAD ONLY/);
  assert.match(html, /Amperoで正誤判定・チューナー/);
  assert.match(html, /TAB判定/);
  assert.match(html, /チューナー/);
  assert.match(html, /上下6半音/);
  assert.match(html, /66〜81小節 · リード奏法編/);
  assert.match(html, /サビ 34–37/);
  assert.match(html, /画像ではない、曲全体のTAB譜/);
  assert.match(html, /動画で通し再生/);
  assert.match(html, /6LfUfHSIiMw/);
  assert.match(html, /aria-label="1小節目"/);
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
  assert.match(trainer, /INPUT LEVEL/);
  assert.match(trainer, /STANDARD TUNING/);
  assert.match(trainer, /inputMode === "tuner"/);
  assert.match(trainer, /firstStrongMinimum/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
