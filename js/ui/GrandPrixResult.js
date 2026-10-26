/*
  ファイル名 : GrandPrixResult.js
  保存場所   : /js/ui
  役割       : グランプリの最終結果画面。総合1〜3位を表彰台にのせ、自分の総合順位とトロフィー、
               全員のポイントを見せる。「もう一度（同じカップ）」と「タイトルへ」のボタン
  バージョン : 1.17.0（Phase17 Step17-2）
*/

import { CONFIG } from '../config.js';
import { trophyOf } from '../systems/GrandPrix.js';

const CELL = 32;
const FRONT_COL = 6;   // ドット絵の画像の中の「正面」の列（PixelArt.js の FRAMES と同じ）

export class GrandPrixResult {
  /**
   * @param {object} o
   * @param {object} o.cup        カップ
   * @param {Array} o.standings   総合順位 [{ rank, charIndex, name, points, isPlayer }]
   * @param {boolean} o.newRecord 今回がこのカップの最高順位なら true
   * @param {HTMLCanvasElement} o.atlasCanvas キャラの絵
   * @param {function} o.onAgain  同じカップをもう一度
   * @param {function} o.onTitle  タイトルへ
   */
  constructor(o) {
    const me = o.standings.find((e) => e.isPlayer);
    const trophy = me ? trophyOf(me.rank) : null;
    const top = [o.standings[1], o.standings[0], o.standings[2]];   // 表彰台は 2位・1位・3位 の順に並べる

    const el = document.createElement('div');
    el.className = 'screen gp-result';
    let html = '<div class="gp-inner">' +
      '<div class="gp-title">' + o.cup.name + '　最終結果</div>' +
      '<div class="gp-podium">';
    top.forEach((e, k) => {
      if (!e) return;
      const place = [2, 1, 3][k];
      html += '<div class="gp-stand place' + place + (e.isPlayer ? ' me' : '') + '">' +
        '<canvas class="gp-face" width="' + CELL + '" height="' + CELL + '" data-char="' + e.charIndex + '"></canvas>' +
        '<div class="gp-name">' + e.name + '</div>' +
        '<div class="gp-block"><span>' + place + '</span><small>' + e.points + '点</small></div>' +
        '</div>';
    });
    html += '</div>';
    if (me) {
      html += '<div class="gp-mine">' + (trophy
        ? '<b style="color:' + trophy.color + '">' + trophy.name + '</b> を手に入れた！（総合' + me.rank + '位）'
        : '総合' + me.rank + '位。次は表彰台を目指そう！') +
        (o.newRecord ? '<span class="gp-new">NEW RECORD!</span>' : '') + '</div>';
    }
    html += '<div class="gp-list">';
    for (const e of o.standings) {
      html += '<div class="gp-row' + (e.isPlayer ? ' me' : '') + '"><span>' + e.rank + '</span><span>' + e.name +
        (e.isPlayer ? '<small>あなた</small>' : '') + '</span><span>' + e.points + '点</span></div>';
    }
    html += '</div>' +
      '<div class="results-buttons">' +
      '<button class="results-btn main" type="button" data-action="again">もう一度（同じカップ）</button>' +
      '<button class="results-btn" type="button" data-action="title">タイトルへ</button>' +
      '</div></div>';
    el.innerHTML = html;
    document.body.appendChild(el);
    this.el = el;
    this.inner = el.querySelector('.gp-inner');

    // 顔のドット絵
    if (o.atlasCanvas) {
      el.querySelectorAll('.gp-face').forEach((canvas) => {
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(o.atlasCanvas, FRONT_COL * CELL, Number(canvas.dataset.char) * CELL, CELL, CELL, 0, 0, CELL, CELL);
      });
    }

    let used = false;
    this.onClick = (e) => {
      const b = e.target.closest('[data-action]');
      if (!b || used) return;
      used = true;
      this.close();
      if (b.dataset.action === 'again') o.onAgain();
      else o.onTitle();
    };
    el.addEventListener('click', this.onClick);
    this.onResize = () => this.fit();
    window.addEventListener('resize', this.onResize);
    this.fit();
  }

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
    window.removeEventListener('resize', this.onResize);
    this.el.removeEventListener('click', this.onClick);
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }
}
