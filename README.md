# Gojo: Cursed Showdown

A browser-based 3D anime arena fighter starring Gojo Satoru — built with Three.js and Vite, no backend, no paid assets.

**Play it: https://ga6484335-star.github.io/Jjs/**

## Features

- Real-time 3D combat arena with camera-relative movement, dash, jump and lock-on facing
- Melee combo system with timing windows, hit-stop, knockback and **Black Flash** (attack inside the timing window for a crimson-impact critical)
- Cursed techniques: **Lapse Blue** (pull), **Reversal Red** (blast), **Hollow Purple** (piercing ultimate), **Infinity** (damage-blocking distortion) and **Infinite Void** (domain expansion that suspends enemies in a cosmic arena)
- 4 handcrafted arenas (Tokyo streets, ruined ward, rooftop helipad, cursed shrine) and 4 enemy archetypes including a two-phase boss
- Round-based scaling encounters, rank grades, victory/defeat and restart
- Mobile-first: virtual joystick, camera drag, 8 ability buttons with cooldown fills, vibration, auto-pause
- 20 procedural synth sound effects, quality tiers (Low/Med/High), installable PWA with offline cache

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | WASD | Left virtual joystick |
| Camera | Mouse drag | Right drag zone |
| Jump | Space | Jump button |
| Dash | Shift | Dash button |
| Attack | J / Left click | Attack button |
| Black Flash | Attack inside the timing window | Same |
| Infinity / Blue / Red | K / U / I | Ability buttons |
| Hollow Purple / Infinite Void | O / P | Ability buttons |

## Develop

```bash
npm ci
npm run dev      # local dev server
npm run build    # production build into dist/
npm run check    # syntax check
```

## Deploy

Pushing to `main` auto-builds and deploys to GitHub Pages via `.github/workflows/deploy-pages.yml`. The build uses a relative base path, so it works from the `/Jjs/` project URL, a subdirectory, or a custom domain.
