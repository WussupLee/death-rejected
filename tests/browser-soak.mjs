import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  headless: true,
  channel:
    process.env.BROWSER_CHANNEL ||
    (process.platform === "win32" ? "msedge" : undefined),
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://127.0.0.1:4173/");
await page.waitForFunction(() => window.__deathRejected?.test);
if (process.env.TEST_QUALITY)
  await page.evaluate(
    (q) => window.__deathRejected.test.game.performanceGovernor.select(q),
    process.env.TEST_QUALITY,
  );
await page.locator("#begin-button").click();
await page.waitForFunction(
  () => window.__deathRejected.getSnapshot().mouseMode === "pointer-lock",
);
await page.evaluate(() => {
  const t = window.__deathRejected.test;
  t.enemies.clear();
  t.moon.state = "combat";
  t.moon.quota = 13;
  t.moon.spawned = 13;
  t.enemies.setMoon(5);
  for (let i = 0; i < 13; i++)
    t.enemies.spawn(i % 2 ? "stalker" : "thrall", t.player.position);
  t.game.onPlayerDamage = () => {};
  window.framesForBenchmark = [];
  const record = () => {
    window.framesForBenchmark.push(
      window.__deathRejected.getSnapshot().frameMs,
    );
    window.benchmarkRAF = requestAnimationFrame(record);
  };
  requestAnimationFrame(record);
});
await page.waitForTimeout(7000);
await page.screenshot({ path: "work/qa/enemy-pressure.png" });
await page.evaluate(() => {
  const t = window.__deathRejected.test;
  t.player.position.set(-9, 5.4, 21);
  t.player.velocity.set(0, 0, 0);
  t.player.verticalSpeed = 0;
  t.player.isGrounded = true;
  t.player.yaw.rotation.y = 0;
  t.player.pitch.rotation.x = -0.25;
});
await page.waitForTimeout(24000);
await page.screenshot({ path: "work/qa/balcony.png" });
const result = await page.evaluate(() => {
  cancelAnimationFrame(window.benchmarkRAF);
  const data = window.framesForBenchmark
    .slice(60)
    .filter((x) => x > 0)
    .sort((a, b) => a - b);
  const snapshot = window.__deathRejected.getSnapshot();
  return {
    viewport: [1920, 1080],
    samples: data.length,
    medianMs: data[Math.floor(data.length * 0.5)],
    p95Ms: data[Math.floor(data.length * 0.95)],
    averageMs: data.reduce((a, b) => a + b, 0) / data.length,
    snapshot,
  };
});
console.log(
  "grounded",
  JSON.stringify(result.snapshot.navigation.filter((e) => e.position[1] < 4)),
);
await writeFile(
  "work/qa/performance-" + (process.env.TEST_QUALITY || "auto") + ".json",
  JSON.stringify(result, null, 2),
);
assert.ok(
  result.snapshot.navigation.every((e) => e.position[1] > 4),
  "enemies must reach the upper floor",
);
assert.equal(errors.length, 0);
console.log(JSON.stringify(result, null, 2));
await writeFile(
  "work/qa/performance-" + (process.env.TEST_QUALITY || "auto") + ".json",
  JSON.stringify(result, null, 2),
);
await browser.close();
