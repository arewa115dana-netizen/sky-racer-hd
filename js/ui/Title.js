/*
  ファイル名 : Title.js
  保存場所   : /js/ui
  役割       : タイトル画面。ロゴと「タップしてスタート」を出し、
               画面のどこかをタップ（PCはクリック・Enter・スペース）したら onStart を呼ぶ。
               最初のタップで音が使えるようになる（スマホで最初の音が鳴らない問題の解決）
  バージョン : 0.9.1（Phase9 Step9-1）
  メモ       : 後ろの景色（コースを飛ぶカメラ）は Game.js が動かす
*/

import { CONFIG } from '../config.js';

export class Title {
  /**
   * @param {function} onStart タップされたときに呼ぶ関数
   */
  constructor(onStart) {
    this.onStart = onStart;
    this.done = false;
    this.readyAt = performance.now() + CONFIG.ui.titleInputDelay * 1000;

    const el = document.createElement('div');
    el.id = 'title';
    el.className = 'screen';
    el.innerHTML =
      '<div class="title-logo">' +
      '<span class="title-sky">SKY RACER</span><span class="title-hd">HD</span>' +
      '</div>' +
      '<div class="title-sub">天空神殿グランプリ</div>' +
      '<div class="title-start">タップしてスタート</div>' +
      '<div class="title-foot">v' + CONFIG.VERSION + '</div>';
    document.body.appendChild(el);
    this.el = el;

    // 画面のどこを押してもスタート
    this.onPointer = (e) => {
      e.preventDefault();
      this.start();
    };
    this.onKey = (e) => {
      if (e.code === 'Enter' || e.code === 'Space') this.start();
    };
    el.addEventListener('pointerup', this.onPointer);
    window.addEventListener('keydown', this.onKey);
  }

  start() {
    // 表示直後の押し間違いは受け付けない
    if (this.done || performance.now() < this.readyAt) return;
    this.done = true;
    this.el.classList.add('hide');   // ふわっと消える（style.css）
    this.onStart();
    // 消える動きが終わったら取り除く
    setTimeout(() => this.dispose(), 450);
  }

  dispose() {
    this.el.removeEventListener('pointerup', this.onPointer);
    window.removeEventListener('keydown', this.onKey);
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }
}
