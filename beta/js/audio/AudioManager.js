/*
  ファイル名 : AudioManager.js
  保存場所   : /js/audio
  役割       : サウンドの管理。音声ファイルは使わず、Web Audio で音を合成する。
               iPhoneは最初のタッチまで音を出せないため、最初のタッチで有効化する
  バージョン : 0.10.3（Phase10 Step10-3）
  メモ       : ずっと鳴る音（エンジン音・ドリフト音・風の音）はここで作る。
               1回だけ鳴る効果音のレシピは Sfx.js、BGMの楽譜と演奏は Music.js にまとめてある
*/

import { CONFIG } from '../config.js';
import { SFX } from './Sfx.js';
import { Music } from './Music.js';

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

    // 風の音（速く飛ぶほど強く。変わったときだけ音を変える）
    this.windGain = null;
    this.windFilter = null;
    this.windLevel = -1;

    // BGM（音を使えるようになってから作る。それまでは「流したい曲」だけ覚えておく）
    this.music = null;
    this.wantedMusic = null;
    this.musicVolume = CONFIG.audio.musicVolume;

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
      this.startWind();
      this.music = new Music(this.ctx, this.master);
      this.music.setVolume(this.musicVolume);
      if (this.wantedMusic) this.music.play(this.wantedMusic);
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

  // ---- 風の音 ----
  // 2秒分のザーッという音を低めの音だけ通して、ゴーッという風にする。最初は音量0
  startWind() {
    const ctx = this.ctx;
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // 少しなめらかにした雑音（細かいザラつきを減らして、風らしく）
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      last = last * 0.9 + (Math.random() * 2 - 1) * 0.1;
      data[i] = last * 3;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 400;
    this.windFilter.Q.value = 0.7;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    src.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.master);
    src.start();
  }

  // 風の強さ（0〜1）。0.02以上変わったときだけ音を変える（毎フレーム予約しない）
  setWind(level) {
    if (!this.windGain) return;
    const v = Math.max(0, Math.min(1, level));
    if (Math.abs(v - this.windLevel) < 0.02 && !(v === 0 && this.windLevel !== 0)) return;
    this.windLevel = v;
    const now = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(CONFIG.audio.windVolume * Math.pow(v, 1.5), now, 0.15);
    this.windFilter.frequency.setTargetAtTime(350 + v * 900, now, 0.15);
  }

  // ---- 効果音（レシピは Sfx.js） ----
  // options は音ごとの追加の指定（例：リングの音の高さ { pitch: 1.12 }）
  play(name, options) {
    if (!this.unlocked || this.paused || !this.isRunning()) return;
    const recipe = SFX[name];
    if (recipe) recipe(this.ctx, this.master, CONFIG.audio.sfxVolume, options || {});
  }

  // ---- BGM（楽譜と演奏は Music.js） ----
  // 曲を流す（'title' / 'race'）。音を使えるようになる前に呼ばれたら、使えるようになった瞬間に流す
  playMusic(name) {
    this.wantedMusic = name;
    if (this.music) this.music.play(name);
  }

  stopMusic(fade) {
    this.wantedMusic = null;
    if (this.music) this.music.stop(fade);
  }

  // テンポを変える（最終周で速くする）
  setMusicTempo(scale) {
    if (this.music) this.music.setTempoScale(scale);
  }

  // BGMの音量（0〜1）
  setMusicVolume(v) {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.music) this.music.setVolume(this.musicVolume);
  }
}
