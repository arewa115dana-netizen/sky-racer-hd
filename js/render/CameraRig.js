/*
  ファイル名 : CameraRig.js
  保存場所   : /js/render
  役割       : レーサーを後ろから追いかけるカメラ。
               向き・高さ・画角を少し遅れて追従させ、なめらかに見せる。
               速いときやブースト中は画角を広げてスピード感を出す
  バージョン : 0.2.5（Phase2 Step2-5）
*/

import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;          // カメラが向いている方向（レーサーより少し遅れて追う）
    this.height = 0;       // カメラが追っている高さ
    this.fov = CONFIG.render.fov;
    this.look = new THREE.Vector3();
  }

  // レーサーの位置へすぐに移動する（スタート時・復帰時）
  snap(racer) {
    this.yaw = racer.renderYaw;
    this.height = racer.renderPos.y;
    this.fov = CONFIG.render.fov;
    this.apply(racer);
  }

  // 毎フレーム呼ぶ。racer.computeRenderPose() の後に呼ぶこと
  follow(racer, track, dt) {
    const c = CONFIG.camera;

    // 向き：近い方の回り方で追いかける
    const diff = wrapAngle(racer.renderYaw - this.yaw);
    this.yaw += diff * smoothing(c.yawFollow, dt);

    // 高さ：空中区間（Phase6）でなめらかに上下させるため
    this.height += (racer.renderPos.y - this.height) * smoothing(c.heightFollow, dt);

    // 画角：速さとブーストで広げる
    const speedRatio = Math.min(1.5, Math.max(0, racer.getSpeedRatio()));
    let targetFov = CONFIG.render.fov + c.fovSpeed * speedRatio;
    if (racer.boostTime > 0) targetFov += c.fovBoost;
    this.fov += (targetFov - this.fov) * smoothing(c.fovFollow, dt);

    this.apply(racer);
  }

  // カメラの位置と向きを決める
  apply(racer) {
    const c = CONFIG.camera;
    const pos = racer.renderPos;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);

    // 速いほど少し後ろに下がる
    const speedRatio = Math.min(1.5, Math.max(0, racer.getSpeedRatio()));
    const distance = c.distance + c.distanceAtSpeed * speedRatio;

    this.camera.position.set(
      pos.x - fx * distance,
      this.height + c.height,
      pos.z - fz * distance
    );
    this.look.set(
      pos.x + fx * c.lookAhead,
      this.height + c.lookHeight,
      pos.z + fz * c.lookAhead
    );
    this.camera.lookAt(this.look);

    // 画角が変わったときだけ再計算する（無駄な計算を省く）
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}

// フレームの長さに関係なく同じ速さで近づけるための割合（0〜1）
function smoothing(rate, dt) {
  return 1 - Math.exp(-rate * dt);
}

// 角度を -π〜π の範囲にそろえる
function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
