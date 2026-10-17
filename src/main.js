import * as THREE from 'three';
import { renderer, scene, camera } from './core.js';
import { updateEffects } from './effects.js';
import { createGame } from './game.js';
import { AbilitySystem } from './abilities.js';
import { initUI } from './ui.js';

/* ------------------------------------------------------------- boot */

const game = createGame();
game.attachAbilities(new AbilitySystem(game.ctx));
const ui = initUI(game);

/* -------------------------------------------------------------- PWA */

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* PWA install is optional; never block the game */
    });
  });
}

/* --------------------------------------------------------- game loop */

const clock = new THREE.Clock();

function tick() {
  const rawDt = clock.getDelta();
  game.update(rawDt);
  updateEffects(rawDt);
  ui.updateHUD();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();
