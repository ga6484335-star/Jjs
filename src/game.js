import * as THREE from 'three';
import {
  scene,
  camera as mainCamera,
  moonLight,
  hemiLight,
  rimLight,
} from './core.js';
import { particles, spawnShockwave, spawnTrail, createEnergyOrb, clearTransientEffects } from './effects.js';
import { createGojo, createEnemy, animateGojo, animateEnemy, enemySpec } from './characters.js';
import {
  buildLevel,
  buildVoidDomain,
  buildEncounter,
  setVisible,
  ARENA_RADIUS,
} from './levels.js';
import { playSound } from './audio.js';
import { clamp, lerp, damp, angleLerp, rand, disposeObject, v3 } from './utils.js';

export function createGame() {
  /* ========================================================= camera */

  const cam = {
    yaw: 0,
    pitch: 0.33,
    dist: 12.5,
    shakeAmt: 0,
    fovPulseAmt: 0,
    cine: null,

    shake(amount) {
      this.shakeAmt = Math.max(this.shakeAmt, amount);
    },
    fovPulse(amount) {
      this.fovPulseAmt = Math.max(this.fovPulseAmt, amount);
    },
    cinematic(opts) {
      this.cine = { t: 0, duration: 2, distance: 8, height: 2, side: 0.6, fov: 45, lookHeight: 1.9, ...opts };
    },
    drag(dx, dy) {
      if (this.cine) return;
      this.yaw -= dx * 0.0052;
      this.pitch = clamp(this.pitch + dy * 0.0036, -0.06, 1.16);
    },
    zoom(delta) {
      this.dist = clamp(this.dist + delta * 0.012, 7, 21);
    },
  };

  /* ========================================================= player */

  const gojo = createGojo();
  scene.add(gojo.group);

  const player = {
    pos: v3(0, 0, 6),
    vel: v3(),
    facing: Math.PI,
    hp: 120,
    maxHp: 120,
    energy: 0,
    maxEnergy: 100,
    onGround: true,
    landTimer: 0,

    attackCooldown: 0,
    attackAnim: 0,
    animDuration: 0.3,
    attackKind: 'punch',
    comboStep: 0,
    comboWindow: 0,
    lockTimer: 0,

    dashTimer: 0,
    dashCooldown: 0,
    invuln: 0,
    hurtTimer: 0,

    blueCooldown: 0,
    redCooldown: 0,
    purpleCooldown: 0,
    infinityCooldown: 0,
    infinityTimer: 0,
    domainTimer: 0,
    domainCast: 0,
    domainCooldown: 0,
    shieldMesh: null,
  };

  /* ========================================================= state */

  const game = {
    phase: 'menu', // menu | playing | paused | roundclear | gameover
    round: 1,
    score: 0,
    combo: 0,
    comboTimer: 0,
    roundTime: 0,
    time: 0,
    paused: false,

    hitStopTimer: 0,
    slowmoTimer: 0,
    slowmoScale: 1,

    player,
    camera: cam,
    gojo,
    enemies: [],
    projectiles: [],
    level: null,
    voidDomain: null,
    domainActive: false,
    encounter: null,

    input: { x: 0, y: 0 },

    callbacks: {
      banner: () => {},
      overlay: () => {},
      flash: () => {},
      haptic: () => {},
    },
    abilities: null,
    ctx: null,
  };

  const sound = (kind) => playSound(kind);
  const flash = () => game.callbacks.flash();
  const banner = (text, dur) => game.callbacks.banner(text, dur);
  const hitStop = (t) => {
    game.hitStopTimer = Math.max(game.hitStopTimer, t);
  };
  const slowmo = (scale, duration) => {
    game.slowmoScale = scale;
    game.slowmoTimer = Math.max(game.slowmoTimer, duration);
  };

  /* ========================================================= level */

  let currentTheme = null;

  function applyLightConfig(lights) {
    if (!lights) return;
    if (lights.moon) {
      moonLight.color.set(lights.moon.color);
      moonLight.intensity = lights.moon.intensity;
      moonLight.position.set(...lights.moon.pos);
    }
    if (lights.hemi) {
      hemiLight.color.set(lights.hemi.sky);
      hemiLight.groundColor.set(lights.hemi.ground);
      hemiLight.intensity = lights.hemi.intensity;
    }
    if (lights.rim) {
      rimLight.color.set(lights.rim.color);
      rimLight.intensity = lights.rim.intensity;
      rimLight.position.set(...lights.rim.pos);
    }
  }

  function applyFog(fog) {
    if (!fog) return;
    scene.fog.color.set(fog.color);
    scene.fog.near = fog.near;
    scene.fog.far = fog.far;
    scene.background.set(fog.color);
  }

  function setLevel(theme) {
    if (game.level) {
      const old = game.level;
      scene.remove(old.group);
      disposeObject(old.group);
    }
    currentTheme = theme;
    game.level = buildLevel(theme);
    if (!game.voidDomain) game.voidDomain = buildVoidDomain();
    setVisible(game.voidDomain, false);
    if (!game.domainActive) {
      applyLightConfig(game.level.lights);
      applyFog(game.level.fog);
    }
  }

  /* ------------------------------------------------ domain enter/exit */

  function enterDomain() {
    if (game.domainActive) return;
    game.domainActive = true;

    setVisible(game.level, false);
    setVisible(game.voidDomain, true);
    applyLightConfig(game.voidDomain.lights);
    applyFog(game.voidDomain.fog);

    for (const enemy of game.enemies) {
      if (enemy.hp > 0) {
        enemy.frozen = player.domainTimer;
        enemy.aiState = 'frozen';
        enemy.vel.set(0, 0, 0);
      }
    }
  }

  function exitDomain() {
    if (!game.domainActive) return;
    game.domainActive = false;

    setVisible(game.voidDomain, false);
    if (game.level) {
      setVisible(game.level, true);
      applyLightConfig(game.level.lights);
      applyFog(game.level.fog);
    }

    for (const enemy of game.enemies) {
      if (enemy.frozen > 0) {
        enemy.frozen = 0;
        if (enemy.hp > 0) enemy.aiState = 'chase';
      }
    }

    sound('domainEnd');
    banner('DOMAIN ENDS', 1.6);
  }

  /* ==================================================== projectiles */

  function addProjectile(opts) {
    const orb = createEnergyOrb({
      color: opts.color,
      coreColor: opts.coreColor || 0xffffff,
      radius: opts.radius * 0.62,
    });
    orb.group.position.copy(opts.origin);
    scene.add(orb.group);

    game.projectiles.push({
      orb,
      kind: opts.kind,
      pos: opts.origin.clone(),
      dir: opts.dir.clone().normalize(),
      speed: opts.speed,
      radius: opts.radius,
      damage: opts.damage,
      knockForce: opts.knockForce || 0,
      life: opts.life || 2,
      pierce: opts.pierce || 0,
      hitSet: new Set(),
      onImpact: opts.onImpact || null,
      onTrail: opts.onTrail || null,
      trailTimer: 0,
      owner: opts.owner || 'player',
    });
  }

  function removeProjectile(index) {
    const p = game.projectiles[index];
    p.orb.dispose();
    game.projectiles.splice(index, 1);
  }

  function updateProjectiles(dt) {
    for (let i = game.projectiles.length - 1; i >= 0; i--) {
      const p = game.projectiles[i];
      p.life -= dt;
      p.pos.addScaledVector(p.dir, p.speed * dt);
      p.orb.group.position.copy(p.pos);
      p.orb.pulse(game.time + i, 1);

      p.trailTimer -= dt;
      if (p.onTrail && p.trailTimer <= 0) {
        p.trailTimer = 0.045;
        p.onTrail(p.pos, p.dir);
      }

      let removed = false;

      if (p.owner === 'player') {
        for (const enemy of game.enemies) {
          if (enemy.hp <= 0 || p.hitSet.has(enemy.id)) continue;
          const hitDist = p.radius + enemy.radius;
          const toEnemy = enemy.pos.clone().setY(0).sub(p.pos.clone().setY(0));
          if (toEnemy.lengthSq() < hitDist * hitDist) {
            p.hitSet.add(enemy.id);
            damageEnemy(enemy, p.damage, {
              knockDir: p.dir.clone(),
              knockForce: p.knockForce,
              source: p.kind,
            });
            if (p.pierce > 0) {
              p.pierce--;
            } else {
              if (p.onImpact) p.onImpact(p.pos.clone(), true);
              removeProjectile(i);
              removed = true;
            }
            break;
          }
        }
      } else {
        // enemy projectile vs player
        const head = player.pos.clone().add(v3(0, 1.3, 0));
        if (p.pos.distanceTo(head) < p.radius + 1.15) {
          if (player.infinityTimer > 0) {
            // Infinity pops incoming projectiles
            particles.spawn(p.pos, 0x7fe8ff, 26, 8, 0.6);
            spawnShockwave(p.pos, 0x7fe8ff, 3.4, 0.35, true);
            sound('infinity');
            removeProjectile(i);
            removed = true;
          } else {
            damagePlayer(p.damage, p.dir.clone().setY(0).normalize());
            particles.spawn(p.pos, p.orb.core.material.color.getHex(), 22, 7, 0.55);
            removeProjectile(i);
            removed = true;
          }
        }
      }

      if (removed) continue;

      // expiry / out of bounds
      const outOfArena = p.pos.lengthSq() > (ARENA_RADIUS + 26) ** 2;
      if (p.life <= 0 || outOfArena || p.pos.y < 0.12) {
        if (p.onImpact && p.owner === 'player') p.onImpact(p.pos.clone(), true);
        removeProjectile(i);
      }
    }
  }

  /* ======================================================== damage */

  function damageEnemy(enemy, amount, opts = {}) {
    if (!enemy || enemy.hp <= 0 || game.phase !== 'playing') return;

    enemy.hp = Math.max(0, enemy.hp - amount);
    enemy.hurtTimer = 0.28;

    game.combo += 1;
    game.comboTimer = 2.2;
    game.score += amount * 12 * (1 + game.combo * 0.06) * (opts.scoreMult || 1);
    player.energy = clamp(player.energy + amount * 1.05, 0, player.maxEnergy);

    const hitPos = enemy.pos.clone().add(v3(0, enemy.height * 0.6, 0));
    particles.spawn(hitPos, 0xffd27a, 16, 7, 0.5);
    particles.spawn(hitPos, 0x9a4dff, 10, 5, 0.6);

    if (opts.knockDir && opts.knockForce > 0) {
      const resist = enemy.type === 'brute' || enemy.type === 'boss' ? 0.45 : 1;
      enemy.vel.addScaledVector(opts.knockDir, opts.knockForce * resist);
      if (opts.knockForce * resist > 12) {
        enemy.aiState = 'stagger';
        enemy.aiTimer = clamp(opts.knockForce / 30, 0.35, 1.1);
      }
    }

    cam.shake(clamp(amount / 22, 0.12, 0.6));
    sound(amount > 15 ? 'heavy' : 'hit');
    if (amount > 15) hitStop(0.05);
    game.callbacks.haptic('light');

    if (enemy.hp <= 0) killEnemy(enemy);
  }

  function damagePlayer(amount, dir) {
    if (player.invuln > 0 || game.phase !== 'playing') return;

    player.hp = Math.max(0, player.hp - amount);
    player.invuln = 0.55;
    player.hurtTimer = 0.32;
    game.combo = 0;
    if (dir) player.vel.addScaledVector(dir, 9);

    const hitPos = player.pos.clone().add(v3(0, 1.5, 0));
    particles.spawn(hitPos, 0xff5a7a, 18, 6.5, 0.5);
    cam.shake(0.5);
    sound('hit');
    game.callbacks.haptic('heavy');

    if (player.hp <= 0) gameOver();
  }

  function killEnemy(enemy) {
    if (enemy.dying >= 0) return;
    enemy.dying = 1.4;
    enemy.aiState = 'dying';
    game.score += 220 * game.round * (enemy.type === 'boss' ? 3 : 1);
    player.energy = clamp(player.energy + 18, 0, player.maxEnergy);

    const pos = enemy.pos.clone().add(v3(0, enemy.height * 0.6, 0));
    particles.spawn(pos, 0xb266ff, enemy.type === 'boss' ? 90 : 55, 11, 1.2, -2);
    spawnShockwave(enemy.pos, 0xb266ff, enemy.type === 'boss' ? 16 : 10, 0.8);
    cam.shake(enemy.type === 'boss' ? 1 : 0.65);
    sound('ko');
    hitStop(0.09);
    game.callbacks.haptic('heavy');
  }

  /* ========================================================= enemies */

  let enemyIdCounter = 1;

  function spawnEnemy(type, index, total) {
    const spec = enemySpec(type);
    const model = createEnemy(type);
    const roundScale = 1 + (game.round - 1) * 0.11;

    const angle = (index / Math.max(total, 1)) * Math.PI * 2 + 0.8;
    const radius = type === 'boss' ? 14 : rand(12, 18);
    const pos = v3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);

    const enemy = {
      id: enemyIdCounter++,
      type,
      model,
      pos,
      vel: v3(),
      facing: angle + Math.PI,
      height: spec.height * spec.scale,
      radius: type === 'boss' ? 2.6 : 1.35,
      hp: Math.round(spec.hp * roundScale),
      maxHp: Math.round(spec.hp * roundScale),
      speed: spec.speed * (1 + (game.round - 1) * 0.02),
      damage: spec.damage * (1 + (game.round - 1) * 0.08),
      reach: spec.reach,
      aiState: 'chase',
      aiTimer: 0,
      attackCooldown: rand(0.6, 1.6),
      attackAnim: 0,
      attackAnimDuration: 0.9,
      shootCooldown: rand(1.5, 3),
      hurtTimer: 0,
      frozen: 0,
      dying: -1,
      bobPhase: Math.random() * 10,
      enrage: false,
      phase: 1,
      strafeDir: Math.random() < 0.5 ? 1 : -1,
    };

    model.group.position.copy(pos);
    scene.add(model.group);
    game.enemies.push(enemy);
    return enemy;
  }

  function spawnEncounter() {
    for (const enemy of game.enemies) {
      scene.remove(enemy.model.group);
      disposeObject(enemy.model.group);
    }
    game.enemies.length = 0;

    game.encounter = buildEncounter(game.round);
    setLevel(game.encounter.theme);

    const types = game.encounter.types;
    types.forEach((type, i) => spawnEnemy(type, i, types.length));

    banner(game.level.name, 2.2);
  }

  const tmpToPlayer = v3();
  const tmpDir = v3();

  function updateEnemy(enemy, dt) {
    stepEnemy(enemy, dt);
    animateEnemy(enemy.model, enemy, dt, game.time);
  }

  function stepEnemy(enemy, dt) {
    const e = enemy;

    if (e.dying >= 0) {
      e.dying -= dt;
      if (e.dying <= -0.2 && e.model.group.visible) {
        e.model.group.visible = false;
      }
      return;
    }

    e.attackCooldown = Math.max(0, e.attackCooldown - dt);
    e.attackAnim = Math.max(0, e.attackAnim - dt);
    e.hurtTimer = Math.max(0, e.hurtTimer - dt);
    e.shootCooldown = Math.max(0, e.shootCooldown - dt);
    e.frozen = Math.max(0, e.frozen - dt);
    e.bobPhase += dt;

    /* ---- Infinite Void: suspended and taking damage */
    if (game.domainActive && e.hp > 0) {
      e.hp = Math.max(0, e.hp - 8.5 * dt);
      if (Math.random() < dt * 12) {
        particles.spawn(
          e.pos.clone().add(v3(rand(-1, 1), rand(0.5, e.height), rand(-1, 1))),
          0xd9b6ff, 3, 2.5, 0.5, -1,
        );
      }
      if (e.hp <= 0) killEnemy(e);
      return;
    }

    if (e.frozen > 0) return;

    /* ---- boss phase transition */
    if (e.type === 'boss' && !e.enrage && e.hp < e.maxHp * 0.5) {
      e.enrage = true;
      e.phase = 2;
      e.speed *= 1.3;
      banner('SPECIAL GRADE — PHASE 2', 2);
      spawnShockwave(e.pos, 0xff2b55, 14, 0.9);
      particles.spawn(e.pos.clone().add(v3(0, e.height * 0.6, 0)), 0xff2b55, 60, 12, 1);
      cam.shake(0.9);
      sound('heavy');
    }

    tmpToPlayer.copy(player.pos).sub(e.pos).setY(0);
    const dist = tmpToPlayer.length();
    if (dist > 0.001) tmpDir.copy(tmpToPlayer).divideScalar(dist);

    if (game.phase !== 'playing' || game.domainActive) {
      e.vel.multiplyScalar(Math.exp(-4 * dt));
      e.pos.addScaledVector(e.vel, dt);
      return;
    }

    switch (e.aiState) {
      case 'chase': {
        const preferred = e.type === 'warlock' ? 11 : e.reach * 0.72;
        if (dist > preferred + 0.8) {
          e.vel.x = lerp(e.vel.x, tmpDir.x * e.speed, damp(6, dt));
          e.vel.z = lerp(e.vel.z, tmpDir.z * e.speed, damp(6, dt));
        } else if (e.type === 'warlock' && dist < preferred - 3) {
          // keep distance and strafe
          e.vel.x = lerp(e.vel.x, -tmpDir.x * e.speed * 0.8, damp(5, dt));
          e.vel.z = lerp(e.vel.z, -tmpDir.z * e.speed * 0.8, damp(5, dt));
        } else {
          // strafe around the player
          const sideX = -tmpDir.z * e.strafeDir;
          const sideZ = tmpDir.x * e.strafeDir;
          e.vel.x = lerp(e.vel.x, sideX * e.speed * 0.55, damp(4, dt));
          e.vel.z = lerp(e.vel.z, sideZ * e.speed * 0.55, damp(4, dt));
          if (Math.random() < dt * 0.5) e.strafeDir *= -1;
        }

        // separation from other enemies
        for (const other of game.enemies) {
          if (other === e || other.hp <= 0) continue;
          const dx = e.pos.x - other.pos.x;
          const dz = e.pos.z - other.pos.z;
          const d2 = dx * dx + dz * dz;
          if (d2 < 6.2 && d2 > 0.0001) {
            const d = Math.sqrt(d2);
            e.vel.x += (dx / d) * 22 * dt;
            e.vel.z += (dz / d) * 22 * dt;
          }
        }

        if (e.attackCooldown <= 0 && dist < e.reach) {
          e.aiState = 'windup';
          e.aiTimer = e.type === 'brute' ? 0.8 : e.type === 'boss' ? 0.6 : 0.38;
          e.attackAnim = 0.95;
          e.attackAnimDuration = 0.95;
          sound('whoosh');
        } else if (e.type === 'warlock' && e.shootCooldown <= 0 && dist < 20) {
          e.aiState = 'shoot';
          e.aiTimer = 0.75;
          e.attackAnim = 0.95;
          e.attackAnimDuration = 0.95;
          e.shootCooldown = rand(2.6, 4);
        } else if (e.type === 'boss' && e.phase === 2 && e.shootCooldown <= 0 && dist > 6) {
          e.aiState = 'volley';
          e.aiTimer = 0.85;
          e.attackAnim = 0.95;
          e.attackAnimDuration = 0.95;
          e.shootCooldown = rand(3, 4.5);
        } else if ((e.type === 'brute' || (e.type === 'boss' && e.phase === 2)) && e.shootCooldown <= 0 && dist < 6.5) {
          e.aiState = 'slam';
          e.aiTimer = 0.95;
          e.attackAnim = 1.1;
          e.attackAnimDuration = 1.1;
          e.shootCooldown = rand(4, 6);
        }
        break;
      }
      case 'windup': {
        e.aiTimer -= dt;
        e.vel.multiplyScalar(Math.exp(-8 * dt));
        if (Math.random() < dt * 18) {
          particles.spawn(e.pos.clone().add(v3(0, e.height * 0.6, 0)), 0xff2b55, 2, 2, 0.3);
        }
        if (e.aiTimer <= 0) {
          if (dist < e.reach + 1 && player.invuln <= 0) {
            damagePlayer(e.damage, tmpDir.clone());
            spawnShockwave(e.pos.clone().addScaledVector(tmpDir, 1.8), 0xff2b55, 4, 0.4);
          } else {
            sound('whoosh');
          }
          // boss chains a second swipe
          if (e.type === 'boss' && e.phase === 2 && dist < e.reach + 1.5) {
            e.aiState = 'windup';
            e.aiTimer = 0.34;
            e.attackAnim = 0.9;
            e.attackAnimDuration = 0.9;
          } else {
            e.aiState = 'recover';
            e.aiTimer = e.type === 'brute' ? 1 : 0.6;
            e.attackCooldown = rand(e.spec ? 1.2 : 1.2, 2.1);
          }
        }
        break;
      }
      case 'shoot': {
        e.aiTimer -= dt;
        e.vel.multiplyScalar(Math.exp(-6 * dt));
        if (e.aiTimer <= 0) {
          const origin = e.pos.clone().add(v3(0, e.height * 0.62, 0));
          const aim = player.pos.clone().add(v3(0, 1.2, 0)).sub(origin).normalize();
          addProjectile({
            kind: 'dark',
            owner: 'enemy',
            origin,
            dir: aim,
            speed: 14,
            radius: 0.55,
            damage: e.damage * 0.85,
            color: 0xb23cff,
            coreColor: 0xffb2e8,
            life: 3.2,
          });
          sound('blue');
          e.aiState = 'recover';
          e.aiTimer = 0.6;
        }
        break;
      }
      case 'volley': {
        e.aiTimer -= dt;
        e.vel.multiplyScalar(Math.exp(-6 * dt));
        if (e.aiTimer <= 0) {
          const origin = e.pos.clone().add(v3(0, e.height * 0.62, 0));
          const base = player.pos.clone().add(v3(0, 1.2, 0)).sub(origin).normalize();
          for (let k = -1; k <= 1; k++) {
            const dir = base.clone().applyAxisAngle(v3(0, 1, 0), k * 0.22).normalize();
            addProjectile({
              kind: 'dark',
              owner: 'enemy',
              origin: origin.clone(),
              dir,
              speed: 15,
              radius: 0.6,
              damage: e.damage * 0.75,
              color: 0xff2b55,
              coreColor: 0xffb2c8,
              life: 3.2,
            });
          }
          sound('red');
          e.aiState = 'recover';
          e.aiTimer = 0.8;
        }
        break;
      }
      case 'slam': {
        e.aiTimer -= dt;
        e.vel.multiplyScalar(Math.exp(-7 * dt));
        if (e.aiTimer <= 0) {
          spawnShockwave(e.pos, 0xff6a2b, 12, 0.8);
          spawnShockwave(e.pos, 0xffd27a, 7, 0.5, true);
          particles.spawn(e.pos.clone().add(v3(0, 0.5, 0)), 0xff8a3c, 46, 11, 0.8, -3);
          cam.shake(0.8);
          sound('heavy');
          if (dist < 7 && player.invuln <= 0 && player.pos.y < 1.2) {
            damagePlayer(e.damage * 1.15, tmpDir.clone());
            player.vel.addScaledVector(tmpDir, 14);
            player.vel.y = 7;
          }
          e.aiState = 'recover';
          e.aiTimer = 1.1;
        }
        break;
      }
      case 'recover': {
        e.aiTimer -= dt;
        e.vel.multiplyScalar(Math.exp(-5 * dt));
        if (e.aiTimer <= 0) {
          e.aiState = 'chase';
          e.attackCooldown = rand(1.1, 2);
        }
        break;
      }
      case 'stagger': {
        e.aiTimer -= dt;
        e.vel.multiplyScalar(Math.exp(-3.2 * dt));
        if (e.aiTimer <= 0) e.aiState = 'chase';
        break;
      }
      default:
        e.aiState = 'chase';
    }

    /* ---- physics + arena bounds */
    e.pos.addScaledVector(e.vel, dt);
    e.pos.y = 0;

    const r = Math.hypot(e.pos.x, e.pos.z);
    const limit = ARENA_RADIUS - 1.8;
    if (r > limit) {
      e.pos.x *= limit / r;
      e.pos.z *= limit / r;
    }

    if (dist > 0.001 && e.hp > 0) {
      e.facing = angleLerp(e.facing, Math.atan2(tmpDir.x, tmpDir.z), damp(7, dt));
    }
    e.model.group.rotation.y = e.facing;
  }

  /* ========================================================== player */

  function updatePlayer(dt) {
    const p = player;

    const tick = (key) => {
      p[key] = Math.max(0, p[key] - dt);
    };
    tick('attackCooldown');
    tick('attackAnim');
    tick('comboWindow');
    tick('lockTimer');
    tick('dashTimer');
    tick('dashCooldown');
    tick('invuln');
    tick('hurtTimer');
    tick('blueCooldown');
    tick('redCooldown');
    tick('purpleCooldown');
    tick('infinityCooldown');
    tick('infinityTimer');
    tick('domainCast');
    tick('landTimer');

    // passive cursed energy regeneration
    p.energy = clamp(p.energy + 3.6 * dt, 0, p.maxEnergy);

    /* ---- domain duration + guaranteed exit */
    if (p.domainTimer > 0) {
      p.domainTimer = Math.max(0, p.domainTimer - dt);
      if (p.domainTimer === 0 && game.domainActive) exitDomain();
    }

    if (game.phase !== 'playing') {
      p.vel.multiplyScalar(Math.exp(-4 * dt));
    } else {
      /* ---- movement (joystick / keys are camera-relative) */
      const forward = v3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
      const right = v3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
      const move = v3()
        .addScaledVector(forward, -game.input.y)
        .addScaledVector(right, game.input.x);

      if (move.lengthSq() > 1) move.normalize();

      const locked = p.lockTimer > 0;
      const speed = p.dashTimer > 0 ? 26 : locked ? 2.6 : 10.5;
      const accel = p.onGround ? 13 : 5.5;
      const k = damp(accel, dt);
      p.vel.x = lerp(p.vel.x, move.x * speed, k);
      p.vel.z = lerp(p.vel.z, move.z * speed, k);

      if (move.lengthSq() > 0.02 && p.attackAnim <= 0) {
        const target = Math.atan2(move.x, move.z);
        p.facing = angleLerp(p.facing, target, damp(11, dt));
      }
    }

    /* ---- gravity + ground */
    const wasAir = !p.onGround;
    p.vel.y -= 28 * dt;
    p.pos.addScaledVector(p.vel, dt);
    if (p.pos.y <= 0) {
      p.pos.y = 0;
      if (wasAir && p.vel.y < -6) {
        particles.spawn(p.pos, 0x88a0ff, 8, 3, 0.4);
        p.landTimer = 0.22;
      }
      p.vel.y = 0;
      p.onGround = true;
    } else {
      p.onGround = false;
    }

    /* ---- arena bounds */
    const r = Math.hypot(p.pos.x, p.pos.z);
    const limit = ARENA_RADIUS - 1.2;
    if (r > limit) {
      p.pos.x *= limit / r;
      p.pos.z *= limit / r;
      p.vel.x *= 0.4;
      p.vel.z *= 0.4;
    }

    /* ---- mesh + animation */
    gojo.group.position.copy(p.pos);
    gojo.group.rotation.y = p.facing;

    const hurtScale = p.hurtTimer > 0 ? 1 + Math.sin(p.hurtTimer * 30) * 0.05 : 1;
    const landScale = p.landTimer > 0 ? 1 - p.landTimer * 0.4 : 1;
    gojo.group.scale.set(hurtScale * (2 - landScale), landScale * hurtScale, hurtScale * (2 - landScale));

    const flicker = p.dashTimer > 0 && Math.floor(game.time * 22) % 2 === 0;
    gojo.group.visible = !flicker;

    animateGojo(gojo, p, dt, game.time);
  }

  /* ========================================================= camera */

  const camTarget = v3();
  const camDesired = v3();

  function updateCamera(dt) {
    camTarget.copy(player.pos).add(v3(0, 1.9, 0));

    if (cam.cine) {
      const cine = cam.cine;
      cine.t += dt;
      const angle = player.facing + cine.side;
      camDesired.set(
        player.pos.x + Math.sin(angle) * cine.distance,
        cine.height + 1.2,
        player.pos.z + Math.cos(angle) * cine.distance,
      );
      mainCamera.position.lerp(camDesired, damp(5, dt));
      mainCamera.lookAt(player.pos.x, cine.lookHeight, player.pos.z);

      const fovTarget = cine.fov;
      mainCamera.fov = lerp(mainCamera.fov, fovTarget, damp(4, dt));
      mainCamera.updateProjectionMatrix();

      if (cine.t >= cine.duration) cam.cine = null;
    } else {
      const offset = v3(
        Math.sin(cam.yaw) * Math.cos(cam.pitch),
        Math.sin(cam.pitch),
        Math.cos(cam.yaw) * Math.cos(cam.pitch),
      ).multiplyScalar(cam.dist);

      camDesired.copy(camTarget).add(offset);
      camDesired.y = Math.max(camDesired.y, 0.7);
      mainCamera.position.lerp(camDesired, damp(7, dt));
      mainCamera.lookAt(camTarget);

      const fovTarget = 55 + cam.fovPulseAmt * 15;
      if (Math.abs(mainCamera.fov - fovTarget) > 0.05) {
        mainCamera.fov = lerp(mainCamera.fov, fovTarget, damp(5, dt));
        mainCamera.updateProjectionMatrix();
      }
    }

    if (cam.shakeAmt > 0) {
      mainCamera.position.x += rand(-1, 1) * cam.shakeAmt * 0.6;
      mainCamera.position.y += rand(-1, 1) * cam.shakeAmt * 0.6;
      mainCamera.position.z += rand(-1, 1) * cam.shakeAmt * 0.6;
      cam.shakeAmt = Math.max(0, cam.shakeAmt - dt * 1.9);
    }
    cam.fovPulseAmt = Math.max(0, cam.fovPulseAmt - dt * 1.2);
  }

  /* ==================================================== game flow */

  function startGame() {
    game.round = 1;
    game.score = 0;
    game.combo = 0;
    game.roundTime = 0;
    player.hp = player.maxHp;
    player.energy = 30;
    player.pos.set(0, 0, 6);
    player.vel.set(0, 0, 0);
    player.facing = Math.PI;
    player.domainTimer = 0;
    player.invuln = 1;
    player.lockTimer = 0;
    if (game.abilities) game.abilities.clear();
    clearTransientEffects();
    if (game.domainActive) exitDomain();

    spawnEncounter();
    game.phase = 'playing';
    game.paused = false;
    game.callbacks.overlay('playing');
    banner('ROUND 1', 1.8);
    sound('ui');
  }

  function nextRound() {
    game.round += 1;
    game.roundTime = 0;
    player.hp = Math.min(player.maxHp, player.hp + 50);
    player.energy = Math.min(player.maxEnergy, player.energy + 45);
    player.pos.set(0, 0, 6);
    player.vel.set(0, 0, 0);
    player.invuln = 1.2;
    player.lockTimer = 0;
    if (game.abilities) game.abilities.clear();
    clearTransientEffects();
    if (game.domainActive) exitDomain();

    spawnEncounter();
    game.phase = 'playing';
    game.paused = false;
    game.callbacks.overlay('playing');
    banner(`ROUND ${game.round}`, 1.8);
    sound('ui');
  }

  function roundClear() {
    game.phase = 'roundclear';
    const grade = game.roundTime < 45 && game.combo > 8 ? 'S' : game.roundTime < 75 ? 'A' : 'B';
    game.score += grade === 'S' ? 1500 : grade === 'A' ? 900 : 500;
    banner(`ROUND CLEAR — RANK ${grade}`, 2.4);
    window.setTimeout(() => {
      if (game.phase === 'roundclear') game.callbacks.overlay('roundclear');
    }, 1300);
  }

  function gameOver() {
    game.phase = 'gameover';
    player.domainTimer = 0;
    if (game.domainActive) exitDomain();
    if (game.abilities) game.abilities.clear();
    sound('ko');
    window.setTimeout(() => {
      if (game.phase === 'gameover') game.callbacks.overlay('gameover');
    }, 1100);
  }

  function togglePause(force) {
    if (game.phase !== 'playing' && game.phase !== 'paused') return;
    const next = typeof force === 'boolean' ? force : !game.paused;
    game.paused = next;
    game.phase = next ? 'paused' : 'playing';
    game.callbacks.overlay(next ? 'paused' : 'playing');
    sound('ui');
  }

  /* ===================================================== abilities */

  function faceCameraDirection() {
    player.facing = cam.yaw + Math.PI;
  }

  const abilityTriggers = {
    melee() {
      faceCameraDirection();
      return game.abilities && game.abilities.melee();
    },
    blue() {
      faceCameraDirection();
      return game.abilities && game.abilities.blue();
    },
    red() {
      faceCameraDirection();
      return game.abilities && game.abilities.red();
    },
    purple() {
      faceCameraDirection();
      return game.abilities && game.abilities.purple();
    },
    infinity() {
      return game.abilities && game.abilities.infinity();
    },
    domain() {
      faceCameraDirection();
      return game.abilities && game.abilities.domain();
    },
    jump() {
      if (game.phase !== 'playing' || !player.onGround) return false;
      player.vel.y = 11.5;
      player.onGround = false;
      player.landTimer = 0;
      sound('jump');
      particles.spawn(player.pos, 0x88a0ff, 8, 3, 0.4);
      return true;
    },
    dash() {
      if (game.phase !== 'playing' || player.dashCooldown > 0) return false;
      const moving = player.vel.lengthSq() > 0.5;
      const dir = moving
        ? player.vel.clone().setY(0).normalize()
        : v3(Math.sin(player.facing), 0, Math.cos(player.facing));
      player.dashTimer = 0.18;
      player.dashCooldown = 1.15;
      player.invuln = Math.max(player.invuln, 0.28);
      player.vel.addScaledVector(dir, 24);
      sound('dash');
      particles.spawn(player.pos.clone().add(v3(0, 1, 0)), 0x77d0ff, 14, 5, 0.45);
      game.callbacks.haptic('light');
      return true;
    },
  };

  /* ========================================================= ctx */

  const handVec = v3();

  game.ctx = {
    scene,
    player,
    camera: cam,
    sound,
    flash,
    banner,
    hitStop,
    slowmo,
    getEnemies: () => game.enemies,
    damageEnemy,
    damagePlayer,
    addProjectile,
    enterDomain,
    exitDomain,
    aimDir() {
      return v3(Math.sin(player.facing), 0, Math.cos(player.facing));
    },
    handPos(side) {
      const parts = gojo.parts;
      const arm = side === 'left' ? parts.armL : parts.armR;
      const hand = arm.hand || arm.elbow;
      hand.getWorldPosition(handVec);
      return handVec;
    },
  };

  game.attachAbilities = (system) => {
    game.abilities = system;
  };

  game.triggers = abilityTriggers;
  game.flow = {
    start: startGame,
    next: nextRound,
    restart: startGame,
    pause: togglePause,
  };

  /* ========================================================= update */

  game.update = function update(rawDt) {
    const raw = Math.min(rawDt, 0.05);

    let dt = raw;
    if (game.hitStopTimer > 0) {
      game.hitStopTimer -= raw;
      dt *= 0.07;
    }
    if (game.slowmoTimer > 0) {
      game.slowmoTimer -= raw;
      dt *= game.slowmoScale;
    }

    const paused = game.paused;
    const gameplayDt = paused ? 0 : dt;

    game.time += raw;
    if (game.phase === 'playing') game.roundTime += gameplayDt;

    if (game.comboTimer > 0) {
      game.comboTimer -= raw;
      if (game.comboTimer <= 0) game.combo = 0;
    }

    if (gameplayDt > 0) {
      updatePlayer(gameplayDt);
      for (const enemy of game.enemies) updateEnemy(enemy, gameplayDt);
      updateProjectiles(gameplayDt);
      if (game.abilities) game.abilities.update(gameplayDt);

      // round clear detection
      if (game.phase === 'playing' && game.enemies.length > 0) {
        const alive = game.enemies.some((e) => e.hp > 0 || e.dying > 0);
        if (!alive) roundClear();
      }
    } else {
      // keep animations alive while paused / in menus
      updatePlayer(0);
    }

    // ambient visuals always run
    if (game.level) game.level.update(raw, game.time);
    if (game.domainActive && game.voidDomain) game.voidDomain.update(raw, game.time);
    updateCamera(paused ? raw * 0.35 : raw);
    animateAmbience(raw);
  };

  function animateAmbience(dt) {
    // subtle energy motes around the arena
    if (Math.random() < dt * 5 && game.level && !game.domainActive) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(3, ARENA_RADIUS);
      particles.spawn(v3(Math.cos(a) * r, rand(0.1, 3), Math.sin(a) * r), 0x6a7dff, 1, 0.8, 2.2, 0.5);
    }
  }

  /* ============================================== bootstrapping */

  setLevel('tokyo');
  game.voidDomain = game.voidDomain || buildVoidDomain();
  setVisible(game.voidDomain, false);
  gojo.group.position.copy(player.pos);
  gojo.group.rotation.y = player.facing;

  return game;
}
