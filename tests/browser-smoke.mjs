import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  headless: true,
  channel:
    process.env.BROWSER_CHANNEL ||
    (process.platform === "win32" ? "msedge" : undefined),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const checks = [];
page.on("response", (r) => {
  if (r.status() >= 400) console.log("HTTP", r.status(), r.url());
});
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
await mkdir("work/qa", { recursive: true });
const snapshot = () =>
  page.evaluate(() => window.__deathRejected.getSnapshot());
try {
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:4173/");
  await page.waitForFunction(() => window.__deathRejected?.test);
  await page.screenshot({ path: "work/qa/menu.png" });
  await page.keyboard.press("ArrowDown");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "settings-button",
  );
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#settings-screen").isVisible(), true);
  await page.keyboard.press("ArrowDown");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "quality-setting",
  );
  await page.selectOption("#quality-setting", "performance");
  await page.locator("#settings-back").click();
  checks.push("keyboard menu navigation and quality selection");
  await page.locator("#begin-button").click();
  await page.waitForFunction(
    () =>
      document.pointerLockElement?.id === "game-canvas" &&
      window.__deathRejected.getSnapshot().phase === "playing",
  );
  checks.push("native pointer lock acquired on Begin");
  await page.waitForTimeout(350);
  const start = await snapshot();
  await page.keyboard.down("Shift");
  await page.keyboard.down("w");
  await page.waitForTimeout(300);
  await page.keyboard.press("c");
  await page.keyboard.press("Space");
  await page.waitForTimeout(100);
  const moved = await snapshot();
  assert.ok(
    Math.hypot(
      start.player.x - moved.player.x,
      start.player.z - moved.player.z,
    ) > 1,
  );
  await page.keyboard.up("w");
  await page.keyboard.up("Shift");
  checks.push("sprint, slide, jump inputs move the player");
  const beforeYaw = (await snapshot()).player.yaw;
  await page.mouse.move(5000, 450);
  await page.waitForTimeout(100);
  const afterYaw = (await snapshot()).player.yaw;
  assert.ok(Math.abs(afterYaw - beforeYaw) > 6.28);
  checks.push("unrestricted mouse rotation exceeds 360 degrees");
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => window.__deathRejected.getSnapshot().phase === "paused",
  );
  assert.equal(await page.evaluate(() => document.pointerLockElement), null);
  const paused = (await snapshot()).simulation.elapsed;
  await page.waitForTimeout(250);
  assert.equal((await snapshot()).simulation.elapsed, paused);
  checks.push("Escape releases native lock and freezes simulation");
  await page.locator("#resume-button").click();
  await page.waitForFunction(
    () =>
      document.pointerLockElement?.id === "game-canvas" &&
      window.__deathRejected.getSnapshot().phase === "playing",
  );
  // Development-only deterministic setup; the input still goes through the browser.
  await page.evaluate(() => {
    const t = window.__deathRejected.test;
    t.enemies.clear();
    t.moon.state = "idle";
    t.player.reset();
    t.player.position.set(12, 0, 12);
    t.player.velocity.set(0, 0, 0);
    t.player.yaw.rotation.y = 0;
    t.player.pitch.rotation.x = 0;
    t.player.update(0);
    t.enemies.spawn("thrall", t.player.position.clone().set(-15, 0, 12));
    const e = t.enemies.pool.find((e) => e.alive);
    e.position.set(12, 0, 10);
    e.blood = 76;
  });
  await page.keyboard.press("q");
  await page.waitForFunction(() =>
    ["active", "recovery"].includes(
      window.__deathRejected.getSnapshot().attackWindow,
    ),
  );
  assert.ok(["active", "recovery"].includes((await snapshot()).attackWindow));
  await page.waitForFunction(
    () => window.__deathRejected.getSnapshot().kills === 1,
  );
  assert.equal((await snapshot()).kills, 1);
  checks.push(
    "Q knife visible active/recovery window and single execution reward",
  );
  await page.waitForFunction(
    () => window.__deathRejected.getSnapshot().attackWindow === "idle",
  );
  await page.evaluate(() => {
    const t = window.__deathRejected.test;
    t.enemies.spawn("thrall", t.player.position.clone().set(-15, 0, 12));
    const e = t.enemies.pool.find((e) => e.alive);
    e.position.set(12, 0, 8);
    t.player.pitch.rotation.x = Math.atan2(1.99 - 1.72, 4);
  });
  await page.waitForTimeout(80);
  await page.mouse.down();
  await page.waitForTimeout(30);
  await page.mouse.up();
  await page.waitForTimeout(100);
  assert.equal((await snapshot()).hitZone, "head");
  checks.push("fire hits separate head volume with headshot feedback");
  await page.keyboard.press("r");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1200);
  assert.equal((await snapshot()).weapon.reloading, true);
  checks.push("reload remains frozen while paused");
  await page.locator("#resume-button").click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const t = window.__deathRejected.test;
    t.player.position.copy(t.environment.shopPosition);
    t.game.marks = 600;
  });
  await page.waitForTimeout(100);
  await page.keyboard.press("e");
  assert.equal((await snapshot()).weapon.slot, 2);
  assert.equal((await snapshot()).marks, 150);
  await page.keyboard.press("e");
  assert.equal((await snapshot()).marks, 30);
  await page.keyboard.press("e");
  assert.equal((await snapshot()).marks, 30);
  checks.push(
    "shop transaction deducts 450 Marks, equips shotgun, and does not charge for full ammo",
  );
  await page.evaluate(() => {
    const t = window.__deathRejected.test;
    t.player.position.set(0, 0, 15);
    t.player.yaw.rotation.y = 0;
    t.player.pitch.rotation.x = 0.12;
    t.player.update(0);
  });
  await page.waitForTimeout(350);
  await page.screenshot({ path: "work/qa/combat.png" });
  const attempts = (await snapshot()).attempts;
  await page.evaluate(() =>
    window.__deathRejected.test.game.onPlayerDamage(200),
  );
  await page.waitForTimeout(500);
  await page.screenshot({ path: "work/qa/death.png" });
  await page.waitForFunction(
    () => window.__deathRejected.getSnapshot().phase === "tally",
    { timeout: 12000 },
  );
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "work/qa/tally.png" });
  assert.equal((await snapshot()).attempts, attempts + 1);
  assert.equal(await page.locator(".tally-mark--new").count(), 1);
  await page.locator("#restart-button").click();
  assert.equal((await snapshot()).blood, 100);
  assert.equal((await snapshot()).weapon.slot, 1);
  checks.push("death, authored tally, single new mark and fast restart");
  await page.reload();
  await page.waitForFunction(() => window.__deathRejected?.test);
  assert.equal((await snapshot()).attempts, attempts + 1);
  checks.push("attempt persists across page reload");
  await page.evaluate(() => {
    document.getElementById("game-canvas").requestPointerLock = () =>
      Promise.reject(new Error("Preview policy"));
  });
  await page.locator("#begin-button").click();
  await page.waitForFunction(
    () => window.__deathRejected.getSnapshot().mouseMode === "preview-fallback",
  );
  const fallbackYaw = (await snapshot()).player.yaw;
  await page.mouse.move(1438, 450);
  await page.waitForTimeout(200);
  assert.notEqual((await snapshot()).player.yaw, fallbackYaw);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  assert.equal((await snapshot()).phase, "paused");
  checks.push(
    "explicit pointer-lock denial enables preview look; Escape stays paused",
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({ checks, errors, snapshot: await snapshot() }, null, 2),
  );
  await writeFile(
    "work/qa/browser-results.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
} finally {
  await browser.close();
}
