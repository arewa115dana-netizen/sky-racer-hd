/*
  ファイル名 : config.js
  保存場所   : /js
  役割       : すべての調整値とバージョン番号を1か所に集めたファイル
               （数字を書き換えるだけでゲームの調整ができるようにする）
  バージョン : 0.3.1（Phase3 Step3-1）
*/

export const CONFIG = {
  // 画面上中央に表示されるバージョン番号
  VERSION: '0.3.1',

  // ゲームループ
  loop: {
    step: 1 / 60,      // ゲームロジックの計算間隔（秒）。常に1秒60回
    maxSubSteps: 4     // 処理落ち時に1フレームで追いつく最大回数
  },

  // 描画
  render: {
    fov: 65,             // カメラの画角（度）
    near: 0.1,           // カメラが描く一番近い距離（メートル）
    far: 400,            // カメラが描く一番遠い距離（メートル）
    skyColor: 0x8ec5ff,  // 空の色
    fogNear: 40,         // フォグが始まる距離
    fogFar: 220          // フォグで完全に見えなくなる距離
  },

  // 画質（描画解像度は「端末の画素密度」と下の上限の小さい方）
  quality: {
    ratioHigh: 1.5,      // 画質high（PC）の描画解像度の上限
    ratioMid: 1.25,      // 画質mid（性能の高いスマホ）の上限
    ratioLow: 1.0,       // 画質low（それ以外のスマホ）の上限
    minScale: 0.6,       // 自動調整で下げる解像度の下限（元の60%まで）
    downFps: 50,         // 平均FPSがこれを下回ったら解像度を下げる
    upFps: 57,           // 平均FPSがこれ以上の状態が続いたら解像度を戻す
    sampleSeconds: 2,    // 何秒ごとに平均FPSを判定するか
    upHoldSeconds: 4,    // 余裕のある状態が何秒続いたら戻すか
    stepDown: 0.1,       // 1回に下げる割合
    stepUp: 0.05,        // 1回に戻す割合
    powerSave: false,    // 省電力モード（30FPS）で始めるか
    powerSaveFps: 30     // 省電力モードの描画回数（1秒あたり）
  },

  // サウンド
  audio: {
    masterVolume: 0.6,   // 全体の音量（0〜1）
    engineVolume: 0.08,  // エンジン音の大きさ
    sfxVolume: 0.5       // 効果音の大きさ
  },

  // 入力
  input: {
    stickRadius: 60,     // 指を何ピクセル動かすと最大の旋回・上下になるか
    deadZone: 0.12       // 指のわずかなブレを無視する範囲（0〜1）
  },

  // デバッグ表示
  debug: {
    show: true,          // 左上の情報表示を出すか
    interval: 0.5,       // 情報表示の更新間隔（秒）
    maxLogs: 3           // 情報表示に残すメッセージの数
  },

  // レーサーの物理（能力値3を基準に、1段階ごとに増減する）
  racer: {
    baseMaxSpeed: 26,    // 最高速（メートル/秒）。能力値3のとき
    maxSpeedPerStat: 1.5,// 最高速の能力値1段階あたりの差
    baseAccel: 8,        // 加速の強さ（メートル/秒毎秒）。能力値3のとき
    accelPerStat: 2,     // 加速の能力値1段階あたりの差
    baseTurnRate: 1.5,   // 曲がる速さ（ラジアン/秒）。能力値3のとき
    turnPerStat: 0.15,   // 旋回の能力値1段階あたりの差
    minTurnSpeed: 8,     // この速さ未満では曲がる力が弱まる（その場で回転しないため）
    maxAngle: 1.2,       // コースの向きに対して曲がれる最大の角度（ラジアン）
    drag: 6,             // アクセルより速いときの自然な減速（メートル/秒毎秒）
    brakeDecel: 20,      // ブレーキの強さ（メートル/秒毎秒）
    wallMargin: 0.8,     // 道の端から何メートル内側を壁とするか
    wallFriction: 1.5,   // 壁にこすれている間の減速の強さ
    wallAngleKeep: 0.3,  // 壁に当たったとき、壁に向かう角度をどれだけ残すか（0〜1）
    boostMultiplier: 1.35,// ブースト中の最高速の倍率
    boostAccel: 20,      // ブースト中の加速の強さ
    buttonBoostTime: 1.2,// ブーストボタン1回で加速する時間（秒）
    gaugeCost: 1,        // ブーストボタン1回で使うゲージ（満タン = 1）
    gaugeRegen: 0.2      // ゲージの自然回復（1秒あたり）※Phase2の試走用。Phase6で0にしてリングで溜める
  },

  // コースの見た目（CourseBuilder が使う）
  course: {
    stripeLength: 4,     // 路面と縁石の明暗の縞の長さ（メートル）。スピード感を出す
    stripeShade: 0.92,   // 縞の暗い方の明るさ（1 = 同じ）
    curbWidth: 0.8,      // 縁石の幅（メートル）
    curbLight: 0xf1e9d6, // 縁石の明るい色
    curbDark: 0xb5543c,  // 縁石の暗い色
    roadColors: {        // 区間ごとの路面の色
      start: 0xb89b72,   // 浮遊島：土
      corridor: 0x9a958c,// 空中回廊：石橋
      temple: 0xe6dfcf,  // 天空神殿：白い石
      default: 0xa8a090
    },
    rockColor: 0x7d6a58, // 浮遊島の岩肌の色
    rockDepth: {         // 路面の下の岩の深さ（メートル）
      start: 14,
      corridor: 3,
      temple: 10,
      default: 8
    },
    railSpacing: 4,      // 柵の杭の間隔（メートル）
    railHeight: 1.0,     // 柵の高さ（メートル）
    railColor: 0xe8e1d0, // 柵の色
    lanternSpacing: 40,  // 空中ルートの灯籠の間隔（メートル）
    lanternColor: 0xffd27a // 灯籠の色
  },

  // キャラクターのドット絵
  sprite: {
    size: 2.6,           // 絵の大きさ（メートル。24マスの絵をこの大きさで表示）
    lift: 0,             // 絵を路面からどれだけ浮かせるか（メートル）
    hover: 0.06,         // ボードがふわふわ上下する幅（メートル）
    hoverSpeed: 6,       // ふわふわの速さ
    leanThreshold: 0.3,  // この強さ以上の旋回入力で、傾いた絵に切り替える
    shadowWidth: 2.0,    // 足元の影の横幅（メートル）
    shadowDepth: 1.2     // 足元の影の奥行き（メートル）
  },

  // 追従カメラ
  camera: {
    distance: 8.5,       // レーサーの後ろ何メートルにいるか（止まっているとき）
    distanceAtSpeed: 1.5,// 最高速のときに追加で下がる距離（メートル）
    height: 3.6,         // レーサーより何メートル上にいるか
    lookAhead: 6,        // レーサーの何メートル先を見るか
    lookHeight: 1.2,     // 見る点の高さ
    yawFollow: 5,        // 向きを追いかける速さ（大きいほどピッタリ、小さいほどゆったり）
    heightFollow: 6,     // 高さを追いかける速さ
    fovSpeed: 6,         // 最高速のときに広がる画角（度）
    fovBoost: 10,        // ブースト中にさらに広がる画角（度）
    fovFollow: 4         // 画角が変わる速さ
  }
};
