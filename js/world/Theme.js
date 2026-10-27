/*
  ファイル名 : Theme.js
  保存場所   : /js/world
  役割       : コースごとの「見た目のテーマ」を切り替える。
               config.js の見た目の値（空の色・路面の色・草の色・光・仕上げの色づくりなど）を、
               コースの theme に書かれた値で上書きする。書かれていない値は config.js の元の値に戻る
  バージョン : 2.6.0（themedValue：今のコースを変えずに、あるコースの色を調べる）
  メモ       : 景色を作るプログラム（Environment・CourseBuilder・Decor など）は、作るときに
               CONFIG の値を読むので、コースを作る前に applyTheme を呼べば、そのコースの色で作られる
*/

import { CONFIG } from '../config.js';

// テーマで上書きできる config.js の項目
const THEMED_SECTIONS = ['environment', 'course', 'decor', 'postfx', 'atmosphere', 'lights'];

// 起動したときの元の値（どのコースのテーマも、この値からの変更として書く）
const BASE = {};
for (const name of THEMED_SECTIONS) {
  BASE[name] = clone(CONFIG[name]);
}

/**
 * テーマを反映する
 * @param {object} theme { environment: {...}, course: {...}, ... }（書いた値だけ変わる）
 */
export function applyTheme(theme) {
  for (const name of THEMED_SECTIONS) {
    const section = CONFIG[name];
    // 同じ入れ物の中身を入れ替える（ほかのファイルが持っている参照がそのまま使えるように）
    for (const key of Object.keys(section)) delete section[key];
    Object.assign(section, clone(BASE[name]));
    if (theme && theme[name]) Object.assign(section, clone(theme[name]));
  }
}

/**
 * あるコースのテーマでの値を調べる（CONFIG は変えない。コース選択のミニチュアが使う）
 * @param {object} theme コースの theme
 * @param {string} section 'environment' / 'course' など
 * @param {string} key 項目の名前
 */
export function themedValue(theme, section, key) {
  if (theme && theme[section] && theme[section][key] !== undefined) return theme[section][key];
  return BASE[section] ? BASE[section][key] : undefined;
}

// 中身ごと写す（数字・文字・配列・入れ子の表だけを使っているので、これで十分）
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
