import * as THREE from 'three';

/* ============================================================ quality */
/* Low / Medium / High tiers drive DPR, shadows and particle budgets. */

export const QUALITY = {
  low: { dpr: 1, shadows: false, shadowMap: 512, particleMult: 0.4, antialias: false },
  medium: { dpr: 1.25, shadows: true, shadowMap: 1024, particleMult: 0.75, antialias: true },
  high: { dpr: 1.75, shadows: true, shadowMap: 2048, particleMult: 1, antialias: true },
};

export const quality = {
  level: 'high',
  get particleMult() {
    return QUALITY[this.level].particleMult;
  },
};

function detectInitialQuality() {
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 560;
  const cores = navigator.hardwareConcurrency || 4;
  if (coarse && (small || cores <= 4)) return 'low';
  if (coarse || cores <= 4) return 'medium';
  return 'high';
}

/* =========================================================== renderer */

export const canvas = document.getElementById('game');

export const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false,
});

export function applyQuality(level) {
  const q = QUALITY[level] || QUALITY.high;
  quality.level = QUALITY[level] ? level : 'high';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.dpr));
  renderer.shadowMap.enabled = q.shadows;
  renderer.shadowMap.type = q.shadowMap >= 2048 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  if (moonLight.shadow.mapSize.x !== q.shadowMap) {
    moonLight.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    if (moonLight.shadow.map) {
      moonLight.shadow.map.dispose();
      moonLight.shadow.map = null;
    }
  }
  moonLight.castShadow = q.shadows;
  moonLight.shadow.camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

/* ============================================================= scene */

export const scene = new THREE.Scene();
export const baseFogColor = new THREE.Color(0x070a18);
export const domainFogColor = new THREE.Color(0x140433);
scene.background = baseFogColor.clone();
scene.fog = new THREE.Fog(baseFogColor.clone(), 38, 130);

/* =========================================================== camera */

export const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  320,
);
camera.position.set(0, 6, 14);

/* =========================================================== lights */

export const hemiLight = new THREE.HemisphereLight(0x5c6cff, 0x140a22, 0.65);
scene.add(hemiLight);

export const moonLight = new THREE.DirectionalLight(0xc2d4ff, 1.35);
moonLight.position.set(16, 30, 12);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(2048, 2048);
moonLight.shadow.camera.left = -30;
moonLight.shadow.camera.right = 30;
moonLight.shadow.camera.top = 30;
moonLight.shadow.camera.bottom = -30;
moonLight.shadow.camera.near = 1;
moonLight.shadow.camera.far = 100;
moonLight.shadow.bias = -0.0012;
scene.add(moonLight, moonLight.target);

export const rimLight = new THREE.DirectionalLight(0x8a3cff, 0.55);
rimLight.position.set(-18, 12, -16);
scene.add(rimLight);

/** Lights that levels/abilities may restyle. */
export const levelLightRig = { moonLight, hemiLight, rimLight };

/* ============================================================ resize */

const resizeHandlers = [];
export function onResize(fn) {
  resizeHandlers.push(fn);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  for (const fn of resizeHandlers) fn();
});

window.addEventListener('orientationchange', () => {
  window.setTimeout(() => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    for (const fn of resizeHandlers) fn();
  }, 120);
});

applyQuality(detectInitialQuality());
