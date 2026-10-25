/*
  ファイル名 : Sfx.js
  保存場所   : /js/audio
  役割       : 効果音の「作り方（レシピ）」をまとめたファイル。音声ファイルは使わず、
               Web Audio で波の形・高さ・長さを組み合わせて、その場で音を作る
  バージョン : 0.10.3（Phase10 Step10-3）
  使い方     : AudioManager.play('名前') から呼ばれる。名前と音の対応は下の SFX を見る

  音の一覧
    count    カウントダウン「ピッ」          go       スタート「ピーン」
    lap      周回「ピロリン」                finalLap 最終周「ピロリロリン↑」
    goal     ゴールのファンファーレ          bump     ぶつかった「ドン」
    fall     コースから落ちた「ヒュー↓」     respawn  復帰「キラリン↑」
    ring     リング「ピロン」（続けて取ると高くなる）  boost    ブースト「シュワーン」
    turbo    ミニターボ「パシュッ」          select   選ぶ「ピッ」（小さく）
    decide   決定「ピコン」
*/

// 音の高さ（ド・ミ・ソなど）
const NOTE = {
  G4: 392, C5: 523, D5: 587, E5: 659, G5: 784, A5: 880,
  C6: 1047, E6: 1319, G6: 1568, C7: 2093
};

/**
 * 1つの音を鳴らす（決まった高さ、または高さが変わっていく音）
 * @param {AudioContext} ctx
 * @param {AudioNode} out  つなぐ先（全体の音量）
 * @param {object} o { type 波の形, freq 高さ, freqEnd 終わりの高さ, at 何秒後, dur 長さ, vol 大きさ, attack 立ち上がり }
 */
function tone(ctx, out, o) {
  const t0 = ctx.currentTime + (o.at || 0);
  const dur = o.dur;
  const osc = ctx.createOscillator();
  osc.type = o.type || 'square';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, t0 + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(o.vol, t0 + (o.attack || 0.01));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// ザーッという雑音（ぶつかった音などに使う）。音の仕組みごとに1回だけ作って使い回す
const noiseCache = new WeakMap();
function noiseBuffer(ctx) {
  let buffer = noiseCache.get(ctx);
  if (!buffer) {
    const length = Math.floor(ctx.sampleRate * 0.5);
    buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, buffer);
  }
  return buffer;
}

function noise(ctx, out, o) {
  const t0 = ctx.currentTime + (o.at || 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = o.filter || 'lowpass';
  filter.frequency.setValueAtTime(o.freq, t0);
  if (o.freqEnd) filter.frequency.exponentialRampToValueAtTime(o.freqEnd, t0 + o.dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(o.vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  src.start(t0);
  src.stop(t0 + o.dur + 0.02);
}

// ---- 効果音のレシピ（ctx, out, vol: 効果音全体の大きさ, o: 音ごとの追加の指定） ----
export const SFX = {
  // カウントダウン「ピッ」
  count(ctx, out, vol) {
    tone(ctx, out, { type: 'square', freq: NOTE.A5, dur: 0.14, vol: vol * 0.35 });
  },

  // スタート「ピーン」（1オクターブ上で長め、和音を重ねる）
  go(ctx, out, vol) {
    tone(ctx, out, { type: 'square', freq: NOTE.A5 * 2, dur: 0.5, vol: vol * 0.35 });
    tone(ctx, out, { type: 'triangle', freq: NOTE.E6, dur: 0.5, vol: vol * 0.3 });
  },

  // 周回「ピロリン」
  lap(ctx, out, vol) {
    [NOTE.C6, NOTE.E6, NOTE.G6].forEach((f, i) => {
      tone(ctx, out, { type: 'triangle', freq: f, at: i * 0.07, dur: 0.18, vol: vol * 0.45 });
    });
  },

  // 最終周「ピロリロリン↑」（少し長く、明るく）
  finalLap(ctx, out, vol) {
    [NOTE.G5, NOTE.C6, NOTE.E6, NOTE.G6, NOTE.C7].forEach((f, i) => {
      tone(ctx, out, { type: 'square', freq: f, at: i * 0.07, dur: i === 4 ? 0.45 : 0.15, vol: vol * 0.25 });
      tone(ctx, out, { type: 'triangle', freq: f / 2, at: i * 0.07, dur: 0.15, vol: vol * 0.2 });
    });
  },

  // ゴールのファンファーレ「タタタ・ターン！」
  goal(ctx, out, vol) {
    const melody = [[NOTE.C5, 0, 0.12], [NOTE.E5, 0.13, 0.12], [NOTE.G5, 0.26, 0.12], [NOTE.C6, 0.42, 0.9]];
    for (const [f, at, dur] of melody) {
      tone(ctx, out, { type: 'square', freq: f, at, dur, vol: vol * 0.28 });
      tone(ctx, out, { type: 'triangle', freq: f * 1.5, at, dur, vol: vol * 0.18 });
    }
    // 最後の音の下に和音
    tone(ctx, out, { type: 'triangle', freq: NOTE.E5, at: 0.42, dur: 0.9, vol: vol * 0.2 });
    tone(ctx, out, { type: 'triangle', freq: NOTE.G4, at: 0.42, dur: 0.9, vol: vol * 0.2 });
  },

  // ぶつかった「ドン」（低い音＋ザッという雑音）
  bump(ctx, out, vol) {
    tone(ctx, out, { type: 'sine', freq: 140, freqEnd: 55, dur: 0.16, vol: vol * 0.7 });
    noise(ctx, out, { freq: 1200, freqEnd: 300, dur: 0.12, vol: vol * 0.35 });
  },

  // コースから落ちた「ヒュー↓」
  fall(ctx, out, vol) {
    tone(ctx, out, { type: 'sine', freq: 900, freqEnd: 140, dur: 0.75, vol: vol * 0.35, attack: 0.03 });
    noise(ctx, out, { filter: 'bandpass', freq: 1500, freqEnd: 300, dur: 0.75, vol: vol * 0.12 });
  },

  // 復帰「キラリン↑」
  respawn(ctx, out, vol) {
    [NOTE.E6, NOTE.G6, NOTE.C7].forEach((f, i) => {
      tone(ctx, out, { type: 'triangle', freq: f, at: i * 0.06, dur: 0.22, vol: vol * 0.3 });
    });
  },

  // リング「ピロン」。o.pitch で高さを変える（続けて取るほど高く。1 = いつもの高さ）
  ring(ctx, out, vol, o) {
    const k = o && o.pitch ? o.pitch : 1;
    tone(ctx, out, { type: 'triangle', freq: 880 * k, dur: 0.18, vol: vol * 0.6 });
    tone(ctx, out, { type: 'triangle', freq: 1320 * k, at: 0.07, dur: 0.18, vol: vol * 0.6 });
    // 3つ目以降は、きらっと高い音を足す
    if (k > 1.2) tone(ctx, out, { type: 'triangle', freq: 1760 * k, at: 0.14, dur: 0.14, vol: vol * 0.35 });
  },

  // ブースト「シュワーン」（音程が駆け上がる）
  boost(ctx, out, vol) {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(900, t0 + 0.35);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, t0);
    filter.frequency.exponentialRampToValueAtTime(2400, t0 + 0.35);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    osc.start(t0);
    osc.stop(t0 + 0.65);
  },

  // ミニターボ「パシュッ」
  turbo(ctx, out, vol) {
    tone(ctx, out, { type: 'square', freq: 1200, freqEnd: 300, dur: 0.15, vol: vol * 0.35 });
  },

  // 選ぶ「ピッ」（小さく短く）
  select(ctx, out, vol) {
    tone(ctx, out, { type: 'triangle', freq: 1200, dur: 0.06, vol: vol * 0.35 });
  },

  // 決定「ピコン」
  decide(ctx, out, vol) {
    tone(ctx, out, { type: 'square', freq: 880, dur: 0.08, vol: vol * 0.3 });
    tone(ctx, out, { type: 'square', freq: 1320, at: 0.08, dur: 0.16, vol: vol * 0.3 });
  }
};
