/*
  ファイル名 : PixelArt.js
  保存場所   : /js/art
  役割       : 文字で書いたドット絵データから、全キャラクター・全コマを
               1枚の画像（テクスチャアトラス）にまとめて作る。画像ファイルは使わない
  バージョン : 0.2.6（Phase2 Step2-6）

  しくみ
    ・全キャラ共通の体型（24×24マス）を1つだけ持ち、色だけキャラごとに変える
    ・手で描くのは「後ろ姿」だけ。左右に傾いた絵は、上半身をずらして自動で作る
    ・帽子や羽などのキャラ別の小物はPhase8で追加する

  ドット絵の文字の意味
    .  透明        k  ふち（濃い色）
    h  頭（sub色）  m  体（main色）   d  体の影（main色を暗く）
    s  腕・肩（sub色） a  アクセント（accent色）
    b  ボード       n  ボードの影     g  ボードの噴射光
*/

import * as THREE from 'three';

const CELL = 24;                       // 1コマのマス数（縦横）
const FRAMES = ['back', 'left', 'right'];
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

// 全キャラ共通の色
const COMMON_COLORS = {
  k: 0x1a1626,
  b: 0x8a5a33,
  n: 0x5c3b22,
  g: 0x9fe8ff
};

/**
 * 全キャラクターのドット絵をまとめた画像を作る
 * @param {Array} characters Characters.js の CHARACTERS
 * @returns {{ texture, material, shadowMaterial, getFrame(charId, frameName) }}
 */
export function buildAtlas(characters) {
  checkTemplate(BACK);

  const width = nextPowerOfTwo(FRAMES.length * CELL);
  const height = nextPowerOfTwo(characters.length * CELL);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);

  // コマ（左・右）を後ろ姿から作る
  const frameData = {
    back: BACK,
    left: lean(BACK, -1),
    right: lean(BACK, 1)
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

  function getFrame(charId, frameName) {
    const row = rowOf[charId] !== undefined ? rowOf[charId] : 0;
    let col = FRAMES.indexOf(frameName);
    if (col < 0) col = 0;
    const x0 = col * CELL;
    const y0 = row * CELL;
    return {
      u0: x0 / width + insetU,
      u1: (x0 + CELL) / width - insetU,
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
function checkTemplate(rows) {
  const bad = [];
  if (rows.length !== CELL) bad.push('行数が' + rows.length);
  rows.forEach((line, i) => {
    if (line.length !== CELL) bad.push((i + 1) + '行目が' + line.length + '文字');
  });
  if (bad.length > 0) {
    throw new Error('ドット絵データの形が違います（' + bad.join('、') + '）');
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
