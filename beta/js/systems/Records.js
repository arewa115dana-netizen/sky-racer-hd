/*
  ファイル名 : Records.js
  保存場所   : /js/systems
  役割       : 自己ベスト（コースごとの一番速いタイム）をスマホに保存して読み出す
  バージョン : 1.13.0（Phase13 Step13-2：コースごとに分けて保存）
  メモ       : 保存の名前は skyRacer.best.コースのid（天空神殿は v1.0.0 までと同じ skyRacer.best.skyTemple）。
               保存できない環境でも、その回の結果は出せるようにする
*/

function keyOf(courseId) {
  return 'skyRacer.best.' + courseId;
}

/**
 * 保存されている自己ベストを読む
 * @returns {{ time, name } | null}
 */
export function loadBest(courseId) {
  try {
    const best = JSON.parse(window.localStorage.getItem(keyOf(courseId)) || 'null');
    return best && typeof best.time === 'number' ? best : null;
  } catch (e) {
    return null;
  }
}

/**
 * ゴールタイムで自己ベストを更新する（time が null ならゴールしていないので読むだけ）
 * @returns {{ time, name, isNew } | null}
 */
export function updateBest(courseId, time, character) {
  const best = loadBest(courseId);
  if (time === null) {
    return best ? { time: best.time, name: best.name, isNew: false } : null;
  }
  if (best && best.time <= time) {
    return { time: best.time, name: best.name, isNew: false };
  }
  try {
    window.localStorage.setItem(keyOf(courseId), JSON.stringify({ time, name: character.name }));
  } catch (e) {
    // 保存できなくても、今回の記録として表示はする
  }
  return { time, name: character.name, isNew: true };
}
