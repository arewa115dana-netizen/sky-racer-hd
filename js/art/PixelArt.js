/*
  ファイル名 : PixelArt.js
  保存場所   : /js/art
  役割       : 文字で書いたドット絵データから、全キャラクター・全コマを
               1枚の画像（テクスチャアトラス）にまとめて作る。画像ファイルは使わない
  バージョン : 0.8.1（Phase8 Step8-1）

  しくみ
    ・全キャラ共通の体型（24×24マス）を持ち、色だけキャラごとに変える
    ・向きは5種類：後ろ・斜め後ろ・横・斜め前・正面。
      斜めと横は「右を向いた絵」だけ描き、左向きは左右反転して使う（getFrame の flip）
    ・後ろ姿だけは、上半身をずらして左右に傾いた絵も自動で作る
    ・帽子や羽などのキャラ別の小物は Step8-2 で追加する

  ドット絵の文字の意味
    .  透明        k  ふち（濃い色）
    h  頭・髪（sub色）  m  体（main色）   d  体の影（main色を暗く）
    s  腕・肩（sub色） a  アクセント（accent色）
    f  顔・手（肌色）  e  目
    b  ボード       n  ボードの影     g  ボードの噴射光
*/

import * as THREE from 'three';

const CELL = 24;                       // 1コマのマス数（縦横）
const FRAMES = ['back', 'left', 'right', 'backDiag', 'side', 'frontDiag', 'front'];
const BOARD_TOP_ROW = 19;              // この行より下（ボード）は傾けない
const LEAN_AMOUNT = 0.25;              // 傾いた絵で、1行上がるごとに何マスずらすか

// 後ろ姿（ボードに乗ったキャラクターを後ろから見た絵）。必ず24文字×24行
const BACK = [
  '........................',
  '..........kkkk..........',
  '.........khhhhk.........',
  '........khhhhhhk........',
  '........khhhhhhk........',
  '........khhhhhhk........',
  '........khhhhhhk........',
  '.........khhhhk.........',
  '......ksssmmmmsssk......',
  '.....ksssmmmmmmsssk.....',
  '.....kssdmmmmmmdssk.....',
  '.....kssdmmmmmmdssk.....',
  '.....ksadmmmmmmdask.....',
  '.....kkkdmaaaamdkkk.....',
  '......kdmmmmmmmmdk......',
  '......kdmmmmmmmmdk......',
  '......kddmmmmmmddk......',
  '........kddkkddk........',
  '........kddkkddk........',
  '.....kkkkkkkkkkkkkk.....',
  '..kkbbbbbbbbbbbbbbbbkk..',
  '..knnnnnnnnnnnnnnnnnnk..',
  '...kkkkkkkkkkkkkkkkkk...',
  '.....gg..........gg.....'
];

// 斜め後ろ（右奥へ向かう姿。右のほほが少し見える）
const BACK_DIAG = [
  '........................',
  '..........kkkk..........',
  '.........khhhhk.........',
  '........khhhhhhk........',
  '........khhhhhhk........',
  '........khhhhhfk........',
  '........khhhhhfk........',
  '.........khhhhk.........',
  '.......kssmmmmssk.......',
  '......kssmmmmmmssk......',
  '......ksdmmmmmmdsk......',
  '......ksdmmmmmmdsk......',
  '......kadmmmmmmdfk......',
  '......kkdmaaaamdkk......',
  '.......kdmmmmmmdk.......',
  '.......kdmmmmmmdk.......',
  '.......kddmmmmddk.......',
  '.......kddk..kddk.......',
  '......kddk...kddk.......',
  '...kkkkkkkkkkkkkkkkkk...',
  '..kbbbbbbbbbbbbbbbbbbk..',
  '..knnnnnnnnnnnnnnnnnk...',
  '...kkkkkkkkkkkkkkkkk....',
  '....gg.........gg.......'
];

// 横（右を向いて進む姿。ボードが長く見える）
const SIDE = [
  '........................',
  '..........kkkk..........',
  '.........khhhhk.........',
  '........khhhhhfk........',
  '........khhhfffk........',
  '........khhhfefk........',
  '........khhhfffk........',
  '.........khhffk.........',
  '.........kmmmmk.........',
  '........kmmmmssk........',
  '........kdmmmssk........',
  '........kdmmmsfk........',
  '........kdmmmmkk........',
  '........kdaaaamk........',
  '........kdmmmmmk........',
  '.......kddmmmmmdk.......',
  '.......kddk..kddk.......',
  '......kddk....kddk......',
  '......kddk....kddk......',
  '..kkkkkkkkkkkkkkkkkkkk..',
  '.kbbbbbbbbbbbbbbbbbbbbk.',
  '..knnnnnnnnnnnnnnnnnnkk.',
  '...kkkkkkkkkkkkkkkkkk...',
  '.gg.....................'
];

// 斜め前（こちら側へ、右向きに進んでくる姿）
const FRONT_DIAG = [
  '........................',
  '..........kkkk..........',
  '.........khhhhk.........',
  '........khhhhhhk........',
  '........khhffffk........',
  '........khfeffek........',
  '........khfffffk........',
  '.........kffffk.........',
  '.......kssmmmmssk.......',
  '......kssmmaammssk......',
  '......ksdmmaammdsk......',
  '......ksdmmmmmmdsk......',
  '......kfdmmmmmmdfk......',
  '......kkdmaaaamdkk......',
  '.......kdmmmmmmdk.......',
  '.......kdmmmmmmdk.......',
  '.......kddmmmmddk.......',
  '.......kddk..kddk.......',
  '......kddk...kddk.......',
  '...kkkkkkkkkkkkkkkkkk...',
  '..kbbbbbbbbbbbbbbbbbbk..',
  '..knnnnnnnnnnnnnnnnnk...',
  '...kkkkkkkkkkkkkkkkk....',
  '....gg.........gg.......'
];

// 正面（こちらへまっすぐ向かってくる姿）
const FRONT = [
  '........................',
  '..........kkkk..........',
  '.........khhhhk.........',
  '........khhhhhhk........',
  '........khffffhk........',
  '........kfeffefk........',
  '........kffffffk........',
  '.........kffffk.........',
  '......ksssmmmmsssk......',
  '.....ksssmmaammsssk.....',
  '.....kssdmmaammdssk.....',
  '.....kssdmmmmmmdssk.....',
  '.....kffdmmmmmmdffk.....',
  '.....kkkdmaaaamdkkk.....',
  '......kdmmmmmmmmdk......',
  '......kdmmmmmmmmdk......',
  '......kddmmmmmmddk......',
  '........kddkkddk........',
  '........kddkkddk........',
  '.....kkkkkkkkkkkkkk.....',
  '..kkbbbbbbbbbbbbbbbbkk..',
  '..knnnnnnnnnnnnnnnnnnk..',
  '...kkkkkkkkkkkkkkkkkk...',
  '.....gg..........gg.....'
];

// 全キャラ共通の色
const COMMON_COLORS = {
  k: 0x1a1626,
  b: 0x8a5a33,
  n: 0x5c3b22,
  g: 0x9fe8ff,
  f: 0xf3c9a4,   // 肌（キャラの配色に skin があればそちらを使う）
  e: 0x1a1626
};

/**
 * 全キャラクターのドット絵をまとめた画像を作る
 * @param {Array} characters Characters.js の CHARACTERS
 * @returns {{ texture, material, shadowMaterial, getFrame(charId, frameName) }}
 */
export function buildAtlas(characters) {
  checkTemplate(BACK, '後ろ');
  checkTemplate(BACK_DIAG, '斜め後ろ');
  checkTemplate(SIDE, '横');
  checkTemplate(FRONT_DIAG, '斜め前');
  checkTemplate(FRONT, '正面');

  const width = nextPowerOfTwo(FRAMES.length * CELL);
  const height = nextPowerOfTwo(characters.length * CELL);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);

  // コマ（左・右）を後ろ姿から作り、向き別の絵と並べる
  const frameData = {
    back: BACK,
    left: lean(BACK, -1),
    right: lean(BACK, 1),
    backDiag: BACK_DIAG,
    side: SIDE,
    frontDiag: FRONT_DIAG,
    front: FRONT
  };

  // キャラクターごとに1行、コマごとに1列で描く
  characters.forEach((ch, row) => {
    const colors = makeColors(ch.palette);
    FRAMES.forEach((frameName, col) => {
      drawPixels(ctx, frameData[frameName], colors, col * CELL, row * CELL);
    });
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;   // ぼかさずドットのまま拡大
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  // 全キャラで1つの素材を共有する（描画を軽くするため）
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    alphaTest: 0.5,     // 透明部分を切り抜く（並べ替え不要で軽い）
    side: THREE.DoubleSide
  });

  // 足元の丸い影
  const shadowTexture = makeShadowTexture();
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false
  });

  // キャラ番号を探す表
  const rowOf = {};
  characters.forEach((ch, i) => { rowOf[ch.id] = i; });

  // 半マスの半分だけ内側を使い、隣のコマがにじまないようにする
  const insetU = 0.25 / width;
  const insetV = 0.25 / height;

  // flip = true なら左右反転（左を向いた絵として使う）
  function getFrame(charId, frameName, flip) {
    const row = rowOf[charId] !== undefined ? rowOf[charId] : 0;
    let col = FRAMES.indexOf(frameName);
    if (col < 0) col = 0;
    const x0 = col * CELL;
    const y0 = row * CELL;
    const left = x0 / width + insetU;
    const right = (x0 + CELL) / width - insetU;
    return {
      u0: flip ? right : left,
      u1: flip ? left : right,
      // 画像は上下が反転して使われるため、下端が v0、上端が v1
      v0: 1 - (y0 + CELL) / height + insetV,
      v1: 1 - y0 / height - insetV
    };
  }

  return { texture, material, shadowMaterial, getFrame };
}

// ---- 内部で使う関数 ----

// キャラクターの配色から、文字→色の表を作る
function makeColors(palette) {
  return {
    k: COMMON_COLORS.k,
    b: COMMON_COLORS.b,
    n: COMMON_COLORS.n,
    g: COMMON_COLORS.g,
    f: palette.skin !== undefined ? palette.skin : COMMON_COLORS.f,
    e: COMMON_COLORS.e,
    h: palette.sub,
    s: palette.sub,
    m: palette.main,
    d: darken(palette.main, 0.65),
    a: palette.accent
  };
}

// 1コマ分のドットを描く
function drawPixels(ctx, rows, colors, offsetX, offsetY) {
  for (let y = 0; y < rows.length; y += 1) {
    const line = rows[y];
    for (let x = 0; x < line.length; x += 1) {
      const key = line[x];
      if (key === '.') continue;
      const color = colors[key];
      if (color === undefined) continue;
      ctx.fillStyle = toCss(color);
      ctx.fillRect(offsetX + x, offsetY + y, 1, 1);
    }
  }
}

// 上半身を左右にずらして「傾いた絵」を作る（direction: -1 = 左、1 = 右）
function lean(rows, direction) {
  return rows.map((line, y) => {
    if (y >= BOARD_TOP_ROW) return line;
    // 上ほど大きくずらす（頭は約5マス、足元はほぼ0）
    const shift = Math.round((BOARD_TOP_ROW - y) * LEAN_AMOUNT) * direction;
    return shiftLine(line, shift);
  });
}

// 1行を左右にずらす（はみ出た分は捨て、空いた所は透明）
function shiftLine(line, shift) {
  if (shift === 0) return line;
  const blank = '.'.repeat(Math.abs(shift));
  if (shift > 0) {
    return (blank + line).slice(0, line.length);
  }
  return (line + blank).slice(-line.length);
}

// 色を暗くする（factor: 0〜1）
function darken(hex, factor) {
  const r = Math.round(((hex >> 16) & 255) * factor);
  const g = Math.round(((hex >> 8) & 255) * factor);
  const b = Math.round((hex & 255) * factor);
  return (r << 16) | (g << 8) | b;
}

function toCss(hex) {
  return '#' + hex.toString(16).padStart(6, '0');
}

function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// ドット絵データの形が正しいか確かめる（間違っていれば画面に知らせる）
function checkTemplate(rows, name) {
  const bad = [];
  if (rows.length !== CELL) bad.push('行数が' + rows.length);
  rows.forEach((line, i) => {
    if (line.length !== CELL) bad.push((i + 1) + '行目が' + line.length + '文字');
  });
  if (bad.length > 0) {
    throw new Error('ドット絵データ「' + name + '」の形が違います（' + bad.join('、') + '）');
  }
}

// 足元の影の画像（中心が濃く、外側が透明な楕円）
function makeShadowTexture() {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
