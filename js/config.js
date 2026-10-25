/*
  ファイル名 : config.js
  保存場所   : /js
  役割       : すべての調整値とバージョン番号を1か所に集めたファイル
               （数字を書き換えるだけでゲームの調整ができるようにする）
  バージョン : 0.7.2（Phase7 Step7-2）
*/

export const CONFIG = {
  // 画面上中央に表示されるバージョン番号
  VERSION: '0.7.2',

  // ゲームループ
  loop: {
    step: 1 / 60,      // ゲームロジックの計算間隔（秒）。常に1秒60回
    maxSubSteps: 4     // 処理落ち時に1フレームで追いつく最大回数
  },

  // 描画
  render: {
    fov: 65,             // カメラの画角（度）
    near: 0.1,           // カメラが描く一番近い距離（メートル）
    far: 450             // カメラが描く一番遠い距離（メートル）
  },

  // 背景（Environment が使う）
  environment: {
    skyTopColor: 0x3f7fd9,  // 空の真上の色
    horizonColor: 0xd4e9fb, // 地平線の色（フォグの色も同じ）
    fogNear: 60,            // フォグが始まる距離（メートル）
    fogFar: 330,            // フォグで完全に見えなくなる距離
    skyRadius: 380,         // 空の球の大きさ（カメラの far より小さくする）
    sunDirection: { x: 0.45, y: 0.42, z: -0.79 }, // 太陽の方向
    sunDistance: 330,       // 太陽までの距離
    sunSize: 120,           // 太陽の光の大きさ
    cloudHeight: -32,       // 雲海の高さ（メートル）
    cloudSize: 2000,        // 雲海の板の大きさ
    cloudRepeat: 7,         // 雲の画像を何回くり返すか
    cloudSpeed: 0.004,      // 雲が流れる速さ
    farIslandDistance: 360, // 遠景の島までの距離
    islandCount: 26,        // 浮遊島の数（画質lowでは半分）
    islandArea: 420,        // 浮遊島を散らす範囲（コース中心から±メートル）
    islandClearance: 30,    // コースから最低これだけ離す（メートル）
    grassColor: 0x7fbf5a,   // 浮遊島の草の色
    rockColor: 0x8a7563,    // 浮遊島の岩の色
    archSpacing: 34,        // 遺跡のアーチの間隔（メートル）
    archHeight: 12,         // アーチの梁の高さ（飛行ルートの中心から）
    ruinColor: 0xb7a98f,    // 遺跡の石の色
    columnSpacing: 14,      // 神殿の柱の間隔（メートル）
    columnHeight: 11,       // 神殿の柱の高さ
    templeColor: 0xf3eee2   // 神殿の白い石の色
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
    sfxVolume: 0.5,      // 効果音の大きさ
    driftVolume: 0.12    // ドリフトの「シャーッ」の大きさ
  },

  // ---- 粒の演出（Step7-2） ----
  effects: {
    maxParticles: 200,   // 同時に出せる粒の数（多いほど重い）
    size: 0.55,          // 粒の大きさ（メートル）
    backOffset: 0.9,     // ボードの後ろ、どれだけ離れた所から出すか
    driftRate: 40,       // ドリフト中に1秒で出す火花の数（1人あたり）
    boostRate: 45,       // ブースト中に1秒で出す炎の数（1人あたり）
    sparkLife: 0.35,     // 火花が消えるまでの秒数
    flameLife: 0.3,      // 炎が消えるまでの秒数
    burstLife: 0.5,      // パッと散る粒が消えるまでの秒数
    turboBurst: 16,      // ミニターボで一度に散らす数
    ringBurst: 20,       // リングを通ったときに一度に散らす数
    gravity: 6           // 粒が下に落ちる強さ
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
    maxSpeedPerStat: 0.6,// 最高速の能力値1段階あたりの差（1.5 → 1.0 → 0.6 に縮小）
    baseAccel: 8,        // 加速の強さ（メートル/秒毎秒）。能力値3のとき
    accelPerStat: 2.5,   // 加速の能力値1段階あたりの差（Step4-2で2から拡大）
    baseTurnRate: 1.5,   // 曲がる速さ（ラジアン/秒）。能力値3のとき
    turnPerStat: 0.15,   // 旋回の能力値1段階あたりの差
    minTurnSpeed: 8,     // この速さ未満では曲がる力が弱まる（その場で回転しないため）
    maxAngle: 1.2,       // コースの向きに対して曲がれる最大の角度（ラジアン）
    drag: 6,             // アクセルより速いときの自然な減速（メートル/秒毎秒）
    brakeDecel: 20,      // ブレーキの強さ（メートル/秒毎秒）
    wallMargin: 0.8,     // 道の端から何メートル内側を壁とするか
    wallFriction: 1.5,   // 壁にこすれている間の減速の強さ
    wallAngleKeep: 0.3,  // 壁に当たったとき、壁に向かう角度をどれだけ残すか（0〜1）
    fallMargin: 1.0,     // 柵のない端で、道幅から何メートル外に出たら落ちるか
    gravity: 20,         // 落下の速さ（メートル/秒毎秒）
    fallTime: 0.8,       // 落ちていく様子を見せる時間（秒）
    respawnTime: 1.5,    // 落ちてから復帰するまでの時間（秒）
    respawnBack: 10,     // 落ちた場所の何メートル手前に戻すか
    respawnSpeed: 0.5,   // 復帰したときの速さ（最高速の何倍）
    respawnBlink: 1.0,   // 復帰直後に点滅する時間（秒）
    climbRate: 7,        // 空中で上下する速さ（メートル/秒）。飛行の能力3のとき
    climbPerStat: 0.15,  // 飛行の能力1段階あたりの上下の速さの差（割合）
    airSpeedPerStat: 0.025, // 飛行の能力1段階あたりの空中での最高速の差（割合）
    pitchResponse: 4,    // 上下の入力への反応の速さ（大きいほどキビキビ）
    landingAssist: 30,   // 地上区間の何メートル手前から高さを路面に寄せるか
    landingPull: 3,      // 着地アシストの強さ
    driftMinSpeed: 15,   // この速さ（メートル/秒）以上でないとドリフトできない
    driftStartSteer: 0.35, // ドリフトを始めるのに必要な旋回の強さ（0〜1）
    driftBaseTurn: 0.75, // ドリフト中の基本の曲がり（旋回入力なしのとき）
    driftSteerRange: 0.4,// 旋回入力でドリフトの曲がりを変えられる幅
    driftTurnScale: 1.35,// ドリフト中の曲がる力の倍率
    driftSlide: 1.5,     // ドリフト中に外側へ滑る速さ（メートル/秒）
    driftSpeedScale: 0.97, // ドリフト中の最高速の倍率
    driftLevel1: 0.5,    // 青い火花になるまでの溜め（秒。ドリフトの能力3のとき）
    driftLevel2: 1.1,    // オレンジの火花になるまでの溜め
    driftChargePerStat: 0.3, // ドリフトの能力1段階あたりの溜まる速さの差（割合）
    turboTime1: 0.6,     // 青のミニターボの時間（秒）
    turboTime2: 1.1,     // オレンジのミニターボの時間（秒）
    turboPerStat: 0.2,   // ドリフトの能力1段階あたりのミニターボの長さの差（割合）
    boostMultiplier: 1.35,// ブースト中の最高速の倍率
    boostAccel: 20,      // ブースト中の加速の強さ
    buttonBoostTime: 1.2,// ブーストボタン1回で加速する時間（秒）
    gaugeCost: 1,        // ブーストボタン1回で使うゲージ（満タン = 1）
    gaugeRegen: 0        // ゲージの自然回復（1秒あたり）。Step6-2から0（リングで溜める）
  },

  // レース
  race: {
    racerCount: 6,       // レーサーの人数（プレイヤー含む）
    laps: 3,             // 周回数
    countdownTime: 3,    // カウントダウンの長さ（秒）
    startDashWindow: 0.5,// GOの何秒前までにブーストを押すとスタートダッシュ成功か
    startDashTime: 1.2,  // スタートダッシュの加速時間（秒）
    cpuDashChance: 0.6,  // CPUのスタートダッシュ成功率（腕前を掛ける）
    resultMinWait: 3,    // 自分のゴールから結果表を出すまでの最短時間（秒）
    resultMaxWait: 10,   // 全員のゴールを待つ最長時間（秒）
    playerGridSlot: 3,   // プレイヤーのスタート位置（0 = 先頭。3 = 4番手）
    gridFront: 6,        // 先頭がスタートラインの何メートル後ろに並ぶか
    gridRowGap: 7,       // 列と列の間隔（メートル）
    gridSideOffset: 3.5  // 左右の列が中心から何メートル離れるか
  },

  // 空中のリング（Rings が使う）
  rings: {
    radius: 3.0,         // リングの大きさ（半径・メートル）
    tube: 0.6,           // リングの太さ（Step6-3で0.35から太く）
    glowTube: 1.3,       // 光のにじみの太さ
    glowOpacity: 0.35,   // 光のにじみの濃さ
    hitSize: 3.0,        // 中心から上下左右にこの距離以内を通れば取れる（メートル）
    gaugeAmount: 0.25,   // 青いリング1つで溜まるゲージ（満タン = 1）
    boostTime: 1.0,      // 金のリングのブースト時間（秒）
    startGauge: 0,       // レース開始時のゲージ
    gaugeColor: 0x1f7bff,// 青いリングの色（空に溶けないよう濃い青に）
    boostColor: 0xffb000 // 金のリングの色（濃い金に）
  },

  // レーサー同士の押し合い（Collision が使う）
  collision: {
    alongSize: 1.8,      // 前後にこの距離より近いと接触（メートル）
    sideSize: 1.3,       // 左右にこの距離より近いと接触（メートル）
    heightSize: 1.5,     // 上下にこの距離より近いと接触（メートル）
    rearEndRatio: 0.6,   // 左右のずれがこの割合より小さいと「追突」とみなす
    rearSlow: 0.6,       // 追突したとき、後ろの人が失う速さの差の割合
    frontPush: 0.3       // 追突されたとき、前の人がもらう速さの差の割合
  },

  // CPUの追い上げ補正（設計書2-8章）
  rubberBand: {
    range: 100,          // プレイヤーとの差がこの距離で補正が最大になる（メートル）
    maxSlow: 0.08,       // 前にいるCPUの最高速を最大何割下げるか（8％）
    maxFast: 0.08        // 後ろにいるCPUの最高速を最大何割上げるか（8％）
  },

  // CPUの思考（AIController が使う）
  ai: {
    lookAheadBase: 6,    // 何メートル先のコースを見るか（基本）
    lookAheadTime: 0.35, // 速さ×この秒数ぶん、さらに先を見る
    lineSpread: 0.45,    // 好きな走行位置の広がり（道幅の半分に対する割合）
    insideGain: 40,      // カーブの内側へ寄る反応の強さ
    insideAmount: 0.4,   // カーブの内側へ寄る量（道幅の半分に対する割合）
    openEdgeMargin: 3.5, // 柵のない所で端から離れる距離（メートル）
    wallEdgeMargin: 1.5, // 柵のある所で端から離れる距離（メートル）
    wobble: 2.0,         // 腕前が低いときのふらつきの幅（メートル）
    steerToLine: 0.12,   // 走行ラインへ戻ろうとする強さ
    steerToAngle: 2.2,   // 向きのずれを直そうとする強さ
    steerToCurve: 12,    // 先のカーブに合わせて曲がり始める強さ
    straightCurvature: 0.006, // これより曲がりがゆるければ「まっすぐ」とみなす
    boostDelay: 0.8,     // ブーストを使えるようになってから使うまでの迷い（秒）
    pitchToHeight: 0.35, // 空中で好きな高さへ戻ろうとする強さ
    pitchDamping: 0.12,  // 上下の動きを落ち着かせる強さ
    ringLookAhead: 70,   // 何メートル先までのリングを狙うか
    ringAimChance: 0.85, // リングを狙う確率（腕前を掛ける）
    driftCurvature: 0.02,// この曲がり具合（1/半径）より急なカーブでドリフトする（半径50 m以下）
    driftChance: 0.9,    // ドリフトする確率（腕前を掛ける。カーブごとに決める）
    // CPU5人の性格（lineOffset: 好きな走行位置 -1=左〜1=右、skill: 腕前 0〜1）
    personalities: [
      { lineOffset: -0.6, skill: 0.92, heightBias: 3 },
      { lineOffset: 0.5, skill: 0.88, heightBias: -3 },
      { lineOffset: 0.0, skill: 0.9, heightBias: 6 },
      { lineOffset: -0.2, skill: 0.86, heightBias: 0 },
      { lineOffset: 0.7, skill: 0.88, heightBias: -1 }
    ]
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
