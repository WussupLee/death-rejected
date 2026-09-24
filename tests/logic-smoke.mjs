import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import ts from "typescript";
import * as THREE from "three";
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && context.parentURL?.includes("/src/")) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(candidate))
        return { url: candidate.href, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts"))
      return {
        format: "module",
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
          },
        }).outputText,
        shortCircuit: true,
      };
    return next(url, context);
  },
});
const { FixedSimulation, attackPhase, KNIFE, resolveDamage, killReward } =
  await import("../src/game/Simulation.ts");
const { WorldLayout, SOLIDS, BALCONY_Y } = await import(
  "../src/game/WorldLayout.ts"
);
const { NavigationGrid } = await import("../src/game/NavigationGrid.ts");
const { SaveManager, migrateSave } = await import("../src/game/SaveManager.ts");
const { MoonManager } = await import("../src/game/MoonManager.ts");
const { PlayerController } = await import("../src/game/PlayerController.ts");
const { EnemySystem } = await import("../src/game/EnemySystem.ts");
const { toRoman } = await import("../src/game/config.ts");
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("PASS", name);
}
const vec = (x, y, z) => new THREE.Vector3(x, y, z);
const world = new WorldLayout();
const events = new Map();
globalThis.window = {
  addEventListener: (name, handler) => {
    const entries = events.get(name) ?? [];
    entries.push(handler);
    events.set(name, entries);
  },
};
globalThis.document = { pointerLockElement: null };
const canvas = { addEventListener() {}, dataset: {} };
test("fixed simulation is identical at 30, 60, 144 FPS", () => {
  const result = [30, 60, 144].map((fps) => {
    const sim = new FixedSimulation();
    let x = 0,
      v = 0;
    for (let i = 0; i < fps * 3; i++)
      sim.advance(1 / fps, (dt) => {
        v += 5 * dt;
        x += v * dt;
      });
    return x;
  });
  assert.ok(Math.max(...result) - Math.min(...result) < 1e-9);
});
test("catch-up work is bounded after a suspended frame", () => {
  const sim = new FixedSimulation();
  assert.equal(
    sim.advance(5, () => {}),
    12,
  );
  assert.equal(sim.droppedSeconds, 4.9);
});
test("damage and knife phases execute their contracts", () => {
  assert.equal(resolveDamage(100, 20, "head").amount, 45);
  assert.equal(resolveDamage(40, 20, "head").killed, true);
  assert.equal(attackPhase(0.05, KNIFE), "windup");
  assert.equal(attackPhase(0.12, KNIFE), "active");
  assert.equal(attackPhase(0.3, KNIFE), "recovery");
  assert.equal(attackPhase(0.5, KNIFE), "idle");
});
test("economy: close kills, ranged kills and style rewards", () => {
  assert.deepEqual(killReward("thrall", "execution", 2), {
    marks: 44,
    blood: 14,
    bonus: 20,
  });
  assert.equal(killReward("thrall", "slide", 2).marks, 39);
  assert.equal(killReward("stalker", "normal", 10).blood, 0);
});
test("legacy save migration preserves attempts and best Moon", () => {
  const data = new Map([
    ["death-rejected-save-v1", JSON.stringify({ attempts: 37, bestMoon: 5 })],
  ]);
  const storage = {
    getItem: (k) => data.get(k),
    setItem: (k, v) => data.set(k, v),
  };
  const save = new SaveManager(storage);
  assert.deepEqual(save.data, { version: 2, attempts: 37, bestMoon: 5 });
  save.recordDeath(3);
  assert.equal(new SaveManager(storage).data.attempts, 38);
  assert.equal(save.data.bestMoon, 5);
  assert.deepEqual(migrateSave({ attempts: Infinity, bestMoon: -3 }), {
    version: 2,
    attempts: 0,
    bestMoon: 1,
  });
  data.set("death-rejected-save-v2", "broken");
  assert.equal(new SaveManager(storage).data.attempts, 37);
  assert.doesNotThrow(() =>
    new SaveManager({
      getItem() {
        throw Error();
      },
      setItem() {
        throw Error();
      },
    }).recordDeath(2),
  );
});
test("movement: sprint-slide-jump retains speed and upper-floor jump retains height", () => {
  const player = new PlayerController(world, canvas);
  player.enabled = true;
  player.position.set(-15, 0, 0);
  player.velocity.set(0, 0, -14);
  player.startSlide();
  assert.ok(player.speed >= 16.8);
  player.jump();
  const before = player.speed;
  for (let i = 0; i < 30; i++) player.update(1 / 120);
  assert.ok(player.speed >= before - 0.01);
  player.position.set(26, BALCONY_Y, 12);
  player.isGrounded = true;
  player.jump();
  assert.ok(player.position.y > BALCONY_Y);
});
test("movement can ascend and descend both escalators", () => {
  for (const x of [-9, 9]) {
    const player = new PlayerController(world, canvas);
    player.enabled = true;
    player.position.set(x, 0, 6.6);
    player.yaw.rotation.y = Math.PI;
    player.keys.add("KeyW");
    for (let i = 0; i < 320; i++) player.update(1 / 120);
    assert.ok(player.position.y >= 5.39, JSON.stringify(player.position));
    assert.ok(player.position.z > 19);
    player.yaw.rotation.y = 0;
    for (let i = 0; i < 360; i++) player.update(1 / 120);
    assert.ok(player.position.y < 0.05, JSON.stringify(player.position));
  }
});
const nav = new NavigationGrid(world);
const scenarios = [
  ["observed-east-ramp-stall", vec(10.712, 0, 8.697), vec(-9, 5.4, 21)],
  ["observed-west-ramp-stall", vec(-7.106, 0, 8.875), vec(-9, 5.4, 21)],
  ["fountain-west", vec(-7, 0, 0), vec(7, 0, 0)],
  ["fountain-north", vec(0, 0, -7), vec(0, 0, 7)],
  ["shop-edge", vec(24, 0, -12), vec(24, 0, 3)],
  ["directory", vec(-22, 0, 2.5), vec(-16, 0, 2.5)],
  ["west-escalator", vec(-9, 0, 5), vec(-9, 5.4, 21)],
  ["east-escalator", vec(9, 0, 5), vec(9, 5.4, 21)],
  ["upper-loop", vec(-26, 5.4, 0), vec(26, 5.4, -10)],
  ...SOLIDS.filter((s) => s.name.startsWith("pillar")).map((s) => [
    s.name,
    vec(s.x - 2, 0, s.z),
    vec(s.x + 2, 0, s.z),
  ]),
];
for (const [name, from, to] of scenarios)
  test("routing " + name, () => {
    const path = nav.findPath(from, to, 0.48);
    assert.ok(path.length > 0, name + " found no path");
    let previous = from;
    for (const point of path) {
      assert.ok(!world.isBlocked(point, 0.48), name + " blocked node");
      assert.ok(
        world.segmentClear(previous, point, 0.48),
        name + " cuts obstacle",
      );
      assert.ok(Math.abs(point.y - previous.y) < 0.7);
      previous = point;
    }
    assert.ok(previous.distanceTo(to) < 1.6, name + " goal missed");
  });
test("choke reservations and safe recovery do not cross scenery", () => {
  assert.equal(nav.reserve(vec(0, 0, 10), 1), true);
  assert.equal(nav.reserve(vec(0, 0, 10), 2), false);
  nav.clearReservations();
  assert.equal(nav.reserve(vec(0, 0, 10), 2), true);
  const from = vec(5.2, 0, 0),
    safe = world.findNearestOpen(from, 0.48);
  assert.ok(safe);
  assert.ok(world.segmentClear(from, safe, 0.48));
});
test("director: every Moon clears once, grants 20 seconds and spawns no enemies in relief", () => {
  const enemies = {
    activeCount: 0,
    kinds: [],
    spawn(kind) {
      this.activeCount++;
      this.kinds.push(kind);
      return true;
    },
    clear() {
      this.activeCount = 0;
    },
    setMoon() {},
  };
  const audio = { setCombat() {}, moon() {} };
  const cleared = [];
  const moon = new MoonManager(
    enemies,
    audio,
    () => {},
    (n, r) => cleared.push([n, r]),
  );
  moon.startRun();
  let reliefSamples = 0;
  for (let i = 0; i < 120 * 350 && cleared.length < 5; i++) {
    const before = enemies.kinds.length,
      phase = moon.intensity;
    moon.update(1 / 120, vec(0, 0, 15), 100);
    if (phase === "relief" && moon.intensity === "relief") {
      assert.equal(enemies.kinds.length, before);
      reliefSamples++;
    }
    enemies.activeCount = 0;
    if (moon.state === "intermission" && Math.abs(moon.timer - 20) < 0.0001)
      assert.equal(moon.countdown, 20);
  }
  assert.deepEqual(
    cleared.map((c) => c[0]),
    [1, 2, 3, 4, 5],
  );
  assert.ok(reliefSamples > 0);
  assert.ok(enemies.kinds.includes("stalker"));
});
test("head/body volumes, wall obstruction, per-swing melee hits, vertical range", () => {
  const fakeAssets = {
    create() {
      const root = new THREE.Group();
      const head = new THREE.Object3D();
      head.name = "head";
      head.position.set(0, 1.99, 0);
      root.add(head);
      return { root, play() {}, update() {} };
    },
  };
  const env = Object.assign(world, { spawnPoints: [vec(12, 0, 12)] });
  let kills = 0;
  const enemyEvents = {
    onEnemyHit() {},
    onEnemyKilled() {
      kills++;
    },
    onPlayerDamage() {},
  };
  const scene = new THREE.Scene(),
    enemies = new EnemySystem(scene, env, enemyEvents, fakeAssets);
  assert.equal(enemies.spawn("thrall", vec(-15, 0, 12)), true);
  const e = enemies.pool.find((e) => e.alive);
  e.position.set(0, 0, -7);
  scene.updateMatrixWorld(true);
  assert.equal(
    enemies.hitScan(vec(0, 1.3, 7), vec(0, 0, -1), 20, 20),
    null,
    "fountain blocks shot",
  );
  e.position.set(12, 0, 10);
  scene.updateMatrixWorld(true);
  assert.equal(
    enemies.hitScan(vec(12, 1.99, 13), vec(0, 0, -1), 10, 20).headshot,
    true,
  );
  assert.equal(e.blood, 53.5);
  assert.equal(
    enemies.hitScan(vec(12, 1.3, 13), vec(0, 0, -1), 10, 20).headshot,
    false,
  );
  const ids = new Set();
  assert.equal(
    enemies.melee(vec(12, 0, 12), vec(0, 0, -1), 10, 3.15, ids).length,
    1,
  );
  assert.equal(
    enemies.melee(vec(12, 0, 12), vec(0, 0, -1), 10, 3.15, ids).length,
    0,
  );
  assert.equal(
    enemies.melee(vec(12, 5.4, 12), vec(0, 0, -1), 100, 3.15).length,
    0,
  );
  e.position.set(-22.8, 0, -18.2);
  scene.updateMatrixWorld(true);
  assert.equal(
    enemies.melee(vec(-25.2, 0, -18.2), vec(1, 0, 0), 100, 3.15).length,
    0,
    "pillar blocks knife",
  );
  assert.equal(kills, 0);
  enemies.clear();
  enemies.spawn("stalker", vec(-15, 0, 12));
  const stalker = enemies.pool.find((enemy) => enemy.alive);
  stalker.position.set(12, 0, 10);
  stalker.leapTime = 0.25;
  stalker.actor.root.position.y = 0.4;
  stalker.stagger = 1;
  stalker.cooldown = 10;
  enemies.update(0.1, vec(12, 0, 12), false);
  assert.equal(stalker.leapTime, 0.25, "paused pounce freezes");
  for (let i = 0; i < 60; i++) enemies.update(1 / 120, vec(12, 0, 12), true);
  assert.equal(stalker.leapTime, 0, "staggered pounce completes");
  assert.equal(stalker.actor.root.position.y, 0, "interrupted pounce lands");
});
test("Roman numerals", () =>
  assert.deepEqual([1, 4, 5, 9, 10].map(toRoman), ["I", "IV", "V", "IX", "X"]));
console.log(passed + " behavioral checks passed");
