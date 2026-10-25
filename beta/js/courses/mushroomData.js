/*
  ファイル名 : mushroomData.js
  保存場所   : /js/courses
  役割       : キノコの森コースの形とリング（データのみ。書き方は CourseData.js と同じ）
  バージョン : 1.16.0（Phase16 Step16-2）

  区間
    glade  … 森の広場（スタート。地上・柵あり）
    roots  … 木の根の道（地上・柵あり。でこぼこの上り下り）
    caps   … キノコのかさの空（空中。巨大キノコの間を飛ぶ）
    log    … うろの丸太（地上・柵あり。倒れた巨木の中を抜ける）
    brook  … 小川のほとり（地上・柵なし。ゆるやかなS字）
*/

export const MUSHROOM = {
  name: 'キノコの森',
  sectors: 8,
  hills: [
    { area: 'roots', height: 3.5, length: 34 },
    { area: 'brook', height: 1.5, length: 70 }
  ],
  points: [
    // 1 森の広場（スタート）
    { x: -88, y: 0, z: -25,  width: 17, zone: 'ground', edge: 'wall', area: 'glade' },
    { x: -88, y: 0, z: 62,   width: 17, zone: 'ground', edge: 'wall', area: 'glade' },
    // 2 木の根の道（でこぼこ）
    { x: -62, y: 2, z: 138,  width: 15, zone: 'ground', edge: 'wall', area: 'roots' },
    { x: -102, y: 4, z: 200,  width: 15, zone: 'ground', edge: 'wall', area: 'roots' },
    { x: -65, y: 6, z: 265,  width: 15, zone: 'ground', edge: 'wall', area: 'roots' },
    { x: 12, y: 8, z: 298,  width: 15, zone: 'ground', edge: 'wall', area: 'roots' },
    { x: 90, y: 9, z: 290,  width: 15, zone: 'ground', edge: 'wall', area: 'roots' },
    { x: 152, y: 11, z: 252,  width: 15, zone: 'ground', edge: 'wall', area: 'roots' },
    // 3 キノコのかさの空（空中）
    { x: 202, y: 15, z: 188,  width: 24, zone: 'air', area: 'caps', yMin: -8, yMax: 12 },
    { x: 235, y: 22, z: 100,   width: 28, zone: 'air', area: 'caps', yMin: -10, yMax: 14 },
    { x: 245, y: 26, z: 0,    width: 28, zone: 'air', area: 'caps', yMin: -10, yMax: 14 },
    { x: 218, y: 22, z: -90,  width: 28, zone: 'air', area: 'caps', yMin: -10, yMax: 12 },
    { x: 158, y: 16, z: -152, width: 26, zone: 'air', area: 'caps', yMin: -8, yMax: 10 },
    { x: 85, y: 12, z: -175, width: 22, zone: 'air', area: 'caps', yMin: -6, yMax: 10 },
    // 4 うろの丸太（倒れた巨木の中）
    { x: 28, y: 10, z: -165, width: 13, zone: 'ground', edge: 'wall', area: 'log' },
    { x: -18, y: 9, z: -140, width: 13, zone: 'ground', edge: 'wall', area: 'log' },
    // 5 小川のほとり（柵なし）
    { x: -65, y: 6, z: -152, width: 15, zone: 'ground', edge: 'open', area: 'brook' },
    { x: -115, y: 4, z: -130, width: 15, zone: 'ground', edge: 'open', area: 'brook' },
    { x: -128, y: 2, z: -82,  width: 15, zone: 'ground', edge: 'open', area: 'brook' },
    { x: -102, y: 1, z: -52,  width: 16, zone: 'ground', edge: 'wall', area: 'glade' }
  ],
  rings: [
    // キノコのかさの空：かさの下（低い）に青、かさの上（高い）に金
    { area: 'caps', at: 0.1,  x: -6, y: -4, type: 'gauge' },
    { area: 'caps', at: 0.1,  x: 6,  y: 8,  type: 'boost' },
    { area: 'caps', at: 0.27, x: -7, y: -5, type: 'gauge' },
    { area: 'caps', at: 0.27, x: 7,  y: 9,  type: 'gauge' },
    { area: 'caps', at: 0.44, x: -7, y: -5, type: 'gauge' },
    { area: 'caps', at: 0.44, x: 7,  y: 9,  type: 'boost' },
    { area: 'caps', at: 0.61, x: -7, y: -5, type: 'gauge' },
    { area: 'caps', at: 0.61, x: 7,  y: 9,  type: 'gauge' },
    { area: 'caps', at: 0.78, x: -5, y: -3, type: 'gauge' },
    { area: 'caps', at: 0.78, x: 5,  y: 7,  type: 'boost' },
    { area: 'caps', at: 0.92, x: 0,  y: 3,  type: 'gauge' }
  ]
};
