import * as THREE from 'three';
import { scene } from './core.js';
import { particles } from './effects.js';
import { rand, clamp, lerp } from './utils.js';

export const ARENA_RADIUS = 24;

/* ------------------------------------------------------- textures */

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function asphaltTexture() {
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#141822';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(${rand(30, 60) | 0},${rand(34, 66) | 0},${rand(48, 84) | 0},0.35)`;
      ctx.fillRect(rand(0, s), rand(0, s), rand(1, 4), rand(1, 4));
    }
    ctx.strokeStyle = 'rgba(220,220,180,0.5)';
    ctx.lineWidth = 7;
    ctx.setLineDash([46, 40]);
    ctx.beginPath();
    ctx.moveTo(0, s / 2);
    ctx.lineTo(s, s / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = 'rgba(230,230,235,0.32)';
      ctx.fillRect(s * 0.18 + i * s * 0.12, s * 0.62, s * 0.07, s * 0.3);
    }
  });
}

function crackedGroundTexture() {
  return canvasTexture(512, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, '#2b2118');
    g.addColorStop(1, '#1c140d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(${rand(20, 50) | 0},${rand(14, 34) | 0},10,0.7)`;
      ctx.lineWidth = rand(1, 4);
      ctx.beginPath();
      let x = rand(0, s);
      let y = rand(0, s);
      ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += rand(-70, 70);
        y += rand(-70, 70);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = `rgba(${rand(60, 110) | 0},${rand(45, 80) | 0},${rand(30, 55) | 0},0.3)`;
      ctx.fillRect(rand(0, s), rand(0, s), rand(2, 9), rand(2, 9));
    }
  });
}

function helipadTexture() {
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#20242e';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < s; i += 16) {
      ctx.strokeStyle = 'rgba(120,140,180,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, s);
      ctx.moveTo(0, i);
      ctx.lineTo(s, i);
      ctx.stroke();
    }
    ctx.strokeStyle = '#e8c33a';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#e8c33a';
    ctx.font = `bold ${s * 0.3}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', s / 2, s / 2 + s * 0.02);
  });
}

function shrineFloorTexture() {
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#170c26';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 30; i++) {
      ctx.strokeStyle = 'rgba(90,60,150,0.28)';
      ctx.lineWidth = 2;
      ctx.strokeRect(rand(0, s - 60), rand(0, s - 60), rand(30, 60), rand(30, 60));
    }
    // glowing seal circle
    const cx = s / 2;
    const cy = s / 2;
    ctx.strokeStyle = 'rgba(180,110,255,0.65)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.22, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * s * 0.22, cy + Math.sin(a) * s * 0.22);
      ctx.lineTo(cx + Math.cos(a) * s * 0.34, cy + Math.sin(a) * s * 0.34);
      ctx.stroke();
    }
  });
}

function windowTexture(baseColor) {
  return canvasTexture(128, (ctx, s) => {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, s, s);
    for (let y = 6; y < s; y += 12) {
      for (let x = 6; x < s; x += 12) {
        const lit = Math.random() < 0.42;
        ctx.fillStyle = lit
          ? `rgba(${rand(180, 255) | 0},${rand(180, 240) | 0},${rand(120, 200) | 0},${rand(0.5, 0.95)})`
          : 'rgba(10,14,26,0.85)';
        ctx.fillRect(x, y, 7, 8);
      }
    }
  });
}

function glowLineTexture() {
  return canvasTexture(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 1, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(160,120,255,0.5)');
    g.addColorStop(1, 'rgba(120,80,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

/* -------------------------------------------------- shared geometry */

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  cone: new THREE.ConeGeometry(1, 1, 8),
  ico: new THREE.IcosahedronGeometry(1, 1),
  sphere: new THREE.SphereGeometry(1, 16, 16),
  plane: new THREE.PlaneGeometry(1, 1),
  ring: new THREE.RingGeometry(0.72, 1, 48),
};

function place(geo, mat, x, y, z, sx, sy, sz, parent, ry = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/* ================================================== TOKYO STREETS */

function buildTokyo() {
  const group = new THREE.Group();
  const animated = [];

  const ground = new THREE.Mesh(
    new THREE.CylinderGeometry(ARENA_RADIUS + 6, ARENA_RADIUS + 7, 1, 64),
    new THREE.MeshStandardMaterial({ map: asphaltTexture(), roughness: 0.72, metalness: 0.22 }),
  );
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  group.add(ground);

  const winTexA = windowTexture('#0d1220');
  const winTexB = windowTexture('#101726');

  // skyline ring
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rand(-0.05, 0.05);
    const r = rand(ARENA_RADIUS + 9, ARENA_RADIUS + 30);
    const w = rand(4, 8.5);
    const h = rand(14, 42);
    const mat = new THREE.MeshStandardMaterial({
      map: Math.random() < 0.5 ? winTexA : winTexB,
      emissive: 0x22304a,
      emissiveIntensity: 0.55,
      roughness: 0.85,
    });
    place(GEO.box, mat, Math.cos(a) * r, h / 2 - 3, Math.sin(a) * r, w, h, w, group, -a);
  }

  // neon signs
  const neonColors = [0xff2b8e, 0x2bd8ff, 0xb24dff, 0x24ffb8];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.2;
    const r = ARENA_RADIUS + rand(5, 9);
    const color = neonColors[i % neonColors.length];
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sign = place(GEO.box, mat, Math.cos(a) * r, rand(4, 13), Math.sin(a) * r, 0.4, rand(1.6, 3.2), rand(2.2, 4.4), group, -a);
    sign.castShadow = false;
    animated.push({ type: 'flicker', mesh: sign, phase: Math.random() * 10 });
  }

  // street lamps (emissive heads + 2 real lights)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    const r = ARENA_RADIUS - 2.2;
    place(GEO.cyl, new THREE.MeshStandardMaterial({ color: 0x2c3242, roughness: 0.6, metalness: 0.5 }), Math.cos(a) * r, 3, Math.sin(a) * r, 0.12, 6, 0.12, group);
    const head = place(
      GEO.sphere,
      new THREE.MeshBasicMaterial({ color: 0xffe6b0, transparent: true, opacity: 0.95 }),
      Math.cos(a) * r, 6.1, Math.sin(a) * r, 0.35, 0.35, 0.35, group,
    );
    head.castShadow = false;
  }

  const lamp1 = new THREE.PointLight(0xffc98a, 60, 30, 1.8);
  lamp1.position.set(10, 8, 8);
  const lamp2 = new THREE.PointLight(0x7ab8ff, 50, 30, 1.8);
  lamp2.position.set(-11, 8, -9);
  group.add(lamp1, lamp2);

  return {
    name: 'TOKYO — SHIBUYA STREETS',
    group,
    fog: { color: 0x060912, near: 34, far: 130 },
    lights: {
      moon: { color: 0x86a8ff, intensity: 1.15, pos: [18, 32, 14] },
      hemi: { sky: 0x4b62c8, ground: 0x0b1020, intensity: 0.6 },
      rim: { color: 0xb14dff, intensity: 0.75, pos: [-20, 10, -14] },
    },
    update(dt, time) {
      for (const a of animated) {
        a.mesh.material.opacity = 0.55 + Math.abs(Math.sin(time * 2.2 + a.phase)) * 0.45;
      }
      if (Math.random() < dt * 12) {
        particles.spawn(
          { x: rand(-ARENA_RADIUS, ARENA_RADIUS), y: rand(6, 16), z: rand(-ARENA_RADIUS, ARENA_RADIUS) },
          0x4d7dff, 1, 1.2, 1.1, -22, 0,
        );
      }
    },
  };
}

/* ==================================================== RUINED CITY */

function buildRuins() {
  const group = new THREE.Group();
  const animated = [];

  const ground = new THREE.Mesh(
    new THREE.CylinderGeometry(ARENA_RADIUS + 6, ARENA_RADIUS + 8, 1.2, 56),
    new THREE.MeshStandardMaterial({ map: crackedGroundTexture(), roughness: 0.95, metalness: 0.05 }),
  );
  ground.position.y = -0.6;
  ground.receiveShadow = true;
  group.add(ground);

  const concrete = new THREE.MeshStandardMaterial({ color: 0x4c4438, roughness: 0.92, metalness: 0.04 });
  const concreteDark = new THREE.MeshStandardMaterial({ color: 0x332c22, roughness: 0.95 });

  // collapsed slabs leaning around the arena
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rand(-0.12, 0.12);
    const r = rand(ARENA_RADIUS - 4, ARENA_RADIUS + 5);
    const slab = place(
      GEO.box, i % 2 ? concrete : concreteDark,
      Math.cos(a) * r, rand(1.5, 5), Math.sin(a) * r,
      rand(1.6, 3.4), rand(5, 12), rand(0.7, 1.5), group,
      -a + rand(-0.5, 0.5),
    );
    slab.rotation.z = rand(-0.4, 0.4);
  }

  // rubble piles inside the arena
  for (let i = 0; i < 22; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(8, ARENA_RADIUS - 2);
    place(GEO.ico, concreteDark, Math.cos(a) * r, rand(0.1, 0.6), Math.sin(a) * r, rand(0.5, 1.4), rand(0.4, 1), rand(0.5, 1.4), group, rand(0, 3));
  }

  // ruined torii gate at the far edge
  const torii = new THREE.Group();
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x7a2b22, roughness: 0.8, emissive: 0x2a0c06, emissiveIntensity: 0.4 });
  for (const side of [-1, 1]) {
    const post = place(GEO.cyl, pillarMat, side * 7, 6, 0, 0.85, 12, 0.85, torii);
    post.rotation.z = side * 0.06;
  }
  const beam = place(GEO.box, pillarMat, 0, 11.6, 0, 9.6, 1.1, 1.2, torii);
  beam.rotation.z = -0.05;
  place(GEO.box, pillarMat, 0, 9.9, 0, 8, 0.7, 1, torii);
  torii.position.set(0, -1, -ARENA_RADIUS - 2);
  group.add(torii);

  // fire pits
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.7;
    const r = rand(9, 16);
    const fire = place(
      GEO.sphere,
      new THREE.MeshBasicMaterial({ color: 0xff7a1e, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
      Math.cos(a) * r, 0.6, Math.sin(a) * r, 0.55, 0.8, 0.55, group,
    );
    fire.castShadow = false;
    animated.push({ type: 'fire', mesh: fire, phase: Math.random() * 10, x: fire.position.x, z: fire.position.z });
    place(GEO.cyl, concreteDark, Math.cos(a) * r, 0.25, Math.sin(a) * r, 0.9, 0.5, 0.9, group);
  }

  return {
    name: 'RUINS — FALLEN WARD',
    group,
    fog: { color: 0x150c06, near: 28, far: 115 },
    lights: {
      moon: { color: 0xff9a5c, intensity: 1.25, pos: [-14, 26, -18] },
      hemi: { sky: 0x8a4a28, ground: 0x140a05, intensity: 0.55 },
      rim: { color: 0xff4020, intensity: 0.85, pos: [16, 8, 12] },
    },
    update(dt, time) {
      for (const a of animated) {
        const k = 0.8 + Math.sin(time * 6 + a.phase) * 0.25;
        a.mesh.scale.set(0.55 * k, 0.8 * (2 - k), 0.55 * k);
        if (Math.random() < dt * 8) {
          particles.spawn({ x: a.x, y: 1, z: a.z }, 0xff8a2e, 2, 2.2, 0.8, 1.5);
        }
      }
      if (Math.random() < dt * 5) {
        particles.spawn({ x: rand(-22, 22), y: rand(0.2, 2), z: rand(-22, 22) }, 0xc9b28a, 1, 0.8, 2.4, 0.35);
      }
    },
  };
}

/* ====================================================== ROOFTOP */

function buildRooftop() {
  const group = new THREE.Group();
  const animated = [];

  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(ARENA_RADIUS, ARENA_RADIUS + 1.2, 1.6, 64),
    new THREE.MeshStandardMaterial({ map: helipadTexture(), roughness: 0.55, metalness: 0.5 }),
  );
  deck.position.y = -0.8;
  deck.receiveShadow = true;
  group.add(deck);

  // railing
  const railMat = new THREE.MeshStandardMaterial({ color: 0x39424f, roughness: 0.45, metalness: 0.75 });
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    place(GEO.cyl, railMat, Math.cos(a) * (ARENA_RADIUS - 0.4), 1.2, Math.sin(a) * (ARENA_RADIUS - 0.4), 0.08, 2.4, 0.08, group);
  }
  const rail = new THREE.Mesh(new THREE.TorusGeometry(ARENA_RADIUS - 0.4, 0.12, 8, 64), railMat);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 2.35;
  rail.receiveShadow = true;
  group.add(rail);

  // AC units + antennas + water tank
  const unitMat = new THREE.MeshStandardMaterial({ color: 0x4a5462, roughness: 0.6, metalness: 0.55 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const r = rand(12, ARENA_RADIUS - 3);
    place(GEO.box, unitMat, Math.cos(a) * r, 1, Math.sin(a) * r, 2.2, 2, 1.6, group, -a);
    place(GEO.cyl, unitMat, Math.cos(a) * r, 4.2, Math.sin(a) * r, 0.09, 5, 0.09, group);
    const beacon = place(
      GEO.sphere,
      new THREE.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.9 }),
      Math.cos(a) * r, 6.8, Math.sin(a) * r, 0.16, 0.16, 0.16, group,
    );
    beacon.castShadow = false;
    animated.push({ type: 'blink', mesh: beacon, phase: i * 0.7 });
  }
  const tank = place(GEO.cyl, unitMat, -12, 3.4, 10, 3, 4.4, 3, group);
  tank.receiveShadow = true;

  // city below the tower
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    const r = rand(34, 70);
    const h = rand(16, 50);
    place(
      GEO.box,
      new THREE.MeshStandardMaterial({ color: 0x11182a, emissive: 0x1b2c52, emissiveIntensity: 0.5, roughness: 0.9 }),
      Math.cos(a) * r, -28 + h / 2, Math.sin(a) * r, rand(5, 10), h, rand(5, 10), group, -a,
    );
  }

  return {
    name: 'ROOFTOP — JUJUTU HIGH',
    group,
    fog: { color: 0x0a1226, near: 40, far: 150 },
    lights: {
      moon: { color: 0xa8c8ff, intensity: 1.5, pos: [10, 36, -20] },
      hemi: { sky: 0x5470d8, ground: 0x0c1224, intensity: 0.72 },
      rim: { color: 0x2fd8ff, intensity: 0.7, pos: [-18, 12, 16] },
    },
    update(dt, time) {
      for (const a of animated) {
        a.mesh.material.opacity = Math.sin(time * 2.4 + a.phase) > 0.55 ? 0.95 : 0.15;
      }
      // wind streaks
      if (Math.random() < dt * 14) {
        particles.spawn(
          { x: rand(-24, 24), y: rand(0.4, 7), z: rand(-24, 24) },
          0x9fd8ff, 1, 9, 0.8, 0, 0.2,
        );
      }
    },
  };
}

/* ================================================ CURSED SHRINE */

function buildShrine() {
  const group = new THREE.Group();
  const animated = [];

  const ground = new THREE.Mesh(
    new THREE.CylinderGeometry(ARENA_RADIUS + 4, ARENA_RADIUS + 5, 1.2, 64),
    new THREE.MeshStandardMaterial({ map: shrineFloorTexture(), roughness: 0.7, metalness: 0.25, emissive: 0x3a1a66, emissiveIntensity: 0.35 }),
  );
  ground.position.y = -0.6;
  ground.receiveShadow = true;
  group.add(ground);

  const stone = new THREE.MeshStandardMaterial({ color: 0x241436, roughness: 0.85, metalness: 0.12, emissive: 0x2a1247, emissiveIntensity: 0.4 });

  // massive column ring
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = ARENA_RADIUS + 1.5;
    place(GEO.cyl, stone, Math.cos(a) * r, 8, Math.sin(a) * r, 1.7, 16, 1.7, group);
    place(GEO.box, stone, Math.cos(a) * r, 16.4, Math.sin(a) * r, 4, 1.1, 4, group, -a);
  }

  // inner pillars with glowing rings
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.35;
    const r = 14;
    place(GEO.cyl, stone, Math.cos(a) * r, 3.6, Math.sin(a) * r, 0.95, 7.2, 0.95, group);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.25, 0.1, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xb266ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ring.position.set(Math.cos(a) * r, 4.2, Math.sin(a) * r);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    animated.push({ type: 'spin', mesh: ring, phase: i });
  }

  // floating talismans
  for (let i = 0; i < 16; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(6, 20);
    const paper = place(
      GEO.plane,
      new THREE.MeshBasicMaterial({
        color: 0xe8d9ff,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        emissive: 0x7b2bff,
      }),
      Math.cos(a) * r, rand(1.5, 6.5), Math.sin(a) * r, 0.45, 0.9, 1, group, rand(0, 3),
    );
    paper.castShadow = false;
    paper.material.emissive = new THREE.Color(0x7b2bff);
    paper.material.emissiveIntensity = 0.6;
    animated.push({ type: 'drift', mesh: paper, phase: Math.random() * 10, baseY: paper.position.y });
  }

  // purple flames
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 1.1;
    const r = 9.5;
    const flame = place(
      GEO.sphere,
      new THREE.MeshBasicMaterial({ color: 0x9a3cff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
      Math.cos(a) * r, 1.1, Math.sin(a) * r, 0.5, 0.95, 0.5, group,
    );
    flame.castShadow = false;
    animated.push({ type: 'fire', mesh: flame, phase: Math.random() * 10, x: flame.position.x, z: flame.position.z, color: 0xb266ff });
    place(GEO.cyl, stone, Math.cos(a) * r, 0.45, Math.sin(a) * r, 0.85, 0.9, 0.85, group);
  }

  return {
    name: 'CURSED SHRINE — VEILED HALL',
    group,
    fog: { color: 0x0c0418, near: 24, far: 105 },
    lights: {
      moon: { color: 0xb266ff, intensity: 1.15, pos: [6, 30, -10] },
      hemi: { sky: 0x6a2bd8, ground: 0x0d0418, intensity: 0.6 },
      rim: { color: 0xff2b8e, intensity: 0.65, pos: [-16, 9, 14] },
    },
    update(dt, time) {
      for (const a of animated) {
        switch (a.type) {
          case 'spin':
            a.mesh.rotation.z += dt * 1.2;
            a.mesh.material.opacity = 0.55 + Math.sin(time * 3 + a.phase) * 0.3;
            break;
          case 'drift':
            a.mesh.position.y = a.baseY + Math.sin(time * 0.9 + a.phase) * 0.55;
            a.mesh.rotation.y += dt * 0.7;
            a.mesh.rotation.z = Math.sin(time * 1.1 + a.phase) * 0.5;
            break;
          case 'fire': {
            const k = 0.85 + Math.sin(time * 7 + a.phase) * 0.22;
            a.mesh.scale.set(0.5 * k, 0.95 * (2 - k), 0.5 * k);
            if (Math.random() < dt * 7) {
              particles.spawn({ x: a.x, y: 1.5, z: a.z }, 0xb266ff, 2, 1.6, 0.9, 1.2);
            }
            break;
          }
        }
      }
    },
  };
}

/* ============================================== INFINITE VOID */

export function buildVoidDomain() {
  const group = new THREE.Group();

  // cosmic backdrop shell
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(160, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0x0b0226, side: THREE.BackSide, fog: false }),
  );
  group.add(shell);

  // dense star field
  const starCount = 1600;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(rand(-1, 1));
    const r = rand(40, 150);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    const c = Math.random();
    colors[i * 3] = 0.65 + c * 0.35;
    colors[i * 3 + 1] = 0.7 + c * 0.3;
    colors[i * 3 + 2] = 1;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ size: 1.5, vertexColors: true, transparent: true, opacity: 0.9, fog: false, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  group.add(stars);

  const animated = [{ type: 'stars', mesh: stars }];

  // glowing concentric rings on the void "floor"
  for (let i = 0; i < 7; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(6 + i * 5.2, 0.22 + i * 0.05, 10, 72),
      new THREE.MeshBasicMaterial({
        color: i % 2 ? 0x7b4dff : 0x35c8ff,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.2 - i * 0.35;
    group.add(ring);
    animated.push({ type: 'ring', mesh: ring, phase: i * 0.8, speed: (i % 2 ? 1 : -1) * (0.06 + i * 0.02) });
  }

  // central light pillar
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 4.2, 90, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xa066ff,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  pillar.position.y = 30;
  group.add(pillar);
  animated.push({ type: 'pillar', mesh: pillar });

  // floating shards
  for (let i = 0; i < 26; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(10, 46);
    const shard = new THREE.Mesh(
      GEO.oct || new THREE.OctahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({
        color: Math.random() < 0.5 ? 0x7b4dff : 0x35c8ff,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    shard.position.set(Math.cos(a) * r, rand(-4, 22), Math.sin(a) * r);
    shard.scale.setScalar(rand(0.4, 1.6));
    group.add(shard);
    animated.push({ type: 'shard', mesh: shard, phase: Math.random() * 10, baseY: shard.position.y });
  }

  // flowing energy arcs (large tilted tori)
  for (let i = 0; i < 5; i++) {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(30 + i * 7, 0.35, 8, 64),
      new THREE.MeshBasicMaterial({
        color: 0x5a2bd8,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    arc.position.y = rand(2, 16);
    arc.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
    group.add(arc);
    animated.push({ type: 'arc', mesh: arc, speed: rand(-0.12, 0.12) });
  }

  return {
    name: 'INFINITE VOID',
    group,
    fog: { color: 0x140433, near: 26, far: 190 },
    lights: {
      moon: { color: 0xb08aff, intensity: 1.6, pos: [0, 40, 0] },
      hemi: { sky: 0x7b4dff, ground: 0x140433, intensity: 0.9 },
      rim: { color: 0x35c8ff, intensity: 1.1, pos: [0, -8, 0] },
    },
    update(dt, time) {
      for (const a of animated) {
        switch (a.type) {
          case 'stars':
            a.mesh.rotation.y += dt * 0.02;
            a.mesh.material.opacity = 0.8 + Math.sin(time * 1.3) * 0.12;
            break;
          case 'ring':
            a.mesh.rotation.z += dt * a.speed;
            a.mesh.material.opacity = 0.3 + Math.sin(time * 1.6 + a.phase) * 0.18;
            break;
          case 'pillar':
            a.mesh.rotation.y += dt * 0.25;
            a.mesh.material.opacity = 0.13 + Math.sin(time * 2.1) * 0.05;
            break;
          case 'shard':
            a.mesh.rotation.x += dt * 0.35;
            a.mesh.rotation.y += dt * 0.22;
            a.mesh.position.y = a.baseY + Math.sin(time * 0.8 + a.phase) * 1.1;
            break;
          case 'arc':
            a.mesh.rotation.z += dt * a.speed;
            break;
        }
      }
      if (Math.random() < dt * 10) {
        particles.spawn(
          { x: rand(-30, 30), y: rand(-2, 18), z: rand(-30, 30) },
          Math.random() < 0.5 ? 0x9a6bff : 0x4fd8ff, 1, 1.4, 2.6, 0.4,
        );
      }
    },
  };
}

/* ================================================ level registry */

const BUILDERS = {
  tokyo: buildTokyo,
  ruins: buildRuins,
  rooftop: buildRooftop,
  shrine: buildShrine,
};

export const LEVEL_ORDER = ['tokyo', 'ruins', 'rooftop', 'shrine'];

/** Handcrafted arenas cycle with rising difficulty; each has a real identity. */
export function buildLevel(theme) {
  const builder = BUILDERS[theme] || buildTokyo;
  const level = builder();
  level.group.visible = true;
  scene.add(level.group);
  return level;
}

export function setVisible(level, visible) {
  if (level && level.group) level.group.visible = visible;
}

/* --------------------------------------------- encounter design */

/**
 * Enemy compositions per round. Early rounds teach, mid rounds mix
 * archetypes, every 4th round is a boss encounter with phases.
 */
export function buildEncounter(round) {
  const levelTheme = LEVEL_ORDER[(round - 1) % LEVEL_ORDER.length];
  const isBoss = round % 4 === 0;

  if (isBoss) {
    return { theme: levelTheme, isBoss, types: ['boss'] };
  }

  const types = [];
  const tier = Math.floor((round - 1) / LEVEL_ORDER.length);
  if (round === 1) types.push('stalker');
  else if (round === 2) types.push('stalker', 'stalker');
  else if (round === 3) types.push('brute', 'stalker');
  else {
    types.push('brute');
    types.push('stalker');
    if (tier >= 1) types.push('warlock');
    if (tier >= 2) types.push('stalker', 'warlock');
    if (tier >= 3) types.push('brute', 'warlock');
  }

  return { theme: levelTheme, isBoss, types };
}

export { clamp, lerp };
