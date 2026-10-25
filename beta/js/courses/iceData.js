/*
  ファイル名 : iceData.js
  保存場所   : /js/courses
  役割       : 氷の空中城コースの形とリング（データのみ。書き方は CourseData.js と同じ）
  バージョン : 1.14.0（Phase14 Step14-3）

  区間
    gate    … 城門（スタート。地上・柵あり・雪の道）
    bridge  … 氷の橋（地上・柵なし・すべる）
    aurora  … オーロラの空（空中。氷の結晶の塔の間を飛ぶ）
    castle  … 城の中（地上・柵あり・細いジグザグ。雪の道）
    lake    … 凍った湖（地上・柵あり・すべる。大きなS字）
  grip … すべる区間と、すべりにくさ（大きいほどすぐ曲がれる。氷でない区間は書かない）
*/

export const ICE = {
  name: '氷の空中城',
  sectors: 8,
  grip: { bridge: 2.2, lake: 1.8 },
  points: [
    // 1 城門（スタート）
    { x: -60,  y: 0,  z: 20,   width: 18, zone: 'ground', edge: 'wall', area: 'gate' },
    { x: -60,  y: 0,  z: 95,   width: 18, zone: 'ground', edge: 'wall', area: 'gate' },
    // 2 氷の橋（柵なし・すべる・S字）
    { x: -52,  y: 2,  z: 160,  width: 15, zone: 'ground', edge: 'open', area: 'bridge' },
    { x: -26,  y: 3,  z: 212,  width: 15, zone: 'ground', edge: 'open', area: 'bridge' },
    { x: 22,   y: 4,  z: 222,  width: 15, zone: 'ground', edge: 'open', area: 'bridge' },
    { x: 62,   y: 6,  z: 254,  width: 15, zone: 'ground', edge: 'open', area: 'bridge' },
    { x: 124,  y: 8,  z: 262,  width: 15, zone: 'ground', edge: 'open', area: 'bridge' },
    { x: 184,  y: 10, z: 228,  width: 15, zone: 'ground', edge: 'open', area: 'bridge' },
    // 3 オーロラの空（空中）
    { x: 230,  y: 13, z: 165,  width: 24, zone: 'air', area: 'aurora', yMin: -8, yMax: 12 },
    { x: 256,  y: 20, z: 85,   width: 28, zone: 'air', area: 'aurora', yMin: -10, yMax: 14 },
    { x: 258,  y: 27, z: 0,    width: 28, zone: 'air', area: 'aurora', yMin: -10, yMax: 14 },
    { x: 226,  y: 30, z: -78,  width: 28, zone: 'air', area: 'aurora', yMin: -10, yMax: 14 },
    { x: 160,  y: 25, z: -132, width: 26, zone: 'air', area: 'aurora', yMin: -8, yMax: 12 },
    { x: 92,   y: 18, z: -146, width: 22, zone: 'air', area: 'aurora', yMin: -6, yMax: 10 },
    // 4 城の中（柵あり・ジグザグ）
    { x: 46,   y: 14, z: -140, width: 13, zone: 'ground', edge: 'wall', area: 'castle' },
    { x: 14,   y: 13, z: -110, width: 13, zone: 'ground', edge: 'wall', area: 'castle' },
    { x: -22,  y: 12, z: -134, width: 13, zone: 'ground', edge: 'wall', area: 'castle' },
    { x: -52,  y: 11, z: -106, width: 13, zone: 'ground', edge: 'wall', area: 'castle' },
    { x: -84,  y: 10, z: -134, width: 14, zone: 'ground', edge: 'wall', area: 'castle' },
    // 5 凍った湖（柵あり・すべる・大きく回ってスタートへ）
    { x: -124, y: 8,  z: -112, width: 20, zone: 'ground', edge: 'wall', area: 'lake' },
    { x: -138, y: 5,  z: -66,  width: 20, zone: 'ground', edge: 'wall', area: 'lake' },
    { x: -120, y: 3,  z: -22,  width: 20, zone: 'ground', edge: 'wall', area: 'lake' },
    { x: -84,  y: 1,  z: -4,   width: 19, zone: 'ground', edge: 'wall', area: 'lake' }
  ],
  rings: [
    // オーロラの空：内側（城寄り）の低いルートに青、外側の高いルートに金と青。最後は真ん中に金
    { area: 'aurora', at: 0.12, x: -6, y: -4, type: 'gauge' },
    { area: 'aurora', at: 0.12, x: 6,  y: 8,  type: 'gauge' },
    { area: 'aurora', at: 0.3,  x: -7, y: -5, type: 'gauge' },
    { area: 'aurora', at: 0.3,  x: 7,  y: 9,  type: 'boost' },
    { area: 'aurora', at: 0.48, x: -7, y: -5, type: 'gauge' },
    { area: 'aurora', at: 0.48, x: 7,  y: 9,  type: 'gauge' },
    { area: 'aurora', at: 0.66, x: -7, y: -5, type: 'gauge' },
    { area: 'aurora', at: 0.66, x: 7,  y: 9,  type: 'boost' },
    { area: 'aurora', at: 0.84, x: -5, y: -3, type: 'gauge' },
    { area: 'aurora', at: 0.84, x: 5,  y: 7,  type: 'gauge' },
    { area: 'aurora', at: 0.94, x: 0,  y: 4,  type: 'boost' }
  ]
};
