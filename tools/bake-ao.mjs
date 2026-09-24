import { NodeIO } from "@gltf-transform/core";
import * as THREE from "three";
import { readFile } from "node:fs/promises";
// Offline, deterministic, cosine-weighted vertex AO against the actual model triangles.
// The rest pose is baked; animation remains dynamic. No reference textures are used.
const io = new NodeIO();
const manifest = JSON.parse(
  await readFile("public/assets/models/manifest.json", "utf8"),
);
const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const raycaster = new THREE.Raycaster();
for (const [id, asset] of Object.entries(manifest.assets)) {
  const path = "public/" + asset.url,
    document = await io.read(path);
  const occluders = [],
    entries = [];
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const matrix = new THREE.Matrix4().fromArray(node.getWorldMatrix()),
      normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    for (const primitive of mesh.listPrimitives()) {
      const positions = primitive.getAttribute("POSITION"),
        normals = primitive.getAttribute("NORMAL");
      if (!positions || !normals) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(positions.getArray()), 3),
      );
      if (primitive.getIndices())
        geometry.setIndex(
          new THREE.BufferAttribute(primitive.getIndices().getArray(), 1),
        );
      geometry.applyMatrix4(matrix);
      geometry.computeBoundingSphere();
      geometry.computeBoundingBox();
      const collider = new THREE.Mesh(geometry, material);
      collider.updateMatrixWorld();
      occluders.push(collider);
      entries.push({ primitive, positions, normals, matrix, normalMatrix });
    }
  }
  for (const {
    primitive,
    positions,
    normals,
    matrix,
    normalMatrix,
  } of entries) {
    const pos = positions.getArray(),
      normal = normals.getArray(),
      colors = new Float32Array(pos.length),
      cache = new Map();
    for (let i = 0; i < positions.getCount(); i++) {
      const key = [
        ...pos.slice(i * 3, i * 3 + 3),
        ...normal.slice(i * 3, i * 3 + 3),
      ].join(",");
      let shade = cache.get(key);
      if (shade === undefined) {
        const point = new THREE.Vector3()
            .fromArray(pos, i * 3)
            .applyMatrix4(matrix),
          n = new THREE.Vector3()
            .fromArray(normal, i * 3)
            .applyNormalMatrix(normalMatrix);
        const tangent = new THREE.Vector3(
            Math.abs(n.y) > 0.9 ? 1 : 0,
            Math.abs(n.y) > 0.9 ? 0 : 1,
            0,
          )
            .cross(n)
            .normalize(),
          bitangent = n.clone().cross(tangent);
        let blocked = 0;
        for (let sample = 0; sample < 8; sample++) {
          const radius = Math.sqrt((sample + 0.5) / 8),
            angle = sample * 2.399963;
          const direction = tangent
            .clone()
            .multiplyScalar(radius * Math.cos(angle))
            .addScaledVector(bitangent, radius * Math.sin(angle))
            .addScaledVector(n, Math.sqrt(1 - radius * radius))
            .normalize();
          raycaster.set(point.clone().addScaledVector(n, 0.004), direction);
          raycaster.near = 0.003;
          raycaster.far = 0.3;
          if (raycaster.intersectObjects(occluders, false).length) blocked++;
        }
        shade = 0.5 + 0.5 * (1 - blocked / 8);
        cache.set(key, shade);
      }
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = shade;
    }
    primitive.setAttribute(
      "COLOR_0",
      document
        .createAccessor()
        .setType("VEC3")
        .setArray(colors)
        .setBuffer(document.getRoot().listBuffers()[0]),
    );
  }
  await io.write(path, document);
  for (const mesh of occluders) mesh.geometry.dispose();
  console.log("Baked vertex AO: " + id);
}
