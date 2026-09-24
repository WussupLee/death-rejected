# Astra overhaul requirements ledger

Reviewed 2026-09-24 against [the supplied overhaul plan](overhaul-plan.md), all 33 sections of the original master brief, and all 16 embedded references and usage notes. This replaces the previous ledger, which incorrectly deferred core V2 art, animation, options and vertical traversal.

Status meanings: **Implemented** means code/assets exist and the named checks exercise them. **Review** means a qualitative or device-specific acceptance gate remains. **Blocked** means a required external action was denied. **Second milestone** means explicitly deferred by the supplied plan, not silently removed from V2.

## Plan-to-implementation trace

| Requirement | Implementation / evidence | Status |
|---|---|---|
| Fixed simulation separate from rendering and UI | Simulation.ts, 120 Hz; 30/60/144 FPS invariance; 20 Hz HUD; separately advanced effects/animation | Implemented |
| Sprint, acceleration, friction, crouch, slide and slide-jump | PlayerController.ts; crouch speed, wish-direction air acceleration, height-aware ground; movement and both-escalator tests | Implemented |
| Native capture, unrestricted look, Escape, recapture | Game.ts; actual browser capture and >360-degree movement test; no timeout that silently resumes after Escape | Implemented |
| Secondary preview fallback | Rejected/unsupported lock activates edge turning; actual mouse mode in snapshot | Implemented |
| Blackthorn, Widowmaker, hands and Q knife | AssetLibrary.ts, WeaponSystem.ts; textured GLBs, articulated arms, animated slide, magazine, pump, hand motion, equip/recoil/aim | Implemented; art review |
| Wind-up / active / recovery melee, cone, obstruction, once per target | Simulation.KNIFE, EnemySystem.melee, per-swing ID set; F8 development-only cone | Implemented |
| Head/body volumes and 2.25x damage | Analytic independent head sphere/body box; scenery bounds the ray; distinct feedback; behavioral and browser checks | Implemented |
| Muzzle light, recoil, sound, shells, smoke, impacts, kill feedback | WeaponSystem + pooled instanced CombatEffects + UI + AudioManager | Implemented |
| Two animated enemy silhouettes | Thrall and Stalker GLBs; walk, idle, attack, hurt and death; sustained telegraphed pounce, recovery and flank goals | Implemented; art review |
| Navigation covers floor, balconies, escalators, fountain, pillars, directory and shop | Shared WorldLayout and two-level NavigationGrid; reservations, separation, per-agent progress/repaths/recovery; all-pillar routes and observed-stall regressions | Implemented |
| No attacks across floors or through scenery | Vertical melee bounds and line-of-sight attack check; bullet obstruction | Implemented |
| Authored mall topology | Paired 40-step escalators, connected upper ring, rail openings, shuttered stores, fountain, directory, benches, banners, service doors | Implemented; broader module art review |
| Historical material detail | 256px painted plaster/stone/shutter textures, damaged mall signs, inset storefront GLB, debris and stained tile | Implemented; additional set dressing remains an art gate |
| Moon composition and red/cyan contrast | Red moon visible through skylight, red directional/point illumination, cyan practical lights; per-Moon occult stains | Implemented; visual review |
| Puddle reflections | One-time scene cubemap, reused by wet surfaces; disabled in Performance | Implemented; static approximation, not planar dynamic reflection |
| Menu: live backdrop, keyboard, sparse vertical choices | Live camera drift, Begin / Options / Controls, arrows and Enter; quality/sensitivity/volume | Implemented |
| HUD position and palette | Portrait/Blood left, Marks and capped rewards bottom center, ammo/name right, Roman Moon above; no weapon icons | Implemented |
| Intensity pacing | No spawning during anticipation/relief; build cap, peak interval, low-Blood mercy, cleanup; deterministic mixes | Implemented; human pacing review |
| Moons I–V, 20-second intermission, shop/economy/recovery | MoonManager, killReward, shop transactions; behavioral and browser checks | Implemented |
| Death / tally / fast restart | 0.12x enemy motion, audio collapse, red-to-black transition, modeled hunter and physical scratched marks, immediate restart | Implemented; animation/art review |
| Preserve attempts and best Moon | Version-2 migration reads original v1 key; finite integer validation, corrupt-v2 fallback, unavailable-storage tolerance | Implemented |
| Adaptive quality | Resolution, shadows, static reflections, particle budget, enemy animation frequency, screen effects; manual overrides; hysteresis | Implemented |
| Typed interfaces | types.ts: InputAction, MovementProfile, WeaponDefinition, AttackWindow, DamageResult, EnemyArchetype, NavigationAgent, MoonDefinition, IntensityState, QualityProfile, AssetManifest | Implemented |
| Development snapshot | Frame time, draw calls, dropped simulation time, movement, attack window, hit zone, paths, repaths/recoveries, intensity, quality and Moon | Implemented |
| Editable model sources + GLB delivery | Thirteen .bbmodel sources; original mesh/texture authoring scripts; meshopt compression; GLTFLoader decoder; Khronos validation | Implemented |
| Browser Blockbench modeling/export round trip | Editor opens; opening local model was rejected twice by automatic approval review as an external transfer; permission question sent | Blocked pending user authorization |
| Painted asset finish / baked AO / modular asset family | Original 256px atlas; offline cosine-weighted raycast vertex AO; reusable storefront, pillar, fountain, escalator, service-door, railing and debris GLBs; rigid node animation | Implemented; final visual and animation acceptance remains |
| 60 FPS at 1080p | Local Edge native-1080p High test with 13 enemies: ~60 FPS average, 16.9 ms p95; final report in astra-review.md | Local evidence; wider device gate open |
| Separate preview; no Pages promotion without approval | Review branch + existing private Astra Sites playtest; Pages workflow still only deploys master/main | Implemented release isolation |

## All 33 master-brief sections

| Section | Treatment |
|---|---|
| 1. Summary | Original desktop occult survival FPS identity retained |
| 2. Core fantasy | Cursed hunter, aggressive combat, canonical attempts |
| 3. Setting | Authored decayed mall atrium, skylight, wet tile, stores and upper ring; extra wings Second milestone |
| 4. Story / death | Slowdown, audio collapse, black fade, modeled revival, new scratch and restart |
| 5. Round structure | Roman Moons and 20-second downtime |
| 6. Movement | Fixed-step sprint / crouch / slide / jump / retained momentum |
| 7. Advanced movement | Double jump and slam Second milestone |
| 8. Combat | Close recovery, knife utility, weapon differentiation, reactions |
| 9. Melee | Q knife now; sword / charged slash / deflection Second milestone |
| 10. Health/currency | Blood and Marks kept separate |
| 11. Stylish bonuses | Slide +15, air/execution +20, multi +30, capped brief feedback |
| 12. Guns | Pistol and shotgun V2; remaining compact arsenal Second milestone |
| 13. Gun shop | Fixed Sanguine Arms location, shotgun and ammo spending |
| 14. Upgrade Altar | Second milestone |
| 15. Enemies | Thrall and leaping Stalker; other archetypes Second milestone |
| 16. Escalation | Mixed Moons I–V, stronger Moon V mix; Moon X boss Second milestone |
| 17. Modifiers | Intensity states now; BLACKOUT and other modifiers Second milestone |
| 18. Flashlight | Second milestone, as the overhaul plan explicitly requires |
| 19. Map | Atrium loop, two escalators and continuous balcony; branches Second milestone |
| 20. Character | Original portrait retained; hunter model has brown skin, curls, white eyes, goatee, face cross, chains and black coat; likeness/art review remains |
| 21. Voice | No chatty dialogue; authored voice recording not required for V2 |
| 22. Visual style | Low-resolution atlas and faceted mesh assets; no heavy distortion; aesthetic approval still open |
| 23. Environment | Painted decay, red moon, cyan pools, static wet reflections; final set-dressing pass still open |
| 24. HUD | Locked edge layout and bone/red/charcoal palette preserved |
| 25. Audio | Layered synthesized guns, bass/percussion reacting to director, relief and death collapse |
| 26. Technical | Three.js + TypeScript + Vite; modular fixed simulation |
| 27. Performance | Mesh batching, capped enemy pool, instanced particles, mesh compression and adaptive settings |
| 28. Input | WASD, native mouse, Shift, Space, C/Ctrl, R, Q, E, 1/2/wheel, Escape |
| 29. Priorities | Movement/combat/navigation corrected before deferred features |
| 30. First playable | Complete loop exercised by browser and behavioral checks; human replayability gate still open |
| 31. Second milestone | Kept out of this change |
| 32. Non-goals | No campaign, multiplayer, mobile, attachments, giant perk tree or destructibility work |
| 33. Experience target | Launch → hunt → earn → shop → reject death → scratch → restart; evaluation is not replaced by code checks |

## All 16 reference usage constraints

| Ref | Applied direction | Explicit exclusion retained |
|---|---|---|
| HUD 01 | Edge anchoring and open center | No cyan palette, objectives or waypoints |
| HUD 02 | Portrait/health relationship and strong numerals | No copied graphic panels, branding or weapon silhouettes |
| HUD 03 | Separated health and ammo | No blue, minimap or checklist |
| HUD 04 | Original portrait and chunky readouts | No dense icon stack, armor color or dual-weapon UI |
| Character 01 | Long black coat and hunter presence | No actor, face, eyewear or costume copied |
| Character 02 | Boots, layers and gothic proportions | No pictured person's likeness or castle setting |
| Character 03 | Layered leather and jewelry | No copied model or garments |
| Character 04 | White eyes, rings and chains | Original face, curls, goatee and tattoos |
| Character 05 | Black-on-black texture and silver detail | No reproduced identity or exact jewelry |
| Mall 01 | Wet tiles, depth and cyan decay | Authored landmark loops, not a liminal maze |
| Mall 02 | Paired escalators and multi-level ruin | Both escalators remain traversable |
| Mall 03 | Atrium height and balcony relationship | Contrast/readability review remains, not assumed passed |
| Mall 04 | Service signage and clutter | Food-court expansion / flashlight deferred; no battery management |
| Mall 05 | Fountain/skylight orientation | New signs, architecture and floor plan |
| Mall 06 | Broken ribs, wet patches and low-res materials | Grain removed when it obscured combat |
| Mall 07 | Balcony overview and looping routes | No copied monochrome palette or exact layout |

No embedded reference images were shipped as game textures, models or UI art.

## Production gates

1. **Requirements / benchmark:** source review complete; research matrix in research-matrix.md.
2. **Visual foundation:** textured and animated assets, modular architecture, baked vertex AO and live composition implemented; final aesthetic approval and Blockbench round trip remain open.
3. **Combat room:** automated mechanics, obstruction, movement, pointer lock and navigation checks pass.
4. **Vertical slice:** implemented and exercised. Repeated human pacing, feel and replayability comparison remains open.
5. **Performance / release:** local automated checks and local 1080p measurement exist. Private preview only. Cross-device/work-computer certification and promotion approval remain open.

The plan is not honestly “100% complete” merely because builds and tests pass. Remaining production gates are recorded here instead of being relabeled Second Milestone.
