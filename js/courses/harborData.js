/*
  ファイル名 : harborData.js
  保存場所   : /js/courses
  役割       : 雲海の港町コースの形とリング（データのみ。書き方は CourseData.js と同じ）
  バージョン : 1.15.0（Phase15 Step15-2）

  区間
    plaza      … 港町の広場（スタート。地上・柵あり・石だたみ）
    hill       … 坂の町並み（地上・柵あり。はっきりした上り下り）
    pier       … 桟橋（地上・柵なし。雲海のふちを走る板の道）
    airship    … 飛行船の港（空中。停まっている飛行船の間を飛ぶ）
    lighthouse … 灯台の丘（地上・柵あり。大きく回りながら下って広場へ）
*/

export const HARBOR = {
  name: '雲海の港町',
  sectors: 8,
  hills: [
    { area: 'hill', height: 7, length: 70 },
    { area: 'pier', height: 1.5, length: 60 }
  ],
  points: [
    // 1 広場（スタート）
    { x: 0,    y: 0,  z: -20,  width: 16, zone: 'ground', edge: 'wall', area: 'plaza' },
    { x: 0,    y: 0,  z: 55,   width: 16, zone: 'ground', edge: 'wall', area: 'plaza' },
    // 2 坂の町並み（上って下る）
    { x: 14,   y: 4,  z: 110,  width: 14, zone: 'ground', edge: 'wall', area: 'hill' },
    { x: -8,   y: 12, z: 162,  width: 14, zone: 'ground', edge: 'wall', area: 'hill' },
    { x: 20,   y: 20, z: 212,  width: 14, zone: 'ground', edge: 'wall', area: 'hill' },
    { x: 80,   y: 23, z: 234,  width: 14, zone: 'ground', edge: 'wall', area: 'hill' },
    { x: 136,  y: 15, z: 214,  width: 14, zone: 'ground', edge: 'wall', area: 'hill' },
    // 3 桟橋（柵なし）
    { x: 174,  y: 7,  z: 166,  width: 14, zone: 'ground', edge: 'open', area: 'pier' },
    { x: 198,  y: 5,  z: 96,   width: 14, zone: 'ground', edge: 'open', area: 'pier' },
    { x: 206,  y: 5,  z: 20,   width: 14, zone: 'ground', edge: 'open', area: 'pier' },
    { x: 204,  y: 5,  z: -55,  width: 14, zone: 'ground', edge: 'open', area: 'pier' },
    { x: 186,  y: 6,  z: -122, width: 14, zone: 'ground', edge: 'open', area: 'pier' },
    // 4 飛行船の港（空中）
    { x: 148,  y: 10, z: -168, width: 24, zone: 'air', area: 'airship', yMin: -8, yMax: 12 },
    { x: 86,   y: 18, z: -196, width: 28, zone: 'air', area: 'airship', yMin: -10, yMax: 14 },
    { x: 18,   y: 23, z: -200, width: 28, zone: 'air', area: 'airship', yMin: -10, yMax: 14 },
    { x: -46,  y: 19, z: -180, width: 24, zone: 'air', area: 'airship', yMin: -8, yMax: 12 },
    // 5 灯台の丘（灯台のまわりを回りながら下って、広場へ）
    { x: -100, y: 15, z: -142, width: 15, zone: 'ground', edge: 'wall', area: 'lighthouse' },
    { x: -128, y: 11, z: -94,  width: 15, zone: 'ground', edge: 'wall', area: 'lighthouse' },
    { x: -110, y: 7,  z: -50,  width: 15, zone: 'ground', edge: 'wall', area: 'lighthouse' },
    { x: -66,  y: 4,  z: -62,  width: 15, zone: 'ground', edge: 'wall', area: 'lighthouse' },
    { x: -30,  y: 2,  z: -72,  width: 16, zone: 'ground', edge: 'wall', area: 'plaza' },
    { x: -6,   y: 1,  z: -52,  width: 16, zone: 'ground', edge: 'wall', area: 'plaza' }
  ],
  rings: [
    // 飛行船の港：飛行船の下（低い）に青、上（高い）に金。真ん中あたりは左右に分かれる
    { area: 'airship', at: 0.12, x: 0,  y: -5, type: 'gauge' },
    { area: 'airship', at: 0.12, x: 0,  y: 9,  type: 'boost' },
    { area: 'airship', at: 0.32, x: -7, y: -4, type: 'gauge' },
    { area: 'airship', at: 0.32, x: 7,  y: 8,  type: 'gauge' },
    { area: 'airship', at: 0.52, x: 0,  y: -5, type: 'gauge' },
    { area: 'airship', at: 0.52, x: 0,  y: 9,  type: 'boost' },
    { area: 'airship', at: 0.72, x: 7,  y: -4, type: 'gauge' },
    { area: 'airship', at: 0.72, x: -7, y: 8,  type: 'gauge' },
    { area: 'airship', at: 0.9,  x: 0,  y: -3, type: 'gauge' },
    { area: 'airship', at: 0.9,  x: 0,  y: 7,  type: 'boost' }
  ]
};
