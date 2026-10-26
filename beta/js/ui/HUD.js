/*
  ファイル名 : HUD.js
  保存場所   : /js/ui
  役割       : レース中の画面表示。順位・周回・タイム・ブーストゲージ・ドリフトの溜まり・
               カウントダウン・お知らせ（LAP 2、FINAL LAP、GOAL!）・結果画面
  バージョン : 1.18.0（Phase19：みんなで対戦の結果画面）
  メモ       : 表示はHTMLの文字で行う（3Dより軽い）。
               変わったときだけ書き換えて、無駄な処理をしない
*/

import { CONFIG } from '../config.js';

// ドット絵の画像の中で、正面の絵がある列（PixelArt.js の FRAMES の順番）
const FRONT_COL = 6;
const CELL = 32;

export class HUD {
  constructor(root) {
    const el = document.createElement('div');
    el.id = 'race-hud';
    el.innerHTML =
      '<div class="hud-rank"><span class="hud-rank-num">-</span><span class="hud-rank-unit">位</span>' +
      '<span class="hud-rank-total">/6</span></div>' +
      '<div class="hud-lap-time">' +
      '<div class="hud-lap">LAP <span class="hud-lap-num">1</span>/<span class="hud-lap-max">3</span></div>' +
      '<div class="hud-time">0:00.00</div>' +
      '</div>' +
      '<div class="hud-drift"><span class="hud-drift-label">DRIFT</span><i></i><i></i></div>' +
      '<div class="hud-gauge"><div class="hud-gauge-fill"></div>' +
      '<div class="hud-gauge-ticks"><i></i><i></i><i></i></div>' +
      '<span class="hud-gauge-label">BOOST</span></div>' +
      '<div class="hud-countdown"></div>' +
      '<div class="hud-banner"></div>';
    (root || document.body).appendChild(el);

    this.root = el;
    this.rankEl = el.querySelector('.hud-rank');
    this.rankNum = el.querySelector('.hud-rank-num');
    this.rankTotal = el.querySelector('.hud-rank-total');
    this.lapEl = el.querySelector('.hud-lap');
    this.lapNum = el.querySelector('.hud-lap-num');
    this.lapMax = el.querySelector('.hud-lap-max');
    this.timeEl = el.querySelector('.hud-time');
    this.driftEl = el.querySelector('.hud-drift');
    this.gauge = el.querySelector('.hud-gauge');
    this.gaugeFill = el.querySelector('.hud-gauge-fill');
    this.countdownEl = el.querySelector('.hud-countdown');
    this.bannerEl = el.querySelector('.hud-banner');

    // 前回の表示内容（変わったときだけ書き換えるため）
    this.last = {};
    this.bannerTimer = 0;
  }

  /**
   * 毎フレーム呼ぶ
   * @param {object} view { rank, total, lap, laps, time, gauge, countdown, drift }
   *                      drift: -1 = していない、0 = 溜め中、1 = 青、2 = オレンジ
   * @param {number} dt
   */
  update(view, dt) {
    this.set('rank', view.rank, (v) => {
      this.rankNum.textContent = v;
      // 1〜3位は金・銀・銅の色。順位が変わったら、ポンと弾ませる
      this.rankEl.className = 'hud-rank' + (v >= 1 && v <= 3 ? ' place' + v : '');
      restartAnimation(this.rankEl, 'bump');
    });
    this.set('total', view.total, (v) => { this.rankTotal.textContent = '/' + v; });
    this.set('lap', view.lap, (v) => { this.lapNum.textContent = v; });
    this.set('laps', view.laps, (v) => { this.lapMax.textContent = v; });
    this.set('finalLap', view.lap >= view.laps, (v) => { this.lapEl.classList.toggle('final', v); });
    this.set('time', formatTime(view.time), (v) => { this.timeEl.textContent = v; });

    // ゲージは1％単位で書き換える
    const pct = Math.round(Math.max(0, Math.min(1, view.gauge)) * 100);
    this.set('gauge', pct, (v) => {
      this.gaugeFill.style.width = v + '%';
      this.gauge.classList.toggle('full', v >= 100);
    });

    // ドリフトの溜まり（ドリフト中だけ出す）
    const drift = view.drift === undefined ? -1 : view.drift;
    this.set('drift', drift, (v) => {
      this.driftEl.className = 'hud-drift' + (v >= 0 ? ' show level' + v : '');
    });

    // カウントダウン（3・2・1）。GO! はお知らせで出す
    this.set('countdown', view.countdown || '', (v) => {
      this.countdownEl.textContent = v;
      restartAnimation(this.countdownEl, v ? 'pop' : '');
    });

    // お知らせは決められた時間だけ表示する（0秒指定はずっと表示）
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerEl.classList.remove('show');
      }
    }
  }

  // お知らせを出す（seconds = 0 なら消えない）
  showBanner(text, seconds, style) {
    this.bannerEl.textContent = text;
    this.bannerEl.className = 'hud-banner show' + (style ? ' ' + style : '');
    this.bannerTimer = seconds > 0 ? seconds : 0;
  }

  hideBanner() {
    this.bannerEl.classList.remove('show');
    this.bannerTimer = 0;
  }

  /**
   * 結果画面を出す
   * @param {object} o
   * @param {Array} o.rows  [{ rank, name, charIndex, time(秒 または null), isPlayer }]
   * @param {HTMLCanvasElement} o.atlasCanvas キャラの絵（顔アイコン用）
   * @param {object} o.best { time, name, isNew } 自己ベスト（なければ null）
   * @param {function} o.onRetry / o.onSelect / o.onTitle ボタンを押したときの処理
   * @param {object} o.gp グランプリ中なら { label, gained(キャラ番号→このレースのポイント), standings, isLast }
   * @param {function} o.onNext グランプリの「次のレースへ」を押したときの処理
   */
  showResults(o) {
    // 出し直し（みんなで対戦で、あとから他の人のゴールが届いた）のときは、前の表を消す
    if (this.resultsEl && this.resultsEl.parentNode) this.resultsEl.parentNode.removeChild(this.resultsEl);
    if (this.onResize) window.removeEventListener('resize', this.onResize);
    const me = o.rows.find((r) => r.isPlayer);
    const winnerTime = o.rows[0] && o.rows[0].time !== null ? o.rows[0].time : null;

    const box = document.createElement('div');
    box.className = 'results screen' + (o.gp ? ' gp' : '');
    let html = '<div class="results-inner">' +
      '<div class="results-title">RESULT</div>' +
      (o.courseName ? '<div class="results-course">' + (o.gp ? o.gp.label + '　' : '') + o.courseName + '</div>' : '') +
      (me ? '<div class="results-mine place' + me.rank + '">' + me.rank + '位でゴール！</div>' : '') +
      '<div class="results-body"><div class="results-list">';
    o.rows.forEach((r, i) => {
      const time = r.time !== null ? formatTime(r.time) : '記録なし';
      const gap = r.time !== null && winnerTime !== null && i > 0 ? '+' + (r.time - winnerTime).toFixed(2) : '';
      html += '<div class="results-row place' + r.rank + (r.isPlayer ? ' me' : '') + (r.human && !r.isPlayer ? ' human' : '') + '">' +
        '<span class="results-rank">' + r.rank + '</span>' +
        '<canvas class="results-icon" width="' + CELL + '" height="' + CELL + '" data-char="' + r.charIndex + '"></canvas>' +
        '<span class="results-name">' + r.name + (r.isPlayer ? '<small>あなた</small>' : (o.online && !r.human ? '<small>CPU</small>' : '')) + '</span>' +
        '<span class="results-time">' + time + '</span>' +
        '<span class="results-gap">' + gap + '</span>' +
        (o.gp ? '<span class="results-pts">+' + (o.gp.gained.get(r.charIndex) || 0) + '</span>' : '') +
        '</div>';
    });
    html += '</div>';
    // グランプリの総合順位（レース結果の右横に並べる）
    if (o.gp) {
      html += '<div class="results-gp"><div class="results-gp-title">総合順位</div>';
      for (const e of o.gp.standings) {
        html += '<div class="results-gp-row' + (e.isPlayer ? ' me' : '') + '">' +
          '<span class="results-gp-rank">' + e.rank + '</span>' +
          '<span class="results-gp-name">' + e.name + '</span>' +
          '<span class="results-gp-pts">' + e.points + '点</span></div>';
      }
      html += '</div>';
    }
    html += '</div>';   // results-body
    if (o.best) {
      html += '<div class="results-best">自己ベスト ' + formatTime(o.best.time) + '（' + o.best.name + '）' +
        (o.best.isNew ? '<b class="results-new">NEW RECORD!</b>' : '') + '</div>';
    }
    if (o.online) {
      html += '<div class="results-buttons">' +
        '<button class="results-btn main" type="button" data-action="room">部屋に戻る</button>' +
        '<button class="results-btn" type="button" data-action="leave">部屋を出る</button>' +
        '</div></div>';
    } else if (o.gp) {
      html += '<div class="results-buttons">' +
        '<button class="results-btn main" type="button" data-action="next">' + (o.gp.isLast ? '最終結果へ ▶' : '次のレースへ ▶') + '</button>' +
        '<button class="results-btn" type="button" data-action="title">やめる</button>' +
        '</div></div>';
    } else {
      html += '<div class="results-buttons">' +
        '<button class="results-btn main" type="button" data-action="retry">もう一度</button>' +
        '<button class="results-btn" type="button" data-action="select">キャラ選択</button>' +
        '<button class="results-btn" type="button" data-action="title">タイトル</button>' +
        '</div></div>';
    }
    box.innerHTML = html;

    // 結果画面はHUDの中ではなく、ページに直接置く。
    // HUDの中に置くと、HUDごと操作部品（スティック・ボタン）の下に重なり、押せなくなるため
    document.body.appendChild(box);
    this.resultsEl = box;

    // 顔アイコンを描く
    if (o.atlasCanvas) {
      box.querySelectorAll('.results-icon').forEach((canvas) => {
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(o.atlasCanvas, FRONT_COL * CELL, Number(canvas.dataset.char) * CELL, CELL, CELL, 0, 0, CELL, CELL);
      });
    }

    // ボタン（同時に何度も押されないよう、1回だけ受け付ける）
    let used = false;
    box.addEventListener('click', (e) => {
      const button = e.target.closest('[data-action]');
      if (!button || used) return;
      used = true;
      const action = button.dataset.action;
      if (action === 'retry') o.onRetry();
      else if (action === 'next' && o.onNext) o.onNext();
      else if (action === 'room') o.onRoom();
      else if (action === 'leave') o.onLeave();
      else if (action === 'select') o.onSelect();
      else if (action === 'title') o.onTitle();
    });

    // 画面に収まるよう縮める
    this.resultsInner = box.querySelector('.results-inner');
    this.onResize = () => this.fitResults();
    window.addEventListener('resize', this.onResize);
    this.fitResults();
  }

  // 結果画面が画面より大きければ、収まる大きさまで縮める
  fitResults() {
    const inner = this.resultsInner;
    if (!inner) return;
    inner.style.transform = '';
    const margin = CONFIG.ui.screenMargin;
    const w = inner.offsetWidth;
    const h = inner.offsetHeight;
    if (!w || !h) return;
    const scale = Math.min(1, (window.innerWidth - margin * 2) / w, (window.innerHeight - margin * 2) / h);
    if (scale < 1) inner.style.transform = 'scale(' + scale.toFixed(3) + ')';
  }

  // 片付け（HUDと結果画面を画面から取り除く）
  dispose() {
    if (this.onResize) window.removeEventListener('resize', this.onResize);
    if (this.resultsEl && this.resultsEl.parentNode) {
      this.resultsEl.parentNode.removeChild(this.resultsEl);
    }
    this.resultsEl = null;
    this.resultsInner = null;
    if (this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }

  setVisible(visible) {
    this.root.style.display = visible ? '' : 'none';
  }

  // 値が変わったときだけ表示を書き換える
  set(key, value, apply) {
    if (this.last[key] === value) return;
    this.last[key] = value;
    apply(value);
  }
}

// 動きのクラスを一度外してから付け直す（毎回最初から再生される）
function restartAnimation(el, className) {
  el.classList.remove('pop', 'bump');
  void el.offsetWidth;
  if (className) el.classList.add(className);
}

// 秒を「分:秒.1/100秒」の文字にする（例：83.456 → 1:23.45）
export function formatTime(seconds) {
  const t = Math.max(0, seconds || 0);
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t * 100) % 100);
  return m + ':' + String(s).padStart(2, '0') + '.' + String(cs).padStart(2, '0');
}
