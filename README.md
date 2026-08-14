# DEATH REJECTED — First Playable

A desktop-first first-person survival-shooter prototype built with TypeScript,
Three.js, and Vite. The game uses only procedural geometry, generated UI art,
and synthesized audio; the visual references in the design brief are not
included as assets.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (configured as `http://127.0.0.1:4173`).

Production check:

```bash
npm run build
```

## Controls

- WASD: move
- Mouse: look
- Shift: sprint
- Space: jump / slide-jump
- C or Ctrl: crouch / slide
- Left click: fire
- Right click: aim
- R: reload
- Q: knife
- 1 / 2 or mouse wheel: switch weapons
- E: use the Sanguine Arms gun shop
- Escape: release pointer lock / pause

## Playable loop

Survive escalating Blood Moons in the mall atrium, earn Marks for kills and
movement-based bonuses, recover Blood through aggressive close-range play, buy
the Widowmaker shotgun and ammunition at the fixed gun shop, and clear Moons I
through V and beyond. Death triggers the DEATH REJECTED sequence, a wall-tally
restart scene, and a new canonical attempt. Attempt count and best Moon persist
in local storage.

Gunfire supports 2.25x headshot damage. The knife uses a visible first-person
slash and a 3.15-unit forward melee radius. Enemies steer around atrium
obstacles and recover from blocked positions, while sprint momentum carries
into longer, faster slides beneath the central Blood Moon.

## Project layout

The main systems live in `src/game`: player movement, weapons/melee, enemies,
Moon flow, environment, audio, save data, and HUD/state presentation are kept
separate so Second Milestone systems can be added without rewriting the core.
