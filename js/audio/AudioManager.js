/*
  ファイル名 : AudioManager.js
  保存場所   : /js/audio
  役割       : サウンドの管理。音声ファイルは使わず、Web Audio で音を合成する。
               iPhoneは最初のタッチまで音を出せないため、最初のタッチで有効化する
  バージョン : 0.6.2（Phase6 Step6-2）
  メモ       : エンジン音・ブースト音・リング音。
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
  unlock() {
    if (this.unlocked) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = CONFIG.audio.masterVolume;
    this.master.connect(this.ctx.destination);

    // iPhone向け：操作の直後に無音を1回鳴らすと、以降の音が出せるようになる
    const silent = this.ctx.createBuffer(1, 1, 22050);
    const src = this.ctx.createBufferSource();
    src.buffer = silent;
    src.connect(this.master);
    src.start(0);
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.startEngine();
    this.unlocked = true;
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

  // ---- 効果音 ----
  play(name) {
    if (!this.unlocked || this.paused) return;
    if (name === 'boost') {
      this.playBoost();
    } else if (name === 'ring') {
      this.playRing();
    }
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
