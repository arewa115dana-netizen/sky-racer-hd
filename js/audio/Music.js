/*
  ファイル名 : Music.js
  保存場所   : /js/audio
  役割       : BGM。音声ファイルは使わず、楽譜（このファイルの中の数字の並び）を
               Web Audio で少し先まで予約しながら演奏する（チップチューン風）
                 title … タイトル・キャラ選択の曲。ゆったり明るい（92 BPM、8小節）
                 race  … レースの曲。速くて勇ましい（150 BPM、16小節、ドラムつき）
  バージョン : 0.10.2（Phase10 Step10-2）

  楽譜の読み方
    ・音の高さは MIDI 番号（60 = 真ん中のド、69 = ラ（440Hz）、1増えると半音上）
    ・メロディは1小節を8つ（8分音符）に分けて書く。数字 = 音を出す、'-' = 前の音をのばす、null = 休み
    ・和音（chords）は1小節に1つ。ベース・伴奏・分散和音は、和音から自動で作る

  しくみ
    ・0.05秒ごとに「0.2秒先までの音」を予約する。予約は音の仕組みの時計（currentTime）で行うので、
      画面が重くなってもリズムがずれない
    ・一時停止中や画面を裏に回したときは、音の仕組みごと止まるので、曲も止まる
*/

// 和音の名前 → [ベースの音, 伴奏の音たち]
const CHORDS = {
  Am: [45, [57, 60, 64]],
  F: [41, [53, 57, 60]],
  Fmaj7: [41, [53, 57, 60, 64]],
  C: [48, [55, 60, 64]],
  G: [43, [55, 59, 62]],
  Em: [40, [52, 55, 59]],
  E: [40, [56, 59, 64]]     // ラの短調で、ゴールへ向かう緊張感を出す「ミ・ソ#・シ」
};

const TRACKS = {
  // タイトル曲：ゆったり明るい
  title: {
    bpm: 92,
    chords: ['Fmaj7', 'G', 'Em', 'Am', 'Fmaj7', 'G', 'Em', 'Am'],
    melody: [
      [72, '-', '-', '-', 76, '-', 79, '-'],
      [79, '-', '-', '-', 74, '-', 71, '-'],
      [72, '-', 71, '-', 67, '-', '-', '-'],
      [69, '-', '-', '-', '-', '-', null, null],
      [72, '-', '-', '-', 76, '-', 81, '-'],
      [79, '-', '-', '-', 83, '-', 86, '-'],
      [84, '-', 83, '-', 79, '-', 76, '-'],
      [81, '-', '-', '-', '-', '-', null, null]
    ],
    lead: { type: 'triangle', vol: 0.5 },
    bass: 'half',        // 2分音符でゆったり
    pad: { type: 'sawtooth', vol: 0.06, cutoff: 900 },
    arp: { every: 2, vol: 0.12 },   // 8分音符の分散和音
    drums: false
  },

  // レース曲：速くて勇ましい
  race: {
    bpm: 150,
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E', 'F', 'G', 'Am', 'Am', 'F', 'G', 'E', 'E'],
    melody: [
      [76, '-', 81, '-', 79, 76, 74, 72],
      [74, '-', 77, '-', 76, 74, 72, 69],
      [72, '-', 76, '-', 79, '-', 76, '-'],
      [74, '-', '-', '-', 71, '-', 74, '-'],
      [76, '-', 81, '-', 79, 76, 74, 72],
      [74, '-', 77, '-', 81, '-', 77, '-'],
      [79, '-', 77, '-', 76, '-', 74, '-'],
      [76, '-', '-', '-', 68, '-', 71, '-'],
      [81, '-', 77, '-', 81, '-', 84, '-'],
      [83, '-', 79, '-', 74, '-', 79, '-'],
      [81, '-', 76, '-', 72, '-', 76, '-'],
      [81, '-', '-', '-', 79, 81, 83, '-'],
      [84, '-', 81, '-', 77, '-', 81, '-'],
      [83, '-', 79, '-', 86, '-', 83, '-'],
      [80, '-', 83, '-', 88, '-', 86, '-'],
      [88, '-', '-', '-', '-', '-', null, null]
    ],
    lead: { type: 'square', vol: 0.28 },
    bass: 'eighth',      // 8分音符で刻む
    pad: { type: 'square', vol: 0.035, cutoff: 1400 },
    arp: { every: 1, vol: 0.07 },   // 16分音符の分散和音
    drums: true
  }
};

const STEPS_PER_BAR = 16;   // 1小節を16分音符16個に分ける

export class Music {
  /**
   * @param {AudioContext} ctx
   * @param {AudioNode} out つなぐ先（全体の音量）
   */
  constructor(ctx, out) {
    this.ctx = ctx;
    this.bus = ctx.createGain();     // BGM全体の音量
    this.bus.connect(out);
    this.volume = 0.5;
    this.bus.gain.value = this.volume;

    this.name = null;
    this.track = null;
    this.trackGain = null;           // 今の曲だけの音量（曲を変えるとき、前の曲をフェードアウトさせる）
    this.step = 0;
    this.nextTime = 0;
    this.tempoScale = 1;
    this.timer = null;
    this.noise = makeNoise(ctx);
  }

  // 曲を始める（同じ曲なら何もしない）
  play(name) {
    if (this.name === name) return;
    const track = TRACKS[name];
    if (!track) return;
    this.stop(0.4);
    this.name = name;
    this.track = track;
    this.step = 0;
    this.tempoScale = 1;
    this.trackGain = this.ctx.createGain();
    this.trackGain.gain.value = 1;
    this.trackGain.connect(this.bus);
    this.nextTime = this.ctx.currentTime + 0.1;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 50);
  }

  // 曲を止める（fade 秒かけて小さくする）
  stop(fade) {
    if (this.trackGain) {
      const g = this.trackGain;
      const now = this.ctx.currentTime;
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + (fade || 0.01));
      setTimeout(() => g.disconnect(), ((fade || 0.01) + 0.3) * 1000);
    }
    this.name = null;
    this.track = null;
    this.trackGain = null;
  }

  // テンポを変える（1 = 楽譜どおり、1.12 = 12%速く）
  setTempoScale(k) {
    this.tempoScale = k;
  }

  setVolume(v) {
    this.volume = v;
    this.bus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  // ---- 少し先までの音を予約する ----
  schedule() {
    if (!this.track) return;
    const ctx = this.ctx;
    const ahead = ctx.currentTime + 0.2;
    // 画面を裏に回していたなどで大きく遅れたら、追いかけずに今から再開する
    if (this.nextTime < ctx.currentTime - 0.1) this.nextTime = ctx.currentTime + 0.05;
    const total = this.track.chords.length * STEPS_PER_BAR;
    while (this.nextTime < ahead) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += this.stepDuration();
      this.step = (this.step + 1) % total;
    }
  }

  // 16分音符1つ分の長さ（秒）
  stepDuration() {
    return 60 / (this.track.bpm * this.tempoScale) / 4;
  }

  // 1つの16分音符の位置で鳴らす音を全部予約する
  playStep(step, t) {
    const tr = this.track;
    const out = this.trackGain;
    const sd = this.stepDuration();
    const bar = Math.floor(step / STEPS_PER_BAR);
    const pos = step % STEPS_PER_BAR;
    const [root, tones] = CHORDS[tr.chords[bar]];

    // メロディ（8分音符ごと。のばす記号 '-' の数だけ長くする）
    if (pos % 2 === 0) {
      const line = tr.melody[bar];
      const slot = pos / 2;
      const note = line[slot];
      if (typeof note === 'number') {
        let len = 1;
        while (slot + len < line.length && line[slot + len] === '-') len += 1;
        this.voice(out, tr.lead.type, note, t, len * 2 * sd * 0.92, tr.lead.vol);
      }
    }

    // ベース
    if (tr.bass === 'eighth' && pos % 2 === 0) {
      this.voice(out, 'triangle', root + (pos % 4 === 2 ? 12 : 0), t, sd * 1.8, 0.55);
    } else if (tr.bass === 'half' && pos % 8 === 0) {
      this.voice(out, 'triangle', root, t, sd * 7.5, 0.5);
    }

    // 伴奏（小節の頭で和音を1つ。やわらかい音）
    if (pos === 0) {
      for (const n of tones) {
        this.voice(out, tr.pad.type, n, t, sd * STEPS_PER_BAR * 0.95, tr.pad.vol, tr.pad.cutoff, 0.08);
      }
    }

    // 分散和音（和音の音を1オクターブ上で順番に）
    if (pos % tr.arp.every === 0) {
      const k = (pos / tr.arp.every) % tones.length;
      this.voice(out, 'triangle', tones[k] + 12, t, sd * 0.9, tr.arp.vol);
    }

    // ドラム
    if (tr.drums) {
      const fill = bar % 4 === 3 && pos >= 12;   // 4小節ごとに、小節の終わりで「タタタタ」
      if (pos === 0 || pos === 8 || pos === 10) this.kick(out, t);
      if (pos === 4 || pos === 12 || (fill && pos > 12)) this.snare(out, t);
      if (pos % 2 === 0 && !fill) this.hat(out, t);
    }
  }

  // ---- 楽器（1つの音を作って予約する） ----
  voice(out, type, midi, t, dur, vol, cutoff, attack) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(440 * Math.pow(2, (midi - 69) / 12), t);
    const gain = ctx.createGain();
    const a = attack || 0.01;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + a);
    gain.gain.setValueAtTime(vol, t + Math.max(a, dur * 0.6));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let last = osc;
    if (cutoff) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      osc.connect(filter);
      last = filter;
    }
    last.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // バスドラム「ドッ」：低い音が一気に下がる
  kick(out, t) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  // スネア「パッ」：雑音を少し高めで短く
  snare(out, t) {
    this.noiseHit(out, t, 'bandpass', 1800, 0.12, 0.35);
  }

  // ハイハット「チッ」：雑音のとても高い所だけを、ごく短く
  hat(out, t) {
    this.noiseHit(out, t, 'highpass', 7000, 0.04, 0.12);
  }

  noiseHit(out, t, type, freq, dur, vol) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}

// ドラム用の雑音（0.5秒分を1回だけ作って使い回す）
function makeNoise(ctx) {
  const length = Math.floor(ctx.sampleRate * 0.5);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}
