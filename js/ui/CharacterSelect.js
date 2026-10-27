/*
  ファイル名 : CharacterSelect.js
  保存場所   : /js/ui
  役割       : キャラクター選択画面。選んだキャラを大きく表示してゆっくり回し（全方向のドット絵）、
               名前・タイプ・説明・5つの能力の棒グラフを見せる。下の顔アイコンで選んで「決定」。
               （難しさは v2.6.0 から設定の画面で選ぶ）
  バージョン : 2.6.0（難しさは設定の画面へ移した）
  操作       : スマホ … アイコンをタップ／◀ ▶ ／難しさのボタン／「決定」
               PC     … ← → で選ぶ、↑ ↓ で難しさ、Enter・スペースで決定、Esc でタイトルへ、数字キー 1〜6
  メモ       : ドット絵は、ゲームで使っている画像（atlas）から切り抜いて表示する（新しい画像は作らない）
*/

import { CONFIG } from '../config.js';

// 能力の表示名（Characters.js の stats の項目）
const STATS = [
  ['speed', '最高速'],
  ['accel', '加速'],
  ['handling', '曲がり'],
  ['flight', '飛行'],
  ['drift', 'ドリフト']
];

// キャラごとのひとこと説明
const DESCRIPTIONS = {
  knight: 'どの能力もそろった、扱いやすい騎士。はじめての人におすすめ。',
  witch: '魔力で一気に加速する。ぶつかって遅くなっても、すぐ取り戻せる。',
  rogue: 'まっすぐな道では誰よりも速い。そのぶん、曲がるのは苦手。',
  fairy: '羽で空を自在に飛ぶ。上昇・下降が速く、リングを集めやすい。',
  engineer: 'ドリフトの名人。オレンジの火花まで素早く溜められる。',
  dragonrider: '速さと力をあわせ持つ竜騎士。空中ルートで追い上げる。'
};

// ドット絵の画像の並び（PixelArt.js の FRAMES と同じ順番）
const FRAME_COL = { back: 0, left: 1, right: 2, backDiag: 3, side: 4, frontDiag: 5, front: 6 };
const CELL = 32;
// その場で回るときの向きの順番（反転 = 左右を入れ替えて表示）
const TURN = [
  ['front', false], ['frontDiag', false], ['side', false], ['backDiag', false],
  ['back', false], ['backDiag', true], ['side', true], ['frontDiag', true]
];

export class CharacterSelect {
  /**
   * @param {object} o
   * @param {Array} o.characters  Characters.js の CHARACTERS
   * @param {HTMLCanvasElement} o.atlasCanvas ドット絵の画像（atlas.texture.image）
   * @param {number} o.index      最初に選んでおくキャラ番号
   * @param {function} o.onDecide 決定したときに呼ぶ関数（キャラ番号を渡す）
   * @param {function} o.onBack   タイトルへ戻るときに呼ぶ関数
   * @param {function} o.onSound  効果音を鳴らす関数（名前を渡す）
   * @param {Array} o.difficulties 難しさの一覧 [{ key, label }]（やさしい順）
   * @param {string} o.difficulty  今の難しさ（key）
   * @param {function} o.onDifficulty 難しさを変えたときに呼ぶ関数（key を渡す）
   */
  constructor(o) {
    this.characters = o.characters;
    this.atlasCanvas = o.atlasCanvas;
    this.index = Math.max(0, Math.min(o.characters.length - 1, o.index || 0));
    this.onDecide = o.onDecide;
    this.onBack = o.onBack;
    this.onSound = o.onSound || (() => {});
    this.difficulties = o.difficulties || [];
    this.difficulty = o.difficulty;
    this.onDifficulty = o.onDifficulty || (() => {});
    this.done = false;
    this.turn = 0;

    this.build();
    this.select(this.index, true);

    // その場でゆっくり回る
    this.turnTimer = setInterval(() => {
      this.turn = (this.turn + 1) % TURN.length;
      this.drawBig();
    }, CONFIG.ui.selectTurnInterval * 1000);

    this.onKey = (e) => this.handleKey(e);
    window.addEventListener('keydown', this.onKey);

    // 画面に収まるよう縮める（スマホの横向きはアドレスバーの分だけ縦が狭い）
    this.onResize = () => this.fit();
    window.addEventListener('resize', this.onResize);
    this.fit();
  }

  // 中身が画面より大きければ、収まる大きさまで縮める（小さい画面では拡大はしない）
  fit() {
    const inner = this.inner;
    inner.style.transform = '';
    const margin = CONFIG.ui.screenMargin;
    const w = inner.offsetWidth;
    const h = inner.offsetHeight;
    if (!w || !h) return;
    const scale = Math.min(1, (window.innerWidth - margin * 2) / w, (window.innerHeight - CONFIG.ui.backBarHeight - margin * 2) / h);
    if (scale < 1) inner.style.transform = 'scale(' + scale.toFixed(3) + ')';
  }

  // ---- 画面を作る ----
  build() {
    const el = document.createElement('div');
    el.id = 'charselect';
    el.className = 'screen';
    el.innerHTML =
      '<button class="cs-back" type="button">◀ もどる</button>' +
      '<div class="cs-inner">' +
      '<div class="cs-heading">キャラクターを選ぶ</div>' +
      '<div class="cs-main">' +
      '  <div class="cs-portrait"><canvas class="cs-big" width="32" height="32"></canvas></div>' +
      '  <div class="cs-info">' +
      '    <div class="cs-name"></div>' +
      '    <div class="cs-type"></div>' +
      '    <div class="cs-desc"></div>' +
      '    <div class="cs-perk"></div>' +
      '    <div class="cs-stats"></div>' +
      '  </div>' +
      '</div>' +
      (this.difficulties.length ? '<div class="cs-diff"><span class="cs-diff-label">難しさ</span><span class="cs-diff-btns"></span></div>' : '') +
      '<div class="cs-bottom">' +
      '  <button class="cs-arrow cs-prev" type="button">◀</button>' +
      '  <div class="cs-icons"></div>' +
      '  <button class="cs-arrow cs-next" type="button">▶</button>' +
      '  <button class="cs-decide" type="button">決定</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(el);
    this.el = el;

    this.inner = el.querySelector('.cs-inner');
    this.bigCanvas = el.querySelector('.cs-big');
    this.nameEl = el.querySelector('.cs-name');
    this.typeEl = el.querySelector('.cs-type');
    this.descEl = el.querySelector('.cs-desc');
    this.perkEl = el.querySelector('.cs-perk');

    // 能力の棒グラフ（5マス）
    const statsEl = el.querySelector('.cs-stats');
    this.statCells = {};
    for (const [key, label] of STATS) {
      const row = document.createElement('div');
      row.className = 'cs-stat';
      row.innerHTML = '<span class="cs-stat-label">' + label + '</span><span class="cs-stat-bar"></span>';
      const bar = row.querySelector('.cs-stat-bar');
      const cells = [];
      for (let k = 0; k < 5; k += 1) {
        const cell = document.createElement('i');
        bar.appendChild(cell);
        cells.push(cell);
      }
      this.statCells[key] = cells;
      statsEl.appendChild(row);
    }

    // 顔アイコン（正面の絵を切り抜く）
    const iconsEl = el.querySelector('.cs-icons');
    this.iconButtons = this.characters.map((ch, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cs-icon';
      const canvas = document.createElement('canvas');
      canvas.width = CELL;
      canvas.height = CELL;
      this.drawFrame(canvas, i, 'front', false);
      button.appendChild(canvas);
      button.addEventListener('click', () => this.select(i));
      iconsEl.appendChild(button);
      return button;
    });

    // 難しさのボタン
    const diffEl = el.querySelector('.cs-diff-btns');
    this.diffButtons = !diffEl ? [] : this.difficulties.map((d) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cs-diff-btn';
      button.textContent = d.label;
      button.addEventListener('click', () => this.setDifficulty(d.key));
      diffEl.appendChild(button);
      return button;
    });
    this.setDifficulty(this.difficulty, true);

    el.querySelector('.cs-prev').addEventListener('click', () => this.move(-1));
    el.querySelector('.cs-next').addEventListener('click', () => this.move(1));
    el.querySelector('.cs-decide').addEventListener('click', () => this.decide());
    el.querySelector('.cs-back').addEventListener('click', () => this.back());
  }

  // atlas から1コマ切り抜いて描く（flip = 左右反転）
  drawFrame(canvas, charIndex, frameName, flip) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, CELL, CELL);
    ctx.save();
    if (flip) {
      ctx.translate(CELL, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(this.atlasCanvas, FRAME_COL[frameName] * CELL, charIndex * CELL, CELL, CELL, 0, 0, CELL, CELL);
    ctx.restore();
  }

  drawBig() {
    const [frame, flip] = TURN[this.turn];
    this.drawFrame(this.bigCanvas, this.index, frame, flip);
  }

  // ---- 選ぶ ----
  select(i, silent) {
    if (this.done) return;
    this.index = i;
    this.turn = 0;   // 選び直したら正面から
    const ch = this.characters[i];
    this.nameEl.textContent = ch.name;
    this.typeEl.textContent = ch.type;
    this.descEl.textContent = DESCRIPTIONS[ch.id] || '';
    this.perkEl.textContent = ch.perkText ? '★ ' + ch.perkText : '';
    for (const [key] of STATS) {
      const value = ch.stats[key];
      this.statCells[key].forEach((cell, k) => cell.classList.toggle('on', k < value));
    }
    this.iconButtons.forEach((b, k) => b.classList.toggle('selected', k === i));
    this.drawBig();
    if (!silent) this.onSound('select');
  }

  // 難しさを選ぶ（silent = 音を鳴らさず、知らせない）
  setDifficulty(key, silent) {
    if (this.done) return;
    if (!this.difficulties.some((d) => d.key === key)) return;
    this.difficulty = key;
    this.diffButtons.forEach((b, k) => b.classList.toggle('selected', this.difficulties[k].key === key));
    if (!silent) {
      this.onSound('select');
      this.onDifficulty(key);
    }
  }

  // 難しさを1つずらす（step = -1 でやさしく、1 で難しく）
  moveDifficulty(step) {
    const list = this.difficulties;
    const i = list.findIndex((d) => d.key === this.difficulty);
    const next = list[Math.max(0, Math.min(list.length - 1, i + step))];
    if (next && next.key !== this.difficulty) this.setDifficulty(next.key);
  }

  move(step) {
    const n = this.characters.length;
    this.select((this.index + step + n) % n);
  }

  decide() {
    if (this.done) return;
    this.done = true;
    this.onSound('decide');
    this.close();
    this.onDecide(this.index);
  }

  back() {
    if (this.done) return;
    this.done = true;
    this.close();
    this.onBack();
  }

  handleKey(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.move(-1);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.move(1);
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') this.moveDifficulty(1);
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') this.moveDifficulty(-1);
    else if (e.code === 'Enter' || e.code === 'Space') this.decide();
    else if (e.code === 'Escape') this.back();
    else if (e.code.startsWith('Digit')) {
      const n = Number(e.code.slice(5));
      if (n >= 1 && n <= this.characters.length) this.select(n - 1);
    }
  }

  // ふわっと消してから取り除く
  close() {
    clearInterval(this.turnTimer);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    this.el.classList.add('hide');
    setTimeout(() => {
      if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
    }, 450);
  }
}
