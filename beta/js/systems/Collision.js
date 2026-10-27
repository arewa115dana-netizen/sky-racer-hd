/*
  ファイル名 : Collision.js
  保存場所   : /js/systems
  役割       : レーサー同士の押し合い。6人なので全組み合わせ（15組）を毎回調べる
  バージョン : 1.18.0（Phase19：届いた位置で動く相手は押さない。自分の側だけが押し戻される）

  コース基準座標（進行方向の距離・左右・高さ）で近さを調べるので、計算が軽い
    ・横に重なったら、左右に押し離す
    ・後ろから追突したら、後ろの人は減速し、前の人は少し押される
    ・落下中・復帰直後（点滅中）のレーサーはすり抜ける
*/

import { CONFIG } from '../config.js';

/**
 * 全レーサーの押し合いを解決する
 * @param {Racer[]} racers
 * @param {Track} track
 * @returns {number} この回に起きた接触の数
 */
export function resolveCollisions(racers, track) {
  const c = CONFIG.collision;
  const half = track.length / 2;
  let contacts = 0;

  for (const r of racers) {
    r.bumped = false;
  }

  for (let i = 0; i < racers.length; i += 1) {
    const a = racers[i];
    if (!canCollide(a)) continue;

    for (let j = i + 1; j < racers.length; j += 1) {
      const b = racers[j];
      if (!canCollide(b)) continue;

      // 進行方向の差（コースの周回のつなぎ目をまたいでも正しく測る）
      let ds = a.s - b.s;
      if (ds > half) ds -= track.length;
      if (ds < -half) ds += track.length;
      if (Math.abs(ds) >= c.alongSize) continue;

      const dy = a.y - b.y;
      if (Math.abs(dy) >= c.heightSize) continue;

      const dx = a.x - b.x;
      const overlapSide = c.sideSize - Math.abs(dx);
      if (overlapSide <= 0) continue;

      // 届いた位置で動く人（みんなで対戦の相手）は動かせないので、こちらだけが全部押し戻される
      if (a.remote && b.remote) continue;
      const wa = a.remote ? 0 : (b.remote ? 2 : 1);
      const wb = 2 - wa;

      contacts += 1;
      a.bumped = true;
      b.bumped = true;

      // 左右に押し離す（ぴったり同じ位置なら番号で向きを決める）
      const dir = dx !== 0 ? Math.sign(dx) : (a.id < b.id ? -1 : 1);
      const push = overlapSide / 2;
      a.x += dir * push * wa;
      b.x -= dir * push * wb;

      // ほぼ真後ろからの追突：速さを分け合い、前後にも少し離す
      if (Math.abs(dx) < c.sideSize * c.rearEndRatio) {
        const front = ds > 0 ? a : b;
        const rear = ds > 0 ? b : a;
        const dv = rear.speed - front.speed;
        if (dv > 0) {
          if (!rear.remote) rear.speed -= dv * c.rearSlow * (rear.bumpSlowScale || 1);
          if (!front.remote) front.speed += dv * c.frontPush;
        }
        const gap = c.alongSize - Math.abs(ds);
        if (!rear.remote) {
          rear.distance -= gap * 0.5;
          rear.s = rear.wrap(rear.distance);
        } else {
          front.distance += gap * 0.5;
          front.s = front.wrap(front.distance);
        }
      }
    }
  }
  return contacts;
}

// ぶつかる対象か（落下中・点滅中はすり抜ける）
function canCollide(r) {
  return r.state !== 'respawn' && r.invincibleTime <= 0;
}
