import validator from "gltf-validator";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const manifest = JSON.parse(
  await readFile("public/assets/models/manifest.json", "utf8"),
);
for (const [id, asset] of Object.entries(manifest.assets)) {
  const bytes = await readFile("public/" + asset.url);
  const report = await validator.validateBytes(new Uint8Array(bytes), {
    maxIssues: 100,
  });
  const errors = report.issues.messages.filter((x) => x.severity === 0);
  assert.deepEqual(
    errors,
    [],
    id + " contains invalid glTF: " + JSON.stringify(errors),
  );
  const source = JSON.parse(await readFile(asset.source, "utf8"));
  assert.ok(source.elements.length > 0);
  assert.ok(source.outliner.length > 0);
  for (const clip of asset.animations)
    assert.ok(
      source.animations.some((a) => a.name === clip),
      id + " missing " + clip,
    );
  console.log(
    "PASS asset " +
      id +
      "; " +
      asset.triangles +
      " triangles; " +
      bytes.length +
      " bytes",
  );
}
