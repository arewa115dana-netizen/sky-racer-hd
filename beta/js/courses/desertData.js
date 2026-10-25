/*
  ファイル名 : desertData.js
  保存場所   : /js/courses
  役割       : 夕焼けの砂漠遺跡コースの形とリング（データのみ。書き方は CourseData.js と同じ）
  バージョン : 1.15.0（Phase15：砂丘をうねる丘に）

  区間
    oasis    … スタートのオアシス（地上・柵あり）
    dunes    … 砂丘（地上・柵なし。広くて速い大きなカーブ）
    pyramid  … 大ピラミッドのまわり（空中。頂上を越える高いルートと、すそを回る低いルート）
    canyon   … 峡谷（地上・柵あり・細い。くねくねした谷）
    avenue   … オベリスクの参道（地上・柵あり。ゴールの門へ）
*/

export const DESERT = {
  name: '夕焼けの砂漠遺跡',
  sectors: 8,
  // 砂丘はうねる丘（上りで遅く、下りで速い）
  hills: [{ area: 'dunes', height: 6, length: 90 }],
  points: [
    // 1 オアシス（スタート）
    { x: -80,  y: 0,  z: -10,  width: 18, zone: 'ground', edge: 'wall', area: 'oasis' },
    { x: -80,  y: 0,  z: 75,   width: 18, zone: 'ground', edge: 'wall', area: 'oasis' },
    // 2 砂丘（柵なし・広い）
    { x: -66,  y: 1,  z: 145,  width: 20, zone: 'ground', edge: 'open', area: 'dunes' },
    { x: -20,  y: 3,  z: 205,  width: 20, zone: 'ground', edge: 'open', area: 'dunes' },
    { x: 55,   y: 4,  z: 228,  width: 20, zone: 'ground', edge: 'open', area: 'dunes' },
    { x: 130,  y: 6,  z: 220,  width: 20, zone: 'ground', edge: 'open', area: 'dunes' },
    { x: 192,  y: 8,  z: 185,  width: 20, zone: 'ground', edge: 'open', area: 'dunes' },
    { x: 226,  y: 10, z: 128,  width: 18, zone: 'ground', edge: 'open', area: 'dunes' },
    // 3 大ピラミッド（空中。ピラミッドのまわりを回る）
    { x: 248,  y: 14, z: 62,   width: 24, zone: 'air', area: 'pyramid', yMin: -8, yMax: 12 },
    { x: 264,  y: 22, z: -18,  width: 28, zone: 'air', area: 'pyramid', yMin: -10, yMax: 14 },
    { x: 244,  y: 27, z: -98,  width: 28, zone: 'air', area: 'pyramid', yMin: -10, yMax: 14 },
    { x: 184,  y: 21, z: -146, width: 28, zone: 'air', area: 'pyramid', yMin: -10, yMax: 12 },
    { x: 114,  y: 12, z: -148, width: 22, zone: 'air', area: 'pyramid', yMin: -6, yMax: 10 },
    // 4 峡谷（柵あり・細い。くねくね）
    { x: 66,   y: 8,  z: -130, width: 13, zone: 'ground', edge: 'wall', area: 'canyon' },
    { x: 34,   y: 7,  z: -88,  width: 12, zone: 'ground', edge: 'wall', area: 'canyon' },
    { x: 48,   y: 7,  z: -48,  width: 12, zone: 'ground', edge: 'wall', area: 'canyon' },
    { x: 22,   y: 6,  z: -14,  width: 12, zone: 'ground', edge: 'wall', area: 'canyon' },
    { x: -14,  y: 5,  z: -32,  width: 12, zone: 'ground', edge: 'wall', area: 'canyon' },
    { x: -10,  y: 5,  z: -80,  width: 12, zone: 'ground', edge: 'wall', area: 'canyon' },
    { x: -38,  y: 4,  z: -118, width: 13, zone: 'ground', edge: 'wall', area: 'canyon' },
    // 5 オベリスクの参道（ゴールへ）
    { x: -76,  y: 2,  z: -110, width: 18, zone: 'ground', edge: 'wall', area: 'avenue' },
    { x: -84,  y: 1,  z: -65,  width: 18, zone: 'ground', edge: 'wall', area: 'avenue' }
  ],
  rings: [
    // 大ピラミッド：内側（ピラミッド寄り）の低いルートに青、外側の高いルートに金と青を交互に
    { area: 'pyramid', at: 0.12, x: -6, y: -4, type: 'gauge' },
    { area: 'pyramid', at: 0.12, x: 6,  y: 8,  type: 'boost' },
    { area: 'pyramid', at: 0.3,  x: -7, y: -5, type: 'gauge' },
    { area: 'pyramid', at: 0.3,  x: 7,  y: 9,  type: 'gauge' },
    { area: 'pyramid', at: 0.48, x: -7, y: -5, type: 'gauge' },
    { area: 'pyramid', at: 0.48, x: 7,  y: 9,  type: 'boost' },
    { area: 'pyramid', at: 0.66, x: -7, y: -5, type: 'gauge' },
    { area: 'pyramid', at: 0.66, x: 7,  y: 9,  type: 'gauge' },
    { area: 'pyramid', at: 0.84, x: -5, y: -3, type: 'gauge' },
    { area: 'pyramid', at: 0.84, x: 5,  y: 7,  type: 'boost' }
  ]
};
