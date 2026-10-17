import * as THREE from 'three';

export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

export function angleLerp(current, target, t) {
  const diff = ((target - current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return current + diff * t;
}

export function easeOutCubic(k) {
  return 1 - Math.pow(1 - k, 3);
}

export function easeInOutCubic(k) {
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

/* ---------------------------------------------------------- temp pool */
/* Reusable scratch vectors so hot paths never allocate per frame. */

const pool = [];
let poolCursor = 0;

export function tempVec() {
  if (pool.length < 24) {
    const v = new THREE.Vector3();
    pool.push(v);
    return v;
  }
  const v = pool[poolCursor];
  poolCursor = (poolCursor + 1) % pool.length;
  return v;
}

export const UP = new THREE.Vector3(0, 1, 0);
export const ZERO = new THREE.Vector3(0, 0, 0);

/* --------------------------------------------------------- dispose */

export function disposeObject(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m.map) m.map.dispose();
        m.dispose();
      }
    }
  });
}
