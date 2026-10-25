/*
  ファイル名 : HUD.js
  保存場所   : /js/ui
  役割       : レース中の画面表示。順位・周回・タイム・ブーストゲージ・
               カウントダウン・お知らせ（LAP 2、FINAL LAP、GOAL!）・結果表
  バージョン : 0.5.3（Phase5 Step5-2 修正）
  メモ       : 表示はHTMLの文字で行う（3Dより軽い）。
               変わったときだけ書き換えて、無駄な処理をしない。
               見た目の仕上げはPhase9で行う
*/

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
      '<div class="hud-gauge"><div class="hud-gauge-fill"></div><span class="hud-gauge-label">BOOST</span></div>' +
      '<div class="hud-countdown"></div>' +
      '<div class="hud-banner"></div>';
    (root || document.body).appendChild(el);

    this.root = el;
    this.rankNum = el.querySelector('.hud-rank-num');
    this.rankTotal = el.querySelector('.hud-rank-total');
    this.lapNum = el.querySelector('.hud-lap-num');
    this.lapMax = el.querySelector('.hud-lap-max');
    this.timeEl = el.querySelector('.hud-time');
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
   * @param {object} view { rank, total, lap, laps, time, gauge, countdown }
   * @param {number} dt
   */
  update(view, dt) {
    this.set('rank', view.rank, (v) => { this.rankNum.textContent = v; });
    this.set('total', view.total, (v) => { this.rankTotal.textContent = '/' + v; });
    this.set('lap', view.lap, (v) => { this.lapNum.textContent = v; });
    this.set('laps', view.laps, (v) => { this.lapMax.textContent = v; });
    this.set('time', formatTime(view.time), (v) => { this.timeEl.textContent = v; });

    // ゲージは1％単位で書き換える
    const pct = Math.round(Math.max(0, Math.min(1, view.gauge)) * 100);
    this.set('gauge', pct, (v) => {
      this.gaugeFill.style.width = v + '%';
      this.gauge.classList.toggle('full', v >= 100);
    });

    // カウントダウン（3・2・1）。GO! はお知らせで出す
    this.set('countdown', view.countdown || '', (v) => {
      this.countdownEl.textContent = v;
      this.countdownEl.classList.remove('pop');
      // 一度外してから付け直すと、数字が変わるたびに動きが最初から再生される
      void this.countdownEl.offsetWidth;
      if (v) this.countdownEl.classList.add('pop');
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
   * 結果表を出す
   * @param {Array} rows [{ rank, name, time(秒 または null), isPlayer }]
   * @param {function} onRetry 「もう一度」が押されたときに呼ぶ関数
   */
  showResults(rows, onRetry) {
    let html = '<div class="results-title">RESULT</div><table class="results-table">';
    for (const r of rows) {
      const time = r.time !== null ? formatTime(r.time) : '記録なし';
      html += '<tr class="' + (r.isPlayer ? 'me' : '') + '">' +
        '<td class="results-rank">' + r.rank + '位</td>' +
        '<td class="results-name">' + r.name + (r.isPlayer ? '（あなた）' : '') + '</td>' +
        '<td class="results-time">' + time + '</td></tr>';
    }
    html += '</table><button class="results-retry" type="button">もう一度</button>';

    const box = document.createElement('div');
    box.className = 'results';
    box.innerHTML = html;
    // 結果表はHUDの中ではなく、ページに直接置く。
    // HUDの中に置くと、HUDごと操作部品（スティック・ボタン）の下に重なり、押せなくなるため
    document.body.appendChild(box);
    this.resultsEl = box;

    const button = box.querySelector('.results-retry');
    button.addEventListener('click', () => onRetry());
  }

  // 片付け（HUDと結果表を画面から取り除く）
  dispose() {
    if (this.resultsEl && this.resultsEl.parentNode) {
      this.resultsEl.parentNode.removeChild(this.resultsEl);
    }
    this.resultsEl = null;
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

// 秒を「分:秒.1/100秒」の文字にする（例：83.456 → 1:23.45）
export function formatTime(seconds) {
  const t = Math.max(0, seconds || 0);
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t * 100) % 100);
  return m + ':' + String(s).padStart(2, '0') + '.' + String(cs).padStart(2, '0');
}
