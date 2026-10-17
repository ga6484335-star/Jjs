import * as THREE from 'three';
import { rand, clamp, lerp, damp, angleLerp } from './utils.js';

/* ------------------------------------------------------- glow sprite */

let glowTexture = null;

export function makeGlowTexture() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(160,220,255,0.55)');
  g.addColorStop(1, 'rgba(120,180,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}

function glowSprite(color, size) {
  const mat = new THREE.SpriteMaterial({
    map: makeGlowTexture(),
    color,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(size);
  return s;
}

/* ============================================================ GOJO */
/* Procedural, rigged with pivot groups: hips/spine/head/shoulders/elbows/
   hips-knees. Not a placeholder mannequin: layered hair silhouette, Six
   Eyes glow under the blindfold, high-collared dark uniform with trim. */

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

export function createGojo() {
  const group = new THREE.Group();

  const jacket = new THREE.MeshStandardMaterial({
    color: 0x161d36,
    roughness: 0.52,
    metalness: 0.16,
    emissive: 0x0a1230,
    emissiveIntensity: 0.25,
  });
  const jacketLight = new THREE.MeshStandardMaterial({
    color: 0x212c52,
    roughness: 0.5,
    metalness: 0.2,
    emissive: 0x111c44,
    emissiveIntensity: 0.3,
  });
  const pants = new THREE.MeshStandardMaterial({ color: 0x121830, roughness: 0.6, metalness: 0.12 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0f1f, roughness: 0.45, metalness: 0.3 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xf3cba6, roughness: 0.62, metalness: 0.02 });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0xeef1ff,
    roughness: 0.42,
    metalness: 0.12,
    emissive: 0x2b3c72,
    emissiveIntensity: 0.32,
  });
  const silver = new THREE.MeshStandardMaterial({
    color: 0xc9d4ff,
    roughness: 0.28,
    metalness: 0.85,
    emissive: 0x22305c,
    emissiveIntensity: 0.35,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x8fe8ff,
    emissive: 0x54d8ff,
    emissiveIntensity: 3.2,
    roughness: 0.2,
  });

  /* ------------------------------------------------------- legs */
  function buildLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(0.22 * side, 1.18, 0);

    const thigh = mesh(new THREE.BoxGeometry(0.3, 0.58, 0.32), pants, 0, -0.29, 0);
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.58;
    const shin = mesh(new THREE.BoxGeometry(0.26, 0.52, 0.28), pants, 0, -0.26, 0);
    knee.add(shin);

    const boot = mesh(new THREE.BoxGeometry(0.3, 0.2, 0.42), dark, 0, -0.56, 0.06);
    knee.add(boot);
    const bootCuff = mesh(new THREE.BoxGeometry(0.32, 0.12, 0.34), jacketLight, 0, -0.44, 0);
    knee.add(bootCuff);

    hip.add(knee);
    return { hip, knee };
  }

  const legL = buildLeg(1);
  const legR = buildLeg(-1);
  group.add(legL.hip, legR.hip);

  /* ------------------------------------------------------ spine */
  const spine = new THREE.Group();
  spine.position.y = 1.18;
  group.add(spine);

  const chest = mesh(new THREE.BoxGeometry(0.92, 0.72, 0.5), jacket, 0, 0.36, 0);
  chest.scale.set(1, 1, 1);
  spine.add(chest);

  const chestUpper = mesh(new THREE.BoxGeometry(0.98, 0.36, 0.54), jacketLight, 0, 0.78, 0);
  spine.add(chestUpper);

  // jacket front panel + silver trim lines
  const panel = mesh(new THREE.BoxGeometry(0.3, 0.98, 0.06), jacketLight, 0, 0.44, 0.28);
  spine.add(panel);
  for (const x of [-0.31, 0.31]) {
    const trim = mesh(new THREE.BoxGeometry(0.035, 0.95, 0.05), silver, x, 0.45, 0.265);
    spine.add(trim);
  }
  for (let i = 0; i < 3; i++) {
    const button = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), silver, 0, 0.28 + i * 0.26, 0.32);
    button.rotation.x = Math.PI / 2;
    spine.add(button);
  }

  // high collar with angled flaps
  const collar = mesh(new THREE.BoxGeometry(0.62, 0.22, 0.5), jacketLight, 0, 1.03, -0.02);
  spine.add(collar);
  for (const side of [-1, 1]) {
    const flap = mesh(new THREE.BoxGeometry(0.1, 0.34, 0.42), jacketLight, side * 0.31, 1.06, 0.12);
    flap.rotation.z = side * 0.38;
    flap.rotation.x = -0.12;
    spine.add(flap);
  }

  // belt + buckle
  const belt = mesh(new THREE.BoxGeometry(0.92, 0.13, 0.52), dark, 0, -0.02, 0);
  spine.add(belt);
  const buckle = mesh(new THREE.BoxGeometry(0.16, 0.12, 0.05), silver, 0, -0.02, 0.28);
  spine.add(buckle);

  // flared jacket skirt
  const skirt = mesh(new THREE.BoxGeometry(1.02, 0.34, 0.62), jacket, 0, -0.22, 0);
  skirt.rotation.x = 0.05;
  spine.add(skirt);

  /* ------------------------------------------------------- arms */
  function buildArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.58 * side, 0.88, 0);

    const pad = mesh(new THREE.BoxGeometry(0.3, 0.24, 0.34), jacketLight, side * 0.02, 0.06, 0);
    shoulder.add(pad);

    const upper = mesh(new THREE.BoxGeometry(0.24, 0.5, 0.26), jacket, 0, -0.28, 0);
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.54;
    const fore = mesh(new THREE.BoxGeometry(0.21, 0.46, 0.23), jacket, 0, -0.24, 0);
    elbow.add(fore);

    const cuff = mesh(new THREE.BoxGeometry(0.23, 0.1, 0.25), silver, 0, -0.44, 0);
    elbow.add(cuff);

    const hand = mesh(new THREE.SphereGeometry(0.14, 12, 12), dark, 0, -0.56, 0.02);
    hand.scale.set(0.95, 1.15, 1.1);
    elbow.add(hand);

    shoulder.add(elbow);
    return { shoulder, elbow, hand };
  }

  const armL = buildArm(1);
  const armR = buildArm(-1);
  spine.add(armL.shoulder, armR.shoulder);

  /* ------------------------------------------------------- head */
  const head = new THREE.Group();
  head.position.y = 1.18;
  spine.add(head);

  const neck = mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.18, 10), skin, 0, 0.05, 0);
  head.add(neck);

  const skull = mesh(new THREE.SphereGeometry(0.3, 24, 24), skin, 0, 0.32, 0.01);
  skull.scale.set(0.98, 1.12, 1.02);
  head.add(skull);

  const jaw = mesh(new THREE.BoxGeometry(0.34, 0.16, 0.32), skin, 0, 0.16, 0.1);
  jaw.scale.set(1, 1, 0.9);
  head.add(jaw);

  const nose = mesh(new THREE.BoxGeometry(0.06, 0.1, 0.08), skin, 0, 0.3, 0.31);
  nose.rotation.x = -0.25;
  head.add(nose);

  const mouth = mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), dark, 0, 0.19, 0.3);
  head.add(mouth);

  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.07, 10, 10), skin, side * 0.29, 0.3, 0);
    ear.scale.set(0.55, 1, 0.75);
    head.add(ear);
  }

  /* ------------------------------------- Six Eyes (glow under blindfold) */
  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.062, 12, 12), eyeMat, side * 0.135, 0.335, 0.275);
    eye.scale.set(1.5, 0.8, 0.6);
    head.add(eye);
    eyes.push(eye);

    const glow = glowSprite(0x66d8ff, 0.42);
    glow.position.set(side * 0.135, 0.335, 0.32);
    head.add(glow);
    eyes.push(glow);
  }

  /* -------------------------------------------------- blindfold */
  const blindfold = mesh(new THREE.BoxGeometry(0.66, 0.19, 0.62), dark, 0, 0.42, 0.02);
  blindfold.rotation.x = -0.06;
  head.add(blindfold);
  const blindKnot = mesh(new THREE.BoxGeometry(0.12, 0.16, 0.12), dark, 0, 0.42, -0.32);
  head.add(blindKnot);
  for (const side of [-1, 1]) {
    const band = mesh(new THREE.BoxGeometry(0.06, 0.16, 0.5), dark, side * 0.33, 0.42, -0.02);
    band.rotation.y = side * 0.16;
    head.add(band);
  }

  /* ------------------------------------------------------- hair */
  const hair = new THREE.Group();
  head.add(hair);

  const hairCap = mesh(new THREE.SphereGeometry(0.335, 20, 20), hairMat, 0, 0.46, -0.02);
  hairCap.scale.set(1.06, 0.92, 1.08);
  hair.add(hairCap);

  // crown spikes: swept up and back for a sharp silhouette
  const spikeGeo = new THREE.ConeGeometry(0.1, 0.52, 6);
  const spikeSpecs = [
    [0, 0.72, -0.02, -0.22, 0, 0.24],
    [-0.14, 0.7, 0.06, -0.3, 0, 0.34],
    [0.14, 0.7, 0.06, -0.3, 0, -0.34],
    [-0.24, 0.62, -0.12, -0.62, 0, 0.5],
    [0.24, 0.62, -0.12, -0.62, 0, -0.5],
    [-0.2, 0.58, 0.18, -0.28, 0, 0.62],
    [0.2, 0.58, 0.18, -0.28, 0, -0.62],
    [0, 0.6, -0.26, -1.05, 0, 0],
    [-0.12, 0.56, -0.28, -1.15, 0, 0.22],
    [0.12, 0.56, -0.28, -1.15, 0, -0.22],
  ];
  for (const [x, y, z, rx, ry, rz] of spikeSpecs) {
    const s = mesh(spikeGeo, hairMat, x, y, z);
    s.rotation.set(rx, ry, rz);
    s.scale.setScalar(rand(0.85, 1.25));
    hair.add(s);
  }

  // fringe sweeping across the forehead above the blindfold
  for (const side of [-1, 1]) {
    const fringe = mesh(new THREE.ConeGeometry(0.11, 0.4, 6), hairMat, side * 0.19, 0.6, 0.24);
    fringe.rotation.set(1.25, 0, side * 0.5);
    hair.add(fringe);
    const sideLock = mesh(new THREE.ConeGeometry(0.09, 0.36, 6), hairMat, side * 0.32, 0.42, 0.12);
    sideLock.rotation.set(0.45, 0, side * 0.85);
    hair.add(sideLock);
  }

  const backHair = mesh(new THREE.ConeGeometry(0.2, 0.55, 7), hairMat, 0, 0.36, -0.26);
  backHair.rotation.x = -0.95;
  hair.add(backHair);

  /* ------------------------------------------------- shading prep */
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  const model = {
    group,
    parts: {
      spine,
      head,
      hair,
      legL,
      legR,
      armL,
      armR,
      eyes,
      eyeMat,
      hairMat,
      jacket,
      jacketLight,
    },
  };
  return model;
}

/* ------------------------------------------------ Gojo procedural anim */
/* Pose-blended: base pose + additive locomotion + one-shot action poses
   that decay back smoothly. No instant snapping between states. */

export function animateGojo(model, player, dt, time) {
  const p = model.parts;
  const speed = Math.hypot(player.vel.x, player.vel.z);
  const moving = speed > 0.8 && player.onGround;
  const runK = clamp(speed / 10, 0, 1);
  const t = time * (7 + runK * 6);

  /* ---- locomotion: legs and arms swing with knee/elbow bend */
  const swing = Math.sin(t) * (0.28 + 0.62 * runK) * (moving ? 1 : 0);
  const swing2 = Math.cos(t) * (0.1 + 0.22 * runK) * (moving ? 1 : 0);

  p.legL.hip.rotation.x = lerp(p.legL.hip.rotation.x, swing, damp(14, dt));
  p.legR.hip.rotation.x = lerp(p.legR.hip.rotation.x, -swing, damp(14, dt));
  p.legL.knee.rotation.x = lerp(
    p.legL.knee.rotation.x,
    Math.max(0, -Math.sin(t)) * 0.85 * runK * (moving ? 1 : 0),
    damp(14, dt),
  );
  p.legR.knee.rotation.x = lerp(
    p.legR.knee.rotation.x,
    Math.max(0, Math.sin(t)) * 0.85 * runK * (moving ? 1 : 0),
    damp(14, dt),
  );

  const armSwingL = -swing * 0.8;
  const armSwingR = swing * 0.8;

  /* ---- idle: subtle breathing + weight shift */
  const breathe = Math.sin(time * 2.1);
  p.spine.rotation.x = lerp(p.spine.rotation.x, breathe * 0.022 + runK * 0.1, damp(8, dt));
  p.spine.rotation.z = lerp(p.spine.rotation.z, Math.sin(time * 0.9) * 0.02 - runK * 0.05, damp(6, dt));
  p.head.rotation.y = lerp(p.head.rotation.y, Math.sin(time * 0.6) * 0.12, damp(5, dt));
  p.head.rotation.x = lerp(p.head.rotation.x, -runK * 0.06, damp(6, dt));

  /* ---- hair secondary motion (follows head/spine with lag) */
  p.hair.rotation.z = lerp(p.hair.rotation.z, -p.spine.rotation.z * 2 + Math.sin(time * 1.7) * 0.035, damp(6, dt));
  p.hair.rotation.x = lerp(p.hair.rotation.x, p.spine.rotation.x * 1.4 + 0.02, damp(6, dt));

  /* ---- air pose */
  if (!player.onGround) {
    p.legL.hip.rotation.x = lerp(p.legL.hip.rotation.x, -0.55, damp(10, dt));
    p.legR.hip.rotation.x = lerp(p.legR.hip.rotation.x, 0.3, damp(10, dt));
    p.legL.knee.rotation.x = lerp(p.legL.knee.rotation.x, 0.75, damp(10, dt));
    p.legR.knee.rotation.x = lerp(p.legR.knee.rotation.x, 0.25, damp(10, dt));
    p.spine.rotation.x = lerp(p.spine.rotation.x, -0.12, damp(8, dt));
  }

  /* ---- hurt reaction */
  if (player.hurtTimer > 0) {
    const k = player.hurtTimer / 0.32;
    p.spine.rotation.x = lerp(p.spine.rotation.x, -0.34 * k, damp(16, dt));
    p.head.rotation.x = lerp(p.head.rotation.x, 0.3 * k, damp(16, dt));
  }

  /* ---- one-shot action poses (attack / abilities / domain) */
  let targetArmL = armSwingL;
  let targetArmR = armSwingR;
  let targetElbowL = -0.16;
  let targetElbowR = -0.16;
  let spineTwist = 0;
  let spineLean = 0;

  if (player.attackAnim > 0) {
    const dur = player.animDuration || 0.32;
    const k = clamp(1 - player.attackAnim / dur, 0, 1);
    const thrust = Math.sin(Math.min(1, k * 1.25) * Math.PI);
    switch (player.attackKind) {
      case 'finisher':
        targetArmR = -2.35 * thrust;
        targetElbowR = -0.25 + 1.1 * thrust;
        spineTwist = -0.55 * thrust;
        spineLean = 0.18 * thrust;
        break;
      case 'blue':
        targetArmR = -1.55 * thrust;
        targetElbowR = -0.9 + 0.35 * thrust;
        targetArmL = 0.35 * thrust;
        spineTwist = -0.18 * thrust;
        break;
      case 'red':
        targetArmR = -1.1 - 1.15 * thrust;
        targetElbowR = -1.25 + 1.05 * thrust;
        targetArmL = -0.5 * thrust;
        spineTwist = -0.32 * thrust;
        spineLean = -0.12 * thrust;
        break;
      case 'purple':
        targetArmR = -1.35 * thrust;
        targetArmL = -1.35 * thrust;
        targetElbowR = -0.75 + 0.3 * thrust;
        targetElbowL = -0.75 + 0.3 * thrust;
        spineLean = -0.1 * thrust;
        break;
      case 'domain':
        targetArmR = -1.15 * thrust;
        targetArmL = -1.15 * thrust;
        targetElbowR = -1.25 + 1.2 * thrust;
        targetElbowL = -1.25 + 1.2 * thrust;
        spineLean = -0.18 * thrust;
        break;
      case 'infinity':
        targetArmR = -0.85 * thrust;
        targetArmL = -0.85 * thrust;
        targetElbowR = -1.15;
        targetElbowL = -1.15;
        break;
      default: {
        // punch combo: alternating hands with snap
        const useLeft = player.comboStep === 1;
        const punch = (useLeft ? targetArmL : targetArmR);
        if (useLeft) {
          targetArmL = lerp(punch, -1.75 * thrust, 1);
          targetElbowL = -1.15 + 1.1 * thrust;
        } else {
          targetArmR = lerp(punch, -1.75 * thrust, 1);
          targetElbowR = -1.15 + 1.1 * thrust;
        }
        spineTwist = (useLeft ? 0.34 : -0.34) * thrust;
        spineLean = 0.12 * thrust;
      }
    }
  } else {
    targetElbowL = -0.16 - runK * 0.35;
    targetElbowR = -0.16 - runK * 0.35;
  }

  const poseDamp = damp(player.attackAnim > 0 ? 22 : 9, dt);
  p.armL.shoulder.rotation.x = lerp(p.armL.shoulder.rotation.x, targetArmL, poseDamp);
  p.armR.shoulder.rotation.x = lerp(p.armR.shoulder.rotation.x, targetArmR, poseDamp);
  p.armL.elbow.rotation.x = lerp(p.armL.elbow.rotation.x, targetElbowL, poseDamp);
  p.armR.elbow.rotation.x = lerp(p.armR.elbow.rotation.x, targetElbowR, poseDamp);
  p.spine.rotation.y = lerp(p.spine.rotation.y, spineTwist, poseDamp);
  if (player.attackAnim <= 0 && player.hurtTimer <= 0) {
    p.spine.rotation.x = lerp(p.spine.rotation.x, spineLean + breathe * 0.022 + runK * 0.1, damp(8, dt));
  }

  /* ---- arm sway when running */
  if (moving && player.attackAnim <= 0) {
    p.armL.shoulder.rotation.x = lerp(p.armL.shoulder.rotation.x, armSwingL, damp(12, dt));
    p.armR.shoulder.rotation.x = lerp(p.armR.shoulder.rotation.x, armSwingR, damp(12, dt));
  }

  /* ---- Six Eyes intensity tracks energy / domain */
  const energyK = player.energy / player.maxEnergy;
  const eyePower = 2.6 + energyK * 2.4 + (player.domainTimer > 0 ? 5 : 0);
  p.eyeMat.emissiveIntensity = lerp(p.eyeMat.emissiveIntensity, eyePower, damp(6, dt));
  for (const e of p.eyes) {
    if (e.isSprite) e.material.opacity = 0.35 + energyK * 0.4 + (player.domainTimer > 0 ? 0.3 : 0);
  }

  /* ---- uniform glow rises with cursed energy */
  p.jacket.emissiveIntensity = 0.25 + energyK * 0.9;
  p.hairMat.emissiveIntensity = 0.32 + energyK * 0.5;

  /* ---- land squash + dash stretch */
  const squash = player.landTimer > 0 ? 1 - player.landTimer * 0.35 : 1;
  const stretch = player.dashTimer > 0 ? 1.12 : 1;
  model.group.scale.set(2 - squash > 1 ? 1 : squash, squash * stretch, squash);
}

/* ============================================================ ENEMIES */
/* Four archetypes: brute, stalker, warlock, boss. Distinct silhouettes,
   colors, proportions and animation parameters. */

const ENEMY_SPECS = {
  brute: {
    height: 2.9,
    color: 0x3b2150,
    emissive: 0x7a2fd0,
    eyeColor: 0xff8c2b,
    hp: 130,
    speed: 4.2,
    damage: 14,
    reach: 3.4,
    attackCd: [1.6, 2.4],
    scale: 1,
  },
  stalker: {
    height: 2.2,
    color: 0x123a46,
    emissive: 0x16b8c8,
    eyeColor: 0x5effe0,
    hp: 85,
    speed: 7.6,
    damage: 9,
    reach: 2.8,
    attackCd: [0.9, 1.5],
    scale: 1,
  },
  warlock: {
    height: 2.5,
    color: 0x2a1140,
    emissive: 0x8a2be2,
    eyeColor: 0xff3b6b,
    hp: 95,
    speed: 5,
    damage: 11,
    reach: 14,
    attackCd: [2.4, 3.6],
    float: true,
    scale: 1,
  },
  boss: {
    height: 3.9,
    color: 0x2b0f3f,
    emissive: 0xc22bff,
    eyeColor: 0xff2b55,
    hp: 420,
    speed: 5.4,
    damage: 18,
    reach: 4.2,
    attackCd: [1.4, 2.2],
    scale: 1.15,
  },
};

export function enemySpec(type) {
  return ENEMY_SPECS[type] || ENEMY_SPECS.stalker;
}

export function createEnemy(type) {
  const spec = enemySpec(type);
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: spec.color,
    emissive: spec.emissive,
    emissiveIntensity: 0.5,
    roughness: 0.36,
    metalness: 0.28,
    flatShading: true,
  });
  const limbMat = new THREE.MeshStandardMaterial({
    color: spec.color,
    emissive: spec.emissive,
    emissiveIntensity: 0.38,
    roughness: 0.42,
    metalness: 0.22,
    flatShading: true,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: spec.eyeColor,
    emissive: spec.eyeColor,
    emissiveIntensity: 2.2,
    roughness: 0.18,
  });

  const h = spec.height;
  const parts = {};

  if (type === 'warlock') {
    // floating robed caster with a mask and orbiting ring
    const robe = mesh(new THREE.ConeGeometry(0.95, h * 0.85, 9), bodyMat, 0, h * 0.42, 0);
    group.add(robe);
    parts.body = robe;

    const mask = mesh(new THREE.SphereGeometry(0.42, 14, 14), limbMat, 0, h * 0.88, 0.12);
    mask.scale.set(1, 1.25, 0.8);
    group.add(mask);
    parts.head = mask;

    const eyes = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const eye = mesh(new THREE.SphereGeometry(0.085, 10, 10), eyeMat, Math.cos(a) * 0.22, h * 0.9 + Math.sin(a) * 0.16, 0.36);
      group.add(eye);
      eyes.push(eye);
    }
    parts.eyes = eyes;

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.07, 8, 36),
      new THREE.MeshBasicMaterial({
        color: spec.emissive,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    ring.position.y = h * 0.55;
    ring.rotation.x = Math.PI / 2.2;
    group.add(ring);
    parts.ring = ring;

    const arms = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.75, h * 0.72, 0);
      const sleeve = mesh(new THREE.ConeGeometry(0.24, 1.15, 7), limbMat, 0, -0.5, 0);
      sleeve.rotation.x = Math.PI;
      shoulder.add(sleeve);
      const claw = mesh(new THREE.SphereGeometry(0.15, 10, 10), eyeMat, 0, -1.08, 0.05);
      shoulder.add(claw);
      group.add(shoulder);
      arms.push(shoulder);
    }
    parts.armL = arms[0];
    parts.armR = arms[1];
  } else {
    // humanoid brutes / stalkers / boss
    const torsoScale = type === 'brute' ? 1.5 : type === 'boss' ? 1.7 : 0.92;
    const torso = mesh(
      new THREE.IcosahedronGeometry(0.72, 1),
      bodyMat,
      0,
      h * 0.58,
      0,
    );
    torso.scale.set(torsoScale, 1.15, torsoScale * 0.82);
    group.add(torso);
    parts.body = torso;

    const hips = mesh(new THREE.IcosahedronGeometry(0.52, 1), bodyMat, 0, h * 0.34, 0);
    hips.scale.set(torsoScale, 0.8, torsoScale * 0.8);
    group.add(hips);

    const head = mesh(new THREE.IcosahedronGeometry(type === 'boss' ? 0.55 : 0.4, 1), limbMat, 0, h * 0.86, 0.06);
    group.add(head);
    parts.head = head;

    // eyes
    const eyes = [];
    const eyeCount = type === 'boss' ? 6 : type === 'brute' ? 2 : 3;
    for (let i = 0; i < eyeCount; i++) {
      const a = (i / eyeCount - 0.5) * 1.6;
      const eye = mesh(
        new THREE.SphereGeometry(type === 'boss' ? 0.1 : 0.085, 10, 10),
        eyeMat,
        Math.sin(a) * 0.26,
        h * 0.87 + (i % 2) * 0.13,
        0.36 + Math.cos(a) * 0.06,
      );
      group.add(eye);
      eyes.push(eye);
    }
    parts.eyes = eyes;

    // arms with elbow pivots
    const arms = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * (0.72 * torsoScale), h * 0.68, 0);
      const upper = mesh(new THREE.CylinderGeometry(0.19, 0.15, 0.62, 8), limbMat, 0, -0.3, 0);
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.62;
      const fore = mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.58, 8), limbMat, 0, -0.28, 0);
      elbow.add(fore);
      const fist = mesh(new THREE.IcosahedronGeometry(type === 'brute' || type === 'boss' ? 0.28 : 0.19, 1), eyeMat, 0, -0.62, 0.03);
      elbow.add(fist);
      shoulder.add(elbow);
      group.add(shoulder);
      arms.push({ shoulder, elbow });
    }
    parts.armL = arms[0];
    parts.armR = arms[1];

    // legs
    const legs = [];
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.34 * torsoScale, h * 0.32, 0);
      const upper = mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.56, 8), limbMat, 0, -0.27, 0);
      hip.add(upper);
      const knee = new THREE.Group();
      knee.position.y = -0.56;
      const lower = mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.52, 8), limbMat, 0, -0.25, 0);
      knee.add(lower);
      const foot = mesh(new THREE.BoxGeometry(0.26, 0.14, 0.42), limbMat, 0, -0.53, 0.08);
      knee.add(foot);
      hip.add(knee);
      group.add(hip);
      legs.push({ hip, knee });
    }
    parts.legL = legs[0];
    parts.legR = legs[1];

    // horns / crown for the boss and shoulder spikes for the brute
    if (type === 'boss') {
      for (const side of [-1, 1]) {
        const horn = mesh(new THREE.ConeGeometry(0.14, 0.95, 7), limbMat, side * 0.34, h * 0.98, -0.05);
        horn.rotation.z = side * -0.62;
        horn.rotation.x = -0.35;
        group.add(horn);
      }
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const spike = mesh(new THREE.ConeGeometry(0.12, 1.5, 6), limbMat, Math.cos(a) * 1.15, h * 0.52, Math.sin(a) * 1.15);
        spike.rotation.set(Math.sin(a) * 1.1, -a, Math.cos(a) * -1.1);
        group.add(spike);
      }
    }
    if (type === 'brute') {
      for (const side of [-1, 1]) {
        const rock = mesh(new THREE.IcosahedronGeometry(0.32, 0), limbMat, side * 0.95, h * 0.76, -0.06);
        group.add(rock);
      }
    }
    if (type === 'stalker') {
      const blade = mesh(new THREE.ConeGeometry(0.07, 0.85, 5), eyeMat, 0, -1.15, 0.12);
      blade.rotation.x = 1.15;
      parts.armR.elbow.add(blade);
    }
  }

  // aura shell
  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(h * 0.42, 18, 18),
    new THREE.MeshBasicMaterial({
      color: spec.emissive,
      transparent: true,
      opacity: 0.07,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  aura.position.y = h * 0.52;
  group.add(aura);
  parts.aura = aura;

  group.traverse((o) => {
    if (o.isMesh && !o.material.transparent) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  group.scale.setScalar(spec.scale);

  return { group, parts, spec, type, materials: { bodyMat, limbMat, eyeMat } };
}

/* ---------------------------------------------- enemy procedural anim */

export function animateEnemy(model, enemy, dt, time) {
  const p = model.parts;
  const spec = model.spec;
  const speed = Math.hypot(enemy.vel.x, enemy.vel.z);
  const moving = speed > 0.5;
  const t = time * (6 + speed * 0.7);

  const bob = Math.sin(time * 1.8 + enemy.bobPhase) * (spec.float ? 0.3 : 0.06);
  if (spec.float) {
    model.group.position.copy(enemy.pos);
    model.group.position.y = enemy.pos.y + 1.15 + bob;
    if (p.ring) {
      p.ring.rotation.z += dt * 1.1;
      p.ring.rotation.x = Math.PI / 2.2 + Math.sin(time * 1.3) * 0.18;
    }
    if (p.body) p.body.rotation.y += dt * 0.35;
    if (p.armL) p.armL.rotation.x = lerp(p.armL.rotation.x, Math.sin(time * 1.6) * 0.35 - 0.25, damp(5, dt));
    if (p.armR) p.armR.rotation.x = lerp(p.armR.rotation.x, Math.sin(time * 1.6 + 1.4) * 0.35 - 0.25, damp(5, dt));
  } else {
    model.group.position.copy(enemy.pos);
    model.group.position.y = enemy.pos.y + bob * 0.5;

    const swing = Math.sin(t) * 0.55 * (moving ? 1 : 0);
    if (p.legL) {
      p.legL.hip.rotation.x = lerp(p.legL.hip.rotation.x, swing, damp(12, dt));
      p.legR.hip.rotation.x = lerp(p.legR.hip.rotation.x, -swing, damp(12, dt));
      p.legL.knee.rotation.x = lerp(p.legL.knee.rotation.x, Math.max(0, -Math.sin(t)) * 0.6 * (moving ? 1 : 0), damp(12, dt));
      p.legR.knee.rotation.x = lerp(p.legR.knee.rotation.x, Math.max(0, Math.sin(t)) * 0.6 * (moving ? 1 : 0), damp(12, dt));
    }
    if (p.armL) {
      const idle = Math.sin(time * 1.5 + enemy.bobPhase) * 0.12;
      p.armL.shoulder.rotation.x = lerp(p.armL.shoulder.rotation.x, -swing * 0.7 + idle, damp(10, dt));
      p.armR.shoulder.rotation.x = lerp(p.armR.shoulder.rotation.x, swing * 0.7 - idle, damp(10, dt));
      p.armL.elbow.rotation.x = lerp(p.armL.elbow.rotation.x, -0.24, damp(10, dt));
      p.armR.elbow.rotation.x = lerp(p.armR.elbow.rotation.x, -0.24, damp(10, dt));
    }
    if (p.body) {
      p.body.rotation.z = lerp(p.body.rotation.z, -swing * 0.08, damp(8, dt));
      p.body.rotation.x = lerp(p.body.rotation.x, moving ? 0.12 : Math.sin(time * 1.4) * 0.03, damp(6, dt));
    }
  }

  /* ---- attack telegraph + lunge */
  if (enemy.attackAnim > 0) {
    const dur = enemy.attackAnimDuration || 0.9;
    const k = clamp(1 - enemy.attackAnim / dur, 0, 1);
    const lunge = Math.sin(Math.min(1, k * 1.2) * Math.PI);
    if (p.armR) {
      p.armR.shoulder.rotation.x = -2.1 * lunge;
      p.armR.elbow.rotation.x = -0.6 + 0.9 * lunge;
    }
    if (p.armL && (model.type === 'boss' || model.type === 'brute')) {
      p.armL.shoulder.rotation.x = -1.7 * lunge;
    }
    if (p.body) p.body.rotation.x = -0.22 * lunge;
  }

  /* ---- hurt / telegraph glow */
  const spec2 = model.spec;
  let glow = 0.5;
  if (enemy.aiState === 'windup' || enemy.aiState === 'shoot' || enemy.aiState === 'slam') glow = 1.5;
  if (enemy.hurtTimer > 0) glow = 2.4;
  if (enemy.frozen > 0) glow = 0.25;
  if (enemy.enraged) glow += 0.5;
  model.materials.bodyMat.emissiveIntensity = lerp(model.materials.bodyMat.emissiveIntensity, glow, damp(8, dt));
  model.materials.eyeMat.emissiveIntensity = lerp(
    model.materials.eyeMat.emissiveIntensity,
    enemy.hurtTimer > 0 ? 5 : enemy.aiState === 'windup' ? 4 : 2.2,
    damp(9, dt),
  );

  /* ---- frozen lift during Infinite Void */
  if (enemy.frozen > 0) {
    model.group.position.y += 0.6 + Math.sin(time * 2.2 + enemy.bobPhase) * 0.16;
    model.group.rotation.y += dt * 1.3;
    if (p.aura) p.aura.material.opacity = 0.16 + Math.sin(time * 7) * 0.05;
  } else if (p.aura) {
    p.aura.material.opacity = enemy.enraged ? 0.14 : 0.07;
    p.aura.rotation.y += dt * 0.6;
  }

  /* ---- death dissolve */
  if (enemy.hp <= 0 && enemy.dying >= 0) {
    const k = clamp(enemy.dying / 1.4, 0, 1);
    model.group.scale.setScalar(Math.max(0.02, spec2.scale * k));
    model.group.rotation.y += dt * 3.4;
    model.group.position.y += (1 - k) * 1.4;
  }

  /* ---- hurt jitter */
  if (enemy.hurtTimer > 0) {
    model.group.position.x += Math.sin(enemy.hurtTimer * 46) * 0.05;
  }

  spec2.scale = spec2.scale; // keep spec reference warm for minifiers
}
