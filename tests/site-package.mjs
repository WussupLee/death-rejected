import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url));
assert.deepEqual(
  await read("dist/client/index.html"),
  await read("dist/index.html"),
);
const manifest = JSON.parse(
  await read("dist/client/assets/models/manifest.json"),
);
assert.equal(Object.keys(manifest.assets).length, 13);
for (const asset of Object.values(manifest.assets)) {
  assert.deepEqual(
    await read("dist/client/" + asset.url),
    await read("dist/" + asset.url),
  );
}
assert.ok((await read("dist/server/index.js")).length > 0);
assert.ok(JSON.parse(await read("dist/.openai/hosting.json")).project_id);
console.log("PASS Sites client asset layout and GitHub Pages output parity");
