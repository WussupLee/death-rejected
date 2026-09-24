import * as THREE from "three";
import { AssetLibrary, AnimatedAsset } from "./AssetLibrary";
export class TallyScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 30);
  private readonly hunter: AnimatedAsset;
  private readonly scratches = new THREE.Group();
  private readonly scratchMaterial = new THREE.MeshStandardMaterial({
    color: 0xb6b09c,
    roughness: 1,
  });
  private newest: THREE.Mesh | null = null;
  private time = 0;
  constructor(assets: AssetLibrary) {
    this.scene.background = new THREE.Color(0x090b0b);
    this.scene.fog = new THREE.Fog(0x090b0b, 6, 14);
    this.hunter = assets.create("hunter");
    this.hunter.root.position.set(-1.2, -0.35, 0);
    this.scene.add(this.hunter.root);
    const material = new THREE.MeshStandardMaterial({
      color: 0x454941,
      roughness: 1,
    });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 0.3), material);
    wall.position.set(0, 2, -0.5);
    this.scene.add(wall);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(16, 0.2, 10), material);
    floor.position.y = -0.1;
    this.scene.add(floor);
    for (let i = 0; i < 8; i++) {
      const seam = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 5, 0.01),
        new THREE.MeshBasicMaterial({ color: 0x202520 }),
      );
      seam.position.set(i * 1.5 - 6, 2, -0.34);
      this.scene.add(seam);
    }
    this.scene.add(new THREE.HemisphereLight(0xb0b6a2, 0x110406, 1.2));
    const red = new THREE.PointLight(0xb12c36, 24, 12, 1.5);
    red.position.set(2, 2, 2);
    this.scene.add(red);
    const cyan = new THREE.PointLight(0x70a392, 18, 10, 1.5);
    cyan.position.set(-4, 3, 2);
    this.scene.add(cyan);
    this.scene.add(this.scratches);
    this.camera.position.set(0, 1.7, 5.2);
    this.camera.lookAt(0, 1.05, 0);
  }
  begin(attempts: number): void {
    this.time = 0;
    this.hunter.play("scratch", true);
    for (const mark of [...this.scratches.children]) {
      this.scratches.remove(mark);
      (mark as THREE.Mesh).geometry.dispose();
    }
    const count = Math.min(65, 24 + attempts);
    for (let i = 0; i < count; i++) {
      const mark = new THREE.Mesh(
        new THREE.BoxGeometry(0.015, 0.23, 0.015),
        this.scratchMaterial,
      );
      mark.position.set(
        -2.5 + (i % 15) * 0.1,
        2.05 - Math.floor(i / 15) * 0.32,
        -0.337,
      );
      mark.rotation.z = i % 5 === 4 ? -1.2 : ((i % 3) - 1) * 0.08;
      this.scratches.add(mark);
      if (i === count - 1) this.newest = mark;
    }
  }
  update(dt: number): void {
    this.time += dt;
    this.hunter.update(dt);
    for (const side of [-1, 1]) {
      const leg = this.hunter.root.getObjectByName("leg" + side);
      if (leg) leg.rotation.x = -1.2;
    }
    if (this.newest)
      this.newest.scale.y = THREE.MathUtils.clamp(
        (this.time - 0.5) / 0.4,
        0,
        1,
      );
  }
  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
