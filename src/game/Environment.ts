import * as THREE from "three";
import { COLORS, WORLD } from "./config";
import { circleIntersects, randomRange } from "./math";

type BoxCollider = { x: number; z: number; halfX: number; halfZ: number };
type CircleCollider = { x: number; z: number; radius: number };

export class Environment {
  readonly group = new THREE.Group();
  readonly shopPosition = new THREE.Vector3(23.2, 0, -4.5);
  readonly spawnPoints: THREE.Vector3[] = [];
  private readonly boxes: BoxCollider[] = [];
  private readonly circles: CircleCollider[] = [];

  constructor(private readonly scene: THREE.Scene) {
    this.group.name = "Dead Mall Atrium";
    this.scene.add(this.group);
    this.buildFloor();
    this.buildArchitecture();
    this.buildBloodMoon();
    this.buildFountain();
    this.buildShop();
    this.buildSpawnPoints();
    this.addDecay();
  }

  isBlocked(position: THREE.Vector3, radius: number): boolean {
    if (
      position.x - radius < -WORLD.halfWidth || position.x + radius > WORLD.halfWidth ||
      position.z - radius < -WORLD.halfDepth || position.z + radius > WORLD.halfDepth
    ) return true;

    for (const circle of this.circles) {
      if (circleIntersects(position.x, position.z, radius, circle.x, circle.z, circle.radius)) return true;
    }
    for (const box of this.boxes) {
      const closestX = THREE.MathUtils.clamp(position.x, box.x - box.halfX, box.x + box.halfX);
      const closestZ = THREE.MathUtils.clamp(position.z, box.z - box.halfZ, box.z + box.halfZ);
      if (Math.hypot(position.x - closestX, position.z - closestZ) < radius) return true;
    }
    return false;
  }

  distanceToShop(position: THREE.Vector3): number {
    return Math.hypot(position.x - this.shopPosition.x, position.z - this.shopPosition.z);
  }

  findNearestOpen(position: THREE.Vector3, radius: number): THREE.Vector3 | null {
    for (let ring = 0.7; ring <= 3.5; ring += 0.7) {
      for (let index = 0; index < 16; index += 1) {
        const angle = (index / 16) * Math.PI * 2;
        const candidate = position.clone();
        candidate.x += Math.cos(angle) * ring;
        candidate.z += Math.sin(angle) * ring;
        if (!this.isBlocked(candidate, radius)) return candidate;
      }
    }
    return null;
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
        const shade = (row + column) % 2 === 0 ? 43 : 51;
        context.fillStyle = `rgb(${shade}, ${shade + 5}, ${shade + 3})`;
        context.fillRect(column * 32 + 1, row * 32 + 1, 30, 30);
      }
    }
    context.strokeStyle = "rgba(8, 10, 9, .85)";
    context.lineWidth = 2;
    for (let i = 0; i <= 8; i += 1) {
      context.beginPath(); context.moveTo(i * 32, 0); context.lineTo(i * 32, 256); context.stroke();
      context.beginPath(); context.moveTo(0, i * 32); context.lineTo(256, i * 32); context.stroke();
    }
    for (let i = 0; i < 70; i += 1) {
      context.fillStyle = `rgba(20, 25, 22, ${randomRange(0.06, 0.2)})`;
      context.fillRect(randomRange(0, 250), randomRange(0, 250), randomRange(2, 15), randomRange(1, 5));
    }
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(12, 10);
    texture.colorSpace = THREE.SRGBColorSpace;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.halfWidth * 2, WORLD.halfDepth * 2),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.52, metalness: 0.12 }),
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
    [[-11, 7, 7, 3], [10, -9, 5, 2], [13, 11, 4, 5], [-18, -8, 3, 3]].forEach(([x, z, sx, sz]) => {
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 18), puddleMaterial);
      puddle.rotation.x = -Math.PI / 2;
      puddle.scale.set(sx, sz, 1);
      puddle.position.set(x, 0.012, z);
      this.group.add(puddle);
    });
  }

  private buildArchitecture(): void {
    const concrete = new THREE.MeshStandardMaterial({ color: 0x272c2a, roughness: 0.88 });
    const darkConcrete = new THREE.MeshStandardMaterial({ color: 0x111514, roughness: 0.95 });
    const railing = new THREE.MeshStandardMaterial({ color: 0x1b2422, roughness: 0.42, metalness: 0.8 });
    const glass = new THREE.MeshPhysicalMaterial({ color: COLORS.mallCyan, transparent: true, opacity: 0.16, roughness: 0.18 });

    const wallSpecs: Array<[number, number, number, number]> = [
      [0, -24.5, 61, 1], [0, 24.5, 61, 1], [-30.5, 0, 1, 50], [30.5, 0, 1, 50],
    ];
    for (const [x, z, width, depth] of wallSpecs) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(width, 9, depth), darkConcrete);
      wall.position.set(x, 4.5, z);
      wall.receiveShadow = true;
      this.group.add(wall);
    }

    const upperRingParts: Array<[number, number, number, number]> = [
      [0, -19.7, 56, 3.5], [0, 19.7, 56, 3.5], [-26.2, 0, 3.5, 36], [26.2, 0, 3.5, 36],
    ];
    for (const [x, z, width, depth] of upperRingParts) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.65, depth), concrete);
      slab.position.set(x, 7.1, z);
      slab.castShadow = true;
      slab.receiveShadow = true;
      this.group.add(slab);
    }

    for (const side of [-1, 1]) {
      for (let i = -3; i <= 3; i += 1) {
        const column = new THREE.Mesh(new THREE.BoxGeometry(1.1, 7.2, 1.1), concrete);
        column.position.set(i * 8, 3.6, side * 18.2);
        column.castShadow = true;
        this.group.add(column);
        this.boxes.push({ x: i * 8, z: side * 18.2, halfX: 0.75, halfZ: 0.75 });
      }
      const railBar = new THREE.Mesh(new THREE.BoxGeometry(54, 0.15, 0.12), railing);
      railBar.position.set(0, 8.25, side * 17.9);
      this.group.add(railBar);
      const railGlass = new THREE.Mesh(new THREE.BoxGeometry(54, 1.05, 0.08), glass);
      railGlass.position.set(0, 7.72, side * 17.9);
      this.group.add(railGlass);
    }

    this.addStorefronts(-1);
    this.addStorefronts(1);
    this.addEscalators();
    this.addSkylight();

    const cyanLights = [
      [-19, 7.8, -19], [-5, 7.8, -19], [9, 7.8, -19], [22, 7.8, -19],
      [-15, 7.8, 19], [1, 7.8, 19], [17, 7.8, 19],
    ];
    cyanLights.forEach(([x, y, z], index) => {
      const fixture = new THREE.Mesh(
        new THREE.BoxGeometry(4.6, 0.08, 0.32),
        new THREE.MeshBasicMaterial({ color: index % 3 === 0 ? 0x385f55 : 0x80c7b5 }),
      );
      fixture.position.set(x, y, z);
      this.group.add(fixture);
    });
  }

  private addStorefronts(side: -1 | 1): void {
    const shutterMaterial = new THREE.MeshStandardMaterial({ color: 0x252929, roughness: 0.72, metalness: 0.5 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x0b0d0d, roughness: 0.8 });
    const names = side < 0
      ? ["SWEET NOTHING", "REQUIEM RECORDS", "NIGHT SERVICE", "AFTERHOURS"]
      : ["GHOST ARCADE", "VELVET STATIC", "LAST LIGHT", "NO TOMORROW"];
    for (let i = 0; i < 4; i += 1) {
      const x = -21 + i * 14;
      const z = side * 23.85;
      const shutter = new THREE.Mesh(new THREE.BoxGeometry(11.2, 4.2, 0.3), shutterMaterial);
      shutter.position.set(x, 2.1, z - side * 0.35);
      this.group.add(shutter);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 0.55), trim);
      frame.position.set(x, 4.4, z - side * 0.5);
      this.group.add(frame);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(9.5, 1.1),
        new THREE.MeshBasicMaterial({ map: this.makeSignTexture(names[i]), transparent: true }),
      );
      sign.position.set(x, 5.25, z - side * 0.82);
      sign.rotation.y = side < 0 ? 0 : Math.PI;
      this.group.add(sign);
    }
  }

  private addEscalators(): void {
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x2c3836, metalness: 0.72, roughness: 0.35 });
    const stepMaterial = new THREE.MeshStandardMaterial({ color: 0x151918, metalness: 0.4, roughness: 0.7 });
    for (const side of [-1, 1]) {
      const steps = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.45, 11), stepMaterial);
      steps.rotation.x = side * -0.5;
      steps.position.set(side * 3.2, 3.25, 11.5);
      steps.castShadow = true;
      this.group.add(steps);
      const rails = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.18, 11.3), frameMaterial);
      rails.rotation.x = side * -0.5;
      rails.position.set(side * 3.2, 3.85, 11.5);
      this.group.add(rails);
    }
    this.boxes.push({ x: 0, z: 11.5, halfX: 5.8, halfZ: 6.2 });
  }

  private addSkylight(): void {
    const frame = new THREE.MeshStandardMaterial({ color: 0x18201e, metalness: 0.8, roughness: 0.35 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x9bd6cf, transparent: true, opacity: 0.13, roughness: 0.22, depthWrite: false });
    const skylight = new THREE.Mesh(new THREE.BoxGeometry(31, 0.14, 11), glass);
    skylight.position.set(0, 12, -1);
    this.group.add(skylight);
    for (let x = -15; x <= 15; x += 5) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, 11.5), frame);
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
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(3.8, 28, 20),
      new THREE.MeshBasicMaterial({ color: 0xd51524 }),
    );
    moon.position.set(0, 21.5, -2.5);
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
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(glowCanvas),
      color: 0xff2636,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    glow.position.copy(moon.position);
    glow.scale.set(14, 14, 1);
    this.group.add(glow);
  }

  private buildFountain(): void {
    const stone = new THREE.MeshStandardMaterial({ color: 0x777065, roughness: 0.8 });
    const darkWater = new THREE.MeshPhysicalMaterial({ color: 0x152b29, roughness: 0.08, metalness: 0.45, transparent: true, opacity: 0.75 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4.25, 4.6, 0.75, 12), stone);
    base.position.y = 0.38;
    base.castShadow = true;
    base.receiveShadow = true;
    this.group.add(base);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(3.72, 3.72, 0.08, 20), darkWater);
    water.position.y = 0.78;
    this.group.add(water);
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.25, 2.1, 10), stone);
    pedestal.position.y = 1.55;
    this.group.add(pedestal);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 0.8, 0.45, 12), stone);
    bowl.position.y = 2.65;
    this.group.add(bowl);
    this.circles.push({ x: 0, z: 0, radius: 4.55 });
  }

  private buildShop(): void {
    const body = new THREE.MeshStandardMaterial({ color: 0x1a1112, roughness: 0.72, metalness: 0.18 });
    const brass = new THREE.MeshStandardMaterial({ color: 0x80654d, roughness: 0.46, metalness: 0.72 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.65, 6, 11), body);
    back.position.set(29.25, 3, -4.5);
    this.group.add(back);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.35, 9.6), body);
    counter.position.set(26.7, 0.68, -4.5);
    counter.castShadow = true;
    this.group.add(counter);
    this.boxes.push({ x: 26.7, z: -4.5, halfX: 1.35, halfZ: 5.15 });

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(7.8, 1.5),
      new THREE.MeshBasicMaterial({ map: this.makeSignTexture("SANGUINE ARMS", "#d7c7aa", "#25070c"), transparent: true }),
    );
    sign.position.set(28.85, 5.15, -4.5);
    sign.rotation.y = -Math.PI / 2;
    this.group.add(sign);

    for (let i = -3; i <= 3; i += 1) {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 1.5), brass);
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
      [-26, -19], [-14, -22], [0, -22], [15, -22], [27, -18],
      [-27, 0], [28, 10], [-24, 18], [18, 20], [8, 18], [-16, 10], [17, 9],
    ];
    for (const [x, z] of points) this.spawnPoints.push(new THREE.Vector3(x, 0, z));
  }

  private addDecay(): void {
    const debrisMaterial = new THREE.MeshStandardMaterial({ color: 0x202322, roughness: 0.95 });
    for (let i = 0; i < 42; i += 1) {
      const x = randomRange(-28, 28);
      const z = randomRange(-22, 22);
      if (Math.hypot(x, z) < 6 || Math.hypot(x - 24, z + 4.5) < 5) continue;
      const piece = new THREE.Mesh(
        new THREE.BoxGeometry(randomRange(0.12, 0.65), randomRange(0.03, 0.12), randomRange(0.16, 0.9)),
        debrisMaterial,
      );
      piece.position.set(x, 0.07, z);
      piece.rotation.y = randomRange(0, Math.PI);
      this.group.add(piece);
    }
  }

  private makeSignTexture(text: string, foreground = "#9bbeb3", background = "#101615"): THREE.CanvasTexture {
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
