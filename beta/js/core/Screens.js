/*
  ファイル名 : Screens.js
  保存場所   : /js/core
  役割       : 画面の流れの管理。タイトル → キャラ選択 → コース選択 → レース、と一時停止メニュー。
               グランプリ（カップ）では、レース → 結果（得点）→ 紹介カード → 次のレース … → 最終結果。
               設定（音量・BGM・省電力・仕上げ処理・デバッグ表示・難しさ）と、選んだキャラ・コースを
               スマホに保存して反映する。
               画面に合わせてBGMを切り替える（タイトル・選択画面はタイトル曲、レースはコースの曲）
  バージョン : 1.18.0（Phase18：みんなで対戦の部屋とレース）
  メモ       : Game.js が長くなったので、画面の切り替えをここに分けた。
               Game.js はこのクラスを1つ持ち、レースの開始（startRace）だけを自分で行う
*/

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { CHARACTERS } from '../entities/Characters.js';
import { Title } from '../ui/Title.js';
import { CharacterSelect } from '../ui/CharacterSelect.js';
import { CourseSelect } from '../ui/CourseSelect.js';
import { COURSES, CUPS, courseIndexOf } from '../courses/Courses.js';
import { loadBest } from '../systems/Records.js';
import { GrandPrix, loadCupBest } from '../systems/GrandPrix.js';
import { GrandPrixResult } from '../ui/GrandPrixResult.js';
import { PauseMenu } from '../ui/Menu.js';
import { Lobby } from '../ui/Lobby.js';
import { Room } from '../net/Room.js';

const CHAR_KEY = 'skyRacer.character';
const COURSE_KEY = 'skyRacer.course';
const SETTINGS_KEY = 'skyRacer.settings';
// 保存データの形の番号。1.0.0 でデバッグ表示の初期値を OFF にしたので、それより前の保存では
// デバッグ表示の設定だけ初期値（OFF）に戻す
const SETTINGS_FORMAT = 2;

// CPUの腕前の元の値（難しさに合わせて、毎回ここから計算し直す）
const BASE_SKILLS = CONFIG.ai.personalities.map((p) => p.skill);

export class Screens {
  /**
   * @param {Game} game ゲーム本体（描画・ループ・音などを持っている）
   */
  constructor(game) {
    this.game = game;
    this.title = null;
    this.menu = null;          // 一時停止メニュー（開いている間だけ）
    this.titleTime = 0;        // タイトルの背景でカメラが飛んだ時間
    this.titleLook = new THREE.Vector3();
    this.titlePoint = { x: 0, y: 0, z: 0 };

    this.charIndex = loadCharIndex();
    this.courseIndex = loadCourseIndex();
    this.gp = null;               // グランプリ中なら、その進み具合
    this.selectMode = 'course';   // コース選択画面で前回開いていたタブ
    this.room = null;             // みんなで対戦の部屋（入っている間だけ）
    this.lobby = null;            // みんなで対戦の画面（出ている間だけ）
    this.settings = loadSettings();
  }

  // ---- 設定 ----
  // 保存されている設定を、ゲームの各部分に反映する（起動時に1回）
  applyAllSettings() {
    for (const key of Object.keys(this.settings)) {
      this.applySetting(key, this.settings[key]);
    }
  }

  // 設定を1つ変えて保存する（メニューやPCのキーから呼ぶ）
  setSetting(key, value) {
    this.settings[key] = value;
    this.applySetting(key, value);
    saveSettings(this.settings);
  }

  applySetting(key, value) {
    const g = this.game;
    if (key === 'music') {
      g.audio.setMusicVolume(value / 10);
    } else if (key === 'volume') {
      // 音を使えるようになる前でも、その音量で始まるように基準値も変える
      CONFIG.audio.masterVolume = value / 10;
      g.audio.setVolume(value / 10);
    } else if (key === 'powerSave') {
      g.quality.setPowerSave(value);
    } else if (key === 'postfx') {
      if (g.postfx.enabled !== (value && this.canPostfx())) g.postfx.toggle();
    } else if (key === 'difficulty') {
      applyDifficulty(value);
    } else if (key === 'debug') {
      // メニュー中は隠したまま。レースに戻ったときに反映される
      if (g.state === 'RACE' && !this.menu) g.debug.setVisible(value);
    }
  }

  canPostfx() {
    return this.game.quality.level !== 'low';
  }

  // ---- メニュー中（タイトル・キャラ選択・一時停止）とレース中の切り替え ----
  enterMenuMode() {
    const g = this.game;
    g.input.setEnabled(false);
    document.body.classList.add('in-menu');   // 操作部品を隠す（style.css）
    g.debug.setVisible(false);
  }

  leaveMenuMode() {
    const g = this.game;
    document.body.classList.remove('in-menu');
    g.debug.setVisible(this.settings.debug);
  }

  // ---- タイトル ----
  showTitle() {
    const g = this.game;
    this.gp = null;
    this.leaveRoomQuietly();
    if (g.session) {
      g.session.dispose();
      g.session = null;
      this.titleTime = 0;   // レースから戻ったときは、背景のカメラを最初から
    }
    this.enterMenuMode();
    g.setState('TITLE');
    g.audio.playMusic('title');
    this.title = new Title(() => {
      this.title = null;
      // タップ（指を離した瞬間）の中で、もう一度確実に音を再開する
      g.audio.unlock();
      this.showCharacterSelect();
    });
  }

  // ---- キャラクター選択 ----
  showCharacterSelect() {
    const g = this.game;
    this.gp = null;
    this.leaveRoomQuietly();
    if (g.session) {
      g.session.dispose();
      g.session = null;
    }
    this.enterMenuMode();
    g.setState('SELECT');
    g.audio.playMusic('title');   // タイトルから来たときは同じ曲が続く
    new CharacterSelect({
      characters: CHARACTERS,
      atlasCanvas: g.atlas.texture.image,
      index: this.charIndex,
      onDecide: (index) => {
        this.charIndex = index;
        saveCharIndex(index);
        this.showCourseSelect();
      },
      onBack: () => this.showTitle(),
      onSound: (name) => g.audio.play(name),   // 'select'（選ぶ）・'decide'（決定）
      difficulties: CONFIG.difficulty.order.map((key) => ({ key, label: CONFIG.difficulty.levels[key].label })),
      difficulty: this.settings.difficulty,
      onDifficulty: (key) => this.setSetting('difficulty', key)
    });
  }

  // ---- コース選択（キャラを決めた後） ----
  showCourseSelect() {
    const g = this.game;
    this.enterMenuMode();
    g.setState('SELECT');
    const select = new CourseSelect({
      courses: COURSES,
      index: this.courseIndex,
      getBest: (id) => loadBest(id),
      cups: CUPS,
      getCupBest: (id) => loadCupBest(id),
      mode: this.selectMode,
      onDecideCup: (cupIndex) => {
        this.selectMode = 'cup';
        select.close();
        this.startGp(cupIndex);
      },
      onSound: (name) => g.audio.play(name),
      onBack: () => this.showCharacterSelect(),
      onOnline: () => this.showOnline(),
      onDecide: (index) => {
        this.selectMode = 'course';
        this.gp = null;
        this.courseIndex = index;
        saveCourseIndex(index);
        // 別のコースなら作り直す。重い処理の前に「準備中…」を画面に出しておく
        const needLoad = !g.world || g.world.course !== COURSES[index];
        if (needLoad) select.showLoading();
        const go = () => {
          if (needLoad) {
            g.loadCourse(index);
            this.titleTime = 0;
          }
          select.close();
          this.leaveMenuMode();
          g.startRace(this.charIndex);
        };
        // 表示が画面に出てから（2フレーム後に）作り始める
        if (needLoad) requestAnimationFrame(() => requestAnimationFrame(go));
        else go();
      }
    });
  }

  // ---- グランプリ ----
  startGp(cupIndex) {
    this.gp = new GrandPrix(CUPS[cupIndex], this.charIndex);
    this.startGpRace();
  }

  // 今のレースの紹介カードを出し、その間にコースを読み込んで、レースを始める
  startGpRace() {
    const g = this.game;
    const gp = this.gp;
    const index = courseIndexOf(gp.courseId);
    const course = COURSES[index];
    this.enterMenuMode();
    g.setState('SELECT');
    if (g.session) {
      g.session.dispose();
      g.session = null;
    }
    const card = document.createElement('div');
    card.className = 'screen gp-card';
    card.innerHTML = '<div class="gp-card-cup" style="color:' + gp.cup.color + '">' + gp.cup.name + '</div>' +
      '<div class="gp-card-no">第' + (gp.raceIndex + 1) + '戦 / ' + gp.raceCount + '</div>' +
      '<div class="gp-card-name">' + course.name + '</div>' +
      '<div class="gp-card-stars">' + '★'.repeat(course.stars || 1) + '</div>';
    document.body.appendChild(card);
    const shownAt = performance.now();
    // 表示が出てから（2フレーム後に）作り始め、カードは最低1.6秒見せる
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (g.loadCourse(index)) this.titleTime = 0;
      const wait = Math.max(0, 1600 - (performance.now() - shownAt));
      setTimeout(() => {
        if (this.gp !== gp) {   // 待っている間にやめていた
          card.remove();
          return;
        }
        card.classList.add('hide');
        setTimeout(() => card.remove(), 450);
        this.leaveMenuMode();
        g.startRace(this.charIndex, gp);
      }, wait);
    }));
  }

  // 結果画面の「次のレースへ」（最後のレースなら最終結果へ）
  gpNext() {
    const gp = this.gp;
    if (!gp) return;
    if (gp.next()) {
      this.startGpRace();
    } else {
      this.showGpResult();
    }
  }

  showGpResult() {
    const g = this.game;
    const gp = this.gp;
    const newRecord = gp.saveResult();
    const standings = gp.standings();
    if (g.session) {
      g.session.dispose();
      g.session = null;
    }
    this.enterMenuMode();
    g.setState('SELECT');
    g.audio.playMusic('title');
    g.audio.play('goal');
    new GrandPrixResult({
      cup: gp.cup,
      standings,
      newRecord,
      atlasCanvas: g.atlas.texture.image,
      onAgain: () => this.startGp(CUPS.indexOf(gp.cup)),
      onTitle: () => this.showTitle()
    });
  }

  // ==== みんなで対戦 ====
  // 部屋の画面（部屋に入っていれば部屋の中、いなければ入口）
  showOnline(message) {
    const g = this.game;
    if (g.session) {
      g.session.dispose();
      g.session = null;
    }
    if (this.lobby) this.lobby.close();
    this.enterMenuMode();
    g.setState('SELECT');
    g.audio.playMusic('title');
    this.lobby = new Lobby({
      name: loadNetName(),
      courses: COURSES,
      characters: CHARACTERS,
      atlasCanvas: g.atlas.texture.image,
      onSound: (name) => g.audio.play(name),
      onBack: () => {
        this.closeLobby();
        this.showCourseSelect();
      },
      onCreate: (name) => this.createRoom(name),
      onJoin: (name, code) => this.joinRoom(name, code),
      onLeave: () => this.leaveRoom(),
      onStart: () => this.hostStart(),
      onCourse: (index) => { if (this.room) this.room.setCourse(index); }
    });
    if (this.room) this.lobby.showRoom(this.room);
    else if (message) this.lobby.setStatus(message, true);
  }

  closeLobby() {
    if (this.lobby) {
      this.lobby.close();
      this.lobby = null;
    }
  }

  // 部屋の準備（作る人・入る人 共通）
  makeRoom(name) {
    saveNetName(name);
    const room = new Room({
      name: name || 'プレイヤー',
      char: this.charIndex,
      onChange: () => { if (this.lobby && this.room === room) this.lobby.refresh(); },
      onClosed: (reason) => { if (this.room === room) this.roomLost(reason); }
    });
    room.on('start', (m) => this.netStart(m));
    room.on('go', () => {
      const s = this.game.session;
      if (s && s.net) s.release();
    });
    room.on('end', () => {
      // ホストが部屋に戻った：まだ走っていても、ここで結果を出す
      const s = this.game.session;
      if (s && s.net && !s.resultsShown) s.showResults();
    });
    room.on('ready', (m, pid) => this.onGuestReady(pid));
    return room;
  }

  createRoom(name) {
    const lobby = this.lobby;
    const room = this.makeRoom(name);
    lobby.setBusy(true, '部屋を作っています…');
    room.create(this.courseIndex).then(() => {
      if (this.lobby !== lobby || room.closed) {
        room.close(true);
        return;
      }
      this.room = room;
      lobby.setBusy(false);
      lobby.showRoom(room);
    }).catch((err) => {
      room.close(true);
      if (this.lobby !== lobby) return;
      lobby.setBusy(false);
      lobby.setStatus(err.message + '。通信の状態を確認して、もう一度お試しください', true);
    });
  }

  joinRoom(name, code) {
    const lobby = this.lobby;
    const room = this.makeRoom(name);
    lobby.setBusy(true, '部屋 ' + code + ' に入っています…');
    room.join(code).then(() => {
      if (this.lobby !== lobby || room.closed) {
        room.close(true);
        return;
      }
      this.room = room;
      lobby.setBusy(false);
      lobby.showRoom(room);
    }).catch((err) => {
      if (this.lobby !== lobby) return;
      lobby.setBusy(false);
      lobby.setStatus(err.message, true);
    });
  }

  // 自分から部屋を出る → 入口へ
  leaveRoom() {
    this.leaveRoomQuietly();
    if (this.menu) this.closePauseMenu(false);
    this.showOnline();
  }

  leaveRoomQuietly() {
    if (this.room) {
      this.room.close(true);
      this.room = null;
    }
    this.closeLobby();
    clearTimeout(this.readyTimer);
  }

  // 部屋がなくなった（ホストが閉じた・切れた）→ 入口へ（理由を出す）
  roomLost(reason) {
    this.room = null;
    clearTimeout(this.readyTimer);
    if (this.menu) this.closePauseMenu(false);
    const text = reason || '部屋から出ました';
    if (this.lobby) {
      this.lobby.showEntry(loadNetName(), text);
    } else {
      this.showOnline(text);
    }
  }

  // ホスト：スタート。人のスタート位置とCPUを決めて、全員に知らせる
  hostStart() {
    const room = this.room;
    if (!room || !room.isHost) return;
    const slots = [];
    const humanSlots = CONFIG.net.humanSlots;
    const used = new Set(room.members.map((m) => m.char));
    // CPUのキャラ：人と同じキャラはなるべく避ける
    const cpuChars = CHARACTERS.map((_, i) => i).filter((i) => !used.has(i))
      .concat(CHARACTERS.map((_, i) => i).filter((i) => used.has(i)));
    let cpu = 0;
    for (let i = 0; i < CONFIG.race.racerCount; i += 1) {
      const k = humanSlots.indexOf(i);
      const m = k >= 0 ? room.members[k] : null;
      if (m) slots.push({ pid: m.pid, char: m.char, name: m.name });
      else slots.push({ pid: -1, char: cpuChars[cpu++ % cpuChars.length], name: '' });
    }
    room.setLocked(true);
    const msg = { t: 'start', course: room.course, slots };
    room.broadcast(msg);
    this.netStart(msg);
  }

  // レースの準備（全員）：コースを読み込んでレースを作り、カウントダウンは止めておく
  netStart(m) {
    const g = this.game;
    const room = this.room;
    if (!room) return;
    const index = m.course;
    const course = COURSES[index];
    if (!course) return;
    if (this.menu) this.closePauseMenu(false);
    this.closeLobby();
    if (g.session) {
      g.session.dispose();
      g.session = null;
    }
    this.enterMenuMode();
    g.setState('SELECT');
    const card = document.createElement('div');
    card.className = 'screen gp-card';
    card.innerHTML = '<div class="gp-card-cup" style="color:#7fe0ff">みんなで対戦</div>' +
      '<div class="gp-card-no">' + room.members.length + '人 ＋ CPU</div>' +
      '<div class="gp-card-name">' + course.name + '</div>' +
      '<div class="gp-card-stars">' + '★'.repeat(course.stars || 1) + '</div>';
    document.body.appendChild(card);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (this.room !== room) {
        card.remove();
        return;
      }
      if (g.loadCourse(index)) this.titleTime = 0;
      this.courseIndex = index;
      card.classList.add('hide');
      setTimeout(() => card.remove(), 450);
      this.leaveMenuMode();
      const mySlot = m.slots.findIndex((x) => x.pid === room.myPid);
      g.startRace(this.charIndex, null, { room, slots: m.slots.map((x) => ({ ...x })), mySlot });
      if (room.isHost) {
        this.readySet = new Set([room.myPid]);
        clearTimeout(this.readyTimer);
        this.readyTimer = setTimeout(() => this.hostGo(), CONFIG.net.readyTimeout * 1000);
        this.onGuestReady(room.myPid);
      } else {
        room.toHost({ t: 'ready' });
      }
    }));
  }

  // ホスト：ゲストの読み込みが終わった。全員そろったらスタート
  onGuestReady(pid) {
    const room = this.room;
    if (!room || !room.isHost || !this.readySet) return;
    this.readySet.add(pid);
    if (room.members.every((x) => this.readySet.has(x.pid))) this.hostGo();
  }

  hostGo() {
    const room = this.room;
    clearTimeout(this.readyTimer);
    if (!room || !this.readySet) return;
    this.readySet = null;
    room.broadcast({ t: 'go' });
    // 知らせが届くまでの時間（往復の半分）だけ自分も待つと、全員ほぼ同時にカウントダウンが始まる
    const delay = Math.min(0.3, room.maxRtt() / 2);
    setTimeout(() => {
      const s = this.game.session;
      if (s && s.net) s.release();
    }, delay * 1000);
  }

  // 結果画面の「部屋に戻る」
  backToRoom() {
    const room = this.room;
    if (!room) {
      this.showOnline();
      return;
    }
    if (room.isHost) {
      room.broadcast({ t: 'end' });
      room.setLocked(false);
    }
    this.showOnline();
  }

  // ---- レースが始まったとき（Game.startRace から呼ばれる）：コースの曲と、最終周・ゴールでの変化 ----
  onRaceStart(session) {
    const audio = this.game.audio;
    audio.playMusic(session.course && session.course.music ? session.course.music : 'race');
    audio.setMusicTempo(1);
    session.race.on('finalLap', (racer) => {
      if (racer.isPlayer) audio.setMusicTempo(CONFIG.audio.finalLapTempo);
    });
    session.race.on('finish', (racer) => {
      // ゴールしたら曲を止めて、ファンファーレを聞かせる
      if (racer.isPlayer) audio.stopMusic(0.3);
    });
  }

  // タイトル・キャラ選択の背景：カメラがコースの上をゆっくり飛び、少し先を見る
  updateTitleCamera(frameTime) {
    const g = this.game;
    const u = CONFIG.ui;
    const t = g.track;
    this.titleTime += frameTime;
    // カメラが飛び始める位置はコースごと（なければ config.js の値）
    const course = g.world ? g.world.course : null;
    const start = course && course.titleStart !== undefined ? course.titleStart : u.titleCameraStart;
    const s = (start + this.titleTime * u.titleCameraSpeed) % t.length;
    const sway = Math.sin(this.titleTime * 0.25) * u.titleCameraSway;
    const p = this.titlePoint;
    t.toWorld(s, sway, u.titleCameraHeight, p);
    g.camera.position.set(p.x, p.y, p.z);
    t.toWorld(s + u.titleCameraLook, 0, u.titleCameraHeight * 0.4, p);
    this.titleLook.set(p.x, p.y, p.z);
    g.camera.lookAt(this.titleLook);
    g.environment.update(frameTime, g.camera.position);
  }

  // ---- 一時停止メニュー（レース中だけ。「II」ボタン・Esc キー） ----
  togglePauseMenu() {
    if (this.game.state !== 'RACE') return;
    if (this.menu) {
      this.closePauseMenu(true);
    } else {
      this.openPauseMenu();
    }
  }

  openPauseMenu() {
    const g = this.game;
    // みんなで対戦では止められない（他の人は走り続けている）。メニューを出すだけ
    const online = !!(g.session && g.session.net);
    if (!online) {
      g.loop.setPaused(true);
      g.audio.setPaused(true);
    }
    this.enterMenuMode();
    this.menu = new PauseMenu({
      online,
      onLeave: () => this.leaveRoom(),
      settings: { ...this.settings },
      canPostfx: this.canPostfx(),
      onResume: () => this.closePauseMenu(true),
      onRetry: () => {
        this.closePauseMenu(true);   // 操作部品を戻してから、最初からやり直す
        if (this.gp) this.gp.retry();
        g.startRace(this.charIndex, this.gp);
      },
      onSelect: () => {
        this.closePauseMenu(false);
        this.showCharacterSelect();
      },
      onTitle: () => {
        this.closePauseMenu(false);
        this.showTitle();
      },
      onChange: (key, value) => this.setSetting(key, value)
    });
  }

  // メニューを閉じる（backToRace = true ならレースに戻って操作できるようにする）
  closePauseMenu(backToRace) {
    const g = this.game;
    if (this.menu) {
      this.menu.close();
      this.menu = null;
    }
    g.loop.setPaused(false);
    g.audio.setPaused(false);
    if (backToRace) {
      this.leaveMenuMode();
      g.input.setEnabled(true);
    }
  }
}

// ---- 難しさ：CPUの腕前・追い上げ補正・最高速を、選んだ段階の値にする（次のレースから効く） ----
function applyDifficulty(key) {
  const level = CONFIG.difficulty.levels[key] || CONFIG.difficulty.levels[CONFIG.difficulty.default];
  CONFIG.ai.personalities.forEach((p, i) => {
    p.skill = Math.min(1, BASE_SKILLS[i] * level.skill);
  });
  CONFIG.rubberBand.maxSlow = level.rubberSlow;
  CONFIG.rubberBand.maxFast = level.rubberFast;
  CONFIG.rubberBand.cpuSpeed = level.cpuSpeed;
}

// ---- 保存と読み込み（保存できない環境でも動くよう、失敗は無視する） ----

function loadNetName() {
  try {
    return window.localStorage.getItem(CONFIG.net.nameKey) || '';
  } catch (e) {
    return '';
  }
}

function saveNetName(name) {
  try {
    window.localStorage.setItem(CONFIG.net.nameKey, name || '');
  } catch (e) {
    // 保存できなくても遊べる
  }
}

function loadCharIndex() {
  try {
    const v = Number(window.localStorage.getItem(CHAR_KEY));
    return Number.isInteger(v) && v >= 0 && v < CHARACTERS.length ? v : 0;
  } catch (e) {
    return 0;
  }
}

function loadCourseIndex() {
  try {
    return courseIndexOf(window.localStorage.getItem(COURSE_KEY));
  } catch (e) {
    return 0;
  }
}

function saveCourseIndex(index) {
  try {
    window.localStorage.setItem(COURSE_KEY, COURSES[index].id);
  } catch (e) {
    // 保存できなくても遊べるので何もしない
  }
}

function saveCharIndex(index) {
  try {
    window.localStorage.setItem(CHAR_KEY, String(index));
  } catch (e) {
    // 保存できなくても遊べるので何もしない
  }
}

// 設定の初期値（config.js の値から作る）
function defaultSettings() {
  return {
    volume: Math.round(CONFIG.audio.masterVolume * 10),
    music: Math.round(CONFIG.audio.musicVolume * 10),
    powerSave: CONFIG.quality.powerSave,
    postfx: CONFIG.postfx.enabled,
    debug: CONFIG.debug.show,
    difficulty: CONFIG.difficulty.default
  };
}

function loadSettings() {
  const settings = defaultSettings();
  try {
    const saved = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}');
    // 知っている項目で、型が同じものだけ使う（古い保存データや壊れたデータでも動くように）
    for (const key of Object.keys(settings)) {
      if (typeof saved[key] === typeof settings[key]) settings[key] = saved[key];
    }
    // 古い形の保存では、デバッグ表示は初期値（OFF）にする
    if (saved.format !== SETTINGS_FORMAT) settings.debug = CONFIG.debug.show;
  } catch (e) {
    // 読めなければ初期値のまま
  }
  settings.volume = Math.max(0, Math.min(10, Math.round(settings.volume)));
  settings.music = Math.max(0, Math.min(10, Math.round(settings.music)));
  if (!CONFIG.difficulty.levels[settings.difficulty]) settings.difficulty = CONFIG.difficulty.default;
  return settings;
}

function saveSettings(settings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, format: SETTINGS_FORMAT }));
  } catch (e) {
    // 保存できなくても、今回の間は設定が効いている
  }
}
