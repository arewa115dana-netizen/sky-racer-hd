/*
  ファイル名 : Loop.js
  保存場所   : /js/core
  役割       : ゲームループ。ゲームロジックは常に1秒60回の固定間隔で計算し、
               描画は端末の表示速度に合わせる。裏に回ったら自動で止まる
  バージョン : 0.2.1（Phase2 Step2-1）
*/

export class Loop {
  /**
   * @param {object} options
   * @param {function} options.update  固定間隔で呼ばれる処理 update(dt)
   * @param {function} options.render  毎フレーム呼ばれる描画 render(alpha, frameTime)
   * @param {number}   options.step    計算間隔（秒）
   * @param {number}   options.maxSubSteps 1フレームで計算する最大回数
   */
  constructor({ update, render, step = 1 / 60, maxSubSteps = 4 }) {
    this.update = update;
    this.render = render;
    this.step = step;
    this.maxSubSteps = maxSubSteps;

    this.running = false;
    this.paused = false;
    this.accumulator = 0;
    this.lastTime = 0;
    this.rafId = 0;
    this.resumeOnShow = false;

    // FPS（1秒あたりの描画回数）の計測
    this.fps = 0;
    this.fpsFrames = 0;
    this.fpsTime = 0;

    this.tick = this.tick.bind(this);
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  // ループを開始する
  start() {
    if (this.running) return;
    this.running = true;
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  // ループを完全に止める
  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  // 一時停止（描画は続け、ゲームの計算だけ止める）
  setPaused(paused) {
    this.paused = !!paused;
    this.accumulator = 0;
  }

  // アプリの切り替え・画面オフで自動停止、戻ったら再開
  onVisibilityChange() {
    if (document.hidden) {
      if (this.running) {
        this.stop();
        this.resumeOnShow = true;
      }
    } else if (this.resumeOnShow) {
      this.resumeOnShow = false;
      this.start();
    }
  }

  // 毎フレームの処理
  tick(now) {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    // 前のフレームからの経過時間（秒）。極端な値は切り詰める
    let frameTime = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (frameTime < 0) frameTime = 0;
    if (frameTime > 0.25) frameTime = 0.25;

    // FPSの計測（0.5秒ごとに更新）
    this.fpsFrames += 1;
    this.fpsTime += frameTime;
    if (this.fpsTime >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }

    // ゲームロジックを固定間隔で必要な回数だけ計算する
    if (!this.paused) {
      this.accumulator += frameTime;
      let steps = 0;
      while (this.accumulator >= this.step && steps < this.maxSubSteps) {
        this.update(this.step);
        this.accumulator -= this.step;
        steps += 1;
      }
      // 追いつけなかった分は捨てる（固まるのを防ぐ）
      if (this.accumulator >= this.step) {
        this.accumulator = 0;
      }
    }

    // 計算と計算の間の位置を滑らかに描くための割合（0〜1）
    const alpha = this.paused ? 1 : this.accumulator / this.step;
    this.render(alpha, frameTime);
  }
}
