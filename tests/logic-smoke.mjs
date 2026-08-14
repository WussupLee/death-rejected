import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
for (const id of [
  "game-canvas", "begin-button", "resume-button", "restart-button", "hud",
  "blood-value", "marks-value", "moon-label", "weapon-name", "tally-marks",
]) {
  assert.match(index, new RegExp(`id=["']${id}["']`), `index.html should contain #${id}`);
}

const saveSource = await readFile(new URL("../src/game/SaveManager.ts", import.meta.url), "utf8");
assert.match(saveSource, /localStorage\.setItem\(STORAGE_KEY/);
assert.match(saveSource, /bestMoon: Math\.max\(1/);
assert.match(saveSource, /this\.data\.attempts \+= 1/);

const moonSource = await readFile(new URL("../src/game/MoonManager.ts", import.meta.url), "utf8");
assert.match(moonSource, /intermissionSeconds: 20|MOON\.intermissionSeconds/);
assert.match(moonSource, /this\.currentMoon \+= 1/);
assert.match(moonSource, /this\.state = "intermission"/);
assert.match(moonSource, /currentMoon === 5/);

const weaponSource = await readFile(new URL("../src/game/WeaponSystem.ts", import.meta.url), "utf8");
assert.match(weaponSource, /BLACKTHORN \.45/);
assert.match(weaponSource, /WIDOWMAKER 12G/);
assert.match(weaponSource, /melee\(/);
assert.match(weaponSource, /purchaseShotgun\(\)/);

const gameSource = await readFile(new URL("../src/game/Game.ts", import.meta.url), "utf8");
for (const required of ["recordDeath", "showTally", "useShop", "requestPointerLock", "onMoonCleared"]) {
  assert.match(gameSource, new RegExp(required), `Game should wire ${required}`);
}

const configSource = await readFile(new URL("../src/game/config.ts", import.meta.url), "utf8");
const toRomanBody = configSource.match(/export function toRoman\(value: number\): string \{([\s\S]*?)\n\}/)?.[1];
assert.ok(toRomanBody, "Roman numeral function should be present");
const runnableRomanBody = toRomanBody.replace(": Array<[number, string]>", "");
const script = new vm.Script(`(function(value) {${runnableRomanBody}})`);
const toRoman = script.runInNewContext();
assert.deepEqual([1, 4, 5, 9, 10].map(toRoman), ["I", "IV", "V", "IX", "X"]);

console.log("logic-smoke: HUD contract, Moon flow, weapons/melee, shop, death/tally, persistence, and Roman numerals present");
