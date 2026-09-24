import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import { readFile, writeFile, stat } from "node:fs/promises";
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });
const manifest = JSON.parse(
  await readFile("public/assets/models/manifest.json", "utf8"),
);
for (const [id, asset] of Object.entries(manifest.assets)) {
  const path = "public/" + asset.url;
  const before = (await stat(path)).size;
  const document = await io.read(path);
  await document.transform(
    weld(),
    dedup(),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  await io.write(path, document);
  asset.bytes = (await stat(path)).size;
  asset.triangles = document
    .getRoot()
    .listMeshes()
    .reduce(
      (sum, mesh) =>
        sum +
        mesh
          .listPrimitives()
          .reduce(
            (s, p) =>
              s +
              (p.getIndices()?.getCount() ??
                p.getAttribute("POSITION").getCount()) /
                3,
            0,
          ),
      0,
    );
  console.log(id + ": " + before + " -> " + asset.bytes + " bytes");
}
await writeFile(
  "public/assets/models/manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
