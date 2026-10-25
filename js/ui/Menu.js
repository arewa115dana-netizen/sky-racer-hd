/*
  ファイル名 : Menu.js
  保存場所   : /js/ui
  役割       : 一時停止メニューと設定画面。
                 一時停止 … 続ける／やり直す／設定／キャラ選択へ／タイトルへ
                 設定     … 音量・BGM・省電力モード・仕上げ処理・デバッグ表示（変えるとすぐ反映され、保存される）
  バージョン : 0.10.2（Phase10 Step10-2）
  メモ       : ボタンが押されたときの中身は Screens.js から渡された関数が行う（この画面は見た目と操作だけ）。
               画面に収まらないときは、中身の箱ごと自動で縮める
*/

import { CONFIG } from '../config.js';

export class PauseMenu {
  /**
   * @param {object} o
   * @param {object} o.settings   今の設定 { volume: 0〜10, music: 0〜10, powerSave, postfx, debug }
   * @param {boolean} o.canPostfx この端末で仕上げ処理を使えるか
   * @param {function} o.onResume / o.onRetry / o.onSelect / o.onTitle ボタンごとの処理
   * @param {function} o.onChange 設定が変わったときに呼ぶ（項目名, 値）
   */
  constructor(o) {
    this.o = o;
    this.settings = o.settings;

    const el = document.createElement('div');
    el.id = 'menu';
    el.className = 'screen';
    el.innerHTML = '<div class="menu-inner"></div>';
    document.body.appendChild(el);
    this.el = el;
    this.inner = el.querySelector('.menu-inner');

    // ボタンの処理は data-action で見分ける（1か所でまとめて受ける）
    this.onClick = (e) => {
      const button = e.target.closest('[data-action]');
      if (button) this.act(button.dataset.action);
    };
    el.addEventListener('click', this.onClick);
    this.onResize = () => this.fit();
    window.addEventListener('resize', this.onResize);

    this.showPause();
  }

  // ---- 一時停止の画面 ----
  showPause() {
    this.view = 'pause';
    this.inner.innerHTML =
      '<div class="menu-title">一時停止</div>' +
      '<button class="menu-btn main" type="button" data-action="resume">▶ 続ける</button>' +
      '<div class="menu-grid">' +
      '  <button class="menu-btn" type="button" data-action="retry">やり直す</button>' +
      '  <button class="menu-btn" type="button" data-action="settings">設定</button>' +
      '  <button class="menu-btn" type="button" data-action="select">キャラ選択へ</button>' +
      '  <button class="menu-btn" type="button" data-action="title">タイトルへ</button>' +
      '</div>';
    this.fit();
  }

  // ---- 設定の画面 ----
  showSettings() {
    this.view = 'settings';
    const s = this.settings;
    // 0〜10 の段階を − ＋ で変える行
    const level = (key, value) => {
      let bars = '';
      for (let k = 1; k <= 10; k += 1) {
        bars += '<i class="' + (k <= value ? 'on' : '') + '"></i>';
      }
      return '<span class="menu-volume">' +
        '<button class="menu-step" type="button" data-action="level:' + key + ':-1">−</button>' +
        '<span class="menu-bars">' + bars + '</span>' +
        '<button class="menu-step" type="button" data-action="level:' + key + ':1">＋</button>' +
        '</span>';
    };
    const toggle = (key, value, disabled) =>
      '<button class="menu-toggle ' + (value ? 'on' : '') + '" type="button" data-action="toggle:' + key + '"' +
      (disabled ? ' disabled' : '') + '>' + (disabled ? '使えません' : (value ? 'ON' : 'OFF')) + '</button>';

    this.inner.innerHTML =
      '<div class="menu-title">設定</div>' +
      '<div class="menu-rows">' +
      '  <div class="menu-row"><span class="menu-label">音量<small>すべての音の大きさ</small></span>' +
      level('volume', s.volume) + '</div>' +
      '  <div class="menu-row"><span class="menu-label">BGM<small>曲の大きさ</small></span>' +
      level('music', s.music) + '</div>' +
      '  <div class="menu-row"><span class="menu-label">省電力モード<small>30FPSで描いて、電池と発熱を抑える</small></span>' +
      toggle('powerSave', s.powerSave) + '</div>' +
      '  <div class="menu-row"><span class="menu-label">仕上げ処理<small>上下のぼかし・光のにじみ・色づくり</small></span>' +
      toggle('postfx', s.postfx && this.o.canPostfx, !this.o.canPostfx) + '</div>' +
      '  <div class="menu-row"><span class="menu-label">デバッグ表示<small>左上のFPSなどの表示</small></span>' +
      toggle('debug', s.debug) + '</div>' +
      '</div>' +
      '<button class="menu-btn" type="button" data-action="back">◀ 戻る</button>';
    this.fit();
  }

  // ---- ボタンが押されたとき ----
  act(action) {
    const o = this.o;
    if (action === 'resume') o.onResume();
    else if (action === 'retry') o.onRetry();
    else if (action === 'select') o.onSelect();
    else if (action === 'title') o.onTitle();
    else if (action === 'settings') this.showSettings();
    else if (action === 'back') this.showPause();
    else if (action.startsWith('level:')) {
      const [, key, step] = action.split(':');
      const v = Math.max(0, Math.min(10, this.settings[key] + Number(step)));
      this.settings[key] = v;
      o.onChange(key, v);
      this.showSettings();
    } else if (action.startsWith('toggle:')) {
      const key = action.slice(7);
      this.settings[key] = !this.settings[key];
      o.onChange(key, this.settings[key]);
      this.showSettings();
    }
  }

  // 中身が画面より大きければ、収まる大きさまで縮める
  fit() {
    const inner = this.inner;
    inner.style.transform = '';
    const margin = CONFIG.ui.screenMargin;
    const w = inner.offsetWidth;
    const h = inner.offsetHeight;
    if (!w || !h) return;
    const scale = Math.min(1, (window.innerWidth - margin * 2) / w, (window.innerHeight - margin * 2) / h);
    if (scale < 1) inner.style.transform = 'scale(' + scale.toFixed(3) + ')';
  }

  close() {
    this.el.removeEventListener('click', this.onClick);
    window.removeEventListener('resize', this.onResize);
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }
}
