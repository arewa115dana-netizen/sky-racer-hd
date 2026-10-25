/*
  ファイル名 : RacerSprite.js
  保存場所   : /js/entities
  役割       : レーサーの見た目。ドット絵の板（ビルボード）を常にカメラへ向け、
               カメラから見た向き（後ろ・斜め後ろ・横・斜め前・正面）で絵を切り替える。
               後ろから見ているときは、曲がる向きに傾いた絵を使う。足元に丸い影を置く
  バージョン : 0.8.1（Phase8 Step8-1）
*/

import * as THREE from 'three';
import { CONFIG } from '../config.js';

// 向きの順番（0 = 後ろ … 4 = 正面）
const VIEWS = ['back', 'backDiag', 'side', 'frontDiag', 'front'];
const VIEW_STEP = Math.PI / 4;   // 1つの向きが受け持つ角度（45度）

export class RacerSprite {
  constructor(atlas, characterId) {
    const c = CONFIG.sprite;
    this.atlas = atlas;
    this.characterId = characterId;
    this.frame = null;
    this.flip = false;
    this.view = 0;      // 今の向き（VIEWS の番号）
    this.time = 0;

    // ドット絵の板（下端が足元になるよう、板の中心を上にずらす）
    this.geometry = new THREE.PlaneGeometry(c.size, c.size);
    this.geometry.translate(0, c.size / 2, 0);
    this.mesh = new THREE.Mesh(this.geometry, atlas.material);

    // 足元の影
    const shadowGeo = new THREE.PlaneGeometry(c.shadowWidth, c.shadowDepth);
    shadowGeo.rotateX(-Math.PI / 2);
    this.shadow = new THREE.Mesh(shadowGeo, atlas.shadowMaterial);
    this.shadow.position.y = 0.06;

    this.object3d = new THREE.Group();
    this.object3d.add(this.shadow);
    this.object3d.add(this.mesh);

    this.setFrame('back', false);
  }

  // キャラクターを変える
  setCharacter(characterId) {
    this.characterId = characterId;
    const current = this.frame || 'back';
    this.frame = null;
    this.setFrame(current, this.flip);
  }

  // 表示するコマを変える（同じコマなら何もしない）。flip = true で左右反転
  setFrame(frameName, flip) {
    const f2 = !!flip;
    if (frameName === this.frame && f2 === this.flip) return;
    this.frame = frameName;
    this.flip = f2;
    const f = this.atlas.getFrame(this.characterId, frameName, f2);
    const uv = this.geometry.attributes.uv;
    // 板の4つの角：左上、右上、左下、右下
    uv.setXY(0, f.u0, f.v1);
    uv.setXY(1, f.u1, f.v1);
    uv.setXY(2, f.u0, f.v0);
    uv.setXY(3, f.u1, f.v0);
    uv.needsUpdate = true;
  }

  // 毎フレーム呼ぶ。racer.computeRenderPose() の後、カメラを動かした後に呼ぶこと
  update(racer, camera, dt) {
    const c = CONFIG.sprite;
    const pos = racer.renderPos;
    this.time += dt;

    // 位置（ボードが少しふわふわ浮く）
    this.object3d.position.set(pos.x, pos.y, pos.z);
    this.mesh.position.y = c.lift + Math.sin(this.time * c.hoverSpeed) * c.hover;

    // 縦の軸だけ回して、常にカメラの方を向く（板が傾かず直立して見える）
    const toCamX = camera.position.x - pos.x;
    const toCamZ = camera.position.z - pos.z;
    this.mesh.rotation.y = Math.atan2(toCamX, toCamZ);

    // カメラがレーサーのどちら側にいるか
    //   forward = 進む向き、right = 進む向きの右
    const yaw = racer.renderYaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const ahead = toCamX * fx + toCamZ * fz;        // プラス = カメラが前にいる
    const side = -toCamX * fz + toCamZ * fx;        // プラス = カメラが右にいる（right = (-cos, 0, sin)）
    // 0 = 真後ろから見ている … π = 真正面から見ている
    const angle = Math.atan2(Math.abs(side), -ahead);
    this.view = this.pickView(angle, c.viewHysteresis);

    if (this.view === 0) {
      // 後ろから見ているときは、曲がる向きで傾いた絵
      const steer = racer.input.steer;
      if (steer < -c.leanThreshold) {
        this.setFrame('left', false);
      } else if (steer > c.leanThreshold) {
        this.setFrame('right', false);
      } else {
        this.setFrame('back', false);
      }
    } else {
      // 絵は「カメラが右にいる（＝画面の右へ向かって見える）」向きで描いてある。
      // カメラが左にいるときは左右反転する
      this.setFrame(VIEWS[this.view], side < 0);
    }
  }

  // 角度から向きを選ぶ。境目で絵がチラチラ切り替わらないよう、
  // 今の向きから外れるときだけ少し余分に（margin）回ってから切り替える
  pickView(angle, margin) {
    const current = this.view;
    const low = (current - 0.5) * VIEW_STEP - margin;
    const high = (current + 0.5) * VIEW_STEP + margin;
    if (angle >= low && angle <= high) return current;
    return Math.max(0, Math.min(VIEWS.length - 1, Math.round(angle / VIEW_STEP)));
  }
}
