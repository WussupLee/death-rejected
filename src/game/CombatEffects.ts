import * as THREE from "three";
export class CombatEffects {
  private readonly mesh: THREE.InstancedMesh;
  private readonly items: Array<{
    life: number;
    max: number;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    kind: number;
  }>;
  private readonly matrix = new THREE.Object3D();
  private cursor = 0;
  budget = 48;
  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
      96,
    );
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.items = Array.from({ length: 96 }, () => ({
      life: 0,
      max: 0,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      kind: 0,
    }));
    this.update(0);
  }
  emit(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    kind: "blood" | "smoke" | "shell",
  ): void {
    const count = kind === "blood" ? 9 : kind === "smoke" ? 4 : 1;
    for (let i = 0; i < count; i++) {
      const index = this.cursor++ % this.budget,
        item = this.items[index];
      item.position.copy(position);
      item.kind = kind === "shell" ? 2 : kind === "smoke" ? 1 : 0;
      item.max = item.life =
        kind === "smoke" ? 0.4 : kind === "shell" ? 1.3 : 0.48;
      item.velocity
        .copy(direction)
        .multiplyScalar(kind === "shell" ? 2 : kind === "smoke" ? 0.4 : 2.5);
      item.velocity.add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          Math.random() * 2,
          (Math.random() - 0.5) * 2,
        ),
      );
      this.mesh.setColorAt(
        index,
        new THREE.Color(
          kind === "blood" ? 0xa81929 : kind === "shell" ? 0xb89556 : 0x77766d,
        ),
      );
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  update(dt: number): void {
    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i];
      p.life = Math.max(0, p.life - dt);
      this.matrix.scale.setScalar(0);
      if (p.life > 0 && i < this.budget) {
        p.velocity.y -= p.kind === 1 ? -0.2 * dt : 12 * dt;
        p.position.addScaledVector(p.velocity, dt);
        if (p.position.y < 0.04) {
          p.position.y = 0.04;
          p.velocity.y = Math.abs(p.velocity.y) * 0.3;
          p.velocity.x *= 0.8;
          p.velocity.z *= 0.8;
        }
        const scale =
          p.kind === 1
            ? 0.05 + (1 - p.life / p.max) * 0.14
            : p.kind === 2
              ? 0.025
              : (0.035 * p.life) / p.max;
        this.matrix.position.copy(p.position);
        this.matrix.scale.set(scale, p.kind === 2 ? 0.08 : scale, scale);
        this.matrix.rotation.set(p.life * 5, p.life * 3, 0);
      }
      this.matrix.updateMatrix();
      this.mesh.setMatrixAt(i, this.matrix.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear(): void {
    for (const item of this.items) item.life = 0;
    this.update(0);
  }
}
