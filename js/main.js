/*
  ファイル名 : main.js
  保存場所   : /js
  役割       : Phase1 動作確認。Three.jsの読み込み、描画、タッチ、FPS、
               バージョン一致、バックグラウンド停止を確認する
  バージョン : 0.1.0（Phase1 動作確認版）
*/

import * as THREE from 'three';

const VERSION = '0.1.0';

// ---- バージョン確認（古いファイルが残っていないか） ----
const versionEl = document.getElementById('version');
const htmlVersion = document.documentElement.dataset.version;
if (htmlVersion !== VERSION) {
  versionEl.textContent = 'v' + VERSION + ' / HTML v' + htmlVersion + ' 不一致';
  versionEl.classList.add('warn');
} else {
  versionEl.textContent = 'v' + VERSION;
}

// ---- 描画の準備 ----
const container = document.getElementById('game');

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: 'high-performance'
});
const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const skyColor = new THREE.Color(0x8ec5ff);
scene.background = skyColor;
scene.fog = new THREE.Fog(skyColor, 8, 30);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.5, 5);
camera.lookAt(0, 0.5, 0);

// ライトは2つだけ（本番と同じ構成）
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x5577aa, 1.2);
scene.add(hemiLight);
const sunLight = new THREE.DirectionalLight(0xfff2cc, 1.6);
sunLight.position.set(3, 5, 2);
scene.add(sunLight);

// 回転する立方体
const cubeColors = [0xffb347, 0x7fd67f, 0xff7aa8, 0x7ab8ff];
let colorIndex = 0;
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1.2, 1.2, 1.2),
  new THREE.MeshLambertMaterial({ color: cubeColors[colorIndex] })
);
cube.position.y = 0.6;
scene.add(cube);

// 足場（浮遊島のつもり）
const island = new THREE.Mesh(
  new THREE.CylinderGeometry(2.5, 1.2, 0.8, 16),
  new THREE.MeshLambertMaterial({ color: 0x6fae5a })
);
island.position.y = -0.4;
scene.add(island);

// ---- タッチ確認：画面に触れると立方体の色が変わる ----
let touchCount = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  touchCount += 1;
  colorIndex = (colorIndex + 1) % cubeColors.length;
  cube.material.color.setHex(cubeColors[colorIndex]);
});

// ---- 画面サイズ変更・回転への対応 ----
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 200));

// ---- ループ（バックグラウンドでは停止） ----
const infoEl = document.getElementById('info');
let running = true;
let lastTime = performance.now();
let fpsFrames = 0;
let fpsTime = 0;
let fps = 0;

function frame(now) {
  if (!running) return;
  requestAnimationFrame(frame);

  // 経過時間（秒）。長時間止まった直後の大きな値は切り詰める
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  cube.rotation.x += dt * 0.8;
  cube.rotation.y += dt * 1.2;

  renderer.render(scene, camera);

  fpsFrames += 1;
  fpsTime += dt;
  if (fpsTime >= 0.5) {
    fps = Math.round(fpsFrames / fpsTime);
    fpsFrames = 0;
    fpsTime = 0;
    const info = renderer.info.render;
    infoEl.textContent =
      'FPS      : ' + fps + '\n' +
      '描画回数 : ' + info.calls + '\n' +
      '三角形   : ' + info.triangles + '\n' +
      '画面     : ' + window.innerWidth + 'x' + window.innerHeight + ' @' + pixelRatio.toFixed(2) + '\n' +
      'タッチ   : ' + touchCount + '回\n' +
      'Three.js : r' + THREE.REVISION;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    running = false;
  } else if (!running) {
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(frame);
  }
});

requestAnimationFrame(frame);
window.__SKY_READY = true;
