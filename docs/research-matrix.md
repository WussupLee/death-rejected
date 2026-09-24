# Research and legacy-system matrix

This is an implementation comparison, not a claim to have watched inaccessible talks or conducted comparative play sessions.

| Primary source | Usable evidence / intended application | Concrete implementation |
|---|---|---|
| [DUSK](https://store.steampowered.com/app/519860/) | Official retro FPS / survival description; use movement and authored-space readability as design targets | Momentum preservation and circular atrium routes |
| [Devil Daggers](https://store.steampowered.com/app/422970/) | Official survival presentation; use enemy pressure and clear silhouettes as targets | Capped populations, two height profiles, sparse HUD |
| [ULTRAKILL](https://store.steampowered.com/app/1229490/) | Official aggressive combat / Blood-recovery direction | Close kill recovery; stronger melee recovery and style Marks |
| [Push-forward combat](https://gdcvault.com/play/1024940/Embracing-Push-Forward-) | Fetch failed; not treated as a watched source | The plan itself specifies close-range incentives |
| [First-person animation](https://gdcvault.com/play/1022297/The-Art-of-First-Person) | Fetch timed out; no claim of having viewed the talk | Articulated hands, slide/pump/magazine clips; synchronized recoil, effects and audio |
| [Adventure Director](https://gdcvault.com/play/1035589/Game-AI-Summit-Growing-an) | Accessible session overview describes control of encounter flow and authored overrides | Anticipation, build, peak, relief, cleanup, low-Blood mercy |
| [F.E.A.R. reference link](https://gdcvault.com/play/1013394/contactUs) | Supplied URL inaccessible; no claim to implement F.E.A.R.'s full planner | Compact A*, local reservations, flank goals, progress tracking and safe local recovery |
| [Blockbench export](https://blockbench.net/wiki/guides/export-formats/) | GLB preserves hierarchy/animation/textures; editable sources should remain separate | .bbmodel source plus compressed .glb runtime delivery; browser round trip pending permission |
| [Three GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) | Supported glTF loading and compression integration | GLTFLoader with bundled MeshoptDecoder |
| [glTF Transform meshopt](https://gltf-transform.dev/modules/functions/functions/meshopt) | Official compression pipeline | Weld, deduplicate, quantize/reorder and EXT_meshopt_compression |

## Legacy decisions

- **Retained and corrected:** movement tuning constants, basic aim/pointer-lock event flow, v1 save values, weapon names, Marks prices, kill rewards, five-Moon economy, original portrait.
- **Replaced:** frame-driven simulation, direct enemy mesh raycasts, single-frame knife contact, primitive weapon/enemy construction, floor-only navigation, blocked escalator geometry, source-string tests, static landing image as the menu background, portrait-only tally.
- **Extended:** lighting, architectural details, audio synthesis, quality controls and HUD. These are not represented as a complete externally modeled replacement of the mall.
- **Deferred only by explicit plan:** sword, deflection, flashlight/BLACKOUT, Altar, other wings/unlocks, double jump, slam, extra enemies/arsenal and Moon X.
