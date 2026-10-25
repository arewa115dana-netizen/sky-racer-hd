/*
  ファイル名 : Input.js
  保存場所   : /js/core
  役割       : タッチ操作とキーボードを、共通の「入力状態」に変換する。
               スマホ用のスティックとボタンもここで画面に作る
  バージョン : 0.2.2（Phase2 Step2-2）

  入力状態（getState() の戻り値）
    steer : -1〜1  旋回（-1 = 左、1 = 右）
    pitch : -1〜1  上下（1 = 上昇）
    drift : true/false  ドリフトボタンを押している間 true
    boost : true/false  ブーストを押した直後の1回だけ true
    brake : true/false  ブレーキ中 true
  一時停止は onPause に登録した関数が呼ばれる（ゲーム停止中でも反応させるため）

  操作方法
    スマホ : 左半分をドラッグ = 旋回・上下 / 右側の空いた所に触れる = ブレーキ
             「ドリフト」長押し / 「ブースト」タップ / 右上「II」= 一時停止
    PC     : ←→ または A/D = 旋回 / ↑↓ または W/S = 上下
             Space = ドリフト / Shift = ブースト / X = ブレーキ / Esc = 一時停止
*/

import { CONFIG } from '../config.js';

export class Input {
  constructor(element) {
    this.element = element;
    this.enabled = true;
    this.onPause = null;

    // 返す入力状態（毎回作らず使い回す）
    this.state = { steer: 0, pitch: 0, drift: false, boost: false, brake: false };

    // キーボード
    this.keys = new Set();
    this.boostLatched = false;

    // タッチ
    this.isTouch = false;
    this.stickId = null;      // スティックを操作している指
    this.stickOriginX = 0;
    this.stickOriginY = 0;
    this.stickX = 0;          // -1〜1
    this.stickY = 0;          // -1〜1（上が +1）
    this.driftId = null;      // ドリフトボタンを押している指
    this.brakeId = null;      // ブレーキ（右側の空き場所）を押している指

    this.createTouchUI();
    this.bindKeyboard();
    this.bindTouch();
    this.detectTouchDevice();
  }

  // ---- 外から使う関数 ----

  // 現在の入力状態を返す（ゲームロジックが1回の計算ごとに1度呼ぶ）
  getState() {
    const s = this.state;
    if (!this.enabled) {
      s.steer = 0;
      s.pitch = 0;
      s.drift = false;
      s.boost = false;
      s.brake = false;
      this.boostLatched = false;
      return s;
    }

    const k = this.keys;
    const keySteer = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) -
                     (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    const keyPitch = (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) -
                     (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0);

    s.steer = clamp(keySteer + this.stickX, -1, 1);
    s.pitch = clamp(keyPitch + this.stickY, -1, 1);
    s.drift = k.has('Space') || this.driftId !== null;
    s.brake = k.has('KeyX') || this.brakeId !== null;

    // ブーストは押した瞬間の1回だけ伝える
    s.boost = this.boostLatched;
    this.boostLatched = false;

    return s;
  }

  // 入力の受け付けを切り替える（タイトル画面などで使う）
  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) {
      this.releaseAll();
    }
  }

  // ---- スマホ用の画面部品 ----
  createTouchUI() {
    const layer = document.createElement('div');
    layer.id = 'touch-ui';
    layer.innerHTML =
      '<div class="stick-base"><div class="stick-knob"></div></div>' +
      '<div class="tbtn tbtn-drift" data-btn="drift">ドリフト</div>' +
      '<div class="tbtn tbtn-boost" data-btn="boost">ブースト</div>' +
      '<div class="tbtn tbtn-pause" data-btn="pause">II</div>' +
      '<div class="touch-hint">左側をドラッグで操作</div>';
    document.body.appendChild(layer);

    this.layer = layer;
    this.stickBase = layer.querySelector('.stick-base');
    this.stickKnob = layer.querySelector('.stick-knob');
    this.driftBtn = layer.querySelector('.tbtn-drift');
    this.boostBtn = layer.querySelector('.tbtn-boost');
    this.pauseBtn = layer.querySelector('.tbtn-pause');
  }

  // タッチ端末ならスマホ用の部品を表示する
  detectTouchDevice() {
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (coarse || navigator.maxTouchPoints > 0) {
      this.setTouchMode(true);
    }
  }

  setTouchMode(on) {
    this.isTouch = on;
    document.body.classList.toggle('is-touch', on);
  }

  // ---- キーボード ----
  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.boostLatched = true;
      }
      if (e.code === 'Escape') {
        this.firePause();
      }
      // 矢印キーやSpaceで画面がスクロールしないようにする
      if (e.code.startsWith('Arrow') || e.code === 'Space') {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    // 別のウィンドウに切り替えたら押しっぱなしを解除
    window.addEventListener('blur', () => this.releaseAll());
  }

  // ---- タッチ ----
  bindTouch() {
    const layer = this.layer;
    layer.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    layer.addEventListener('pointermove', (e) => this.onPointerMove(e));
    layer.addEventListener('pointerup', (e) => this.onPointerUp(e));
    layer.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    layer.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  onPointerDown(e) {
    e.preventDefault();
    if (e.pointerType === 'touch' && !this.isTouch) {
      this.setTouchMode(true);
    }
    if (!this.enabled) return;

    const btn = e.target.closest ? e.target.closest('[data-btn]') : null;
    if (btn) {
      const name = btn.dataset.btn;
      if (name === 'drift') {
        this.driftId = e.pointerId;
        this.driftBtn.classList.add('pressed');
      } else if (name === 'boost') {
        this.boostLatched = true;
        this.flash(this.boostBtn);
      } else if (name === 'pause') {
        this.firePause();
        this.flash(this.pauseBtn);
      }
      return;
    }

    if (e.clientX < window.innerWidth * 0.5) {
      // 左半分：スティック（触れた場所が中心になる）
      if (this.stickId === null) {
        this.stickId = e.pointerId;
        this.stickOriginX = e.clientX;
        this.stickOriginY = e.clientY;
        this.stickX = 0;
        this.stickY = 0;
        this.stickBase.style.left = e.clientX + 'px';
        this.stickBase.style.top = e.clientY + 'px';
        this.stickKnob.style.transform = 'translate(0px, 0px)';
        this.stickBase.classList.add('active');
      }
    } else if (this.brakeId === null) {
      // 右側のボタン以外の場所：ブレーキ
      this.brakeId = e.pointerId;
    }
  }

  onPointerMove(e) {
    if (e.pointerId !== this.stickId) return;
    e.preventDefault();

    const radius = CONFIG.input.stickRadius;
    let dx = e.clientX - this.stickOriginX;
    let dy = e.clientY - this.stickOriginY;
    const len = Math.hypot(dx, dy);
    if (len > radius) {
      dx = (dx / len) * radius;
      dy = (dy / len) * radius;
    }
    this.stickKnob.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';

    this.stickX = applyDeadZone(dx / radius, CONFIG.input.deadZone);
    this.stickY = applyDeadZone(-dy / radius, CONFIG.input.deadZone);
  }

  onPointerUp(e) {
    if (e.pointerId === this.stickId) {
      this.stickId = null;
      this.stickX = 0;
      this.stickY = 0;
      this.stickBase.classList.remove('active');
    }
    if (e.pointerId === this.driftId) {
      this.driftId = null;
      this.driftBtn.classList.remove('pressed');
    }
    if (e.pointerId === this.brakeId) {
      this.brakeId = null;
    }
  }

  // ---- 補助 ----
  firePause() {
    if (typeof this.onPause === 'function') {
      this.onPause();
    }
  }

  // ボタンを一瞬光らせる
  flash(el) {
    el.classList.add('pressed');
    setTimeout(() => el.classList.remove('pressed'), 120);
  }

  releaseAll() {
    this.keys.clear();
    this.boostLatched = false;
    this.stickId = null;
    this.stickX = 0;
    this.stickY = 0;
    this.driftId = null;
    this.brakeId = null;
    if (this.stickBase) this.stickBase.classList.remove('active');
    if (this.driftBtn) this.driftBtn.classList.remove('pressed');
  }
}

function clamp(v, min, max) {
  return v < min ? min : (v > max ? max : v);
}

// 中心付近の小さな動きを0にし、その外側を0〜1に引き伸ばす
function applyDeadZone(v, dead) {
  const a = Math.abs(v);
  if (a <= dead) return 0;
  return Math.sign(v) * Math.min(1, (a - dead) / (1 - dead));
}
