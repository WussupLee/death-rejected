import * as THREE from "three";
import { COLORS, WORLD } from "./config";
import { randomRange } from "./math";

import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { AssetLibrary } from "./AssetLibrary";
import { WorldLayout, BALCONY_Y, RAMPS } from "./WorldLayout";

export class Environment extends WorldLayout {
  readonly group = new THREE.Group();
  readonly shopPosition = new THREE.Vector3(23.2, 0, -4.5);
  private readonly corruption = new THREE.Group();
  private visualMoon = 0;
  readonly spawnPoints: THREE.Vector3[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly assets: AssetLibrary,
  ) {
    super();
    this.group.name = "Dead Mall Atrium";
    this.scene.add(this.group);
    this.buildFloor();
    this.buildArchitecture();
    this.buildAtriumDetails();
    this.buildBloodMoon();
    this.buildFountain();
    this.buildShop();
    this.buildSpawnPoints();
    this.addDecay();
    this.mergeStaticMeshes();
    this.group.add(this.corruption);
  }

  private reflection: THREE.CubeTexture | null = null;
  private readonly water: THREE.MeshPhysicalMaterial[] = [];
  captureReflections(renderer: THREE.WebGLRenderer): void {
    const target = new THREE.WebGLCubeRenderTarget(128, {
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    const camera = new THREE.CubeCamera(0.1, 100, target);
    camera.position.set(0, 1, 0);
    camera.update(renderer, this.scene);
    this.reflection = target.texture;
    this.group.traverse((object) => {
      if (
        object instanceof THREE.Mesh &&
        object.material instanceof THREE.MeshPhysicalMaterial &&
        object.material.metalness > 0.3
      ) {
        this.water.push(object.material);
        object.material.envMap = this.reflection;
        object.material.envMapIntensity = 0.6;
        object.material.needsUpdate = true;
      }
    });
  }
  setReflections(enabled: boolean): void {
    for (const material of this.water)
      if (material.envMap !== (enabled ? this.reflection : null)) {
        material.envMap = enabled ? this.reflection : null;
        material.needsUpdate = true;
      }
  }
  private mergeStaticMeshes(): void {
    this.group.updateMatrixWorld(true);
    const batches = new Map<THREE.Material, THREE.Mesh[]>();
    this.group.traverse((object) => {
      if (
        object instanceof THREE.Mesh &&
        !Array.isArray(object.material) &&
        !object.material.transparent
      ) {
        const batch = batches.get(object.material) ?? [];
        batch.push(object);
        batches.set(object.material, batch);
      }
    });
    for (const [material, meshes] of batches) {
      if (meshes.length < 2) continue;
      const geometries = meshes.map((mesh) => {
        const g = mesh.geometry.clone();
        g.applyMatrix4(mesh.matrixWorld);
        return g.index ? g.toNonIndexed() : g;
      });
      const geometry = mergeGeometries(geometries, false);
      geometries.forEach((g) => g.dispose());
      if (!geometry) continue;
      const merged = new THREE.Mesh(geometry, material);
      merged.castShadow = true;
      merged.receiveShadow = true;
      meshes.forEach((mesh) => mesh.removeFromParent());
      this.group.add(merged);
    }
  }

  setMoon(moon: number): void {
    if (moon === this.visualMoon) return;
    this.visualMoon = moon;
    while (this.corruption.children.length) {
      const mesh = this.corruption.children[0] as THREE.Mesh;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.removeFromParent();
    }
    for (let i = 0; i < Math.min(5, moon) - 1; i++) {
      const stain = new THREE.Mesh(
        new THREE.RingGeometry(1.3 + i * 0.13, 1.36 + i * 0.13, 20),
        new THREE.MeshBasicMaterial({
          color: 0x71111d,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        }),
      );
      stain.rotation.x = -Math.PI / 2;
      stain.position.set(i % 2 ? 14 : -14, 0.022, -8 + i * 5);
      this.corruption.add(stain);
    }
  }
  distanceToShop(position: THREE.Vector3): number {
    return position.distanceTo(this.shopPosition);
  }

  private buildFloor(): void {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 256;
    textureCanvas.height = 256;
    const context = textureCanvas.getContext("2d")!;
    context.fillStyle = "#303332";
    context.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 8; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        const shade = (row + column) % 2 === 0 ? 72 : 86;
        context.fillStyle = `rgb(${shade}, ${shade + 5}, ${shade + 3})`;
        context.fillRect(column * 32 + 1, row * 32 + 1, 30, 30);
      }
    }
    context.strokeStyle = "rgba(8, 10, 9, .85)";
    context.lineWidth = 2;
    for (let i = 0; i <= 8; i += 1) {
      context.beginPath();
      context.moveTo(i * 32, 0);
      context.lineTo(i * 32, 256);
      context.stroke();
      context.beginPath();
      context.moveTo(0, i * 32);
      context.lineTo(256, i * 32);
      context.stroke();
    }
    for (let i = 0; i < 70; i += 1) {
      context.fillStyle = `rgba(20, 25, 22, ${randomRange(0.06, 0.2)})`;
      context.fillRect(
        randomRange(0, 250),
        randomRange(0, 250),
        randomRange(2, 15),
        randomRange(1, 5),
      );
    }
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(12, 10);
    texture.colorSpace = THREE.SRGBColorSpace;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.halfWidth * 2, WORLD.halfDepth * 2),
      new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.52,
        metalness: 0.12,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    const puddleMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x193a37,
      transparent: true,
      opacity: 0.38,
      roughness: 0.08,
      metalness: 0.35,
    });
    [
      [-11, 7, 7, 3],
      [10, -9, 5, 2],
      [13, 11, 4, 5],
      [-18, -8, 3, 3],
    ].forEach(([x, z, sx, sz]) => {
      const puddle = new THREE.Mesh(
        new THREE.CircleGeometry(1, 18),
        puddleMaterial,
      );
      puddle.rotation.x = -Math.PI / 2;
      puddle.scale.set(sx, sz, 1);
      puddle.position.set(x, 0.012, z);
      this.group.add(puddle);
    });
  }

  private texture(name: string): THREE.Texture {
    const texture = new THREE.TextureLoader().load(
      import.meta.env.BASE_URL + "assets/models/" + name + ".png",
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    return texture;
  }
  private buildArchitecture(): void {
    const concrete = new THREE.MeshStandardMaterial({
      color: 0x999c88,
      map: this.texture("mall-plaster"),
      roughness: 0.88,
    });
    const darkConcrete = new THREE.MeshStandardMaterial({
      color: 0x819086,
      map: this.texture("mall-plaster"),
      roughness: 0.95,
    });
    const railing = new THREE.MeshStandardMaterial({
      color: 0x1b2422,
      roughness: 0.42,
      metalness: 0.8,
    });
    const glass = new THREE.MeshPhysicalMaterial({
      color: COLORS.mallCyan,
      transparent: true,
      opacity: 0.16,
      roughness: 0.18,
    });

    const wallSpecs: Array<[number, number, number, number]> = [
      [0, -24.5, 61, 1],
      [0, 24.5, 61, 1],
      [-30.5, 0, 1, 50],
      [30.5, 0, 1, 50],
    ];
    for (const [x, z, width, depth] of wallSpecs) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(width, 9, depth),
        darkConcrete,
      );
      wall.position.set(x, 4.5, z);
      wall.receiveShadow = true;
      this.group.add(wall);
    }

    const upperRingParts: Array<[number, number, number, number]> = [
      [0, -20.8, 59, 5.6],
      [0, 20.8, 59, 5.6],
      [-26.75, 0, 5.5, 36],
      [26.75, 0, 5.5, 36],
    ];
    for (const [x, z, width, depth] of upperRingParts) {
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.35, depth),
        concrete,
      );
      slab.position.set(x, BALCONY_Y - 0.175, z);
      slab.castShadow = true;
      slab.receiveShadow = true;
      this.group.add(slab);
    }

    for (const side of [-1, 1]) {
      for (let i = -3; i <= 3; i += 1) {
        const column = this.assets.create("pillar").root;
        column.position.set(
          side === 1 && Math.abs(i) === 1 ? i * 5 : i * 8,
          0,
          side * 18.2,
        );
        this.group.add(column);
      }
      const segments =
        side < 0
          ? [[-29.5, 29.5]]
          : [
              [-29.5, -10.8],
              [-7.2, 7.2],
              [10.8, 29.5],
            ];
      for (const [left, right] of segments) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(right - left, 0.12, 0.12),
          railing,
        );
        rail.position.set((left + right) / 2, BALCONY_Y + 1.05, side * 17.95);
        this.group.add(rail);
        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(right - left, 0.95, 0.06),
          glass,
        );
        panel.position.set((left + right) / 2, BALCONY_Y + 0.52, side * 17.95);
        this.group.add(panel);
      }
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 36),
        railing,
      );
      rail.position.set(side * 23.95, BALCONY_Y + 1.05, 0);
      this.group.add(rail);
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.95, 36),
        glass,
      );
      panel.position.set(side * 23.95, BALCONY_Y + 0.52, 0);
      this.group.add(panel);
    }

    for (const side of [-1, 1])
      for (let z = -16; z <= 16; z += 2) {
        const module = this.assets.create("railing").root;
        module.position.set(side * 23.95, BALCONY_Y, z);
        module.rotation.y = Math.PI / 2;
        this.group.add(module);
      }
    this.addStorefronts(-1);
    this.addStorefronts(1);
    this.addEscalators();
    this.addSkylight();

    const cyanLights = [
      [-19, 7.8, -19],
      [-5, 7.8, -19],
      [9, 7.8, -19],
      [22, 7.8, -19],
      [-15, 7.8, 19],
      [1, 7.8, 19],
      [17, 7.8, 19],
    ];
    cyanLights.forEach(([x, y, z], index) => {
      const fixture = new THREE.Mesh(
        new THREE.BoxGeometry(4.6, 0.08, 0.32),
        new THREE.MeshBasicMaterial({
          color: index % 3 === 0 ? 0x385f55 : 0x80c7b5,
        }),
      );
      fixture.position.set(x, y, z);
      this.group.add(fixture);
    });
  }

  private addStorefronts(side: -1 | 1): void {
    const shutterMaterial = new THREE.MeshStandardMaterial({
      color: 0x8d9790,
      map: this.texture("mall-shutter"),
      roughness: 0.72,
      metalness: 0.5,
    });
    const trim = new THREE.MeshStandardMaterial({
      color: 0x0b0d0d,
      roughness: 0.8,
    });
    const names =
      side < 0
        ? ["SWEET NOTHING", "REQUIEM RECORDS", "NIGHT SERVICE", "AFTERHOURS"]
        : ["GHOST ARCADE", "VELVET STATIC", "LAST LIGHT", "NO TOMORROW"];
    for (let i = 0; i < 4; i += 1) {
      const x = -21 + i * 14;
      const z = side * 23.85;
      const shutter = new THREE.Mesh(
        new THREE.BoxGeometry(11.2, 4.2, 0.3),
        shutterMaterial,
      );
      shutter.position.set(x, 2.1, z - side * 0.35);
      const module = this.assets.create("storefront").root;
      module.position.set(x, 0, z - side * 0.7);
      module.rotation.y = side < 0 ? 0 : Math.PI;
      this.group.add(module);
      shutter.scale.y = 0.45;
      shutter.position.y = 3.15;
      this.group.add(shutter);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 0.55), trim);
      frame.position.set(x, 4.4, z - side * 0.5);
      this.group.add(frame);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(9.5, 1.1),
        new THREE.MeshBasicMaterial({
          map: this.makeSignTexture(names[i]),
          transparent: true,
        }),
      );
      sign.position.set(x, 4.43, z - side * 0.82);
      sign.rotation.y = side < 0 ? 0 : Math.PI;
      this.group.add(sign);
    }
  }

  private addEscalators(): void {
    for (const ramp of RAMPS) {
      const module = this.assets.create("escalator").root;
      module.position.set(ramp.x, 0, ramp.start);
      this.group.add(module);
    }
  }

  private addSkylight(): void {
    const frame = new THREE.MeshStandardMaterial({
      color: 0x18201e,
      metalness: 0.8,
      roughness: 0.35,
    });
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x9bd6cf,
      transparent: true,
      opacity: 0.13,
      roughness: 0.22,
      depthWrite: false,
    });
    const skylight = new THREE.Mesh(new THREE.BoxGeometry(31, 0.14, 11), glass);
    skylight.position.set(0, 12, -1);
    this.group.add(skylight);
    for (let x = -15; x <= 15; x += 5) {
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.35, 11.5),
        frame,
      );
      rib.position.set(x, 12.1, -1);
      this.group.add(rib);
    }
    for (const z of [-6.5, 4.5]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(31, 0.35, 0.2), frame);
      beam.position.set(0, 12.1, z);
      this.group.add(beam);
    }
  }

  private buildBloodMoon(): void {
    const surface = document.createElement("canvas");
    surface.width = 256;
    surface.height = 256;
    const surfaceContext = surface.getContext("2d")!;
    const surfaceGradient = surfaceContext.createRadialGradient(
      92,
      72,
      15,
      128,
      128,
      138,
    );
    surfaceGradient.addColorStop(0, "#ff5860");
    surfaceGradient.addColorStop(0.38, "#d31829");
    surfaceGradient.addColorStop(1, "#5b020d");
    surfaceContext.fillStyle = surfaceGradient;
    surfaceContext.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 56; i += 1) {
      const radius = randomRange(3, 20);
      surfaceContext.beginPath();
      surfaceContext.arc(
        randomRange(18, 238),
        randomRange(18, 238),
        radius,
        0,
        Math.PI * 2,
      );
      surfaceContext.fillStyle = `rgba(55, 0, 8, ${randomRange(0.08, 0.34)})`;
      surfaceContext.fill();
    }
    const moonTexture = new THREE.CanvasTexture(surface);
    moonTexture.colorSpace = THREE.SRGBColorSpace;
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(4.6, 32, 24),
      new THREE.MeshBasicMaterial({ map: moonTexture, color: 0xff3340 }),
    );
    moon.position.set(0, 18, -16);
    moon.name = "Blood Moon";
    this.group.add(moon);

    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = 256;
    glowCanvas.height = 256;
    const context = glowCanvas.getContext("2d")!;
    const gradient = context.createRadialGradient(128, 128, 22, 128, 128, 128);
    gradient.addColorStop(0, "rgba(255, 55, 65, 0.72)");
    gradient.addColorStop(0.34, "rgba(210, 15, 32, 0.35)");
    gradient.addColorStop(1, "rgba(90, 0, 12, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(glowCanvas),
        color: 0xff2636,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    glow.position.copy(moon.position);
    glow.scale.set(17, 17, 1);
    this.group.add(glow);
  }

  private buildAtriumDetails(): void {
    const oxidized = new THREE.MeshStandardMaterial({
      color: 0x26312d,
      roughness: 0.62,
      metalness: 0.46,
      flatShading: true,
    });
    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x0c1110,
      roughness: 0.48,
      metalness: 0.72,
      flatShading: true,
    });
    const dirtyBone = new THREE.MeshStandardMaterial({
      color: 0x81796d,
      roughness: 0.92,
      flatShading: true,
    });
    const redCloth = new THREE.MeshStandardMaterial({
      color: 0x4a080f,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });

    // Layered balcony fascia and upper service doors give the room a believable mall scale.
    for (const side of [-1, 1]) {
      const fascia = new THREE.Mesh(
        new THREE.BoxGeometry(57, 1.2, 0.48),
        dirtyBone,
      );
      fascia.position.set(0, 4.85, side * 18.05);
      this.group.add(fascia);
      for (let x = -24; x <= 24; x += 8) {
        const upperDoor = this.assets.create("service-door").root;
        upperDoor.position.set(x, BALCONY_Y, side * 23.6);
        upperDoor.rotation.y = side < 0 ? 0 : Math.PI;
        this.group.add(upperDoor);
        const lintel = new THREE.Mesh(
          new THREE.BoxGeometry(6.3, 0.18, 0.28),
          oxidized,
        );
        lintel.position.set(x, 9.26, side * 23.55);
        this.group.add(lintel);
      }
    }

    // Central hanging banners point the eye toward the moon without copying any reference signage.
    for (const x of [-7.2, 7.2]) {
      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(2.5, 6.4, 1, 3),
        redCloth,
      );
      banner.position.set(x, 9.1, -4.8);
      banner.rotation.y = x < 0 ? 0.08 : -0.08;
      this.group.add(banner);
      const sigil = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.055, 5, 16),
        new THREE.MeshBasicMaterial({ color: 0x9d2630 }),
      );
      sigil.position.set(x, 9.25, -4.76);
      this.group.add(sigil);
    }

    // Period mall furniture, directory kiosk, trash cans and bench islands.
    const benchSpecs: Array<[number, number, number]> = [
      [-12, -4, 0.2],
      [12, 4, -0.25],
      [-13, 12, -0.1],
      [14, -12, 0.15],
    ];
    for (const [x, z, angle] of benchSpecs) {
      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 0.18, 0.62),
        dirtyBone,
      );
      seat.position.set(x, 0.62, z);
      seat.rotation.y = angle;
      seat.castShadow = true;
      this.group.add(seat);
      for (const offset of [-1.3, 1.3]) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 0.62, 0.48),
          darkMetal,
        );
        leg.position.set(
          x + Math.cos(angle) * offset,
          0.31,
          z - Math.sin(angle) * offset,
        );
        leg.rotation.y = angle;
        this.group.add(leg);
      }
    }
    const directory = new THREE.Group();
    const directoryBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 3.9, 0.42),
      oxidized,
    );
    directoryBody.position.y = 1.95;
    const directoryFace = new THREE.Mesh(
      new THREE.PlaneGeometry(1.45, 2.3),
      new THREE.MeshBasicMaterial({ map: this.makeDirectoryTexture() }),
    );
    directoryFace.position.set(0, 2.35, -0.225);
    directory.add(directoryBody, directoryFace);
    directory.position.set(-19, 0, 2.5);
    directory.rotation.y = -0.32;
    this.group.add(directory);

    // Broken roof frame adds the late-PS2 silhouette language seen from the combat floor.
    for (let i = -4; i <= 4; i += 1) {
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.25, 18),
        darkMetal,
      );
      rib.position.set(i * 4.2, 12.25 + Math.abs(i) * 0.1, -1.5);
      rib.rotation.z = i % 3 === 0 ? i * 0.008 : 0;
      this.group.add(rib);
    }

    // A restrained occult ring stains the fountain landmark instead of becoming glowing sci-fi trim.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(5.2, 5.38, 48),
      new THREE.MeshBasicMaterial({
        color: 0x4e080f,
        transparent: true,
        opacity: 0.58,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.018;
    this.group.add(ring);
  }

  private makeDirectoryTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 384;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#111716";
    context.fillRect(0, 0, 256, 384);
    context.strokeStyle = "#776e5d";
    context.lineWidth = 5;
    context.strokeRect(8, 8, 240, 368);
    context.fillStyle = "#b9b09e";
    context.font = "700 25px Arial Narrow";
    context.textAlign = "center";
    context.fillText("DIRECTORY", 128, 45);
    context.font = "14px Arial";
    context.textAlign = "left";
    const entries = [
      "ATRIUM / YOU ARE HERE",
      "SANGUINE ARMS",
      "AFTERHOURS",
      "FOOD COURT",
      "SERVICE HALL",
      "NO EXIT",
    ];
    entries.forEach((entry, index) => {
      context.fillStyle = index === 5 ? "#a31522" : "#777d73";
      context.fillText(
        `${String(index + 1).padStart(2, "0")}  ${entry}`,
        24,
        95 + index * 42,
      );
      context.fillRect(22, 105 + index * 42, 208, 1);
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private buildFountain(): void {
    this.group.add(this.assets.create("fountain").root);
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(3.72, 3.72, 0.08, 24),
      new THREE.MeshPhysicalMaterial({
        color: 0x20342e,
        roughness: 0.12,
        metalness: 0.45,
        transparent: true,
        opacity: 0.8,
      }),
    );
    water.position.y = 0.32;
    this.group.add(water);
  }

  private buildShop(): void {
    const body = new THREE.MeshStandardMaterial({
      color: 0x1a1112,
      roughness: 0.72,
      metalness: 0.18,
    });
    const brass = new THREE.MeshStandardMaterial({
      color: 0x80654d,
      roughness: 0.46,
      metalness: 0.72,
    });
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.65, 6, 11), body);
    back.position.set(29.25, 3, -4.5);
    this.group.add(back);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.35, 9.6), body);
    counter.position.set(26.7, 0.68, -4.5);
    counter.castShadow = true;
    this.group.add(counter);

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(7.8, 1.5),
      new THREE.MeshBasicMaterial({
        map: this.makeSignTexture("SANGUINE ARMS", "#d7c7aa", "#25070c"),
        transparent: true,
      }),
    );
    sign.position.set(28.85, 5.15, -4.5);
    sign.rotation.y = -Math.PI / 2;
    this.group.add(sign);

    for (let i = -3; i <= 3; i += 1) {
      const rack = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.12, 1.5),
        brass,
      );
      rack.position.set(28.55, 2.3 + (i % 2) * 1.2, -4.5 + i * 1.3);
      rack.rotation.x = i * 0.08;
      this.group.add(rack);
    }
    const shopLight = new THREE.PointLight(0x941b29, 18, 11, 1.8);
    shopLight.position.set(26.5, 4, -4.5);
    this.group.add(shopLight);
  }

  private buildSpawnPoints(): void {
    const points: Array<[number, number]> = [
      [-26, -19],
      [-14, -22],
      [0, -22],
      [15, -22],
      [27, -18],
      [-27, 0],
      [28, 10],
      [-24, 18],
      [18, 20],
      [8, 18],
      [-16, 10],
      [17, 9],
    ];
    for (const [x, z] of points)
      this.spawnPoints.push(new THREE.Vector3(x, 0, z));
  }

  private addDecay(): void {
    for (let i = 0; i < 24; i++) {
      const x = Math.sin(i * 71.3) * 27,
        z = Math.cos(i * 19.7) * 21;
      if (Math.hypot(x, z) < 6 || this.rampHeight(x, z) !== null) continue;
      const debris = this.assets.create("debris").root;
      debris.position.set(x, 0, z);
      debris.rotation.y = i * 1.71;
      this.group.add(debris);
    }
  }

  private makeSignTexture(
    text: string,
    foreground = "#9bbeb3",
    background = "#101615",
  ): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const context = canvas.getContext("2d")!;
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = foreground;
    context.globalAlpha = 0.45;
    context.lineWidth = 3;
    context.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    context.globalAlpha = 1;
    context.fillStyle = foreground;
    context.font = "700 37px Georgia";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 256, 49);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
}
