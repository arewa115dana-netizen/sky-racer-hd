/*
  ファイル名 : RacerSprite.js
  保存場所   : /js/entities
  役割       : レーサーの見た目。ドット絵の板（ビルボード）を常にカメラへ向け、
               曲がる向きに合わせて傾いた絵に切り替える。足元に丸い影を置く
  バージョン : 0.2.6（Phase2 Step2-6）
*/

import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class RacerSprite {
  constructor(atlas, characterId) {
    const c = CONFIG.sprite;
    this.atlas = atlas;
    this.characterId = characterId;
    this.frame = null;
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

    this.setFrame('back');
  }

  // キャラクターを変える
  setCharacter(characterId) {
    this.characterId = characterId;
    const current = this.frame || 'back';
    this.frame = null;
    this.setFrame(current);
  }

  // 表示するコマを変える（同じコマなら何もしない）
  setFrame(frameName) {
    if (frameName === this.frame) return;
    this.frame = frameName;
    const f = this.atlas.getFrame(this.characterId, frameName);
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
    this.mesh.rotation.y = Math.atan2(
      camera.position.x - pos.x,
      camera.position.z - pos.z
    );

    // 曲がる向きで絵を切り替える
    const steer = racer.input.steer;
    if (steer < -c.leanThreshold) {
      this.setFrame('left');
    } else if (steer > c.leanThreshold) {
      this.setFrame('right');
    } else {
      this.setFrame('back');
    }
  }
}
