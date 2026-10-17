import * as THREE from 'three';
import { particles, spawnShockwave, spawnTrail, createEnergyOrb } from './effects.js';
import { rand, clamp, lerp, damp, easeOutCubic } from './utils.js';

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/* AbilitySystem drives every special move as a timeline of phases so
   animations, visuals and gameplay hit frames stay in sync. Timers use
   game dt, so pausing or hit-stop freezes the sequences correctly. */

export class AbilitySystem {
  constructor(ctx) {
    this.ctx = ctx; // game context (player, enemies, camera, damage, fx)
    this.timers = [];
    this.effects = [];
  }

  /* ------------------------------------------------------- timeline */

  after(delay, fn) {
    this.timers.push({ t: delay, fn });
  }

  update(dt) {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const timer = this.timers[i];
      timer.t -= dt;
      if (timer.t <= 0) {
        this.timers.splice(i, 1);
        timer.fn();
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.t += dt;
      const alive = fx.update(dt, fx);
      if (!alive) {
        if (fx.dispose) fx.dispose();
        this.effects.splice(i, 1);
      }
    }
  }

  clear() {
    this.timers.length = 0;
    for (const fx of this.effects) if (fx.dispose) fx.dispose();
    this.effects.length = 0;
  }

  addEffect(fx) {
    fx.t = 0;
    this.effects.push(fx);
    return fx;
  }

  /* ---------------------------------------------------------- melee */

  melee() {
    const { player, getEnemies, damageEnemy, sound, camera } = this.ctx;
    if (player.lockTimer > 0.12 || player.attackCooldown > 0) return false;

    player.comboStep = player.comboWindow > 0 ? (player.comboStep + 1) % 3 : 0;
    player.comboWindow = 0.85;

    const finisher = player.comboStep === 2;
    player.attackCooldown = finisher ? 0.52 : 0.34;
    player.attackAnim = finisher ? 0.42 : 0.3;
    player.animDuration = player.attackAnim;
    player.attackKind = finisher ? 'finisher' : 'punch';
    player.lockTimer = finisher ? 0.32 : 0.2;
    sound(finisher ? 'heavy' : 'punch');

    const forward = this.ctx.aimDir();

    this.after(finisher ? 0.16 : 0.11, () => {
      const fwd = this.ctx.aimDir();
      const range = finisher ? 3.9 : 3.2;
      const arc = finisher ? 0.05 : 0.3;
      let hits = 0;
      for (const enemy of getEnemies()) {
        if (enemy.hp <= 0) continue;
        const to = v3().copy(enemy.pos).sub(player.pos).setY(0);
        const d = to.length();
        const facing = d > 0.001 ? fwd.dot(to.divideScalar(d)) : 1;
        if (d < range && facing > arc) {
          damageEnemy(enemy, finisher ? 18 : 9 + player.comboStep * 1.5, {
            knockDir: fwd,
            knockForce: finisher ? 17 : 5,
          });
          hits++;
          if (hits >= 2) break;
        }
      }
      if (hits === 0) {
        particles.spawn(
          v3().copy(player.pos).addScaledVector(fwd, 2).setY(1.4),
          0x88a0ff, 4, 2.5, 0.3,
        );
      } else if (finisher) {
        spawnShockwave(player.pos.clone().addScaledVector(fwd, 1.8), 0xffc36b, 5.5, 0.45);
        camera.shake(0.35);
      }
    });

    player.vel.addScaledVector(forward, finisher ? 6 : 3.2);
    return true;
  }

  /* ------------------------------------------- Lapse Blue (attraction) */

  blue() {
    const { player, camera, sound, flash, handPos, getEnemies, damageEnemy } = this.ctx;
    if (player.lockTimer > 0.05 || player.blueCooldown > 0) return false;
    if (player.energy < 25) {
      sound('denied');
      return false;
    }

    player.energy -= 25;
    player.blueCooldown = 3.2;
    player.attackKind = 'blue';
    player.attackAnim = 0.75;
    player.animDuration = 0.75;
    player.lockTimer = 0.75;
    sound('blue');

    /* ---- target: nearest enemy in front, else a point ahead */
    const fwd = this.ctx.aimDir();
    let target = v3().copy(player.pos).addScaledVector(fwd, 7).setY(1.6);
    let best = 7.5;
    for (const enemy of getEnemies()) {
      if (enemy.hp <= 0) continue;
      const d = enemy.pos.distanceTo(player.pos);
      if (d < best && d < 18) {
        best = d;
        target = enemy.pos.clone().setY(1.6);
      }
    }
    const targetPoint = target.clone();

    /* ---- Phase A: energy gathers at the hand */
    const hand = handPos('right').clone();
    const orb = createEnergyOrb({ color: 0x2f7bff, coreColor: 0x9fe8ff, radius: 0.42 });
    orb.group.position.copy(hand);
    this.ctx.scene.add(orb.group);

    this.addEffect({
      orb,
      targetPoint,
      phase: 0,
      pulled: false,
      update(dt, fx) {
        fx.orb.pulse(fx.t, 1 + fx.t * 0.6);
        const handNow = handPos('right');
        if (fx.t < 0.42) {
          fx.orb.group.position.lerp(handNow, damp(14, dt));
          fx.orb.group.scale.setScalar(clamp(fx.t / 0.42, 0.15, 1) * (1 + fx.t * 0.35));
          // converging motes around the hand
          if (Math.random() < dt * 26) {
            const a = Math.random() * Math.PI * 2;
            const r = rand(1.2, 2.2);
            const p = v3().copy(handNow).add(v3(Math.cos(a) * r, rand(-0.4, 1), Math.sin(a) * r));
            const inward = handNow.clone().sub(p).normalize().multiplyScalar(rand(4, 7));
            particles.spawnVel(p, 0x66c8ff, 1, inward, 0.1, 0.4, 0, 0.4);
          }
          return fx.t < 0.42;
        }

        /* ---- Phase B: orb launches to the target and collapses */
        if (!fx.launched) {
          fx.launched = true;
          fx.launchT = 0;
        }
        fx.launchT += dt;
        const k = clamp(fx.launchT / 0.16, 0, 1);
        fx.orb.group.position.lerpVectors(handNow, fx.targetPoint, easeOutCubic(k));

        if (k >= 1 && !fx.pulled) {
          fx.pulled = true;
          flash();
          camera.shake(0.3);
          camera.fovPulse(0.35);
          sound('blueCollapse');
          spawnShockwave(fx.targetPoint, 0x35c8ff, 7, 0.55);
          spawnShockwave(fx.targetPoint, 0x9fe8ff, 4, 0.4, true);

          /* gameplay: real attraction toward the sphere */
          for (const enemy of getEnemies()) {
            if (enemy.hp <= 0) continue;
            const toOrb = v3().copy(fx.targetPoint).sub(enemy.pos).setY(0);
            const d = toOrb.length();
            if (d < 11) {
              const dir = toOrb.divideScalar(Math.max(d, 0.001));
              const pull = clamp(26 - d * 1.2, 8, 26);
              enemy.vel.copy(dir.multiplyScalar(pull));
              enemy.aiState = 'stagger';
              enemy.aiTimer = 0.65;
              // velocity toward the sphere is already applied; just damage
              damageEnemy(enemy, d < 5.5 ? 16 : 10, { source: 'blue' });
            }
          }
          particles.spawn(fx.targetPoint, 0x35c8ff, 46, 10, 0.85, 0);
        }

        if (fx.pulled) {
          fx.orb.group.scale.multiplyScalar(Math.exp(-7 * dt));
          fx.orb.setOpacity(clamp(1 - (fx.launchT - 0.16) / 0.35, 0, 1));
        }

        return fx.launchT < 0.62;
      },
      dispose() {
        orb.dispose();
      },
    });

    camera.fovPulse(0.2);
    return true;
  }

  /* --------------------------------------- Reversal Red (repulsion) */

  red() {
    const { player, camera, sound, handPos, scene } = this.ctx;
    if (player.lockTimer > 0.05 || player.redCooldown > 0) return false;
    if (player.energy < 35) {
      sound('denied');
      return false;
    }

    player.energy -= 35;
    player.redCooldown = 4.6;
    player.attackKind = 'red';
    player.attackAnim = 0.95;
    player.animDuration = 0.95;
    player.lockTimer = 0.62;
    sound('redCharge');

    const hand = handPos('right').clone();
    const orb = createEnergyOrb({ color: 0xff2233, coreColor: 0xffd6d6, radius: 0.46 });
    orb.group.position.copy(hand);
    scene.add(orb.group);

    /* ---- charge phase: sphere intensifies at the hand */
    const chargeFx = this.addEffect({
      orb,
      releasedAt: null,
      update(dt, fx) {
        fx.orb.pulse(fx.t, 1.2 + fx.t * 1.4);
        const handNow = handPos('right');
        if (fx.releasedAt === null) {
          fx.orb.group.position.lerp(handNow, damp(12, dt));
          fx.orb.group.scale.setScalar(0.5 + fx.t * 1.15);
          if (Math.random() < dt * 30) {
            const a = Math.random() * Math.PI * 2;
            const r = rand(1.4, 2.6);
            const p = v3().copy(handNow).add(v3(Math.cos(a) * r, rand(-0.5, 1.2), Math.sin(a) * r));
            const inward = handNow.clone().sub(p).normalize().multiplyScalar(rand(5, 9));
            particles.spawnVel(p, 0xff6a5a, 1, inward, 0.1, 0.35, 0, 0.3);
          }
          return true;
        }
        const fade = clamp((fx.t - fx.releasedAt) / 0.3, 0, 1);
        fx.orb.setOpacity(1 - fade);
        fx.orb.group.scale.multiplyScalar(Math.exp(-10 * dt));
        return fx.t - fx.releasedAt < 0.6;
      },
      dispose() {
        orb.dispose();
      },
    });

    /* ---- release: projectile fired through the arena */
    this.after(0.52, () => {
      chargeFx.releasedAt = chargeFx.t;
      const fwd = this.ctx.aimDir();
      const origin = handPos('right').clone().addScaledVector(fwd, 0.6);
      sound('red');
      camera.shake(0.55);
      camera.fovPulse(0.55);

      this.ctx.addProjectile({
        kind: 'red',
        origin,
        dir: fwd,
        speed: 27,
        radius: 1.05,
        damage: 26,
        knockForce: 27,
        color: 0xff2b3c,
        coreColor: 0xffd0d0,
        life: 1.15,
        onImpact: (pos) => this.redExplosion(pos),
        onTrail: (pos, dir) => {
          spawnTrail(pos, 0xff4a4a, 0.55, 0.32);
          particles.spawnVel(pos, 0xff7a6a, 2, v3().copy(dir).multiplyScalar(-3), 1.2, 0.4, 0, 1.2);
          if (Math.random() < 0.4) spawnShockwave(pos, 0xff5555, 2.6, 0.3, true);
        },
      });
    });

    return true;
  }

  redExplosion(pos) {
    const { camera, flash, sound, scene } = this.ctx;
    flash();
    camera.shake(0.8);
    camera.fovPulse(0.8);
    sound('purpleImpact');
    this.ctx.hitStop(0.06);

    particles.spawn(pos, 0xff5a4a, 60, 13, 0.9, -2);
    particles.spawn(pos, 0xffd0a0, 30, 8, 0.7, -1);
    spawnShockwave(pos, 0xff4a4a, 11, 0.6);
    spawnShockwave(pos, 0xffa070, 6, 0.45, true);

    const light = new THREE.PointLight(0xff4040, 260, 26, 1.7);
    light.position.copy(pos);
    scene.add(light);
    this.addEffect({
      light,
      update(dt, fx) {
        fx.light.intensity *= Math.exp(-9 * dt);
        return fx.t < 0.7;
      },
      dispose() {
        light.removeFromParent();
      },
    });
  }

  /* ------------------------------------------- Hollow Purple (fusion) */

  purple() {
    const ctx = this.ctx;
    const { player, camera, sound, handPos, scene, flash } = this.ctx;
    if (player.lockTimer > 0.05 || player.purpleCooldown > 0) return false;
    if (player.energy < 70) {
      sound('denied');
      return false;
    }

    player.energy -= 70;
    player.purpleCooldown = 13;
    player.attackKind = 'purple';
    player.attackAnim = 1.55;
    player.animDuration = 1.55;
    player.lockTimer = 1.55;
    sound('charge');

    /* ---- cinematic camera push-in while charging */
    camera.cinematic({
      duration: 1.75,
      distance: 7.2,
      height: 2.2,
      side: 0.55,
      fov: 42,
      lookHeight: 1.8,
    });

    const blueOrb = createEnergyOrb({ color: 0x2f7bff, coreColor: 0xbfe8ff, radius: 0.38 });
    const redOrb = createEnergyOrb({ color: 0xff2233, coreColor: 0xffd6d6, radius: 0.38 });
    scene.add(blueOrb.group, redOrb.group);

    this.addEffect({
      blueOrb,
      redOrb,
      fused: false,
      update(dt, fx) {
        const left = handPos('left');
        const right = handPos('right');
        const center = v3().copy(player.pos).add(v3(0, 1.75, 0)).addScaledVector(ctx.aimDir(), 1.35);

        const k = clamp(fx.t / 1.05, 0, 1);
        const orbit = fx.t * 6;

        fx.blueOrb.group.position.lerpVectors(left, center, easeOutCubic(k));
        fx.redOrb.group.position.lerpVectors(right, center, easeOutCubic(k));
        // spiral convergence
        fx.blueOrb.group.position.x += Math.cos(orbit) * (1 - k) * 0.55;
        fx.blueOrb.group.position.z += Math.sin(orbit) * (1 - k) * 0.55;
        fx.redOrb.group.position.x -= Math.cos(orbit) * (1 - k) * 0.55;
        fx.redOrb.group.position.z -= Math.sin(orbit) * (1 - k) * 0.55;

        fx.blueOrb.pulse(fx.t, 1.2 + k);
        fx.redOrb.pulse(fx.t + 1, 1.2 + k);

        if (Math.random() < dt * 22) {
          particles.spawnVel(
            v3().copy(center).add(v3(rand(-2, 2), rand(-1, 1), rand(-2, 2))),
            fx.t % 0.2 < 0.1 ? 0x66a0ff : 0xff6a5a, 1,
            v3().copy(center).sub(fx.blueOrb.group.position).normalize().multiplyScalar(rand(4, 8)),
            0.1, 0.5, 0, 0.4,
          );
        }

        if (k >= 1 && !fx.fused) {
          fx.fused = true;
          fx.fuseAt = fx.t;
          flash();
          camera.shake(0.75);
          ctx.hitStop(0.12);
          sound('purple');
          particles.spawn(center, 0xd9b6ff, 70, 12, 0.9, -1);
          spawnShockwave(center, 0xc88aff, 10, 0.6);
          spawnShockwave(center, 0xffffff, 5, 0.4, true);
        }

        if (fx.fused) {
          const fade = clamp(1 - (fx.t - fx.fuseAt) / 0.3, 0, 1);
          fx.blueOrb.setOpacity(fade);
          fx.redOrb.setOpacity(fade);
          fx.blueOrb.group.scale.multiplyScalar(Math.exp(-6 * dt));
          fx.redOrb.group.scale.multiplyScalar(Math.exp(-6 * dt));
        }

        return fx.t < 1.45;
      },
      dispose() {
        blueOrb.dispose();
        redOrb.dispose();
      },
    });

    /* ---- fire the purple projectile after the fusion flash */
    this.after(1.12, () => {
      const fwd = this.ctx.aimDir();
      const origin = v3().copy(player.pos).add(v3(0, 1.75, 0)).addScaledVector(fwd, 1.6);
      camera.shake(0.9);
      camera.fovPulse(1);

      this.ctx.addProjectile({
        kind: 'purple',
        origin,
        dir: fwd,
        speed: 19,
        radius: 1.7,
        damage: 46,
        knockForce: 33,
        color: 0x9a3cff,
        coreColor: 0xe8ccff,
        life: 2.2,
        pierce: 3,
        onImpact: (pos, isFinal) => this.purpleExplosion(pos, isFinal),
        onTrail: (pos, dir) => {
          spawnTrail(pos, 0xa855ff, 1.05, 0.5);
          spawnTrail(pos, 0x35c8ff, 0.55, 0.35);
          particles.spawnVel(pos, 0xc88aff, 3, v3().copy(dir).multiplyScalar(-4), 1.5, 0.55, 0, 1);
          if (Math.random() < 0.55) spawnShockwave(pos, 0x9a3cff, 4, 0.4, true);
        },
      });
    });

    return true;
  }

  purpleExplosion(pos, isFinal = true) {
    const { camera, flash, sound, scene } = this.ctx;
    flash();
    camera.shake(isFinal ? 1.1 : 0.6);
    sound('purpleImpact');
    if (isFinal) this.ctx.slowmo(0.35, 0.3);

    particles.spawn(pos, 0xa855ff, isFinal ? 80 : 40, 15, 1.1, -1.5);
    particles.spawn(pos, 0x35c8ff, isFinal ? 40 : 20, 10, 0.9, -1);
    spawnShockwave(pos, 0x9a3cff, isFinal ? 15 : 9, 0.75);
    spawnShockwave(pos, 0xe0b0ff, 8, 0.55, true);

    const light = new THREE.PointLight(0xa050ff, 320, 34, 1.6);
    light.position.copy(pos);
    scene.add(light);
    this.addEffect({
      light,
      update(dt, fx) {
        fx.light.intensity *= Math.exp(-7 * dt);
        return fx.t < 0.9;
      },
      dispose() {
        light.removeFromParent();
      },
    });
  }

  /* ---------------------------------------------------- Infinity */

  infinity() {
    const { player, camera, sound, scene } = this.ctx;
    if (player.infinityCooldown > 0) return false;
    if (player.energy < 20) {
      sound('denied');
      return false;
    }

    player.energy -= 20;
    player.infinityCooldown = 7;
    player.infinityTimer = 3.6;
    player.attackKind = 'infinity';
    player.attackAnim = 0.55;
    player.animDuration = 0.55;
    player.lockTimer = 0.35;
    player.invuln = Math.max(player.invuln, 3.6);
    sound('infinity');

    const shield = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(2.3, 26, 20),
      new THREE.MeshBasicMaterial({
        color: 0x5fd8ff,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    shield.add(shell);

    const rings = [];
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.32, 0.055, 8, 42),
        new THREE.MeshBasicMaterial({
          color: i === 1 ? 0xbfefff : 0x5fd8ff,
          transparent: true,
          opacity: 0.6,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      ring.rotation.set(Math.PI / 2 + i * 1.05, i * 0.8, 0);
      shield.add(ring);
      rings.push(ring);
    }
    scene.add(shield);
    player.shieldMesh = shield;

    this.addEffect({
      shield,
      shell,
      rings,
      ringsSafe: rings,
      update(dt, fx) {
        const p = player;
        fx.shield.position.copy(p.pos).add(v3(0, 1.6, 0));
        const lifeK = clamp(p.infinityTimer / 3.6, 0, 1);
        const born = clamp(fx.t / 0.25, 0, 1);
        fx.shell.scale.setScalar(lerp(0.4, 1, easeOutCubic(born)) * (0.94 + Math.sin(fx.t * 5) * 0.04));
        fx.shell.material.opacity = 0.17 * born * (lifeK < 0.25 ? lifeK * 4 : 1);
        for (let i = 0; i < fx.rings.length; i++) {
          fx.rings[i].rotation.z += dt * (0.8 + i * 0.35) * (i % 2 ? -1 : 1);
          fx.rings[i].rotation.x += dt * 0.32;
          fx.rings[i].material.opacity = 0.55 * born * (lifeK < 0.25 ? lifeK * 4 : 1);
        }
        return p.infinityTimer > 0;
      },
      dispose() {
        shield.removeFromParent();
        shell.geometry.dispose();
        shell.material.dispose();
        for (const r of this.ringsSafe) {
          r.geometry.dispose();
          r.material.dispose();
        }
        player.shieldMesh = null;
      },
    });

    return true;
  }

  /* --------------------------------------------- Infinite Void */

  domain() {
    const { player, camera, sound, flash, scene, banner } = this.ctx;
    if (player.domainTimer > 0 || player.domainCooldown > 0) return false;
    if (player.energy < player.maxEnergy) {
      sound('denied');
      return false;
    }

    player.energy = 0;
    player.domainCooldown = 12;
    player.domainTimer = 7.5;
    player.domainCast = 1.6;
    player.attackKind = 'domain';
    player.attackAnim = 1.6;
    player.animDuration = 1.6;
    player.lockTimer = 1.6;
    player.invuln = Math.max(player.invuln, 9);

    /* ---- cinematic: hit-stop, slow-mo, hero camera */
    this.ctx.hitStop(0.35);
    this.ctx.slowmo(0.22, 1.5);
    camera.cinematic({ duration: 2.6, distance: 6.4, height: 1.6, side: 0.8, fov: 36, lookHeight: 2.1 });
    camera.shake(0.9);
    flash();
    sound('domain');
    banner('DOMAIN EXPANSION', 2.2);
    this.after(1.0, () => banner('INFINITE VOID', 2.4));

    /* the game swaps the environment at this exact moment */
    this.after(0.65, () => this.ctx.enterDomain());

    /* ---- expanding spatial rings from Gojo */
    const origin = player.pos.clone();
    for (let i = 0; i < 4; i++) {
      const idx = i;
      this.after(0.15 + idx * 0.16, () => {
        spawnShockwave(player.pos, idx % 2 ? 0xb266ff : 0x4fd8ff, 16 + idx * 6, 0.9);
        spawnShockwave(player.pos, 0xffffff, 6 + idx * 2, 0.5, true);
      });
    }

    /* rising particle column */
    this.addEffect({
      update(dt, fx) {
        if (fx.t > 1.9) return false;
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = rand(0.6, 3.2);
          particles.spawnVel(
            v3().copy(origin).add(v3(Math.cos(a) * r, 0, Math.sin(a) * r)),
            Math.random() < 0.5 ? 0xc88aff : 0x66d8ff, 1,
            v3(0, rand(7, 13), 0), 0.35, 1.3, -1.5,
          );
        }
        return true;
      },
    });

    /* ---- persistent domain visuals while active */
    this.addEffect({
      orb: createEnergyOrb({ color: 0xb266ff, coreColor: 0xf0e0ff, radius: 0.6 }),
      started: false,
      update(dt, fx) {
        const p = player;
        if (!fx.started) {
          scene.add(fx.orb.group);
          fx.started = true;
        }
        fx.orb.group.position.copy(p.pos).add(v3(0, 3.6 + Math.sin(fx.t * 1.2) * 0.3, 0));
        fx.orb.pulse(fx.t, 1.4);
        if (Math.random() < dt * 12) {
          particles.spawn(fx.orb.group.position, 0xc88aff, 2, 2.4, 1.1, -0.6);
        }
        return p.domainTimer > 0;
      },
      dispose() {
        this.orb.dispose();
      },
    });

    return true;
  }
}
