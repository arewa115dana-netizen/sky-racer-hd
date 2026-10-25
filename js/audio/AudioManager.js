/*
  ファイル名 : AudioManager.js
  保存場所   : /js/audio
  役割       : サウンドの管理。音声ファイルは使わず、Web Audio で音を合成する。
               iPhoneは最初のタッチまで音を出せないため、最初のタッチで有効化する
  バージョン : 0.9.4b（Phase9 Step9-4 修正）
  メモ       : エンジン音・ブースト音・リング音・ドリフト音・ミニターボ音。
               BGMと他の効果音はPhase10で追加する
*/

import { CONFIG } from '../config.js';

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.unlocked = false;
    this.paused = false;

    // エンジン音（ずっと鳴り続ける低い音）
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;

    // ドリフト音（ザラザラした音を、ドリフト中だけ大きくする）
    this.driftGain = null;
    this.driftFilter = null;
    this.driftLevel = -2;   // 前回の段階（変わったときだけ音を変える）

    // アプリを裏に回したら音を止める
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) {
        this.ctx.suspend();
      } else if (!this.paused) {
        this.ctx.resume();
      }
    });
  }

  // 音を使えるようにする（タッチやキー操作の中で呼ぶ必要がある）
  // Android の Chrome は「指を離した瞬間」でないと操作と認めないため、
  // 指を置いたときに作った音の仕組みは一時停止のままになることがある。
  // そこで、何度呼ばれても「まだ鳴っていなければ再開」をかけ直す
  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = CONFIG.audio.masterVolume;
      this.master.connect(this.ctx.destination);
      this.startEngine();
      this.startDrift();
      this.unlocked = true;
    }
    if (this.isRunning() || this.paused) return;

    // iPhone向け：操作の直後に無音を1回鳴らすと、以降の音が出せるようになる
    const silent = this.ctx.createBuffer(1, 1, 22050);
    const src = this.ctx.createBufferSource();
    src.buffer = silent;
    src.connect(this.master);
    src.start(0);
    this.ctx.resume();
  }

  // 本当に音が鳴る状態か
  isRunning() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  // 全体の音量（0〜1）
  setVolume(v) {
    if (!this.master) return;
    this.master.gain.value = Math.max(0, Math.min(1, v));
  }

  // 一時停止中は音を止める
  setPaused(paused) {
    this.paused = !!paused;
    if (!this.ctx) return;
    if (this.paused) {
      this.ctx.suspend();
    } else {
      this.ctx.resume();
    }
  }

  // ---- エンジン音 ----
  startEngine() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;

    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 400;

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;

    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  // 速さに合わせて音の高さと大きさを変える（speedRatio: 0〜1.5）
  setEngine(speedRatio) {
    if (!this.engineOsc) return;
    const r = Math.max(0, Math.min(1.5, speedRatio));
    const now = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + r * 110, now, 0.08);
    this.engineFilter.frequency.setTargetAtTime(400 + r * 900, now, 0.08);
    this.engineGain.gain.setTargetAtTime(CONFIG.audio.engineVolume * (0.4 + r * 0.6), now, 0.1);
  }

  // エンジン音を完全に消す（レースを片付けるとき。次のレースの setEngine でまた鳴り出す）
  silenceEngine() {
    if (!this.engineGain) return;
    this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }

  // ---- ドリフト音 ----
  // 1秒分のザラザラした音（ノイズ）を作り、くり返し鳴らし続ける。最初は音量0
  startDrift() {
    const ctx = this.ctx;
    const length = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    this.driftFilter = ctx.createBiquadFilter();
    this.driftFilter.type = 'bandpass';
    this.driftFilter.frequency.value = 1500;
    this.driftFilter.Q.value = 1.5;

    this.driftGain = ctx.createGain();
    this.driftGain.gain.value = 0;

    src.connect(this.driftFilter);
    this.driftFilter.connect(this.driftGain);
    this.driftGain.connect(this.master);
    src.start();
  }

  // ドリフトの段階に合わせて音を変える（level: -1 = していない、0 = 溜め中、1 = 青、2 = オレンジ）
  setDrift(level) {
    if (!this.driftGain || level === this.driftLevel) return;
    this.driftLevel = level;
    const now = this.ctx.currentTime;
    if (level < 0) {
      this.driftGain.gain.setTargetAtTime(0, now, 0.05);
      return;
    }
    // 段階が上がるほど高い音に
    this.driftFilter.frequency.setTargetAtTime([1500, 2600, 4000][level], now, 0.05);
    this.driftGain.gain.setTargetAtTime(CONFIG.audio.driftVolume, now, 0.04);
  }

  // ---- 効果音 ----
  play(name) {
    if (!this.unlocked || this.paused) return;
    if (name === 'boost') {
      this.playBoost();
    } else if (name === 'ring') {
      this.playRing();
    } else if (name === 'turbo') {
      this.playTurbo();
    }
  }

  // ミニターボ音：短い「パシュッ」（ブースト音と重なって鳴る）
  playTurbo() {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(CONFIG.audio.sfxVolume * 0.35, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  // リング音：高い音が2つ続く「ピロン」
  playRing() {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vol = CONFIG.audio.sfxVolume * 0.6;
    [[880, 0], [1320, 0.07]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(vol, now + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.18);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now + delay);
      osc.stop(now + delay + 0.2);
    });
  }

  // ブースト音：音程が駆け上がる「シュワーン」
  playBoost() {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vol = CONFIG.audio.sfxVolume;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.35);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + 0.35);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.65);
  }

  // BGM（Phase10で追加）
  startBGM() {}
  stopBGM() {}
}
