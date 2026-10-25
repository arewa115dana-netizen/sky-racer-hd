/*
  ファイル名 : Courses.js
  保存場所   : /js/courses
  役割       : コースの一覧。コースごとに
                 data    … コースの形とリング（制御点。CourseData.js と同じ書き方）
                 theme   … 見た目のテーマ（config.js の空の色・路面の色などを上書きする値。Theme.js）
                 decor   … 草木の種類の組（Decor.js）
                 scenery … そのコースだけの建物・名所を作る関数（{ group, update(dt) } を返す）
                 music   … レース中の曲の名前（Music.js）
               をまとめる。ready: false のコースは「準備中」としてコース選択に表示だけする
  バージョン : 1.13.0（Phase13 Step13-1）
  メモ       : 新しいコースを足すときは、このファイルに1つ書き足す（形やテーマは別ファイルに分けてよい）
*/

import * as THREE from 'three';
import { SKY_TEMPLE } from '../world/CourseData.js';
import { TEMPLE_DECOR } from '../world/Decor.js';
import { buildBuildings } from '../world/Buildings.js';
import { buildLandmarks } from '../world/Landmarks.js';
import { DESERT_COURSE } from './desert.js';
import { ICE_COURSE } from './ice.js';
import { HARBOR_COURSE } from './harbor.js';
import { VOLCANO_COURSE } from './volcano.js';

export const COURSES = [
  {
    id: 'skyTemple',
    ready: true,
    name: '天空神殿',
    sub: '浮遊島と遺跡をめぐる、はじまりのコース',
    stars: 2,                 // コースの難しさの目安（1〜5）
    color: '#7fc4ff',         // コース選択のカードの色
    data: SKY_TEMPLE,
    theme: {},                // config.js の元の値そのまま
    decor: TEMPLE_DECOR,
    music: 'race',
    // 遺跡のアーチ・神殿の柱・ゴールの門（Buildings）と、本殿・かがり火・旗・ツタ・浮かぶ瓦礫（Landmarks）
    scenery(track, level) {
      const group = new THREE.Group();
      const buildings = buildBuildings(track);
      group.add(buildings.group);
      const landmarks = buildLandmarks(track, buildings.anchors, level);
      group.add(landmarks.group);
      return { group, update: (dt) => landmarks.update(dt) };
    }
  },
  DESERT_COURSE,
  ICE_COURSE,
  HARBOR_COURSE,
  VOLCANO_COURSE,
  // ---- これから作るコース（準備中） ----
  { id: 'observatory', ready: false, name: '星空の天文塔', sub: '光る水晶と、星の海を回る塔', stars: 4, color: '#b49cff' },
  { id: 'mushroom', ready: false, name: 'キノコの森', sub: '巨大キノコと木の根の上を走る', stars: 3, color: '#8fe07a' }
];

// id からコースの番号を探す（見つからなければ 0）
export function courseIndexOf(id) {
  const i = COURSES.findIndex((c) => c.id === id && c.ready);
  return i >= 0 ? i : 0;
}
