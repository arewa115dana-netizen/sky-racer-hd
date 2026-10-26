/*
  ファイル名 : GrandPrix.js
  保存場所   : /js/systems
  役割       : グランプリ（カップ）の進み具合と得点。何コースかを続けて走り、順位に応じたポイントの合計で競う
                 順位のポイント … 1位 10 / 2位 8 / 3位 6 / 4位 4 / 5位 2 / 6位 1
               カップを最後まで走ったら、自分の総合順位をスマホに保存する（3位以内ならトロフィー）
  バージョン : 1.17.0（Phase17 Step17-2）
  メモ       : 得点はキャラクターごとに数える（CPUのキャラは、どのレースでも同じ顔ぶれ）
*/

import { CHARACTERS } from '../entities/Characters.js';

export const POINTS = [10, 8, 6, 4, 2, 1];

export class GrandPrix {
  /**
   * @param {object} cup カップ（Courses.js の CUPS の1つ）
   * @param {number} playerCharIndex 自分のキャラ番号
   */
  constructor(cup, playerCharIndex) {
    this.cup = cup;
    this.playerCharIndex = playerCharIndex;
    this.raceIndex = 0;                  // 今、何レース目か（0から）
    this.points = new Map();             // キャラ番号 → 合計ポイント
    this.lastGained = new Map();         // キャラ番号 → 直前のレースで取ったポイント
    this.recorded = false;               // 今のレースの得点を数えたか
  }

  get raceCount() { return this.cup.courses.length; }
  get courseId() { return this.cup.courses[this.raceIndex]; }
  get isLastRace() { return this.raceIndex >= this.raceCount - 1; }

  // 次のレースへ（最後のレースが終わっていたら false）
  next() {
    if (this.isLastRace) return false;
    this.raceIndex += 1;
    this.recorded = false;
    return true;
  }

  // レースをやり直すとき（まだ得点を数えていなければ、そのまま同じレース）
  retry() {
    this.recorded = false;
  }

  /**
   * レースの結果を得点に加える（同じレースで二度は数えない）
   * @param {Array} rows 結果 [{ rank, charIndex, isPlayer }]（順位の順）
   * @returns {object} 結果画面に出す情報
   */
  addRace(rows) {
    if (!this.recorded) {
      this.lastGained.clear();
      for (const r of rows) {
        const gained = POINTS[r.rank - 1] || 0;
        this.points.set(r.charIndex, (this.points.get(r.charIndex) || 0) + gained);
        this.lastGained.set(r.charIndex, gained);
      }
      this.recorded = true;
    }
    return {
      label: this.cup.name + '  ' + (this.raceIndex + 1) + ' / ' + this.raceCount + '戦',
      gained: this.lastGained,
      standings: this.standings(),
      isLast: this.isLastRace
    };
  }

  // 総合順位（ポイントの多い順。同点なら直前のレースの順位がよい方を上に）
  standings() {
    const list = [];
    for (const [charIndex, points] of this.points) {
      list.push({
        charIndex,
        name: CHARACTERS[charIndex].name,
        points,
        gained: this.lastGained.get(charIndex) || 0,
        isPlayer: charIndex === this.playerCharIndex
      });
    }
    list.sort((a, b) => b.points - a.points || b.gained - a.gained);
    list.forEach((e, i) => { e.rank = i + 1; });
    return list;
  }

  // 自分の総合順位
  playerRank() {
    const me = this.standings().find((e) => e.isPlayer);
    return me ? me.rank : 6;
  }

  // カップを最後まで走ったら、いちばんよい順位を保存する。今回がこれまでで一番なら true
  saveResult() {
    const rank = this.playerRank();
    const best = loadCupBest(this.cup.id);
    if (best !== null && best <= rank) return false;
    try {
      window.localStorage.setItem(keyOf(this.cup.id), String(rank));
    } catch (e) {
      // 保存できなくても、今回の結果は表示できる
    }
    return true;
  }
}

function keyOf(cupId) {
  return 'skyRacer.cup.' + cupId;
}

// カップのいちばんよい順位（まだ最後まで走っていなければ null）
export function loadCupBest(cupId) {
  try {
    const v = Number(window.localStorage.getItem(keyOf(cupId)));
    return v >= 1 && v <= 6 ? v : null;
  } catch (e) {
    return null;
  }
}

// 順位 → トロフィーの名前と色（4位以下はなし）
export function trophyOf(rank) {
  if (rank === 1) return { name: '金のトロフィー', color: '#ffd34a' };
  if (rank === 2) return { name: '銀のトロフィー', color: '#dfe8f2' };
  if (rank === 3) return { name: '銅のトロフィー', color: '#f0a868' };
  return null;
}
