/*
  ファイル名 : Debug.js
  保存場所   : /js/core
  役割       : 左上のデバッグ表示。FPS・計算回数・描画回数・入力の値などを出す
               （エラーの画面表示は index.html 側が担当）
  バージョン : 0.2.2（Phase2 Step2-2）
*/

import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Debug {
  constructor(renderer) {
    this.renderer = renderer;
    this.el = document.getElementById('info');
    this.timer = 0;
    this.updates = 0;
    this.logs = [];
    this.setVisible(CONFIG.debug.show);
  }

  // ゲームロジックが1回計算されるたびに呼ぶ（計算/秒の計測用）
  countUpdate() {
    this.updates += 1;
  }

  // 毎フレーム呼ぶ。表示の書き換えは一定間隔ごと
  // data = { fps, state, pixelRatio, lines: [追加で表示する文字列] }
  update(frameTime, data) {
    if (!this.el || !this.visible) return;

    this.timer += frameTime;
    if (this.timer < CONFIG.debug.interval) return;

    const updatesPerSecond = Math.round(this.updates / this.timer);
    this.timer = 0;
    this.updates = 0;

    const info = this.renderer.info.render;
    const ratio = data.pixelRatio || 1;

    let text =
      '状態     : ' + data.state + '\n' +
      'FPS      : ' + data.fps + '\n' +
      '計算/秒  : ' + updatesPerSecond + '\n' +
      '描画回数 : ' + info.calls + '\n' +
      '三角形   : ' + info.triangles + '\n' +
      '画面     : ' + window.innerWidth + 'x' + window.innerHeight +
      ' @' + ratio.toFixed(2) + '\n' +
      'Three.js : r' + THREE.REVISION;

    if (data.lines && data.lines.length > 0) {
      text += '\n' + data.lines.join('\n');
    }
    if (this.logs.length > 0) {
      text += '\n' + this.logs.join('\n');
    }

    this.el.textContent = text;
  }

  setVisible(visible) {
    this.visible = !!visible;
    if (this.el) {
      this.el.style.display = this.visible ? 'block' : 'none';
    }
  }

  // 短いメッセージを表示に残す（新しいものから一定数だけ）
  log(text) {
    this.logs.push('> ' + text);
    while (this.logs.length > CONFIG.debug.maxLogs) {
      this.logs.shift();
    }
  }
}
