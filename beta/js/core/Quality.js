/*
  ファイル名 : Quality.js
  保存場所   : /js/core
  役割       : 画質の管理。端末に合わせて画質の段階（high / mid / low）を決め、
               FPSを見張って描画解像度を自動で上げ下げする。
               省電力モード（30FPS）の切り替えもここで持つ
  バージョン : 0.11.3（Phase11 Step11-3）
*/

import { CONFIG } from '../config.js';

export class Quality {
  constructor(renderer) {
    this.renderer = renderer;
    this.level = detectLevel();
    this.baseRatio = this.ratioForLevel(this.level);
    this.scale = 1;              // 自動調整の倍率（minScale〜1）
    this.pixelRatio = this.baseRatio;
    this.powerSave = CONFIG.quality.powerSave;

    // FPSの見張り用
    this.sampleTime = 0;
    this.sampleFrames = 0;
    this.goodTime = 0;           // 余裕のある状態が続いた時間
    this.renderWait = 0;         // 省電力モードで次に描くまでの待ち時間
    this.strainTime = 0;         // 解像度を一番下げてもFPSが足りない状態が続いている時間
    this.onShed = null;          // それが続いたときに呼ぶ関数（Game.js が「もう一段軽くする」を登録）
    this.lastFps = 0;            // 直近の平均FPS（デバッグ表示用）
    this.cap = 0;                // 今の場面で1秒に描く回数の上限（0 = 上限なし）。Game.js が場面ごとに決める
    this.halfRate = false;       // 自動軽量化の最後の段：レース中も30回にそろえる

    this.apply();
  }

  // 画質段階ごとの描画解像度（端末の画素密度より上げない）
  ratioForLevel(level) {
    const q = CONFIG.quality;
    const device = window.devicePixelRatio || 1;
    const limit = level === 'high' ? q.ratioHigh : (level === 'mid' ? q.ratioMid : q.ratioLow);
    return Math.min(device, limit);
  }

  // 毎フレーム呼ぶ。一定時間ごとに平均FPSを見て解像度を調整する
  sample(frameTime) {
    const q = CONFIG.quality;
    this.sampleTime += frameTime;
    this.sampleFrames += 1;
    if (this.sampleTime < q.sampleSeconds) return;

    const fps = this.sampleFrames / this.sampleTime;
    const elapsed = this.sampleTime;
    this.sampleTime = 0;
    this.sampleFrames = 0;
    this.lastFps = fps;

    // 省電力モード中は30FPSが正常なので調整しない
    if (this.powerSave) {
      this.strainTime = 0;
      return;
    }

    // 解像度を一番下げてもまだ重い状態が続いたら、見た目の飾りを1段減らしてもらう
    if (fps < q.downFps && this.scale <= q.minScale + 0.001) {
      this.strainTime += elapsed;
      if (this.strainTime >= q.shedSeconds && this.onShed) {
        this.strainTime = 0;
        this.onShed();
      }
    } else {
      this.strainTime = 0;
    }

    if (fps < q.downFps && this.scale > q.minScale) {
      // 重い：解像度を下げる
      this.scale = Math.max(q.minScale, this.scale - q.stepDown);
      this.goodTime = 0;
      this.apply();
    } else if (fps >= q.upFps && this.scale < 1) {
      // 余裕が続いたら少しずつ戻す
      this.goodTime += elapsed;
      if (this.goodTime >= q.upHoldSeconds) {
        this.scale = Math.min(1, this.scale + q.stepUp);
        this.goodTime = 0;
        this.apply();
      }
    } else {
      this.goodTime = 0;
    }
  }

  // 省電力モードの切り替え
  setPowerSave(on) {
    this.powerSave = !!on;
    this.renderWait = 0;
    this.sampleTime = 0;
    this.sampleFrames = 0;
  }

  // 場面ごとの描く回数の上限を決める（レース 60、メニュー 30、一時停止 10 など）
  setCap(fps) {
    this.cap = fps;
  }

  // 描く回数を間引く。今回のフレームを描くなら true。
  // 120Hz の画面では毎秒120回呼ばれるが、上限60なら2回に1回だけ描く（電池と発熱を抑える）
  shouldRender(frameTime) {
    const q = CONFIG.quality;
    let cap = this.cap;
    if (this.powerSave || this.halfRate) cap = cap ? Math.min(cap, q.powerSaveFps) : q.powerSaveFps;
    if (!cap) return true;
    const period = 1 / cap;
    // 前回描いてからの時間をためて、1/30秒たったら描く（少しの誤差は許す）
    this.renderWait += frameTime;
    if (this.renderWait < period - 0.004) return false;
    // 早めに描いた分は次に持ち越す（マイナスも少し残す）ので、144Hzなどでも平均がちょうど上限になる
    this.renderWait = Math.max(-period / 2, Math.min(period, this.renderWait - period));
    return true;
  }

  // 解像度を描画に反映する（変わったときだけ）
  apply() {
    const ratio = Math.round(this.baseRatio * this.scale * 100) / 100;
    if (ratio !== this.pixelRatio || !this.applied) {
      this.pixelRatio = ratio;
      this.renderer.setPixelRatio(ratio);
      this.applied = true;
    }
  }

  // デバッグ表示用の文字
  describe() {
    return '画質 ' + this.level + '  解像度 ' + Math.round(this.scale * 100) + '%' +
           '  省電力 ' + (this.powerSave ? 'ON' : 'OFF') + '  上限 ' + (this.halfRate ? 30 : this.cap) + '回/秒';
  }
}

// 端末から画質段階を推定する
function detectLevel() {
  const touch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
                navigator.maxTouchPoints > 0;
  if (!touch) return 'high';                 // PC
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4; // 対応していない端末は4とみなす
  if (cores >= 6 && memory >= 4) return 'mid';
  return 'low';
}
