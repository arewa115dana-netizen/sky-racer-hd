/*
  ファイル名 : CourseData.js
  保存場所   : /js/world
  役割       : 天空神殿コースの形（データのみ）。
               制御点を順番になめらかにつなぐと1周のコースになる
  バージョン : 0.6.2（Phase6 Step6-2）

  制御点の項目
    x, z  : 上から見た位置（メートル）
    y     : 高さ（メートル）。地上区間では路面の高さ、空中区間では飛行ルートの中心の高さ
    width : 道幅（空中区間では飛べる幅）
    zone  : 'ground'（地上） または 'air'（空中）。この点から次の点までの区間に適用
    yMin, yMax : 空中区間で、中心から上下に動ける範囲（Phase6で使用）
    area  : 区間の名前（見た目の作り分けとデバッグ表示に使う）
    edge  : 地上区間の道の端。'wall' = 柵あり（押し戻される）、'open' = 柵なし（Step3-3から落ちる）

  リング（rings）の項目（詳しくは Rings.js）
    area : 区間の名前、at : 区間の空中部分のどのあたりか（0〜1）
    x, y : 中心線から右へ・上へのずれ（メートル）
    type : 'gauge'（青：ゲージが溜まる） または 'boost'（金：その場でブースト）
*/

export const SKY_TEMPLE = {
  name: '天空神殿',
  sectors: 8,
  points: [
    // 1 スタート浮遊島（地上）
    { x: 0,    y: 0,  z: 0,    width: 18, zone: 'ground', edge: 'wall', area: 'start' },
    { x: 0,    y: 0,  z: 90,   width: 18, zone: 'ground', edge: 'wall', area: 'start' },
    { x: 22,   y: 0,  z: 160,  width: 16, zone: 'ground', edge: 'open', area: 'start' },
    { x: 0,    y: 1,  z: 230,  width: 16, zone: 'ground', edge: 'open', area: 'start' },
    { x: -6,   y: 4,  z: 290,  width: 16, zone: 'air',    area: 'cloud', yMin: -6, yMax: 10 },
    // 2 雲海（空中）
    { x: 20,   y: 6,  z: 360,  width: 28, zone: 'air',    area: 'cloud', yMin: -8, yMax: 12 },
    { x: 80,   y: -2, z: 410,  width: 30, zone: 'air',    area: 'cloud', yMin: -8, yMax: 14 },
    { x: 160,  y: 8,  z: 425,  width: 30, zone: 'air',    area: 'cloud', yMin: -8, yMax: 14 },
    { x: 235,  y: 16, z: 395,  width: 28, zone: 'air',    area: 'cloud', yMin: -8, yMax: 12 },
    { x: 275,  y: 16, z: 330,  width: 18, zone: 'ground', edge: 'open', area: 'corridor' },
    // 3 空中回廊（地上・細い石橋のヘアピン）
    { x: 285,  y: 16, z: 270,  width: 12, zone: 'ground', edge: 'wall', area: 'corridor' },
    { x: 250,  y: 16, z: 215,  width: 12, zone: 'ground', edge: 'wall', area: 'corridor' },
    { x: 290,  y: 17, z: 160,  width: 12, zone: 'ground', edge: 'wall', area: 'corridor' },
    { x: 250,  y: 18, z: 105,  width: 12, zone: 'ground', edge: 'wall', area: 'corridor' },
    { x: 278,  y: 20, z: 50,   width: 14, zone: 'air',    area: 'ruins', yMin: -6, yMax: 10 },
    // 4 古代遺跡（空中・アーチの上下ルート）
    { x: 262,  y: 26, z: -15,  width: 26, zone: 'air',    area: 'ruins', yMin: -10, yMax: 10 },
    { x: 215,  y: 20, z: -70,  width: 26, zone: 'air',    area: 'ruins', yMin: -10, yMax: 10 },
    { x: 150,  y: 10, z: -95,  width: 24, zone: 'air',    area: 'ruins', yMin: -8, yMax: 10 },
    { x: 95,   y: 5,  z: -100, width: 18, zone: 'ground', edge: 'wall', area: 'temple' },
    // 5 天空神殿（地上・大きなカーブからゴールへ）
    { x: 45,   y: 4,  z: -90,  width: 18, zone: 'ground', edge: 'wall', area: 'temple' },
    { x: 12,   y: 3,  z: -65,  width: 18, zone: 'ground', edge: 'wall', area: 'temple' },
    { x: 0,    y: 1,  z: -32,  width: 18, zone: 'ground', edge: 'wall', area: 'temple' }
  ],

  rings: [
    // 雲海：高いルート（左寄り）と低いルート（右寄り）に青いリングを4組。どちらかを続けて取れば満タン
    { area: 'cloud', at: 0.15, x: -5, y: 7,  type: 'gauge' },
    { area: 'cloud', at: 0.15, x: 5,  y: -4, type: 'gauge' },
    { area: 'cloud', at: 0.35, x: -6, y: 8,  type: 'gauge' },
    { area: 'cloud', at: 0.35, x: 6,  y: -5, type: 'gauge' },
    { area: 'cloud', at: 0.55, x: -4, y: 9,  type: 'gauge' },
    { area: 'cloud', at: 0.55, x: 4,  y: -6, type: 'gauge' },
    { area: 'cloud', at: 0.75, x: -5, y: 7,  type: 'gauge' },
    { area: 'cloud', at: 0.75, x: 5,  y: -4, type: 'gauge' },
    // 古代遺跡：アーチの上側（狭い・高い）に金のリング、下側（広い）に青のリング
    { area: 'ruins', at: 0.25, x: 0,  y: 7,  type: 'boost' },
    { area: 'ruins', at: 0.25, x: -6, y: -6, type: 'gauge' },
    { area: 'ruins', at: 0.5,  x: 0,  y: 7,  type: 'boost' },
    { area: 'ruins', at: 0.5,  x: 6,  y: -6, type: 'gauge' },
    { area: 'ruins', at: 0.75, x: 0,  y: 7,  type: 'boost' },
    { area: 'ruins', at: 0.75, x: -6, y: -6, type: 'gauge' }
  ]
};
