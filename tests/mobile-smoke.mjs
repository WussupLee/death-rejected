import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  channel: process.platform === "win32" ? "msedge" : undefined,
});
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const snapshot = () =>
  page.evaluate(() => window.__deathRejected.getSnapshot());
await mkdir("work/qa", { recursive: true });
try {
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:4173/");
  await page.waitForFunction(() => window.__deathRejected?.test);
  assert.equal(await page.locator("html").getAttribute("data-input"), "touch");
  await page.screenshot({ path: "work/qa/mobile-menu.png" });
  await page.locator("#begin-button").tap();
  assert.equal((await snapshot()).mouseMode, "touch");
  assert.equal(await page.evaluate(() => document.pointerLockElement), null);
  await page.evaluate(() => {
    const t = window.__deathRejected.test;
    t.moon.state = "idle";
    t.enemies.clear();
    t.player.position.set(12, 0, 12);
  });
  const cdp = await context.newCDPSession(page);
  const stick = await page.locator("#touch-stick").boundingBox();
  const fire = await page.locator("#touch-fire").boundingBox();
  const stickTouch = {
    id: 1,
    x: stick.x + stick.width / 2,
    y: stick.y + stick.height * 0.13,
  };
  const fireTouch = {
    id: 2,
    x: fire.x + fire.width / 2,
    y: fire.y + fire.height / 2,
  };
  const before = await snapshot();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [stickTouch, fireTouch],
  });
  await page.waitForTimeout(400);
  fireTouch.x -= 28;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [stickTouch, fireTouch],
  });
  await page.waitForTimeout(150);
  const moving = await snapshot();
  assert.ok(moving.player.speed > 9, "full-forward joystick sprints");
  assert.ok(
    Math.abs(moving.player.yaw - before.player.yaw) > 0.07,
    "fire drag aims while firing",
  );
  assert.ok(
    moving.weapon.ammo < before.weapon.ammo,
    "hold fire consumes ammunition",
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(200);
  const stoppedAmmo = (await snapshot()).weapon.ammo;
  await page.waitForTimeout(250);
  assert.equal(
    (await snapshot()).weapon.ammo,
    stoppedAmmo,
    "lifting finger stops firing",
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [stickTouch, fireTouch],
  });
  await page.waitForTimeout(80);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await page.waitForTimeout(300);
  const cancelledAmmo = (await snapshot()).weapon.ammo;
  await page.waitForTimeout(200);
  assert.equal(
    (await snapshot()).weapon.ammo,
    cancelledAmmo,
    "cancelled touch stops shooting",
  );
  assert.ok(
    (await snapshot()).player.speed < 1,
    "cancelled joystick stops movement",
  );
  await page.locator("#touch-aim").tap();
  assert.equal(
    await page.locator("#touch-aim").getAttribute("aria-pressed"),
    "true",
  );
  await page.locator("#touch-reload").tap();
  assert.equal((await snapshot()).weapon.reloading, true);
  await page.waitForTimeout(1200);
  await page.locator("#touch-knife").tap();
  assert.notEqual((await snapshot()).attackWindow, "idle");
  await page.waitForTimeout(500);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [stickTouch],
  });
  await page.waitForTimeout(400);
  const slide = await page.locator("#touch-slide").boundingBox();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [stickTouch, { id: 3, x: slide.x + 25, y: slide.y + 22 }],
  });
  await page.waitForTimeout(60);
  assert.equal((await snapshot()).player.sliding, true);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.locator("#touch-jump").tap();
  assert.equal((await snapshot()).player.airborne, true);
  await page.locator("#touch-pause").tap();
  assert.equal((await snapshot()).phase, "paused");
  assert.equal(await page.locator("#touch-controls").isVisible(), false);
  const time = (await snapshot()).simulation.elapsed;
  await page.waitForTimeout(200);
  assert.equal((await snapshot()).simulation.elapsed, time);
  await page.locator("#resume-button").tap();
  assert.equal(
    await page.locator("#touch-aim").getAttribute("aria-pressed"),
    "false",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  assert.equal((await snapshot()).phase, "paused");
  assert.equal(await page.locator("#rotate-prompt").isVisible(), true);
  await page.screenshot({ path: "work/qa/mobile-portrait.png" });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(100);
  await page.locator("#resume-button").tap();
  await page.evaluate(() => {
    const t = window.__deathRejected.test;
    t.player.position.copy(t.environment.shopPosition);
    t.player.velocity.set(0, 0, 0);
    t.game.marks = 600;
  });
  await page.waitForTimeout(100);
  await page.locator("#touch-use").tap();
  assert.equal((await snapshot()).weapon.slot, 2);
  await page.locator("#touch-switch").tap();
  assert.equal((await snapshot()).weapon.slot, 1);
  await page.screenshot({ path: "work/qa/mobile-combat.png" });
  for (const size of [
    { width: 667, height: 375 },
    { width: 740, height: 320 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(100);
    for (const id of [
      "touch-stick",
      "touch-fire",
      "touch-slide",
      "touch-pause",
    ]) {
      const box = await page.locator(`#${id}`).boundingBox();
      assert.ok(
        box &&
          box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= size.width &&
          box.y + box.height <= size.height,
        `${id} fits ${size.width}x${size.height}`,
      );
    }
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() =>
    window.__deathRejected.test.game.onPlayerDamage(200),
  );
  await page.waitForFunction(
    () => window.__deathRejected.getSnapshot().phase === "tally",
  );
  await page.waitForTimeout(400);
  await page.screenshot({ path: "work/qa/mobile-tally.png" });
  await page.locator("#restart-button").tap();
  assert.equal((await snapshot()).blood, 100);
  assert.equal(await page.locator("#touch-controls").isVisible(), true);
  assert.deepEqual(errors, []);
  console.log(
    "PASS mobile multitouch sprint/fire/aim, release, reload, knife, slide/jump, pause, rotation, shop, switch, viewport bounds, death and restart; no runtime errors",
  );
} finally {
  await browser.close();
}
