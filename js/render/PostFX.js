/*
  ファイル名 : PostFX.js
  保存場所   : /js/render
  役割       : 画面全体の仕上げ（ポストエフェクト）。HD-2Dの「ミニチュアのような奥行き」を出す
                 1. ティルトシフト … 画面の上と下をぼかし、真ん中（レーサーのあたり）だけくっきり
                 2. ブルーム       … 明るい所の光が、まわりにふわっとにじむ
                 3. 色づくり       … コントラストと鮮やかさを少し上げ、全体をあたたかい色に
  バージョン : 0.8.4（Phase8 Step8-4）

  しくみ（軽くするための工夫）
    ・まず画面を「絵」として1枚に描く
    ・それを縦横1/4に縮めて、ぼかした絵を作る（小さいので、ぼかしの計算が16分の1で済む）
    ・最後に「くっきりした絵」と「ぼかした絵」を、画面の高さに合わせて混ぜる。
      同じぼかした絵から、明るい所だけを足してブルームにする（ぼかしを使い回す）
    ・画質 low の端末では使わない。FPSが下がり続けたら自動で切る
    ・PCでは F キーで ON / OFF を切り替えて見比べられる
*/

import * as THREE from 'three';
import { CONFIG } from '../config.js';

// 全画面の板に絵を貼るだけの頂点シェーダー（どのパスでも共通）
const VERTEX = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// 縮小：4点の平均を取りながら1/4に縮める（細い光がチラつかないように）
const DOWNSAMPLE = /* glsl */`
  uniform sampler2D tInput;
  uniform vec2 texel;   // 元の絵の1マスの大きさ
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tInput, vUv + texel * vec2(-1.0, -1.0)).rgb;
    c += texture2D(tInput, vUv + texel * vec2( 1.0, -1.0)).rgb;
    c += texture2D(tInput, vUv + texel * vec2(-1.0,  1.0)).rgb;
    c += texture2D(tInput, vUv + texel * vec2( 1.0,  1.0)).rgb;
    gl_FragColor = vec4(c * 0.25, 1.0);
  }
`;

// ぼかし：決まった向き（横 or 縦）に9点を重み付きで混ぜる
const BLUR = /* glsl */`
  uniform sampler2D tInput;
  uniform vec2 direction;  // 1マス分の向き（横なら (1/幅, 0)、縦なら (0, 1/高さ)）
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tInput, vUv).rgb * 0.227027;
    c += texture2D(tInput, vUv + direction * 1.384615).rgb * 0.316216;
    c += texture2D(tInput, vUv - direction * 1.384615).rgb * 0.316216;
    c += texture2D(tInput, vUv + direction * 3.230769).rgb * 0.070270;
    c += texture2D(tInput, vUv - direction * 3.230769).rgb * 0.070270;
    gl_FragColor = vec4(c, 1.0);
  }
`;

// 仕上げ：くっきり／ぼかしを混ぜ、ブルームを足し、色を整えて画面へ
const COMPOSITE = /* glsl */`
  uniform sampler2D tSharp;
  uniform sampler2D tBlur;
  uniform float focusCenter;   // くっきり見せる高さ（0 = 画面の下、1 = 上）
  uniform float focusWidth;    // くっきりの帯の半分の幅
  uniform float fadeWidth;     // くっきり → ぼかしへ変わる幅
  uniform float topBlur;       // 上側のぼかしの強さ（0〜1）
  uniform float bottomBlur;    // 下側のぼかしの強さ（0〜1）
  uniform float bloomThreshold;
  uniform float bloomStrength;
  uniform float contrast;
  uniform float saturation;
  uniform vec3 warmTint;       // 全体にかける色（あたたかく）
  uniform vec3 shadowTint;     // 暗い所に足す色（少し青緑に）
  varying vec2 vUv;

  void main() {
    vec3 sharp = texture2D(tSharp, vUv).rgb;
    vec3 blur = texture2D(tBlur, vUv).rgb;

    // 1. ティルトシフト：真ん中の帯から離れるほどぼかす
    float d = vUv.y - focusCenter;
    float amount = smoothstep(focusWidth, focusWidth + fadeWidth, abs(d));
    amount *= d > 0.0 ? topBlur : bottomBlur;
    vec3 color = mix(sharp, blur, amount);

    // 2. ブルーム：ぼかした絵の明るい所だけを足す
    vec3 bright = max(blur - vec3(bloomThreshold), vec3(0.0));
    color += bright * bloomStrength;

    // 3. 色づくり（見た目の明るさに近い形に直してから整え、元に戻す）
    vec3 c = pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));
    c = (c - 0.5) * contrast + 0.5;
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(lum), c, saturation);
    c *= warmTint;
    c += shadowTint * (1.0 - lum) * (1.0 - lum);
    color = pow(clamp(c, 0.0, 1.0), vec3(2.2));

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

export class PostFX {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {Quality} quality
   */
  constructor(renderer, quality) {
    const p = CONFIG.postfx;
    this.renderer = renderer;
    this.quality = quality;
    this.enabled = p.enabled && quality.level !== 'low';
    this.autoOffTimer = 0;
    this.autoOff = false;         // FPS不足で自動で切ったか
    this.size = new THREE.Vector2();
    this.width = 0;
    this.height = 0;

    // 画面の絵を入れる入れ物。明るさが1を超えても保てる形式を使えれば使う（ブルームがきれいになる）
    const ext = renderer.extensions;
    const canFloat = ext && (ext.has('EXT_color_buffer_half_float') || ext.has('EXT_color_buffer_float'));
    const type = canFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const options = {
      type,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false
    };
    this.sceneTarget = new THREE.WebGLRenderTarget(1, 1, { ...options, depthBuffer: true });
    this.blurA = new THREE.WebGLRenderTarget(1, 1, options);
    this.blurB = new THREE.WebGLRenderTarget(1, 1, options);

    // 全画面の板と、それを写すカメラ
    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    this.downMat = makeMaterial(DOWNSAMPLE, {
      tInput: { value: null },
      texel: { value: new THREE.Vector2() }
    });
    this.blurMat = makeMaterial(BLUR, {
      tInput: { value: null },
      direction: { value: new THREE.Vector2() }
    });
    this.compositeMat = makeMaterial(COMPOSITE, {
      tSharp: { value: this.sceneTarget.texture },
      tBlur: { value: this.blurA.texture },
      focusCenter: { value: p.focusCenter },
      focusWidth: { value: p.focusWidth },
      fadeWidth: { value: p.fadeWidth },
      topBlur: { value: p.topBlur },
      bottomBlur: { value: p.bottomBlur },
      bloomThreshold: { value: p.bloomThreshold },
      bloomStrength: { value: p.bloomStrength },
      contrast: { value: p.contrast },
      saturation: { value: p.saturation },
      warmTint: { value: new THREE.Vector3(p.warmTint[0], p.warmTint[1], p.warmTint[2]) },
      shadowTint: { value: new THREE.Vector3(p.shadowTint[0], p.shadowTint[1], p.shadowTint[2]) }
    });
  }

  // ON / OFF の切り替え（PCの F キー用）
  toggle() {
    if (this.quality.level === 'low') return false;
    this.enabled = !this.enabled;
    this.autoOff = false;
    this.autoOffTimer = 0;
    return this.enabled;
  }

  // 画面の大きさ（描画解像度）が変わったら、入れ物の大きさを合わせる
  resizeIfNeeded() {
    this.renderer.getDrawingBufferSize(this.size);
    const w = Math.max(1, Math.floor(this.size.x));
    const h = Math.max(1, Math.floor(this.size.y));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.sceneTarget.setSize(w, h);
    const bw = Math.max(1, Math.floor(w / 4));
    const bh = Math.max(1, Math.floor(h / 4));
    this.blurA.setSize(bw, bh);
    this.blurB.setSize(bw, bh);
  }

  // FPSが足りない状態（解像度を一番下げても遅い）が続いたら自動で切る
  watch(frameTime) {
    if (!this.enabled) return;
    const q = CONFIG.quality;
    const atBottom = this.quality.scale <= q.minScale + 0.001;
    this.autoOffTimer = atBottom ? this.autoOffTimer + frameTime : 0;
    if (this.autoOffTimer >= CONFIG.postfx.autoOffSeconds) {
      this.enabled = false;
      this.autoOff = true;
    }
  }

  // 1フレーム描く（OFFのときは、ふつうに画面へ描くだけ）
  render(scene, camera) {
    const renderer = this.renderer;
    if (!this.enabled) {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      return;
    }
    this.resizeIfNeeded();

    // 1. 画面を絵として描く
    renderer.setRenderTarget(this.sceneTarget);
    renderer.render(scene, camera);

    // 2. 1/4に縮める
    this.downMat.uniforms.tInput.value = this.sceneTarget.texture;
    this.downMat.uniforms.texel.value.set(1 / this.width, 1 / this.height);
    this.pass(this.downMat, this.blurA);

    // 3. 横にぼかす → 縦にぼかす（結果は blurA に戻る）。
    //    これを何回か、回ごとに広げながらくり返して、強くなめらかなぼかしにする
    const bw = this.blurA.width;
    const bh = this.blurA.height;
    const iterations = CONFIG.postfx.blurIterations;
    for (let i = 0; i < iterations; i += 1) {
      const spread = 1 + i;
      this.blurMat.uniforms.tInput.value = this.blurA.texture;
      this.blurMat.uniforms.direction.value.set(spread / bw, 0);
      this.pass(this.blurMat, this.blurB);
      this.blurMat.uniforms.tInput.value = this.blurB.texture;
      this.blurMat.uniforms.direction.value.set(0, spread / bh);
      this.pass(this.blurMat, this.blurA);
    }

    // 4. 混ぜて画面へ
    this.pass(this.compositeMat, null);
  }

  // 全画面の板を1回描く
  pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  // デバッグ表示用
  describe() {
    if (this.quality.level === 'low') return '仕上げ処理 なし（画質low）';
    if (this.autoOff) return '仕上げ処理 自動OFF（FPS不足）';
    return '仕上げ処理 ' + (this.enabled ? 'ON' : 'OFF');
  }
}

function makeMaterial(fragmentShader, uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader,
    depthTest: false,
    depthWrite: false
  });
}
