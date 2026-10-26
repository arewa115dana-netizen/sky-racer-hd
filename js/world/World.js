/*
  ファイル名 : World.js
  保存場所   : /js/world
  役割       : 1コース分の世界をまとめて作り、まとめて片付ける。
                 テーマ（色）の反映 → コースの中心線（Track）→ 路面など（CourseBuilder）→ 光 →
                 背景（Environment）→ 空気感（Atmosphere）
  バージョン : 1.14.0（Phase14：石の素材もコースごとに作り直す）
  メモ       : コースを切り替えるときは、前の World を dispose してから新しい World を作る。
               レース（RaceSession）を片付けてから切り替えること（レースはコースの中心線を使っているため）
*/

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { applyTheme } from './Theme.js';
import { Track } from './Track.js';
import { buildCourse } from './CourseBuilder.js';
import { Environment, disposeTree } from './Environment.js';
import { Atmosphere } from '../render/Atmosphere.js';
import { resetStoneMaterials } from './Buildings.js';

export class World {
  /**
   * @param {THREE.Scene} scene
   * @param {Quality} quality
   * @param {object} course コース（Courses.js の1つ）
   */
  constructor(scene, quality, course) {
    this.scene = scene;
    this.course = course;

    // 1. このコースの色にする（この後に作る物は、すべてこの色で作られる）
    applyTheme(course.theme);
    resetStoneMaterials();   // 石の素材も、このコースの色で作り直す

    // 2. コース：制御点から中心線を計算し、見た目を自動で作る
    this.track = new Track(course.data);
    this.courseMesh = buildCourse(this.track);
    scene.add(this.courseMesh);

    // 3. 光は2つだけ（空からの光と太陽）
    const l = CONFIG.lights;
    this.hemi = new THREE.HemisphereLight(l.hemiSky, l.hemiGround, l.hemiIntensity);
    this.sun = new THREE.DirectionalLight(l.sunColor, l.sunIntensity);
    this.sun.position.set(l.sunPosition.x, l.sunPosition.y, l.sunPosition.z);
    scene.add(this.hemi);
    scene.add(this.sun);

    // 4. 背景：空・雲海・浮遊島・草木・コースだけの建物
    this.environment = new Environment(scene, quality, this.track, course);
    // 5. HD-2Dらしい空気感（光の筋・光る粒・周辺減光）
    this.atmosphere = new Atmosphere(scene, quality);
  }

  dispose() {
    this.environment.dispose();
    this.atmosphere.dispose();
    this.scene.remove(this.courseMesh);
    disposeTree(this.courseMesh);
    this.scene.remove(this.hemi);
    this.scene.remove(this.sun);
    this.hemi.dispose();
    this.sun.dispose();
  }
}
