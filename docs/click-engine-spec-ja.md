# FRET STEP クリック音エンジン仕様書

## 1. 目的

この文書は、FRET STEPで使っているクリック音を別のWebアプリ、練習ツール、音源書き出し処理へ移植するための仕様書です。

中心となる考え方は次の3点です。

1. クリック音は短い矩形波をその場で合成する。
2. 拍子は「小節番号 → 四分音符の拍数」の表で管理する。
3. ブラウザ再生では、発音時刻を`AudioContext`へ先に予約してタイマーの揺れを避ける。

## 2. クリック音の音色

| 項目 | 小節の1拍目 | それ以外の拍 |
| --- | ---: | ---: |
| 波形 | 矩形波 | 矩形波 |
| 周波数 | 1320 Hz | 920 Hz |
| 発音時間 | 50 ms | 50 ms |
| 開始ゲイン | 0.1 | 0.1 |
| 終了ゲイン | 0.0001 | 0.0001 |
| 減衰 | 45 msの指数減衰 | 45 msの指数減衰 |

1拍目だけ周波数を高くし、音量差ではなく音程差で小節頭を判別します。開始ゲイン0.1は、PCM換算ではおよそ-20 dBFSのピークです。

クリック音量フェーダーを付ける場合、最終的な開始ゲインは次の式になります。

```text
実効開始ゲイン = 0.1 × (クリック音量 / 100)
```

フェーダー変更時は値を即時に飛ばさず、約10 msで新しい値へ追従させるとノイズが出にくくなります。

## 3. 時間と拍子のモデル

内部時間は16分音符を1ステップとして扱います。

```text
1四分音符 = 4ステップ
1ステップの秒数 = 15 / BPM
1拍の秒数 = 60 / BPM
1小節のステップ数 = その小節の拍数 × 4
```

拍子表に小節番号がなければ4/4として扱います。

```js
function beatsForMeasure(measure, meterMap = {}) {
  return meterMap[measure] ?? 4;
}

function stepsForMeasure(measure, meterMap = {}) {
  return beatsForMeasure(measure, meterMap) * 4;
}
```

各小節では`0, 4, 8, ...`ステップにクリックを置きます。`step === 0`だけ強拍音です。

```js
for (let step = 0; step < measureSteps; step += 4) {
  const isDownbeat = step === 0;
  scheduleClick(context, clickTime, isDownbeat);
}
```

この方式なら4/4、5/4、6/4を同じロジックで処理できます。5/4は5回、6/4は6回鳴り、次の小節の1拍目で再び高いクリック音になります。

## 4. Web Audio API実装

### 4.1 音声経路

ギター音など他の音源とは別に、クリック専用の`GainNode`を1つ持たせます。

```text
クリック用OscillatorNode
  → クリック単音用GainNode
  → クリック全体用GainNode
  → AudioContext.destination
```

`AudioContext`とクリック全体用`GainNode`は再生ごとに作り直さず、同じインスタンスを再利用します。

```js
const context = new AudioContext();
const clickGain = context.createGain();
clickGain.gain.value = clickVolume / 100;
clickGain.connect(context.destination);
```

### 4.2 1クリックの合成

```js
function scheduleClick(context, clickOutput, startAt, strong) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(strong ? 1320 : 920, startAt);

  gain.gain.setValueAtTime(0.1, startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.045);

  oscillator.connect(gain);
  gain.connect(clickOutput);
  oscillator.start(startAt);
  oscillator.stop(startAt + 0.05);
}
```

指数減衰では終点を0にできないため、十分小さい`0.0001`まで下げてから発振器を停止します。

### 4.3 発音時刻の計算

```js
const secondsPerStep = 15 / bpm;
const clickStartAt = rangeStartAt
  + (clickStepFromRangeStart - playbackPositionSteps) * secondsPerStep;
```

実際の音の開始は`setTimeout`の実行時刻ではなく、`oscillator.start(clickStartAt)`へ渡した`AudioContext`上の絶対時刻で決めます。

## 5. 音切れを避けるスケジューリング

長い曲の全クリックと全ギター音を再生開始時に一括生成すると、数千個の音声ノードが作られ、ブラウザによっては音切れや操作遅延が起きます。FRET STEPでは小節単位で予約します。

- 再生開始時刻は`audioContext.currentTime + 0.03`とし、30 msの準備時間を取る。
- 各小節は発音の600 ms前に`AudioContext`へ予約する。
- `setTimeout`は「予約処理を開始する時刻」にだけ使う。
- 実際の発音時刻は必ず`AudioContext`のタイムラインへ渡す。
- 予約が少し遅れた場合は`currentTime + 0.005`を最短開始時刻にする。
- 再生停止時は未実行タイマーを解除し、稼働中の音声ノードも停止・切断する。

小節予約タイマーの概念コードは次のとおりです。

```js
const LOOKAHEAD_MS = 600;
let measureOffsetSteps = 0;

for (let measure = startMeasure; measure <= endMeasure; measure += 1) {
  const measureSteps = stepsForMeasure(measure, meterMap);
  const currentMeasureOffset = measureOffsetSteps;
  const delayMs = Math.max(
    0,
    (currentMeasureOffset - playbackPositionSteps) * secondsPerStep * 1000
      - LOOKAHEAD_MS,
  );

  setTimeout(() => {
    scheduleMeasureClicks(measure, currentMeasureOffset, measureSteps);
  }, delayMs);

  measureOffsetSteps += measureSteps;
}
```

ループ内の`measureOffsetSteps`は、各反復のローカル定数へコピーしてからコールバックで使います。

## 6. カウントイン

4/4の1小節カウントインを付ける場合は、本編先頭を0ステップとして`-16, -12, -8, -4`へクリックを置きます。`-16`だけ強拍音です。

```js
const countInSteps = 16;
const countInStartAt = mainStartAt - countInSteps * secondsPerStep;

for (let step = 0; step < countInSteps; step += 4) {
  scheduleClick(context, clickOutput, countInStartAt + step * secondsPerStep, step === 0);
}
```

変拍子に合わせたカウントインが必要なら、固定の16ステップではなく、開始小節の`stepsForMeasure`を使用します。

## 7. 「惑う星」の拍子表

原曲テンポは194 BPMです。拍子指定がない小節は4/4です。

```js
const madowMeterMap = {
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
```

113〜128小節の内訳は次のとおりです。

| 小節 | 拍子 | 小節数 | クリック数 |
| --- | --- | ---: | ---: |
| 113〜116 | 4/4 | 4 | 16 |
| 117〜119 | 5/4 | 3 | 15 |
| 120 | 6/4 | 1 | 6 |
| 121〜123 | 5/4 | 3 | 15 |
| 124 | 6/4 | 1 | 6 |
| 125〜128 | 4/4 | 4 | 16 |
| 合計 | — | 16 | 74 |

194 BPMでの長さは約22.8866秒です。カウントインは含みません。

## 8. WAV書き出し

このリポジトリには、113〜128小節を48 kHz・16-bit・モノラルWAVへ書き出すスクリプトがあります。

```powershell
node scripts/export-madow-click-range.mjs
```

出力先を変える場合は、第1引数へパスを渡します。

```powershell
node scripts/export-madow-click-range.mjs C:\path\to\madow-click.wav
```

標準の出力先は次のとおりです。

```text
exports/madow-click-measures-113-128-194bpm.wav
```

WAV版もブラウザ版と同じ周波数、50 msの長さ、45 msの指数減衰、拍子表を使用します。

## 9. 移植時の確認項目

- BPMは四分音符基準になっているか。
- 拍子表の値を分子として扱っているか。
- 小節頭だけ1320 Hzになっているか。
- 5/4で5回、6/4で6回クリックが鳴るか。
- テンポ変更後に未発音の古い予約を停止して再予約しているか。
- クリックと他音源の音量バスが分離されているか。
- `AudioContext`をユーザー操作後に`resume()`しているか。
- 長い範囲を一括生成せず、先行時間を設けて小分けに予約しているか。
- 停止、ループ、シーク時に古いタイマーと音声ノードを破棄しているか。

## 10. 現行実装の参照先

- `app/trainer.tsx`: クリック音合成、音量バス、再生スケジューリング
- `app/trainer-core.mjs`: 拍数、ステップ数、範囲長の計算
- `scripts/export-madow-click-range.mjs`: WAV書き出し
