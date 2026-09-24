# DEATH REJECTED — Astra overhaul playtest

An original desktop occult FPS set in a dead mall. This revision repairs the combat and navigation foundations and adds textured animated assets, a live title scene, a connected balcony, and a modeled death/tally loop.

The authoritative scope and remaining acceptance gates are in [the requirements ledger](docs/requirements-ledger.md). [The review](docs/astra-review.md) records the defects found, changes, test evidence and limitations. Passing automated checks does not certify the final art direction or replayability.

## Run

Node 22.15+ (24 recommended), pnpm 11.25.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open the printed local URL (normally http://127.0.0.1:4173). All runtime models, textures and audio synthesis are local to the build. There is no game server or account requirement for a local/GitHub Pages build.

## Controls

WASD move; mouse look; Shift sprint; Space jump; C/Ctrl crouch or slide; LMB fire; RMB aim; R reload; Q knife; 1/2 or wheel equip; E buy/refill; Escape release/pause. Arrow keys and Enter navigate the title menu. Options include sensitivity, volume and automatic/manual quality. F8 shows the knife cone **only in development**.

## Checks

```sh
pnpm test
# Keep pnpm dev running for browser checks:
pnpm test:browser
pnpm test:soak
```

Browser tests use installed Edge on Windows. On Linux/macOS first run `pnpm exec playwright install chromium`. `BROWSER_CHANNEL`, `GAME_URL` (regression), and `TEST_QUALITY=high` (soak) are optional environment settings. Screenshots and reports go to ignored `work/qa/`.

The default test command checks TypeScript, actual simulation/navigation/economy/save behavior, Khronos GLB validity, and the production build. The separate validation workflow exercises browser inputs and uploads screenshots. It does not deploy Pages.

Browser setups use a development-only test interface to place enemies, accelerate scenarios, and trigger death. Input, hit detection, shop spending, and persistence still execute the real game systems. Production exposes a read-only diagnostic snapshot, without setup/cheat methods.

## Art workflow

Editable generic Blockbench sources: `art-source/models/*.bbmodel`. Runtime assets: `public/assets/models/`. Original authoring scripts are retained; no master-brief reference pictures are game assets.

```sh
# Python + Pillow are needed only to regenerate source art:
python tools/author-assets.py
python tools/paint-mall.py
pnpm assets:bake
pnpm assets:optimize
node tests/assets.mjs
```

The thirteen sources contain node hierarchies, mesh topology, UVs, atlas and animation keyframes. The bake step raycasts the resting meshes to store ambient occlusion in vertex colors; regenerate uncompressed assets before rerunning it. Runtime export uses Meshopt compression and a bundled decoder. Editor round-trip approval status is documented in the ledger. The preview social card is illustrative key art, not an in-game screenshot.

## Release policy

GitHub Pages still deploys only master/main. The review branch is isolated and the existing private Astra Sites project is the comparison playtest. Do not merge/promote before visual and human playtest approval. Local saves migrate attempts and best Moon from the original v1 key; browser origin isolation means a separate preview cannot automatically read saves from the Pages domain.
