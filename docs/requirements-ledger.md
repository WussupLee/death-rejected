# DEATH REJECTED — V2 Vertical Slice Ledger

This branch implements the First Playable Milestone as an original desktop browser game. The written master brief is authoritative; its visual appendix was used only for mood, contrast, pacing, and composition.

## Playable now

- First-person mouse look with Pointer Lock, click-to-recapture, and Escape-to-release.
- WASD locomotion, faster sprint, jump, crouch, momentum-preserving slide, and slide-jump carry.
- BLACKTHORN .45 and unlockable WIDOWMAKER 12G with recoil, aim FOV, procedural viewmodels, hit feedback, reloads, ammo, and headshot multipliers.
- Q knife with a visible arm/blade arc, a timed contact frame, a 3.15-unit cone hitbox, and close-range Blood recovery.
- Five escalating Moons with anticipation/build/peak/relief pacing, enemy caps, intermissions, Marks, and a mall weapon counter.
- Two original enemies: masked funeral Thralls and low quadrupedal Stalkers.
- Grid pathfinding, local separation, steering alternatives, and stuck recovery around the fountain, pillars, kiosk, shop, and escalators.
- DEATH REJECTED pause/death/tally/restart loop with local attempt and best-Moon persistence.
- Adaptive high/balanced/performance rendering profiles.

## Art direction implemented

- Original ruined two-level mall atrium with shuttered stores, period directory, dead fountain, escalators, roof ribs, balcony fascia, furniture, debris, puddles, banners, and restrained occult marks.
- Centered cratered blood moon and red environmental illumination balanced by failing teal mall practicals.
- Early-2000s survival-horror menu language: full-bleed key art, vertical typography, hard-edged HUD, minimal chrome, grain, scanlines, and bone/blood/charcoal color hierarchy.
- Original generated menu/key art and protagonist portrait; no reference-image people, characters, HUDs, logos, or environments were reproduced.

## Intentionally deferred to the Second Milestone

- A second playable location and additional floor traversal.
- Boss encounters, bespoke elite move sets, and cinematic introductions.
- Additional firearms, upgrades, persistent loadouts, and deeper shop economy.
- Hand-authored skeletal character animation, motion-captured first-person animation, and authored audio recordings/music.
- Story scenes, dialogue, objectives beyond survival, accessibility/options menus, gamepad/mobile support, and online features.
- Full art-production pass with externally authored GLB characters, baked lighting, texture atlases, LODs, and a broader device certification matrix.

## Verification contract

`pnpm test` performs TypeScript checking, a production Vite build, and smoke checks for the HUD, Moon flow, combat, Q melee, headshots, shop, pointer lock, death/tally, persistence, and Roman numerals.
