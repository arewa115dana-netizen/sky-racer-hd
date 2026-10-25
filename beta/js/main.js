/*
  ファイル名 : main.js
  保存場所   : /js
  役割       : 起動処理。ゲームの司令塔（Game）を作って開始する
  バージョン : 0.2.1（Phase2 Step2-1）
*/

import { Game } from './core/Game.js';

const container = document.getElementById('game');
const game = new Game(container);

game.init().then(() => {
  // 起動完了の合図（index.html のエラー表示が使う）
  window.__SKY_READY = true;
});
