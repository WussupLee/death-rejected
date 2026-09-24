# DEATH REJECTED Astra Complete Overhaul

## Summary

Rebuild DEATH REJECTED as a visually distinctive, late-PS2/early-Xbox occult FPS vertical slice. Preserve only the proven movement, sliding, save, and selected Moon/shop logic from the current prototype; replace the environment, enemies, weapons, first-person presentation, menus, HUD, lighting, audio treatment, and overall art direction.

The complete original brief—including all 33 sections, 16 embedded references, and every “Use this for” / “Do not copy” note—remains authoritative. :codex-file-citation{path="L:/downloads/DEATH_REJECTED_Codex_Master_Brief.docx" purpose="source" artifact_kind="document"}

“ Award-winning” will be treated as a production-quality target: coherent identity, authored art, exceptional responsiveness, memorable presentation, repeatable playtesting, and no generic generated-game interface patterns.

## Creative and Research Direction

- Use [DUSK](https://store.steampowered.com/app/519860) and [Devil Daggers](https://store.steampowered.com/app/422970) to study maneuverability, silhouette readability, spatial pressure, and minimal survival presentation.
- Study [ULTRAKILL](https://store.steampowered.com/app/1229490) and id Software’s [push-forward combat](https://www.gdcvault.com/play/1024940/Embracing-Push-Forward-) for aggressive Blood recovery, close-range incentives, movement-combat interplay, and constant player agency.
- Apply Bungie’s [first-person animation principles](https://gdcvault.com/play/1022297/The-Art-of-First-Person) so weapons, hands, knife attacks, reloads, recoil, and camera motion feel like the protagonist’s body rather than objects attached to the camera.
- Study intensity-controlled spawning from the [AI Director lineage](https://gdcvault.com/play/1035589/Game-AI-Summit-Growing-an) and adaptive replanning from [F.E.A.R.’s AI](https://www.gdcvault.com/play/1013394/contactUs) for wave pacing, flanking, obstacle navigation, and recovery from blocked paths.
- Use the supplied mall references for topology, wet materials, escalators, balconies, skylight rhythm, storefront decay, and flashlight-era horror composition. Do not reproduce their exact architecture, signs, interfaces, characters, or layouts.
- Maintain a traceable requirements ledger covering the master brief and every follow-up: pointer lock and 360-degree look, Escape release, browser performance, work-computer publishing, Q knife, visible slash and melee radius, headshots, enemy unsticking, faster sprinting, slide momentum, and the centered Blood Moon with red illumination.

## Art and Experience Overhaul

- Use the browser version of Blockbench instead of installing Blender. Blockbench supports modeling, UV painting, rigging, keyframe animation, and glTF/GLB export with hierarchy and animation support. [Blockbench export documentation](https://blockbench.net/wiki/guides/export-formats/) · [Blockbench animation tools](https://blockbench.net/)
- Retain editable `.bbmodel` sources and exported `.glb` assets in the project. Optimize exports with mesh compression and web-ready textures before loading through Three.js; Three.js supports glTF animation, mesh compression, GPU instancing, and compressed texture extensions. [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- Build one cohesive original asset family:
  - First-person arms, Blackthorn pistol, Widowmaker shotgun, and knife with complete gameplay animations.
  - Thrall and Stalker models with unique silhouettes, rigs, locomotion, attacks, reactions, stagger, and death animations.
  - Modular storefronts, pillars, fountain, traversable escalators, balcony routes, railings, service doors, skylight, shop, debris, puddles, and occult corruption.
  - Original protagonist portrait and tally-scene character model preserving the locked Latino identity, curls, white eyes, goatee, tattoos, chains, and long black coat.
- Use deliberately economical early-2000s assets: authored low-poly topology, painted 128–512px texture atlases, baked ambient occlusion, limited materials, sharp silhouettes, selective emissive surfaces, and restrained modern lighting.
- Make the mall feel inhabited by history: distinct shop identities, abandoned displays, directory boards, maintenance clutter, water damage, readable route landmarks, and subtle changes as Moons escalate.
- Center the Blood Moon through the atrium skylight/window composition. Its red directional and ambient influence should affect floors, pillars, fog, enemies, weapons, and puddle reflections without erasing cyan/green fluorescent contrast.
- Replace the current web-like landing overlay with an early-2000s full-screen game menu: minimal vertical choices, period typography, animated mall/Blood Moon background, immediate keyboard navigation, short transitions, and no rounded cards, glass panels, generic dashboard framing, or excessive explanatory text.
- Redesign the HUD as sparse gothic combat instrumentation: bottom-left portrait and Blood, bottom-center Marks feedback, bottom-right weapon name and ammunition without silhouettes, and a restrained Roman-numeral Moon display. Keep the center visually open.

## Gameplay and Technical Rebuild

- Port the working movement math into a fixed-step simulation and retune acceleration, friction, air control, sprint, crouch, slide duration, slide-jump retention, landing behavior, camera bob, and weapon sway as a single movement system.
- Preserve native pointer lock for unrestricted 360-degree mouse look; clicking recaptures the mouse and Escape releases it. Retain a clearly secondary preview fallback where pointer lock is unavailable.
- Rebuild weapon feel as synchronized systems: immediate input response, distinct recoil curves, firing animation, muzzle light, smoke, shell behavior, sound layers, enemy reaction, impact effects, hit markers, kill confirmation, and short camera impulses.
- Keep Q as the knife action. Use a visible arm-and-knife slash with wind-up, active hit window, recovery, forward cone, obstruction check, one hit per target per swing, and a development-only hitbox visualizer.
- Keep separate body and head collision volumes with a 2.25× headshot multiplier and unmistakable headshot feedback.
- Replace direct-chase enemy movement with an authored navigation graph or compact nav grid covering the atrium floor, balconies, escalators, shop, fountain, and pillars. Add local avoidance, reservation around choke points, progress tracking, repathing, and safe unsticking.
- Give Moons an intensity curve rather than constant spawning: anticipation, build, peak, relief, and cleanup. Maintain the 20-second intermission, Moons I–V, Marks, gun shop, aggressive Blood recovery, stylish rewards, and escalating Thrall/Stalker combinations.
- Rebuild the DEATH REJECTED sequence with time dilation, audio collapse, red-to-black visual decay, a short authored tally scene, one newly scratched mark, persistent attempt/best-Moon data, and fast restart.
- Add adaptive quality presets controlling render scale, shadows, puddle reflections, post-processing, particles, and enemy presentation. Preserve color management and limit dynamic lights and render passes to protect browser performance.

### Interface changes

- Add typed `InputAction`, `MovementProfile`, `WeaponDefinition`, `AttackWindow`, `DamageResult`, `EnemyArchetype`, `NavigationAgent`, `MoonDefinition`, `IntensityState`, `QualityProfile`, and `AssetManifest` contracts.
- Version saved data while retaining existing attempts and best Moon.
- Expand the development snapshot with frame timing, movement state, active attack window, hit zone, enemy path/progress state, director intensity, quality profile, and Moon state.
- Separate fixed simulation, rendering, effects, and UI updates so frame-rate instability does not alter movement or combat behavior.

## Production Gates and Verification

1. **Requirements and benchmark gate**
   - Complete the requirement/follow-up ledger and research comparison matrix.
   - Identify each borrowed legacy system and each system that must be replaced.

2. **Visual foundation gate**
   - Establish the final palette, typography, texture rules, mall module kit, Blood Moon lighting, protagonist portrait, one finished weapon, and one finished enemy.
   - Reject the direction if it still resembles a generic Codex site, primitive Three.js demo, or modern web dashboard.

3. **Combat-room gate**
   - Validate movement chains, pistol feel, Q knife, headshots, one enemy, navigation around all major obstacles, and stable pointer lock in the rebuilt atrium.

4. **Vertical-slice gate**
   - Complete both enemies, pistol, shotgun, knife, Moons I–V, shop, economy, intermission, HUD, audio states, death/tally loop, and persistence.
   - Playtest pacing, visual readability, movement satisfaction, weapon differentiation, enemy pressure, navigation failures, and desire to immediately restart.

5. **Performance and release gate**
   - Unit-test movement, damage, melee windows, economy, Moon transitions, director pacing, and save migration.
   - Add deterministic enemy-routing and stuck-recovery scenarios for every pillar, fountain route, escalator, shop edge, and balcony access.
   - Browser-test pointer lock, 360-degree look, Escape release, Q knife, headshots, shop use, death/restart, and persistence.
   - Target 60 FPS at 1080p on a reasonably modern desktop, with adaptive settings for weaker work-computer browsers.
   - Publish V2 to a separate preview while the current GitHub Pages release remains untouched. Promote V2 only after comparison testing and approval.

## Deferred Until the Vertical Slice Is Excellent

Sword progression, projectile deflection, flashlight and BLACKOUT, Upgrade Altar, additional mall wings, area unlocks, double jump, ground slam, additional enemy archetypes, expanded arsenal, and Moon X remain Second Milestone work. Their interfaces may be prepared, but they must not dilute the visual and mechanical quality of Moons I–V.
