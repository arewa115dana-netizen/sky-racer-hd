/*
  ファイル名 : volcanoData.js
  保存場所   : /js/courses
  役割       : 溶岩の火山島コースの形とリング（データのみ。書き方は CourseData.js と同じ）
  バージョン : 1.15.0（Phase15 Step15-3）

  区間
    basalt   … 玄武岩のふもと（スタート。地上・柵あり）
    slope    … 火山の斜面（地上・柵あり。ジグザグに上る急な上り坂）
    crater   … 火口のふち（地上・柵なし・細い。内側は溶岩の湖）
    eruption … 噴煙の空（空中。火山の外へ飛び出しながら下る）
    lavaflow … 溶岩の川（地上・柵あり。川沿いを一気に駆け下りる）
  火山の中心は (0, 230)。火口のふちは半径およそ70、高さ44
*/

export const VOLCANO_CENTER = { x: 0, z: 230 };

export const VOLCANO = {
  name: '溶岩の火山島',
  sectors: 8,
  // 火口のふちと溶岩の川は、でこぼこの道
  hills: [
    { area: 'crater', height: 2.5, length: 48 },
    { area: 'lavaflow', height: 3, length: 50 }
  ],
  points: [
    // 1 玄武岩のふもと（スタート）
    { x: 0,    y: 0,  z: -40,  width: 16, zone: 'ground', edge: 'wall', area: 'basalt' },
    { x: 0,    y: 0,  z: 40,   width: 16, zone: 'ground', edge: 'wall', area: 'basalt' },
    // 2 火山の斜面（ジグザグに上る）
    { x: 30,   y: 4,  z: 92,   width: 14, zone: 'ground', edge: 'wall', area: 'slope' },
    { x: -30,  y: 11, z: 106,  width: 13, zone: 'ground', edge: 'wall', area: 'slope' },
    { x: -80,  y: 18, z: 132,  width: 13, zone: 'ground', edge: 'wall', area: 'slope' },
    { x: -66,  y: 25, z: 158,  width: 13, zone: 'ground', edge: 'wall', area: 'slope' },
    { x: -22,  y: 32, z: 150,  width: 13, zone: 'ground', edge: 'wall', area: 'slope' },
    { x: 12,   y: 39, z: 158,  width: 13, zone: 'ground', edge: 'wall', area: 'slope' },
    // 3 火口のふち（柵なし・細い）
    { x: 40,   y: 44, z: 172,  width: 10.5, zone: 'ground', edge: 'open', area: 'crater' },
    { x: 66,   y: 45, z: 206,  width: 10.5, zone: 'ground', edge: 'open', area: 'crater' },
    { x: 70,   y: 46, z: 244,  width: 10.5, zone: 'ground', edge: 'open', area: 'crater' },
    { x: 50,   y: 46, z: 280,  width: 10.5, zone: 'ground', edge: 'open', area: 'crater' },
    { x: 12,   y: 46, z: 300,  width: 10.5, zone: 'ground', edge: 'open', area: 'crater' },
    { x: -30,  y: 45, z: 296,  width: 10.5, zone: 'ground', edge: 'open', area: 'crater' },
    { x: -62,  y: 44, z: 270,  width: 10.5, zone: 'ground', edge: 'open', area: 'crater' },
    // 4 噴煙の空（空中。火山の外へ）
    { x: -116, y: 38, z: 252,  width: 24, zone: 'air', area: 'eruption', yMin: -8, yMax: 12 },
    { x: -166, y: 30, z: 198,  width: 28, zone: 'air', area: 'eruption', yMin: -10, yMax: 14 },
    { x: -192, y: 22, z: 118,  width: 28, zone: 'air', area: 'eruption', yMin: -10, yMax: 14 },
    { x: -184, y: 16, z: 38,   width: 28, zone: 'air', area: 'eruption', yMin: -10, yMax: 12 },
    { x: -146, y: 12, z: -30,  width: 24, zone: 'air', area: 'eruption', yMin: -8, yMax: 10 },
    // 5 溶岩の川（駆け下りる）
    { x: -102, y: 10, z: -72,  width: 15, zone: 'ground', edge: 'wall', area: 'lavaflow' },
    { x: -66,  y: 7,  z: -112, width: 15, zone: 'ground', edge: 'wall', area: 'lavaflow' },
    { x: -24,  y: 4,  z: -126, width: 15, zone: 'ground', edge: 'wall', area: 'lavaflow' },
    { x: 14,   y: 2,  z: -108, width: 15, zone: 'ground', edge: 'wall', area: 'lavaflow' },
    { x: 8,    y: 1,  z: -74,  width: 16, zone: 'ground', edge: 'wall', area: 'basalt' }
  ],
  rings: [
    // 噴煙の空：火山側（内側）の低いルートに青、外側の高いルートに金。噴煙をよけながら取る
    { area: 'eruption', at: 0.1,  x: 6, y: -4, type: 'gauge' },
    { area: 'eruption', at: 0.1,  x: -6,  y: 8,  type: 'boost' },
    { area: 'eruption', at: 0.28, x: 7, y: -5, type: 'gauge' },
    { area: 'eruption', at: 0.28, x: -7,  y: 9,  type: 'gauge' },
    { area: 'eruption', at: 0.46, x: 7, y: -5, type: 'gauge' },
    { area: 'eruption', at: 0.46, x: -7,  y: 9,  type: 'boost' },
    { area: 'eruption', at: 0.64, x: 7, y: -5, type: 'gauge' },
    { area: 'eruption', at: 0.64, x: -7,  y: 9,  type: 'gauge' },
    { area: 'eruption', at: 0.82, x: 5, y: -3, type: 'gauge' },
    { area: 'eruption', at: 0.82, x: -5,  y: 7,  type: 'boost' }
  ]
};
