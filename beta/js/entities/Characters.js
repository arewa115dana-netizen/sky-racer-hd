/*
  ファイル名 : Characters.js
  保存場所   : /js/entities
  役割       : 6人のキャラクターの名前・タイプ・能力値・配色
               （能力値は1〜5、5項目の合計はどのキャラも15）
  バージョン : 0.12.1（Phase12 Step12-1：強さの最終調整）
  メモ       : palette はドット絵の色。帽子・羽などの小物は art/Parts.js にある
               能力値1段階の効き目は config.js の racer（maxSpeedPerStat など）で決まる
*/

export const CHARACTERS = [
  {
    id: 'knight',
    name: 'ナイト',
    type: 'バランス型',
    stats: { speed: 3, accel: 3, handling: 3, flight: 3, drift: 3 },
    perk: { wallFriction: 0.55, bumpSlow: 0.5 },
    perkText: 'よろい：ぶつかっても、壁にこすれても減速しにくい',
    palette: { main: 0x4a7bd1, sub: 0xd9dde6, accent: 0xf2c14e },
    parts: []
  },
  {
    id: 'witch',
    name: 'ウィッチ',
    type: '加速型',
    stats: { speed: 2, accel: 5, handling: 3, flight: 3, drift: 2 },
    perk: {},
    perkText: 'まりょく：ブーストとミニターボの伸びが大きい',
    palette: { main: 0x7a4bc4, sub: 0x2b2340, accent: 0xff8fd0 },
    parts: []
  },
  {
    id: 'rogue',
    name: 'ローグ',
    type: '最高速型',
    stats: { speed: 5, accel: 3, handling: 2, flight: 3, drift: 2 },   // v2.6.0：ドリフト1を加速へ（ドリフトの差が小さくなったので、立て直しの速さを優先）
    perk: { wallFriction: 0.7 },
    perkText: 'すりぬけ：壁ぎわを走っても速さが落ちにくい',
    palette: { main: 0x3f8a5a, sub: 0x3a3a3a, accent: 0xe05a47 },
    parts: []
  },
  {
    id: 'fairy',
    name: 'フェアリー',
    type: '飛行型',
    stats: { speed: 2, accel: 3, handling: 3, flight: 5, drift: 2 },
    perk: { gauge: 1.3 },
    perkText: 'はね：青いリングでゲージが多く溜まる',
    palette: { main: 0x8fe3c8, sub: 0xfff4d6, accent: 0xffd23f },
    parts: []
  },
  {
    id: 'engineer',
    name: 'エンジニア',
    type: 'ドリフト型',
    stats: { speed: 3, accel: 3, handling: 2, flight: 2, drift: 5 },   // Phase12：曲がり1を加速へ（加速2・飛行2で遅れすぎたため）
    perk: {},
    perkText: 'ターボ職人：ドリフト中も減速しにくく、ミニターボが長い',
    palette: { main: 0xe08a2e, sub: 0x5b4636, accent: 0x9fd3ff },
    parts: []
  },
  {
    id: 'dragonrider',
    name: 'ドラゴンライダー',
    type: '空中最高速型',
    stats: { speed: 4, accel: 3, handling: 2, flight: 3, drift: 3 },
    perk: { ringBoost: 1.15 },
    perkText: 'りゅうの力：金のリングの加速が長い',
    palette: { main: 0xc0392b, sub: 0x2e2e38, accent: 0xf5d76e },
    parts: []
  }
];
