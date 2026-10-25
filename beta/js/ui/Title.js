/*
  ファイル名 : Title.js
  保存場所   : /js/ui
  役割       : タイトル画面。ロゴと「タップしてスタート」を出し、
               画面のどこかをタップ（PCはクリック・Enter・スペース）したら onStart を呼ぶ。
               最初のタップで音が使えるようになる（スマホで最初の音が鳴らない問題の解決）。
               左下の「遊び方」ボタンで、操作とコツの説明を開く
  バージョン : 1.0.0（Phase12 Step12-3）
  メモ       : 後ろの景色（コースを飛ぶカメラ）は Game.js が動かす。
               遊び方を開いている間は、タップしてもスタートしない（「閉じる」で戻る）
*/

import { CONFIG } from '../config.js';

// 遊び方の中身（左：操作、右：コツ）
const HOWTO_HTML =
  '<div class="howto-inner">' +
  '  <div class="howto-title">遊び方</div>' +
  '  <div class="howto-goal">空に浮かぶコースを <b>3周</b> して、<b>1位</b> を目指そう！</div>' +
  '  <div class="howto-cols">' +
  '    <div class="howto-col">' +
  '      <div class="howto-head">操作（スマホ）</div>' +
  '      <dl>' +
  '        <dt>左半分をドラッグ</dt><dd>左右に曲がる。空中では上下で高さを変える</dd>' +
  '        <dt>ドリフト</dt><dd>長押ししながら曲がる</dd>' +
  '        <dt>ブースト</dt><dd>ゲージが溜まったらタップで加速</dd>' +
  '        <dt>右側の空いた所</dt><dd>触れている間ブレーキ</dd>' +
  '        <dt>右上の II</dt><dd>一時停止・設定</dd>' +
  '      </dl>' +
  '      <div class="howto-pc">PC：←→ 曲がる／↑↓ 上下／Space ドリフト／Shift ブースト／X ブレーキ／Esc 一時停止</div>' +
  '    </div>' +
  '    <div class="howto-col">' +
  '      <div class="howto-head">勝つためのコツ</div>' +
  '      <ul>' +
  '        <li><b class="c-blue">ミニターボ</b>：ドリフトを続けると火花が <b class="c-blue">青</b> → <b class="c-orange">オレンジ</b> に。離すと加速</li>' +
  '        <li><b class="c-blue">青いリング</b>：くぐるとブーストのゲージが溜まる</li>' +
  '        <li><b class="c-gold">金のリング</b>：くぐるとその場で加速</li>' +
  '        <li><b>スタートダッシュ</b>：「GO!」の直前にブーストを押す</li>' +
  '        <li><b>柵のない所</b>：端から出ると落ちるので注意</li>' +
  '      </ul>' +
  '    </div>' +
  '  </div>' +
  '  <button class="howto-close" type="button">閉じる</button>' +
  '</div>';

export class Title {
  /**
   * @param {function} onStart タップされたときに呼ぶ関数
   */
  constructor(onStart) {
    this.onStart = onStart;
    this.done = false;
    this.howtoOpen = false;
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
      '<button class="title-howto-btn" type="button">？ 遊び方</button>' +
      '<div class="howto">' + HOWTO_HTML + '</div>' +
      '<div class="title-foot">v' + CONFIG.VERSION + '</div>';
    document.body.appendChild(el);
    this.el = el;
    this.howto = el.querySelector('.howto');
    this.howtoInner = el.querySelector('.howto-inner');

    // 画面のどこを押してもスタート（遊び方のボタンと、開いている説明の上は除く）
    this.onPointer = (e) => {
      e.preventDefault();
      if (e.target.closest('.title-howto-btn')) {
        this.openHowto();
      } else if (e.target.closest('.howto-close')) {
        this.closeHowto();
      } else if (!this.howtoOpen) {
        this.start();
      }
    };
    this.onKey = (e) => {
      if (this.howtoOpen) {
        if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') this.closeHowto();
        return;
      }
      if (e.code === 'Enter' || e.code === 'Space') this.start();
      else if (e.code === 'KeyH') this.openHowto();
    };
    this.onResize = () => this.fitHowto();
    el.addEventListener('pointerup', this.onPointer);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('resize', this.onResize);
  }

  // ---- 遊び方 ----
  openHowto() {
    if (this.done) return;
    this.howtoOpen = true;
    this.howto.classList.add('open');
    this.fitHowto();
  }

  closeHowto() {
    this.howtoOpen = false;
    this.howto.classList.remove('open');
    // 閉じた直後のタップでスタートしないよう、少しだけ待つ
    this.readyAt = performance.now() + 300;
  }

  // 説明が画面より大きければ、収まる大きさまで縮める
  fitHowto() {
    if (!this.howtoOpen) return;
    const inner = this.howtoInner;
    inner.style.transform = '';
    const margin = CONFIG.ui.screenMargin;
    const w = inner.offsetWidth;
    const h = inner.offsetHeight;
    if (!w || !h) return;
    const scale = Math.min(1, (window.innerWidth - margin * 2) / w, (window.innerHeight - margin * 2) / h);
    if (scale < 1) inner.style.transform = 'scale(' + scale.toFixed(3) + ')';
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
    window.removeEventListener('resize', this.onResize);
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }
}
