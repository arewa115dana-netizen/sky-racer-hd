/*
  ファイル名 : observatoryData.js
  保存場所   : /js/courses
  役割       : 星空の天文塔コースの形とリング（データのみ。書き方は CourseData.js と同じ）
  バージョン : 1.16.0（Phase16 Step16-1）

  区間
    gate    … 星見の広場（スタート。地上・柵あり）
    spiral  … らせんの坂（地上・柵あり。天文塔のまわりを1周と少し、ぐるっと上る）
    crystal … 水晶の橋（地上・柵なし。塔のてっぺんから外へ延びる光る橋）
    stars   … 星の海（空中。下りながら大きく回る）
    comet   … 彗星の道（地上・柵あり。下り坂で広場へ戻る）
  天文塔の中心は (0, 160)。らせんの半径は 62
*/

export const TOWER = { x: 0, z: 160, r: 62 };

// らせんの坂の制御点：塔の南（-90度）から、左回りに 1周＋90度、高さ 2 → 42 まで上る
function spiralPoints() {
  const list = [];
  const steps = 10;
  const start = -Math.PI / 2;
  const total = Math.PI * 2 + Math.PI / 2;
  for (let k = 1; k <= steps; k += 1) {
    const t = k / steps;
    const a = start + total * t;
    list.push({
      x: TOWER.x + Math.cos(a) * TOWER.r,
      y: 2 + 40 * t,
      z: TOWER.z + Math.sin(a) * TOWER.r,
      width: 13, zone: 'ground', edge: 'wall', area: 'spiral'
    });
  }
  return list;
}

export const OBSERVATORY = {
  name: '星空の天文塔',
  sectors: 8,
  points: [
    // 1 星見の広場（スタート）
    { x: 0,    y: 0,  z: -30,  width: 16, zone: 'ground', edge: 'wall', area: 'gate' },
    { x: 0,    y: 0,  z: 40,   width: 16, zone: 'ground', edge: 'wall', area: 'gate' },
    { x: 0,    y: 1,  z: 80,   width: 14, zone: 'ground', edge: 'wall', area: 'gate' },
    // 2 らせんの坂（塔のまわりを上る）
    ...spiralPoints(),
    // らせんの出口（柵あり。まっすぐにしてから橋へ出る）
    { x: 68,   y: 42, z: 196,  width: 13, zone: 'ground', edge: 'wall', area: 'spiral' },
    // 3 水晶の橋（柵なし。塔から東へ）
    { x: 104,  y: 42, z: 222,  width: 12, zone: 'ground', edge: 'open', area: 'crystal' },
    { x: 152,  y: 41, z: 214,  width: 12, zone: 'ground', edge: 'open', area: 'crystal' },
    { x: 190,  y: 40, z: 168,  width: 12, zone: 'ground', edge: 'open', area: 'crystal' },
    // 4 星の海（空中。下りながら大きく回る）
    { x: 214,  y: 36, z: 92,   width: 26, zone: 'air', area: 'stars', yMin: -10, yMax: 12 },
    { x: 234,  y: 29, z: 14,   width: 28, zone: 'air', area: 'stars', yMin: -10, yMax: 14 },
    { x: 218,  y: 22, z: -64,  width: 28, zone: 'air', area: 'stars', yMin: -10, yMax: 14 },
    { x: 166,  y: 16, z: -122, width: 28, zone: 'air', area: 'stars', yMin: -10, yMax: 12 },
    { x: 104,  y: 11, z: -146, width: 22, zone: 'air', area: 'stars', yMin: -6, yMax: 10 },
    // 5 彗星の道（下り坂で広場へ）
    { x: 52,   y: 7,  z: -138, width: 15, zone: 'ground', edge: 'wall', area: 'comet' },
    { x: 20,   y: 4,  z: -112, width: 15, zone: 'ground', edge: 'wall', area: 'comet' },
    { x: 6,    y: 2,  z: -78,  width: 16, zone: 'ground', edge: 'wall', area: 'gate' }
  ],
  rings: [
    // 星の海：星座のように、上下左右に散らばったリング
    { area: 'stars', at: 0.1,  x: -6, y: -4, type: 'gauge' },
    { area: 'stars', at: 0.1,  x: 6,  y: 8,  type: 'gauge' },
    { area: 'stars', at: 0.26, x: 0,  y: 10, type: 'boost' },
    { area: 'stars', at: 0.26, x: 0,  y: -6, type: 'gauge' },
    { area: 'stars', at: 0.42, x: -8, y: 2,  type: 'gauge' },
    { area: 'stars', at: 0.42, x: 8,  y: 2,  type: 'gauge' },
    { area: 'stars', at: 0.58, x: 0,  y: 10, type: 'boost' },
    { area: 'stars', at: 0.58, x: 0,  y: -6, type: 'gauge' },
    { area: 'stars', at: 0.74, x: -6, y: -4, type: 'gauge' },
    { area: 'stars', at: 0.74, x: 6,  y: 8,  type: 'gauge' },
    { area: 'stars', at: 0.9,  x: 0,  y: 4,  type: 'boost' }
  ]
};
