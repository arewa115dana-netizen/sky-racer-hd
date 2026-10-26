/*
  ファイル名 : Music.js
  保存場所   : /js/audio
  役割       : BGM。音声ファイルは使わず、楽譜（このファイルの中の数字の並び）を
               Web Audio で少し先まで予約しながら演奏する（チップチューン風）
                 title       … タイトル・選択画面の曲。ゆったり明るい（92 BPM、8小節）
                 race        … 天空神殿。速くて勇ましい（150 BPM）
                 desert      … 夕焼けの砂漠遺跡。異国風の音階と民族風のドラム（140 BPM）
                 ice         … 氷の空中城。鈴のような音とやまびこ、ダンス風のドラム（146 BPM）
                 harbor      … 雲海の港町。はねるリズムの明るい船乗りの歌（152 BPM）
                 volcano     … 溶岩の火山島。速くて重い、馬が駆けるようなリズム（164 BPM）
                 observatory … 星空の天文塔。ふしぎで夢のような響き、ゆったりしたドラム（128 BPM）
                 mushroom    … キノコの森。はずむ短い音で、楽しくおどけた曲（140 BPM）
  バージョン : 1.17.0（Phase17：コースごとの曲を6曲追加）

  楽譜の読み方
    ・音の高さは MIDI 番号（60 = 真ん中のド、69 = ラ（440Hz）、1増えると半音上）
    ・和音の名前は「根音（C, D, Eb, F#…）＋ 種類（なし=長三和音, m=短三和音, 7, m7, maj7）」で書く
    ・曲ごとの設定
        lead  … メロディの音色 { type, vol, len（音の長さの割合。短いと切れのよい音）, cutoff, echo（やまびこ） }
        bass  … 'eighth'（8分で刻む）/ 'half'（2分でゆったり）/ 'pump'（根音と5度を交互）/ 'gallop'（タッタカ）
        drums … false / 'rock' / 'dance'（4つ打ち）/ 'tribal'（民族風）/ 'gallop'（速い2連打）/ 'half'（ゆったり）
        swing … はねる強さ（0 = はねない。0.15 くらいで軽くはねる）
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

// 表にない和音は、名前から作る（ベースは 40〜51、伴奏は 55 から上に重ねる）
const NOTE_PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const QUALITY = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11] };
function chordOf(name) {
  if (CHORDS[name]) return CHORDS[name];
  const m = /^([A-G][#b]?)(.*)$/.exec(name);
  const pc = NOTE_PC[m[1]];
  const intervals = QUALITY[m[2]] || QUALITY[''];
  let bass = 36 + pc;
  if (bass < 40) bass += 12;
  let base = 48 + pc;
  if (base < 53) base += 12;
  const chord = [bass, intervals.map((k) => base + k)];
  CHORDS[name] = chord;
  return chord;
}

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
  },

  // 夕焼けの砂漠遺跡：ミの「異国風の音階」（ファ・ソ#）と、民族風のドラム
  desert: {
    bpm: 140,
    chords: ['E', 'F', 'E', 'Dm', 'E', 'F', 'G', 'E', 'Am', 'G', 'F', 'E', 'Am', 'Dm', 'F', 'E'],
    melody: [
      [76, '-', 77, 76, 80, '-', 81, '-'],
      [81, '-', 80, '-', 77, 76, 77, '-'],
      [76, '-', '-', 74, 72, '-', 71, '-'],
      [69, '-', 71, 72, 74, '-', 77, '-'],
      [76, '-', 77, 76, 80, '-', 83, '-'],
      [84, '-', 83, '-', 81, 80, 81, '-'],
      [79, '-', 77, '-', 76, '-', 74, '-'],
      [76, '-', '-', '-', null, null, 68, 71],
      [72, '-', 71, '-', 69, '-', 72, '-'],
      [74, '-', 72, '-', 71, '-', 67, '-'],
      [69, '-', 72, '-', 77, '-', 76, 74],
      [76, '-', '-', '-', 80, '-', 76, '-'],
      [81, '-', 80, 81, 84, '-', 81, '-'],
      [77, '-', 76, 77, 81, '-', 77, '-'],
      [76, '-', 77, '-', 80, '-', 83, '-'],
      [88, '-', '-', '-', '-', '-', null, null]
    ],
    lead: { type: 'square', vol: 0.25, len: 0.85 },
    bass: 'pump',
    pad: { type: 'sawtooth', vol: 0.04, cutoff: 1100 },
    arp: { every: 2, vol: 0.08 },
    drums: 'tribal'
  },

  // 氷の空中城：レの短調。鈴のような三角波にやまびこをつけ、4つ打ちのドラム
  ice: {
    bpm: 146,
    chords: ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'Gm', 'A', 'Bb', 'C', 'Am', 'Dm', 'Gm', 'C', 'A', 'A'],
    melody: [
      [81, '-', 77, '-', 74, '-', 77, 81],
      [82, '-', 81, '-', 77, '-', 74, '-'],
      [79, '-', 76, '-', 72, '-', 76, 79],
      [81, '-', '-', '-', 73, '-', 76, '-'],
      [86, '-', 84, '-', 81, '-', 77, '-'],
      [82, '-', 81, '-', 79, '-', 77, '-'],
      [79, '-', 74, '-', 70, '-', 74, '-'],
      [76, '-', '-', '-', 73, '-', 69, '-'],
      [74, '-', 77, '-', 82, '-', 81, '-'],
      [79, '-', 76, '-', 72, '-', 79, '-'],
      [81, '-', 84, '-', 88, '-', 84, '-'],
      [86, '-', '-', '-', 81, '-', 77, '-'],
      [79, '-', 82, '-', 86, '-', 82, '-'],
      [84, '-', 79, '-', 76, '-', 79, '-'],
      [81, '-', 85, '-', 88, '-', 85, '-'],
      [81, '-', '-', '-', '-', '-', null, null]
    ],
    lead: { type: 'triangle', vol: 0.42, echo: true },
    bass: 'eighth',
    pad: { type: 'square', vol: 0.03, cutoff: 2000 },
    arp: { every: 1, vol: 0.08 },
    drums: 'dance'
  },

  // 雲海の港町：ドの長調。はねるリズムの、明るい船乗りの歌
  harbor: {
    bpm: 152,
    swing: 0.14,
    chords: ['C', 'F', 'G', 'C', 'Am', 'F', 'G', 'G', 'C', 'F', 'C', 'G', 'F', 'G', 'C', 'C'],
    melody: [
      [72, '-', 76, '-', 79, '-', 76, '-'],
      [77, '-', 81, '-', 84, '-', 81, '-'],
      [79, '-', 77, '-', 76, '-', 74, '-'],
      [72, '-', '-', '-', 67, '-', 72, '-'],
      [76, '-', 72, '-', 69, '-', 72, 76],
      [77, '-', 76, '-', 74, '-', 72, '-'],
      [74, '-', 76, '-', 77, '-', 79, '-'],
      [83, '-', '-', '-', 79, '-', 81, 83],
      [84, '-', 83, '-', 84, '-', 79, '-'],
      [81, '-', 79, '-', 77, '-', 81, '-'],
      [79, '-', 76, '-', 72, '-', 76, '-'],
      [74, '-', 79, '-', 83, '-', 86, '-'],
      [84, '-', 81, '-', 77, '-', 81, '-'],
      [79, '-', 83, '-', 86, '-', 83, '-'],
      [84, '-', 79, '-', 76, '-', 79, '-'],
      [84, '-', '-', '-', null, null, null, null]
    ],
    lead: { type: 'square', vol: 0.26 },
    bass: 'pump',
    pad: { type: 'square', vol: 0.03, cutoff: 1500 },
    arp: { every: 2, vol: 0.09 },
    drums: 'rock'
  },

  // 溶岩の火山島：ミの短調。速くて重い、タッタカと駆けるベースとドラム
  volcano: {
    bpm: 164,
    chords: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B', 'Am', 'C', 'D', 'B', 'Em', 'C', 'D', 'B'],
    melody: [
      [76, '-', 79, '-', 76, 74, 76, '-'],
      [79, '-', 81, '-', 83, '-', 81, 79],
      [76, '-', 72, '-', 79, '-', 76, '-'],
      [78, '-', 74, '-', 81, '-', 78, '-'],
      [88, '-', 86, '-', 83, '-', 79, '-'],
      [83, '-', 81, '-', 79, '-', 76, '-'],
      [79, '-', 76, '-', 72, '-', 76, '-'],
      [75, '-', '-', '-', 71, '-', 75, 78],
      [81, '-', 84, '-', 88, '-', 84, 81],
      [79, '-', 84, '-', 88, '-', 84, '-'],
      [86, '-', 81, '-', 78, '-', 81, '-'],
      [87, '-', '-', '-', 83, '-', 87, '-'],
      [88, '-', 83, '-', 79, '-', 76, '-'],
      [84, '-', 79, '-', 76, '-', 72, '-'],
      [74, '-', 78, '-', 81, '-', 86, '-'],
      [83, '-', '-', '-', '-', '-', null, null]
    ],
    lead: { type: 'sawtooth', vol: 0.2, cutoff: 2600 },
    bass: 'gallop',
    pad: { type: 'square', vol: 0.03, cutoff: 1200 },
    arp: { every: 2, vol: 0.06 },
    drums: 'gallop'
  },

  // 星空の天文塔：ファの明るくふしぎな響き（シが半音高い）。やまびこのメロディと、ゆったりしたドラム
  observatory: {
    bpm: 128,
    chords: ['Fmaj7', 'G', 'Em', 'Am', 'Fmaj7', 'G', 'Cmaj7', 'C', 'Dm', 'G', 'Em', 'Am', 'Fmaj7', 'G', 'Am', 'Am'],
    melody: [
      [72, '-', '-', 76, '-', 79, '-', 83],
      [83, '-', '-', '-', 79, '-', 74, '-'],
      [76, '-', 79, '-', 83, '-', 88, '-'],
      [84, '-', '-', '-', '-', '-', null, null],
      [81, '-', '-', 83, '-', 84, '-', 88],
      [86, '-', '-', '-', 83, '-', 79, '-'],
      [79, '-', 76, '-', 71, '-', 72, '-'],
      [76, '-', '-', '-', null, null, null, null],
      [77, '-', 81, '-', 84, '-', 81, '-'],
      [83, '-', 86, '-', 91, '-', 86, '-'],
      [88, '-', 83, '-', 79, '-', 83, '-'],
      [81, '-', '-', '-', 76, '-', 72, '-'],
      [77, '-', 81, '-', 84, '-', 88, '-'],
      [86, '-', 83, '-', 79, '-', 74, '-'],
      [76, '-', 72, '-', 69, '-', 72, '-'],
      [69, '-', '-', '-', '-', '-', null, null]
    ],
    lead: { type: 'triangle', vol: 0.45, echo: true },
    bass: 'half',
    pad: { type: 'sawtooth', vol: 0.05, cutoff: 900 },
    arp: { every: 1, vol: 0.1 },
    drums: 'half'
  },

  // キノコの森：ソの長調。はずむ短い音と、ときどき出てくる意外な和音で、おどけた感じに
  mushroom: {
    bpm: 140,
    swing: 0.16,
    chords: ['G', 'C', 'G', 'D', 'Em', 'C', 'D', 'D', 'G', 'B', 'C', 'Cm', 'G', 'D', 'G', 'G'],
    melody: [
      [79, null, 83, null, 86, '-', 83, null],
      [84, null, 79, null, 76, '-', 79, null],
      [83, null, 79, null, 74, '-', 79, null],
      [78, '-', 79, '-', 81, '-', null, null],
      [83, null, 79, null, 76, null, 79, 83],
      [84, null, 81, null, 76, '-', 72, null],
      [74, null, 78, null, 81, null, 86, null],
      [84, '-', 83, '-', 81, '-', 78, '-'],
      [79, '-', null, 79, 83, '-', 86, '-'],
      [87, '-', 83, '-', 78, '-', 75, '-'],
      [76, '-', 79, '-', 84, '-', 79, '-'],
      [75, '-', 79, '-', 84, '-', 87, '-'],
      [86, null, 83, null, 79, null, 83, null],
      [81, null, 78, null, 74, null, 78, 81],
      [79, '-', 83, '-', 86, '-', 91, '-'],
      [91, '-', '-', '-', null, null, null, null]
    ],
    lead: { type: 'square', vol: 0.25, len: 0.6 },
    bass: 'pump',
    pad: { type: 'triangle', vol: 0.05 },
    arp: { every: 2, vol: 0.1 },
    drums: 'rock'
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
      // はねるリズム：裏拍の8分音符（16分音符の3つ目）を少し遅らせる
      const swing = this.track.swing && this.step % 4 === 2 ? this.track.swing * this.stepDuration() : 0;
      this.playStep(this.step, this.nextTime + swing);
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
    const [root, tones] = chordOf(tr.chords[bar]);

    // メロディ（8分音符ごと。のばす記号 '-' の数だけ長くする）
    if (pos % 2 === 0) {
      const line = tr.melody[bar];
      const slot = pos / 2;
      const note = line[slot];
      if (typeof note === 'number') {
        let len = 1;
        while (slot + len < line.length && line[slot + len] === '-') len += 1;
        const dur = len * 2 * sd * (tr.lead.len || 0.92);
        this.voice(out, tr.lead.type, note, t, dur, tr.lead.vol, tr.lead.cutoff);
        // やまびこ：8分音符3つ分おくれて、小さく同じ音
        if (tr.lead.echo) this.voice(out, tr.lead.type, note, t + sd * 6, dur, tr.lead.vol * 0.3, tr.lead.cutoff);
      }
    }

    // ベース
    if (tr.bass === 'eighth' && pos % 2 === 0) {
      this.voice(out, 'triangle', root + (pos % 4 === 2 ? 12 : 0), t, sd * 1.8, 0.55);
    } else if (tr.bass === 'half' && pos % 8 === 0) {
      this.voice(out, 'triangle', root, t, sd * 7.5, 0.5);
    } else if (tr.bass === 'pump' && pos % 2 === 0) {
      // 根音と5度（7半音上）を交互に
      this.voice(out, 'triangle', root + (pos % 4 === 2 ? 7 : 0), t, sd * 1.6, 0.55);
    } else if (tr.bass === 'gallop' && (pos % 4 === 0 || pos % 4 === 2 || pos % 4 === 3)) {
      // タッ・タカ（8分＋16分2つ）
      this.voice(out, 'triangle', root + (pos % 8 >= 4 ? 12 : 0), t, sd * 0.9, 0.55);
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
    if (tr.drums) this.drumStep(out, tr.drums, bar, pos, t);
  }

  // ドラムのパターン（true は 'rock' と同じ）
  drumStep(out, kind, bar, pos, t) {
    const fill = bar % 4 === 3 && pos >= 12;   // 4小節ごとに、小節の終わりで「タタタタ」
    if (kind === true || kind === 'rock') {
      if (pos === 0 || pos === 8 || pos === 10) this.kick(out, t);
      if (pos === 4 || pos === 12 || (fill && pos > 12)) this.snare(out, t);
      if (pos % 2 === 0 && !fill) this.hat(out, t);
    } else if (kind === 'dance') {
      // 4つ打ち：バスドラムを毎拍、ハイハットは裏拍
      if (pos % 4 === 0) this.kick(out, t);
      if (pos === 4 || pos === 12 || (fill && pos > 12)) this.snare(out, t);
      if (pos % 4 === 2) this.hat(out, t);
    } else if (kind === 'tribal') {
      // 民族風：低い太鼓（タム）のくり返しと、ところどころのバスドラム
      if (pos === 0 || pos === 6 || pos === 10) this.kick(out, t);
      if (pos === 3 || pos === 8 || pos === 13 || (fill && pos >= 14)) this.tom(out, t, pos % 2 === 0 ? 120 : 160);
      if (pos === 4 || pos === 12) this.snare(out, t);
      if (pos % 4 === 2) this.hat(out, t);
    } else if (kind === 'gallop') {
      // 速い2連打のバスドラム
      if (pos % 4 === 0 || pos % 4 === 3) this.kick(out, t);
      if (pos === 4 || pos === 12 || (fill && pos > 12)) this.snare(out, t);
      if (pos % 2 === 0) this.hat(out, t);
    } else if (kind === 'half') {
      // ゆったり：バスドラムは小節の頭、スネアは真ん中だけ
      if (pos === 0 || (pos === 10 && bar % 2 === 1)) this.kick(out, t);
      if (pos === 8) this.snare(out, t);
      if (pos % 4 === 0) this.hat(out, t);
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

  // タム「ドン」：低い太鼓（高さを指定）
  tom(out, t, freq) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.18);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + 0.24);
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
