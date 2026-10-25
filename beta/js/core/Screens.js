/*
  ファイル名 : Screens.js
  保存場所   : /js/core
  役割       : 画面の流れの管理。タイトル → キャラ選択 → レース、と一時停止メニュー。
               設定（音量・BGM・省電力・仕上げ処理・デバッグ表示・難しさ）と、選んだキャラをスマホに保存して反映する。
               画面に合わせてBGMを切り替える（タイトル・キャラ選択はタイトル曲、レースはレース曲）
  バージョン : 1.0.0（Phase12 Step12-3）
  メモ       : Game.js が長くなったので、画面の切り替えをここに分けた。
               Game.js はこのクラスを1つ持ち、レースの開始（startRace）だけを自分で行う
*/

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { CHARACTERS } from '../entities/Characters.js';
import { Title } from '../ui/Title.js';
import { CharacterSelect } from '../ui/CharacterSelect.js';
import { PauseMenu } from '../ui/Menu.js';

const CHAR_KEY = 'skyRacer.character';
const SETTINGS_KEY = 'skyRacer.settings';
// 保存データの形の番号。1.0.0 でデバッグ表示の初期値を OFF にしたので、それより前の保存では
// デバッグ表示の設定だけ初期値（OFF）に戻す
const SETTINGS_FORMAT = 2;

// CPUの腕前の元の値（難しさに合わせて、毎回ここから計算し直す）
const BASE_SKILLS = CONFIG.ai.personalities.map((p) => p.skill);

export class Screens {
  /**
   * @param {Game} game ゲーム本体（描画・ループ・音などを持っている）
   */
  constructor(game) {
    this.game = game;
    this.title = null;
    this.menu = null;          // 一時停止メニュー（開いている間だけ）
    this.titleTime = 0;        // タイトルの背景でカメラが飛んだ時間
    this.titleLook = new THREE.Vector3();
    this.titlePoint = { x: 0, y: 0, z: 0 };

    this.charIndex = loadCharIndex();
    this.settings = loadSettings();
  }

  // ---- 設定 ----
  // 保存されている設定を、ゲームの各部分に反映する（起動時に1回）
  applyAllSettings() {
    for (const key of Object.keys(this.settings)) {
      this.applySetting(key, this.settings[key]);
    }
  }

  // 設定を1つ変えて保存する（メニューやPCのキーから呼ぶ）
  setSetting(key, value) {
    this.settings[key] = value;
    this.applySetting(key, value);
    saveSettings(this.settings);
  }

  applySetting(key, value) {
    const g = this.game;
    if (key === 'music') {
      g.audio.setMusicVolume(value / 10);
    } else if (key === 'volume') {
      // 音を使えるようになる前でも、その音量で始まるように基準値も変える
      CONFIG.audio.masterVolume = value / 10;
      g.audio.setVolume(value / 10);
    } else if (key === 'powerSave') {
      g.quality.setPowerSave(value);
    } else if (key === 'postfx') {
      if (g.postfx.enabled !== (value && this.canPostfx())) g.postfx.toggle();
    } else if (key === 'difficulty') {
      applyDifficulty(value);
    } else if (key === 'debug') {
      // メニュー中は隠したまま。レースに戻ったときに反映される
      if (g.state === 'RACE' && !this.menu) g.debug.setVisible(value);
    }
  }

  canPostfx() {
    return this.game.quality.level !== 'low';
  }

  // ---- メニュー中（タイトル・キャラ選択・一時停止）とレース中の切り替え ----
  enterMenuMode() {
    const g = this.game;
    g.input.setEnabled(false);
    document.body.classList.add('in-menu');   // 操作部品を隠す（style.css）
    g.debug.setVisible(false);
  }

  leaveMenuMode() {
    const g = this.game;
    document.body.classList.remove('in-menu');
    g.debug.setVisible(this.settings.debug);
  }

  // ---- タイトル ----
  showTitle() {
    const g = this.game;
    if (g.session) {
      g.session.dispose();
      g.session = null;
      this.titleTime = 0;   // レースから戻ったときは、背景のカメラを最初から
    }
    this.enterMenuMode();
    g.setState('TITLE');
    g.audio.playMusic('title');
    this.title = new Title(() => {
      this.title = null;
      // タップ（指を離した瞬間）の中で、もう一度確実に音を再開する
      g.audio.unlock();
      this.showCharacterSelect();
    });
  }

  // ---- キャラクター選択 ----
  showCharacterSelect() {
    const g = this.game;
    if (g.session) {
      g.session.dispose();
      g.session = null;
    }
    this.enterMenuMode();
    g.setState('SELECT');
    g.audio.playMusic('title');   // タイトルから来たときは同じ曲が続く
    new CharacterSelect({
      characters: CHARACTERS,
      atlasCanvas: g.atlas.texture.image,
      index: this.charIndex,
      onDecide: (index) => {
        this.charIndex = index;
        saveCharIndex(index);
        this.leaveMenuMode();
        g.startRace(index);
      },
      onBack: () => this.showTitle(),
      onSound: (name) => g.audio.play(name),   // 'select'（選ぶ）・'decide'（決定）
      difficulties: CONFIG.difficulty.order.map((key) => ({ key, label: CONFIG.difficulty.levels[key].label })),
      difficulty: this.settings.difficulty,
      onDifficulty: (key) => this.setSetting('difficulty', key)
    });
  }

  // ---- レースが始まったとき（Game.startRace から呼ばれる）：レース曲と、最終周・ゴールでの変化 ----
  onRaceStart(session) {
    const audio = this.game.audio;
    audio.playMusic('race');
    audio.setMusicTempo(1);
    session.race.on('finalLap', (racer) => {
      if (racer.isPlayer) audio.setMusicTempo(CONFIG.audio.finalLapTempo);
    });
    session.race.on('finish', (racer) => {
      // ゴールしたら曲を止めて、ファンファーレを聞かせる
      if (racer.isPlayer) audio.stopMusic(0.3);
    });
  }

  // タイトル・キャラ選択の背景：カメラがコースの上をゆっくり飛び、少し先を見る
  updateTitleCamera(frameTime) {
    const g = this.game;
    const u = CONFIG.ui;
    const t = g.track;
    this.titleTime += frameTime;
    const s = (u.titleCameraStart + this.titleTime * u.titleCameraSpeed) % t.length;
    const sway = Math.sin(this.titleTime * 0.25) * u.titleCameraSway;
    const p = this.titlePoint;
    t.toWorld(s, sway, u.titleCameraHeight, p);
    g.camera.position.set(p.x, p.y, p.z);
    t.toWorld(s + u.titleCameraLook, 0, u.titleCameraHeight * 0.4, p);
    this.titleLook.set(p.x, p.y, p.z);
    g.camera.lookAt(this.titleLook);
    g.environment.update(frameTime, g.camera.position);
  }

  // ---- 一時停止メニュー（レース中だけ。「II」ボタン・Esc キー） ----
  togglePauseMenu() {
    if (this.game.state !== 'RACE') return;
    if (this.menu) {
      this.closePauseMenu(true);
    } else {
      this.openPauseMenu();
    }
  }

  openPauseMenu() {
    const g = this.game;
    g.loop.setPaused(true);
    g.audio.setPaused(true);
    this.enterMenuMode();
    this.menu = new PauseMenu({
      settings: { ...this.settings },
      canPostfx: this.canPostfx(),
      onResume: () => this.closePauseMenu(true),
      onRetry: () => {
        this.closePauseMenu(true);   // 操作部品を戻してから、最初からやり直す
        g.startRace(this.charIndex);
      },
      onSelect: () => {
        this.closePauseMenu(false);
        this.showCharacterSelect();
      },
      onTitle: () => {
        this.closePauseMenu(false);
        this.showTitle();
      },
      onChange: (key, value) => this.setSetting(key, value)
    });
  }

  // メニューを閉じる（backToRace = true ならレースに戻って操作できるようにする）
  closePauseMenu(backToRace) {
    const g = this.game;
    if (this.menu) {
      this.menu.close();
      this.menu = null;
    }
    g.loop.setPaused(false);
    g.audio.setPaused(false);
    if (backToRace) {
      this.leaveMenuMode();
      g.input.setEnabled(true);
    }
  }
}

// ---- 難しさ：CPUの腕前・追い上げ補正・最高速を、選んだ段階の値にする（次のレースから効く） ----
function applyDifficulty(key) {
  const level = CONFIG.difficulty.levels[key] || CONFIG.difficulty.levels[CONFIG.difficulty.default];
  CONFIG.ai.personalities.forEach((p, i) => {
    p.skill = Math.min(1, BASE_SKILLS[i] * level.skill);
  });
  CONFIG.rubberBand.maxSlow = level.rubberSlow;
  CONFIG.rubberBand.maxFast = level.rubberFast;
  CONFIG.rubberBand.cpuSpeed = level.cpuSpeed;
}

// ---- 保存と読み込み（保存できない環境でも動くよう、失敗は無視する） ----

function loadCharIndex() {
  try {
    const v = Number(window.localStorage.getItem(CHAR_KEY));
    return Number.isInteger(v) && v >= 0 && v < CHARACTERS.length ? v : 0;
  } catch (e) {
    return 0;
  }
}

function saveCharIndex(index) {
  try {
    window.localStorage.setItem(CHAR_KEY, String(index));
  } catch (e) {
    // 保存できなくても遊べるので何もしない
  }
}

// 設定の初期値（config.js の値から作る）
function defaultSettings() {
  return {
    volume: Math.round(CONFIG.audio.masterVolume * 10),
    music: Math.round(CONFIG.audio.musicVolume * 10),
    powerSave: CONFIG.quality.powerSave,
    postfx: CONFIG.postfx.enabled,
    debug: CONFIG.debug.show,
    difficulty: CONFIG.difficulty.default
  };
}

function loadSettings() {
  const settings = defaultSettings();
  try {
    const saved = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}');
    // 知っている項目で、型が同じものだけ使う（古い保存データや壊れたデータでも動くように）
    for (const key of Object.keys(settings)) {
      if (typeof saved[key] === typeof settings[key]) settings[key] = saved[key];
    }
    // 古い形の保存では、デバッグ表示は初期値（OFF）にする
    if (saved.format !== SETTINGS_FORMAT) settings.debug = CONFIG.debug.show;
  } catch (e) {
    // 読めなければ初期値のまま
  }
  settings.volume = Math.max(0, Math.min(10, Math.round(settings.volume)));
  settings.music = Math.max(0, Math.min(10, Math.round(settings.music)));
  if (!CONFIG.difficulty.levels[settings.difficulty]) settings.difficulty = CONFIG.difficulty.default;
  return settings;
}

function saveSettings(settings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, format: SETTINGS_FORMAT }));
  } catch (e) {
    // 保存できなくても、今回の間は設定が効いている
  }
}
