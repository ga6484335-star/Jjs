import * as THREE from 'three';
import { scene } from './core.js';
import { quality } from './core.js';
import { rand, clamp, lerp, easeOutCubic, tempVec } from './utils.js';

/* ======================================================== particles */
/* Pooled additive point cloud: spawn() never allocates; dead particles
   are recycled through a rolling cursor. */

class ParticleSystem {
  constructor(max = 900) {
    this.max = max;
    this.positions = new Float32Array(max * 3);
    this.colors = new Float32Array(max * 3);
    this.velocities = new Float32Array(max * 3);
    this.baseColors = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.cursor = 0;

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    this.points = new THREE.Points(
      this.geometry,
      new THREE.PointsMaterial({
        size: 0.18,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  spawn(pos, color, count, speed = 6, life = 0.7, gravity = -6, drag = 0) {
    const n = Math.max(1, Math.round(count * quality.particleMult));
    const c = _color.set(color);
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const i3 = i * 3;

      this.positions[i3] = pos.x + rand(-0.16, 0.16);
      this.positions[i3 + 1] = pos.y + rand(-0.16, 0.16);
      this.positions[i3 + 2] = pos.z + rand(-0.16, 0.16);

      const dir = tempVec().set(rand(-1, 1), rand(-0.35, 1.2), rand(-1, 1)).normalize();
      const s = speed * rand(0.35, 1.15);
      this.velocities[i3] = dir.x * s;
      this.velocities[i3 + 1] = dir.y * s;
      this.velocities[i3 + 2] = dir.z * s;

      const tint = rand(0.75, 1.3);
      this.baseColors[i3] = c.r * tint;
      this.baseColors[i3 + 1] = c.g * tint;
      this.baseColors[i3 + 2] = c.b * tint;

      const l = life * rand(0.6, 1.25);
      this.life[i] = l;
      this.maxLife[i] = l;
      this.gravity[i] = gravity;
      this.drag[i] = drag;
    }
  }

  /** Spawn particles already moving with a specific velocity (for trails). */
  spawnVel(pos, color, count, vel, spread = 1, life = 0.5, gravity = 0, drag = 1.5) {
    const n = Math.max(1, Math.round(count * quality.particleMult));
    const c = _color.set(color);
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const i3 = i * 3;

      this.positions[i3] = pos.x + rand(-spread, spread);
      this.positions[i3 + 1] = pos.y + rand(-spread, spread);
      this.positions[i3 + 2] = pos.z + rand(-spread, spread);

      this.velocities[i3] = vel.x + rand(-spread, spread) * 2;
      this.velocities[i3 + 1] = vel.y + rand(-spread, spread) * 2;
      this.velocities[i3 + 2] = vel.z + rand(-spread, spread) * 2;

      const tint = rand(0.75, 1.3);
      this.baseColors[i3] = c.r * tint;
      this.baseColors[i3 + 1] = c.g * tint;
      this.baseColors[i3 + 2] = c.b * tint;

      const l = life * rand(0.7, 1.3);
      this.life[i] = l;
      this.maxLife[i] = l;
      this.gravity[i] = gravity;
      this.drag[i] = drag;
    }
  }

  update(dt) {
    const { positions, velocities, colors, baseColors, life, maxLife, gravity, drag } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) continue;
      const i3 = i * 3;
      life[i] -= dt;
      const k = Math.max(0, life[i] / maxLife[i]);

      if (drag[i] > 0) {
        const f = Math.exp(-drag[i] * dt);
        velocities[i3] *= f;
        velocities[i3 + 1] *= f;
        velocities[i3 + 2] *= f;
      }
      velocities[i3 + 1] += gravity[i] * dt;
      positions[i3] += velocities[i3] * dt;
      positions[i3 + 1] += velocities[i3 + 1] * dt;
      positions[i3 + 2] += velocities[i3 + 2] * dt;

      if (positions[i3 + 1] < 0.04) {
        positions[i3 + 1] = 0.04;
        velocities[i3 + 1] *= -0.35;
        velocities[i3] *= 0.72;
        velocities[i3 + 2] *= 0.72;
      }

      colors[i3] = baseColors[i3] * k;
      colors[i3 + 1] = baseColors[i3 + 1] * k;
      colors[i3 + 2] = baseColors[i3 + 2] * k;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}

const _color = new THREE.Color();

export const particles = new ParticleSystem();

/* ======================================================= shockwaves */

const shockwaves = [];

export function spawnShockwave(pos, color, maxRadius = 6, life = 0.5, tilt = false) {
  const mesh = new THREE.Mesh(
    _ringGeo,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  mesh.position.set(pos.x, tilt ? pos.y : 0.13, pos.z);
  if (!tilt) mesh.rotation.x = -Math.PI / 2;
  scene.add(mesh);
  shockwaves.push({ mesh, t: 0, life, maxRadius });
}

const _ringGeo = new THREE.RingGeometry(0.35, 0.9, 56);

export function updateShockwaves(dt) {
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i];
    s.t += dt;
    const k = clamp(s.t / s.life, 0, 1);
    s.mesh.scale.setScalar(lerp(1, s.maxRadius, easeOutCubic(k)));
    s.mesh.material.opacity = (1 - k) * 0.9;
    if (k >= 1) {
      scene.remove(s.mesh);
      s.mesh.material.dispose();
      shockwaves.splice(i, 1);
    }
  }
}

/* =========================================================== orbs */
/* Layered energy spheres used by Blue / Red / Purple / Infinity.
   Each orb is its own small group so it can be animated and disposed. */

export function createEnergyOrb({ color, coreColor = 0xffffff, radius = 0.6 }) {
  const group = new THREE.Group();

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 18, 18),
    new THREE.MeshBasicMaterial({
      color: coreColor,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(core);

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.6, 22, 22),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(shell);

  const swirl = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.5, radius * 0.11, 10, 42),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  swirl.rotation.x = Math.PI / 2.4;
  group.add(swirl);

  const swirl2 = swirl.clone();
  swirl2.rotation.set(Math.PI / 1.7, 0.7, 0.4);
  group.add(swirl2);

  const light = new THREE.PointLight(color, 3.2, 16, 1.8);
  group.add(light);

  return {
    group,
    core,
    shell,
    swirl,
    swirl2,
    light,
    /** t: 0..1 life phase for generic pulsing */
    pulse(time, intensity = 1) {
      const p = 1 + Math.sin(time * 14) * 0.09 * intensity;
      core.scale.setScalar(p);
      shell.scale.setScalar(1 + Math.sin(time * 9 + 1) * 0.13 * intensity);
      swirl.rotation.z += 0.05;
      swirl2.rotation.z -= 0.038;
      swirl.rotation.x += 0.012;
      light.intensity = (2.6 + Math.sin(time * 11) * 0.9) * intensity;
    },
    setOpacity(k) {
      core.material.opacity = 0.95 * k;
      shell.material.opacity = 0.34 * k;
      swirl.material.opacity = 0.75 * k;
      swirl2.material.opacity = 0.75 * k;
      light.intensity = 3.2 * k;
    },
    dispose() {
      group.removeFromParent();
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    },
  };
}

/* ========================================================== trails */

const trails = [];

export function spawnTrail(pos, color, size = 0.35, life = 0.4) {
  const mesh = new THREE.Mesh(
    _trailGeo,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  mesh.position.copy(pos);
  mesh.scale.setScalar(size);
  scene.add(mesh);
  trails.push({ mesh, t: 0, life, size });
}

const _trailGeo = new THREE.SphereGeometry(1, 8, 8);

export function updateTrails(dt) {
  for (let i = trails.length - 1; i >= 0; i--) {
    const tr = trails[i];
    tr.t += dt;
    const k = clamp(tr.t / tr.life, 0, 1);
    tr.mesh.scale.setScalar(tr.size * (1 + k * 1.6));
    tr.mesh.material.opacity = (1 - k) * 0.5;
    if (k >= 1) {
      scene.remove(tr.mesh);
      tr.mesh.material.dispose();
      trails.splice(i, 1);
    }
  }
}

/* ========================================================== flash */

export function updateEffects(dt) {
  particles.update(dt);
  updateShockwaves(dt);
  updateTrails(dt);
}

export function clearTransientEffects() {
  for (const s of shockwaves) {
    scene.remove(s.mesh);
    s.mesh.material.dispose();
  }
  shockwaves.length = 0;
  for (const t of trails) {
    scene.remove(t.mesh);
    t.mesh.material.dispose();
  }
  trails.length = 0;
}
