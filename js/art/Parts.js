/*
  ファイル名 : Parts.js
  保存場所   : /js/art
  役割       : キャラクターごとの小物（帽子・羽・盾など）のドット絵データ。
               PixelArt.js が、共通の体の絵の上（または後ろ）に重ねて描く
  バージョン : 0.8.2（Phase8 Step8-2）

  データの読み方
    ・絵は32×32マス。体の絵（24×24）は、左から4マス・上から8マスの位置に置かれる
      （上と左右に空きを作り、帽子や羽がはみ出せるようにしている）
    ・1つの小物は [行, 列, 絵の行の並び, 重ね方] で書く
        行・列   : 絵の左上をどのマスに置くか（0〜31）
        重ね方   : 'over' = 体の上に描く / 'under' = 体の後ろに描く（体がない所だけ塗る）
    ・絵の文字：'.' は何もしない。それ以外は PixelArt.js と同じ文字か、
      各キャラの colors で決めた文字（x, y など）
    ・向きは5種類（back 後ろ / backDiag 斜め後ろ / side 横 / frontDiag 斜め前 / front 正面）。
      斜めと横は「右を向いた絵」で書く（左向きは自動で左右反転される）
*/

export const PARTS = {
  // ナイト：かぶとの羽根飾り・顔をおおう面・背中の盾
  knight: {
    colors: { x: 0xd63c3c, y: 0x8e2424 },
    // 後ろ
    back: [
      [4, 15, ['kk', 'kxxk', 'kxyk', 'kxyk', 'kxyk'], 'over'],
      [17, 13, ['kkkkkk', 'kmaamk', 'kaaaak', 'kmaamk', 'kmaamk', '.kmmk.', '..kk..'], 'over']
    ],
    // 斜め後ろ
    backDiag: [
      [4, 14, ['.kk', 'kxxk', 'kyxk', 'kyxk', 'kyxk'], 'over'],
      [13, 18, ['h', 'h'], 'over'],
      [17, 11, ['kkkkk', 'kmamk', 'kaaak', 'kmamk', '.kmk.', '..k..'], 'over']
    ],
    // 横
    side: [
      [4, 12, ['kkk..', 'kxxxk', '.kyxxk', '..kyxk', '...kyk'], 'over'],
      [11, 18, ['h'], 'over'],
      [12, 16, ['hhh', 'kkk', 'hhh'], 'over'],
      [15, 16, ['hh'], 'over'],
      [17, 10, ['kk', 'kak', 'kak', 'kak', 'kk'], 'under']
    ],
    // 斜め前
    frontDiag: [
      [4, 15, ['kk', 'kxxk', 'kxyk', 'kxyk', 'kxyk'], 'under'],
      [12, 15, ['hhhh', 'hkkk', 'hhhh'], 'over'],
      [14, 13, ['hh'], 'over'],
      [15, 14, ['hhhh'], 'over']
    ],
    // 正面
    front: [
      [4, 15, ['kk', 'kxxk', 'kxyk', 'kxyk', 'kxyk'], 'under'],
      [12, 13, ['hhhhhh', 'hkkkkh', 'hhhhhh'], 'over'],
      [15, 14, ['hhhh'], 'over']
    ]
  },
  // ウィッチ：とんがり帽子（先が後ろへ折れる）
  witch: {
    colors: { x: 0x3b2a63 },
    // 後ろ
    back: [
      [1, 19, ['kk'], 'over'],
      [2, 18, ['kxk'], 'over'],
      [3, 17, ['kxk'], 'over'],
      [4, 16, ['kxxk'], 'over'],
      [5, 15, ['kxxxk'], 'over'],
      [6, 15, ['kxxxk'], 'over'],
      [7, 14, ['kxxxxk'], 'over'],
      [8, 13, ['kxxxxxk'], 'over'],
      [9, 12, ['kaaaaaak'], 'over'],
      [10, 9, ['kkxxxxxxxxxxkk'], 'over'],
      [11, 10, ['kkkkkkkkkkkk'], 'over']
    ],
    // 斜め後ろ
    backDiag: [
      [1, 19, ['kk'], 'over'],
      [2, 18, ['kxk'], 'over'],
      [3, 17, ['kxk'], 'over'],
      [4, 16, ['kxxk'], 'over'],
      [5, 15, ['kxxxk'], 'over'],
      [6, 15, ['kxxxk'], 'over'],
      [7, 14, ['kxxxxk'], 'over'],
      [8, 13, ['kxxxxxk'], 'over'],
      [9, 12, ['kaaaaaak'], 'over'],
      [10, 9, ['kkxxxxxxxxxxkk'], 'over'],
      [11, 10, ['kkkkkkkkkkkk'], 'over']
    ],
    // 横
    side: [
      [1, 11, ['kk'], 'over'],
      [2, 11, ['kxk'], 'over'],
      [3, 12, ['kxk'], 'over'],
      [4, 12, ['kxxk'], 'over'],
      [5, 12, ['kxxxk'], 'over'],
      [6, 12, ['kxxxk'], 'over'],
      [7, 12, ['kxxxxk'], 'over'],
      [8, 12, ['kxxxxxk'], 'over'],
      [9, 12, ['kaaaaaak'], 'over'],
      [10, 9, ['kkxxxxxxxxxxkk'], 'over'],
      [11, 10, ['kkkkkkkkkkkk'], 'over']
    ],
    // 斜め前
    frontDiag: [
      [1, 11, ['kk'], 'over'],
      [2, 11, ['kxk'], 'over'],
      [3, 12, ['kxk'], 'over'],
      [4, 12, ['kxxk'], 'over'],
      [5, 12, ['kxxxk'], 'over'],
      [6, 12, ['kxxxk'], 'over'],
      [7, 12, ['kxxxxk'], 'over'],
      [8, 12, ['kxxxxxk'], 'over'],
      [9, 12, ['kaaaaaak'], 'over'],
      [10, 9, ['kkxxxxxxxxxxkk'], 'over'],
      [11, 10, ['kkkkkkkkkkkk'], 'over']
    ],
    // 正面
    front: [
      [1, 19, ['kk'], 'over'],
      [2, 18, ['kxk'], 'over'],
      [3, 17, ['kxk'], 'over'],
      [4, 16, ['kxxk'], 'over'],
      [5, 15, ['kxxxk'], 'over'],
      [6, 15, ['kxxxk'], 'over'],
      [7, 14, ['kxxxxk'], 'over'],
      [8, 13, ['kxxxxxk'], 'over'],
      [9, 12, ['kaaaaaak'], 'over'],
      [10, 9, ['kkxxxxxxxxxxkk'], 'over'],
      [11, 10, ['kkkkkkkkkkkk'], 'over']
    ]
  },
  // ローグ：赤いスカーフ（後ろへなびく）・口元の覆面
  rogue: {
    colors: {  },
    // 後ろ
    back: [
      [16, 13, ['aaaaaa'], 'over'],
      [17, 18, ['kaak', '.kaak', '..kak', '...k'], 'over']
    ],
    // 斜め後ろ
    backDiag: [
      [16, 13, ['aaaaaa'], 'over'],
      [16, 8, ['kkaaa', 'kaak', 'kaak.', 'kak..', '.k...'], 'over']
    ],
    // 横
    side: [
      [14, 16, ['aaa', 'aa'], 'over'],
      [16, 14, ['aaaa'], 'over'],
      [15, 5, ['...kkk', 'kkaaaa', 'kaaak.', '.kaak.', '..kk..'], 'over']
    ],
    // 斜め前
    frontDiag: [
      [14, 14, ['aaaaa', 'aaaa'], 'over'],
      [16, 14, ['aaaa'], 'over'],
      [16, 6, ['..kk', 'kkaak', 'kaak', 'kak', 'k'], 'under']
    ],
    // 正面
    front: [
      [14, 13, ['aaaaaa', '.aaaa.'], 'over'],
      [16, 13, ['aaaaaa'], 'over']
    ]
  },
  // フェアリー：透きとおった羽・触角
  fairy: {
    colors: { x: 0xc4f1ff, y: 0x2f8fbf },
    // 後ろ
    back: [
      [11, 4, ['yyy'], 'over'],
      [12, 3, ['yxxxy'], 'over'],
      [13, 2, ['yxxxxyy'], 'over'],
      [14, 2, ['yxxxxxxyy'], 'over'],
      [15, 3, ['yxxxxxxxyy'], 'over'],
      [16, 4, ['yyxxxxxxxy'], 'over'],
      [17, 6, ['yyxxxy'], 'over'],
      [18, 5, ['yxxxxy'], 'over'],
      [19, 4, ['yxxxxy'], 'over'],
      [20, 4, ['yxxy'], 'over'],
      [21, 5, ['yy'], 'over'],
      [11, 25, ['yyy'], 'over'],
      [12, 24, ['yxxxy'], 'over'],
      [13, 23, ['yyxxxxy'], 'over'],
      [14, 21, ['yyxxxxxxy'], 'over'],
      [15, 19, ['yyxxxxxxxy'], 'over'],
      [16, 18, ['yxxxxxxxyy'], 'over'],
      [17, 20, ['yxxxyy'], 'over'],
      [18, 21, ['yxxxxy'], 'over'],
      [19, 22, ['yxxxxy'], 'over'],
      [20, 24, ['yxxy'], 'over'],
      [21, 25, ['yy'], 'over'],
      [6, 13, ['y'], 'over'],
      [7, 14, ['y'], 'over'],
      [6, 18, ['y'], 'over'],
      [7, 17, ['y'], 'over']
    ],
    // 斜め後ろ
    backDiag: [
      [11, 3, ['yyy'], 'over'],
      [12, 2, ['yxxxy'], 'over'],
      [13, 1, ['yxxxxyy'], 'over'],
      [14, 1, ['yxxxxxxyy'], 'over'],
      [15, 2, ['yxxxxxxxyy'], 'over'],
      [16, 3, ['yyxxxxxxxy'], 'over'],
      [17, 5, ['yyxxxy'], 'over'],
      [18, 4, ['yxxxxy'], 'over'],
      [19, 3, ['yxxxxy'], 'over'],
      [20, 3, ['yxxy'], 'over'],
      [21, 4, ['yy'], 'over'],
      [11, 25, ['yyy'], 'under'],
      [12, 24, ['yxxxy'], 'under'],
      [13, 23, ['yyxxxxy'], 'under'],
      [14, 21, ['yyxxxxxxy'], 'under'],
      [15, 19, ['yyxxxxxxxy'], 'under'],
      [16, 18, ['yxxxxxxxyy'], 'under'],
      [17, 20, ['yxxxyy'], 'under'],
      [18, 21, ['yxxxxy'], 'under'],
      [19, 22, ['yxxxxy'], 'under'],
      [20, 24, ['yxxy'], 'under'],
      [21, 25, ['yy'], 'under'],
      [6, 13, ['y'], 'over'],
      [7, 14, ['y'], 'over'],
      [6, 18, ['y'], 'over'],
      [7, 17, ['y'], 'over']
    ],
    // 横
    side: [
      [11, 6, ['yyy'], 'under'],
      [12, 5, ['yxxxy'], 'under'],
      [13, 4, ['yxxxxyy'], 'under'],
      [14, 4, ['yxxxxxxyy'], 'under'],
      [15, 5, ['yxxxxxxxyy'], 'under'],
      [16, 6, ['yyxxxxxxxy'], 'under'],
      [17, 8, ['yyxxxy'], 'under'],
      [18, 7, ['yxxxxy'], 'under'],
      [19, 6, ['yxxxxy'], 'under'],
      [20, 6, ['yxxy'], 'under'],
      [21, 7, ['yy'], 'under'],
      [6, 15, ['y'], 'over'],
      [7, 16, ['y'], 'over']
    ],
    // 斜め前
    frontDiag: [
      [11, 4, ['yyy'], 'under'],
      [12, 3, ['yxxxy'], 'under'],
      [13, 2, ['yxxxxyy'], 'under'],
      [14, 2, ['yxxxxxxyy'], 'under'],
      [15, 3, ['yxxxxxxxyy'], 'under'],
      [16, 4, ['yyxxxxxxxy'], 'under'],
      [17, 6, ['yyxxxy'], 'under'],
      [18, 5, ['yxxxxy'], 'under'],
      [19, 4, ['yxxxxy'], 'under'],
      [20, 4, ['yxxy'], 'under'],
      [21, 5, ['yy'], 'under'],
      [11, 25, ['yyy'], 'under'],
      [12, 24, ['yxxxy'], 'under'],
      [13, 23, ['yyxxxxy'], 'under'],
      [14, 21, ['yyxxxxxxy'], 'under'],
      [15, 19, ['yyxxxxxxxy'], 'under'],
      [16, 18, ['yxxxxxxxyy'], 'under'],
      [17, 20, ['yxxxyy'], 'under'],
      [18, 21, ['yxxxxy'], 'under'],
      [19, 22, ['yxxxxy'], 'under'],
      [20, 24, ['yxxy'], 'under'],
      [21, 25, ['yy'], 'under'],
      [6, 13, ['y'], 'over'],
      [7, 14, ['y'], 'over'],
      [6, 18, ['y'], 'over'],
      [7, 17, ['y'], 'over']
    ],
    // 正面
    front: [
      [11, 4, ['yyy'], 'under'],
      [12, 3, ['yxxxy'], 'under'],
      [13, 2, ['yxxxxyy'], 'under'],
      [14, 2, ['yxxxxxxyy'], 'under'],
      [15, 3, ['yxxxxxxxyy'], 'under'],
      [16, 4, ['yyxxxxxxxy'], 'under'],
      [17, 6, ['yyxxxy'], 'under'],
      [18, 5, ['yxxxxy'], 'under'],
      [19, 4, ['yxxxxy'], 'under'],
      [20, 4, ['yxxy'], 'under'],
      [21, 5, ['yy'], 'under'],
      [11, 25, ['yyy'], 'under'],
      [12, 24, ['yxxxy'], 'under'],
      [13, 23, ['yyxxxxy'], 'under'],
      [14, 21, ['yyxxxxxxy'], 'under'],
      [15, 19, ['yyxxxxxxxy'], 'under'],
      [16, 18, ['yxxxxxxxyy'], 'under'],
      [17, 20, ['yxxxyy'], 'under'],
      [18, 21, ['yxxxxy'], 'under'],
      [19, 22, ['yxxxxy'], 'under'],
      [20, 24, ['yxxy'], 'under'],
      [21, 25, ['yy'], 'under'],
      [6, 13, ['y'], 'over'],
      [7, 14, ['y'], 'over'],
      [6, 18, ['y'], 'over'],
      [7, 17, ['y'], 'over']
    ]
  },
  // エンジニア：ゴーグル・背中のエンジン
  engineer: {
    colors: { w: 0xb8c0cc, y: 0x5f6774 },
    // 後ろ
    back: [
      [11, 12, ['kkkkkkkk'], 'over'],
      [14, 19, ['kk', 'kwk'], 'over'],
      [16, 13, ['kkkkkk', 'kwwwwk', 'kwyywk', 'kwyywk', 'kwwwwk', 'kkkkkk'], 'over']
    ],
    // 斜め後ろ
    backDiag: [
      [11, 12, ['kkkkkkkk'], 'over'],
      [10, 17, ['kak'], 'over'],
      [14, 11, ['kk', 'kwk'], 'over'],
      [16, 11, ['kkkkk', 'kwwwk', 'kwywk', 'kwywk', 'kkkkk'], 'over']
    ],
    // 横
    side: [
      [10, 15, ['kkkkkk'], 'over'],
      [11, 16, ['kaak'], 'over'],
      [12, 16, ['kkk'], 'over'],
      [15, 10, ['kk', 'kwk', 'kwk', 'kwk', 'kk'], 'under']
    ],
    // 斜め前
    frontDiag: [
      [10, 13, ['kkkkkkk'], 'over'],
      [11, 14, ['kaakaak'], 'over'],
      [12, 14, ['kkkkkkk'], 'over']
    ],
    // 正面
    front: [
      [10, 12, ['kkkkkkkk'], 'over'],
      [11, 13, ['kaakaak'], 'over'],
      [12, 13, ['kkkkkkk'], 'over']
    ]
  },
  // ドラゴンライダー：角・竜の翼
  dragonrider: {
    colors: { x: 0xf2e6c4, q: 0x8f2a22, r: 0x5a1712 },
    // 後ろ
    back: [
      [7, 10, ['k'], 'over'],
      [8, 9, ['kxk'], 'over'],
      [9, 9, ['kxk'], 'over'],
      [10, 10, ['kxkk'], 'over'],
      [11, 11, ['kk'], 'over'],
      [7, 21, ['k'], 'over'],
      [8, 20, ['kxk'], 'over'],
      [9, 20, ['kxk'], 'over'],
      [10, 18, ['kkxk'], 'over'],
      [11, 19, ['kk'], 'over'],
      [12, 1, ['k'], 'over'],
      [13, 1, ['kk'], 'over'],
      [14, 1, ['kqk'], 'over'],
      [15, 2, ['kqqkk'], 'over'],
      [16, 2, ['kqqqqrk'], 'over'],
      [17, 3, ['kqqqqrk'], 'over'],
      [18, 3, ['kqkqqrk'], 'over'],
      [19, 4, ['k.kqrk'], 'over'],
      [20, 7, ['krk'], 'over'],
      [21, 8, ['k'], 'over'],
      [12, 30, ['k'], 'over'],
      [13, 29, ['kk'], 'over'],
      [14, 28, ['kqk'], 'over'],
      [15, 25, ['kkqqk'], 'over'],
      [16, 23, ['krqqqqk'], 'over'],
      [17, 22, ['krqqqqk'], 'over'],
      [18, 22, ['krqqkqk'], 'over'],
      [19, 22, ['krqk.k'], 'over'],
      [20, 22, ['krk'], 'over'],
      [21, 23, ['k'], 'over']
    ],
    // 斜め後ろ
    backDiag: [
      [7, 11, ['k'], 'over'],
      [8, 10, ['kxk'], 'over'],
      [9, 10, ['kxk'], 'over'],
      [10, 11, ['kxkk'], 'over'],
      [11, 12, ['kk'], 'over'],
      [7, 21, ['k'], 'over'],
      [8, 20, ['kxk'], 'over'],
      [9, 20, ['kxk'], 'over'],
      [10, 18, ['kkxk'], 'over'],
      [11, 19, ['kk'], 'over'],
      [12, 2, ['k'], 'over'],
      [13, 2, ['kk'], 'over'],
      [14, 2, ['kqk'], 'over'],
      [15, 3, ['kqqkk'], 'over'],
      [16, 3, ['kqqqqrk'], 'over'],
      [17, 4, ['kqqqqrk'], 'over'],
      [18, 4, ['kqkqqrk'], 'over'],
      [19, 5, ['k.kqrk'], 'over'],
      [20, 8, ['krk'], 'over'],
      [21, 9, ['k'], 'over'],
      [12, 30, ['k'], 'under'],
      [13, 29, ['kk'], 'under'],
      [14, 28, ['kqk'], 'under'],
      [15, 25, ['kkqqk'], 'under'],
      [16, 23, ['krqqqqk'], 'under'],
      [17, 22, ['krqqqqk'], 'under'],
      [18, 22, ['krqqkqk'], 'under'],
      [19, 22, ['krqk.k'], 'under'],
      [20, 22, ['krk'], 'under'],
      [21, 23, ['k'], 'under']
    ],
    // 横
    side: [
      [7, 11, ['kk'], 'over'],
      [8, 10, ['kxxk'], 'over'],
      [9, 11, ['kxk'], 'over'],
      [10, 12, ['kk'], 'over'],
      [12, 4, ['k'], 'under'],
      [13, 4, ['kk'], 'under'],
      [14, 4, ['kqk'], 'under'],
      [15, 5, ['kqqkk'], 'under'],
      [16, 5, ['kqqqqrk'], 'under'],
      [17, 6, ['kqqqqrk'], 'under'],
      [18, 6, ['kqkqqrk'], 'under'],
      [19, 7, ['k.kqrk'], 'under'],
      [20, 10, ['krk'], 'under'],
      [21, 11, ['k'], 'under']
    ],
    // 斜め前
    frontDiag: [
      [7, 10, ['k'], 'over'],
      [8, 9, ['kxk'], 'over'],
      [9, 9, ['kxk'], 'over'],
      [10, 10, ['kxkk'], 'over'],
      [11, 11, ['kk'], 'over'],
      [7, 21, ['k'], 'over'],
      [8, 20, ['kxk'], 'over'],
      [9, 20, ['kxk'], 'over'],
      [10, 18, ['kkxk'], 'over'],
      [11, 19, ['kk'], 'over'],
      [12, 1, ['k'], 'under'],
      [13, 1, ['kk'], 'under'],
      [14, 1, ['kqk'], 'under'],
      [15, 2, ['kqqkk'], 'under'],
      [16, 2, ['kqqqqrk'], 'under'],
      [17, 3, ['kqqqqrk'], 'under'],
      [18, 3, ['kqkqqrk'], 'under'],
      [19, 4, ['k.kqrk'], 'under'],
      [20, 7, ['krk'], 'under'],
      [21, 8, ['k'], 'under'],
      [12, 30, ['k'], 'under'],
      [13, 29, ['kk'], 'under'],
      [14, 28, ['kqk'], 'under'],
      [15, 25, ['kkqqk'], 'under'],
      [16, 23, ['krqqqqk'], 'under'],
      [17, 22, ['krqqqqk'], 'under'],
      [18, 22, ['krqqkqk'], 'under'],
      [19, 22, ['krqk.k'], 'under'],
      [20, 22, ['krk'], 'under'],
      [21, 23, ['k'], 'under']
    ],
    // 正面
    front: [
      [7, 10, ['k'], 'over'],
      [8, 9, ['kxk'], 'over'],
      [9, 9, ['kxk'], 'over'],
      [10, 10, ['kxkk'], 'over'],
      [11, 11, ['kk'], 'over'],
      [7, 21, ['k'], 'over'],
      [8, 20, ['kxk'], 'over'],
      [9, 20, ['kxk'], 'over'],
      [10, 18, ['kkxk'], 'over'],
      [11, 19, ['kk'], 'over'],
      [12, 1, ['k'], 'under'],
      [13, 1, ['kk'], 'under'],
      [14, 1, ['kqk'], 'under'],
      [15, 2, ['kqqkk'], 'under'],
      [16, 2, ['kqqqqrk'], 'under'],
      [17, 3, ['kqqqqrk'], 'under'],
      [18, 3, ['kqkqqrk'], 'under'],
      [19, 4, ['k.kqrk'], 'under'],
      [20, 7, ['krk'], 'under'],
      [21, 8, ['k'], 'under'],
      [12, 30, ['k'], 'under'],
      [13, 29, ['kk'], 'under'],
      [14, 28, ['kqk'], 'under'],
      [15, 25, ['kkqqk'], 'under'],
      [16, 23, ['krqqqqk'], 'under'],
      [17, 22, ['krqqqqk'], 'under'],
      [18, 22, ['krqqkqk'], 'under'],
      [19, 22, ['krqk.k'], 'under'],
      [20, 22, ['krk'], 'under'],
      [21, 23, ['k'], 'under']
    ]
  }
};
