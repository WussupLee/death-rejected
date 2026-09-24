import * as THREE from "three";
import { COLORS } from "./config";
import { randomRange } from "./math";
import { NavigationGrid } from "./NavigationGrid";
import type { Environment } from "./Environment";
import type { EnemyKind, EnemyTarget, GameEvents } from "./types";

interface EnemyRuntime extends EnemyTarget {
  speed: number;
  damage: number;
  attackCooldown: number;
  hurtFlash: number;
  leapCooldown: number;
  blockedTime: number;
  avoidanceSign: number;
  phase: number;
  path: THREE.Vector3[];
  pathIndex: number;
  repathTimer: number;
  activeVisual: THREE.Group;
  thrallVisual: THREE.Group;
  stalkerVisual: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
}

export class EnemySystem {
  readonly group = new THREE.Group();
  private readonly pool: EnemyRuntime[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly liveRoots: THREE.Object3D[] = [];
  private readonly navigation: NavigationGrid;
  private moon = 1;

  constructor(
    scene: THREE.Scene,
    private readonly environment: Environment,
    private readonly events: GameEvents,
  ) {
    this.group.name = "Enemy Pool";
    scene.add(this.group);
    this.navigation = new NavigationGrid(environment);
    for (let i = 0; i < 28; i += 1) this.pool.push(this.createEnemy(i));
  }

  setMoon(moon: number): void {
    this.moon = moon;
  }

  spawn(kind: EnemyKind, playerPosition: THREE.Vector3): boolean {
    const enemy = this.pool.find((candidate) => !candidate.alive);
    if (!enemy) return false;
    const options = this.environment.spawnPoints.filter((point) => point.distanceTo(playerPosition) > 12);
    const spawnPoint = options[Math.floor(Math.random() * options.length)] ?? this.environment.spawnPoints[0];
    enemy.kind = kind;
    enemy.maxBlood = kind === "thrall" ? 66 + this.moon * 7 : 45 + this.moon * 6;
    enemy.blood = enemy.maxBlood;
    enemy.radius = kind === "thrall" ? 0.52 : 0.62;
    enemy.speed = kind === "thrall" ? 2.25 + this.moon * 0.12 : 3.8 + this.moon * 0.16;
    enemy.damage = kind === "thrall" ? 10 + this.moon * 0.8 : 8 + this.moon * 0.7;
    enemy.attackCooldown = randomRange(0.3, 0.8);
    enemy.leapCooldown = randomRange(1.4, 3.3);
    enemy.hurtFlash = 0;
    enemy.blockedTime = 0;
    enemy.avoidanceSign = Math.random() < 0.5 ? -1 : 1;
    enemy.phase = randomRange(0, Math.PI * 2);
    enemy.path = [];
    enemy.pathIndex = 0;
    enemy.repathTimer = randomRange(0, 0.35);
    enemy.alive = true;
    enemy.attacking = false;
    enemy.root.visible = true;
    enemy.root.position.copy(spawnPoint);
    enemy.root.rotation.y = randomRange(-Math.PI, Math.PI);
    enemy.root.scale.setScalar(kind === "thrall" ? 1 : 0.86);
    enemy.root.userData.kind = kind;
    this.configureAppearance(enemy);
    return true;
  }

  update(delta: number, playerPosition: THREE.Vector3, active: boolean): void {
    for (const enemy of this.pool) {
      if (!enemy.alive) continue;
      enemy.attackCooldown -= delta;
      enemy.leapCooldown -= delta;
      enemy.hurtFlash = Math.max(0, enemy.hurtFlash - delta * 7);
      this.updateFlash(enemy);
      if (!active) continue;

      const dx = playerPosition.x - enemy.position.x;
      const dz = playerPosition.z - enemy.position.z;
      const distance = Math.max(0.001, Math.hypot(dx, dz));
      enemy.repathTimer -= delta;
      if (enemy.repathTimer <= 0) {
        enemy.path = this.navigation.findPath(enemy.position, playerPosition, enemy.radius);
        enemy.pathIndex = 0;
        enemy.repathTimer = randomRange(0.55, 0.95);
      }
      while (enemy.pathIndex < enemy.path.length && enemy.position.distanceTo(enemy.path[enemy.pathIndex]) < 1.15) enemy.pathIndex += 1;
      const target = enemy.path[enemy.pathIndex] ?? playerPosition;
      const targetDx = target.x - enemy.position.x;
      const targetDz = target.z - enemy.position.z;
      const targetDistance = Math.max(0.001, Math.hypot(targetDx, targetDz));
      const directionX = targetDx / targetDistance;
      const directionZ = targetDz / targetDistance;
      enemy.root.rotation.y = Math.atan2(directionX, directionZ);

      let moveSpeed = enemy.speed;
      if (enemy.kind === "stalker" && enemy.leapCooldown <= 0 && distance > 4 && distance < 12) {
        moveSpeed *= 2.35;
        enemy.leapCooldown = randomRange(2.2, 3.4);
        enemy.root.position.y = 0.48;
      }
      enemy.root.position.y = Math.max(0, enemy.root.position.y - delta * 2.8);

      if (distance > 1.12) {
        const separation = this.getSeparation(enemy);
        const moved = this.moveEnemy(enemy, directionX, directionZ, moveSpeed, separation, delta);
        if (moved) {
          enemy.blockedTime = Math.max(0, enemy.blockedTime - delta * 2);
        } else {
          enemy.blockedTime += delta;
          if (enemy.blockedTime > 0.65 && enemy.blockedTime - delta <= 0.65) enemy.avoidanceSign *= -1;
          if (enemy.blockedTime > 1.4) {
            const openPosition = this.environment.findNearestOpen(enemy.position, enemy.radius);
            if (openPosition) enemy.position.copy(openPosition);
            enemy.blockedTime = 0;
          }
        }
      }

      enemy.phase += delta * (enemy.kind === "stalker" ? 11 : 6);
      const visual = enemy.activeVisual;
      visual.position.y = Math.sin(enemy.phase) * (enemy.kind === "stalker" ? 0.08 : 0.04);
      visual.rotation.z = Math.sin(enemy.phase * 0.5) * (enemy.kind === "stalker" ? 0.065 : 0.035);

      enemy.attacking = distance < (enemy.kind === "stalker" ? 1.65 : 1.3);
      if (enemy.attacking && enemy.attackCooldown <= 0) {
        this.events.onPlayerDamage(enemy.damage);
        enemy.attackCooldown = enemy.kind === "stalker" ? 0.72 : 1.05;
      }
    }
  }

  hitScan(origin: THREE.Vector3, direction: THREE.Vector3, damage: number, range: number): { enemy: EnemyTarget; killed: boolean; distance: number; headshot: boolean } | null {
    this.liveRoots.length = 0;
    for (const enemy of this.pool) if (enemy.alive) this.liveRoots.push(enemy.activeVisual);
    this.raycaster.set(origin, direction);
    this.raycaster.far = range;
    const intersections = this.raycaster.intersectObjects(this.liveRoots, true);
    for (const intersection of intersections) {
      const id = this.findEnemyId(intersection.object);
      if (id == null) continue;
      const enemy = this.pool[id];
      if (!enemy?.alive) continue;
      const headshot = intersection.object.userData.hitZone === "head";
      const killed = this.damageEnemy(enemy, damage * (headshot ? 2.25 : 1), intersection.distance, false);
      return { enemy, killed, distance: intersection.distance, headshot };
    }
    return null;
  }

  melee(origin: THREE.Vector3, direction: THREE.Vector3, damage: number, range: number): { enemy: EnemyTarget; killed: boolean; distance: number } | null {
    let best: EnemyRuntime | null = null;
    let bestDistance = range;
    const flatDirection = direction.clone().setY(0).normalize();
    for (const enemy of this.pool) {
      if (!enemy.alive) continue;
      const toEnemy = enemy.position.clone().sub(origin);
      const distance = Math.hypot(toEnemy.x, toEnemy.z);
      if (distance > bestDistance) continue;
      const dot = flatDirection.dot(toEnemy.setY(0).normalize());
      if (dot < 0.44) continue;
      best = enemy;
      bestDistance = distance;
    }
    if (!best) return null;
    const killed = this.damageEnemy(best, damage, bestDistance, true);
    return { enemy: best, killed, distance: bestDistance };
  }

  clear(): void {
    for (const enemy of this.pool) {
      enemy.alive = false;
      enemy.root.visible = false;
    }
  }

  get activeCount(): number {
    return this.pool.reduce((count, enemy) => count + (enemy.alive ? 1 : 0), 0);
  }

  private damageEnemy(enemy: EnemyRuntime, amount: number, distance: number, melee: boolean): boolean {
    enemy.blood -= amount;
    enemy.hurtFlash = 1;
    const killed = enemy.blood <= 0;
    this.events.onEnemyHit(enemy, killed);
    if (killed) {
      enemy.alive = false;
      enemy.root.visible = false;
      this.events.onEnemyKilled(enemy, distance, melee);
    }
    return killed;
  }

  private getSeparation(enemy: EnemyRuntime): THREE.Vector3 {
    const result = new THREE.Vector3();
    for (const other of this.pool) {
      if (!other.alive || other === enemy) continue;
      const dx = enemy.position.x - other.position.x;
      const dz = enemy.position.z - other.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 0 && distance < 1.35) {
        result.x += (dx / distance) * (1.35 - distance) * 2.4;
        result.z += (dz / distance) * (1.35 - distance) * 2.4;
      }
    }
    return result;
  }

  private moveEnemy(
    enemy: EnemyRuntime,
    directionX: number,
    directionZ: number,
    moveSpeed: number,
    separation: THREE.Vector3,
    delta: number,
  ): boolean {
    const angles = [0, 0.55, -0.55, 1.05, -1.05, 1.57, -1.57, 2.2, -2.2];
    for (const rawAngle of angles) {
      const angle = rawAngle * enemy.avoidanceSign;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const steeredX = directionX * cos - directionZ * sin;
      const steeredZ = directionX * sin + directionZ * cos;
      const next = enemy.position.clone();
      next.x += (steeredX * moveSpeed + separation.x) * delta;
      next.z += (steeredZ * moveSpeed + separation.z) * delta;
      if (this.environment.isBlocked(next, enemy.radius)) continue;
      enemy.position.copy(next);
      return true;
    }
    return false;
  }

  private createEnemy(id: number): EnemyRuntime {
    const root = new THREE.Group();
    root.visible = false;
    root.userData.enemyId = id;
    const thrallVisual = new THREE.Group();
    const stalkerVisual = new THREE.Group();
    root.add(thrallVisual, stalkerVisual);
    this.group.add(root);

    const materials = [
      new THREE.MeshStandardMaterial({ color: 0x2b2021, roughness: 0.92, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x918678, roughness: 0.8, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: COLORS.blood, roughness: 0.62, emissive: 0x260005, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x0d0c0d, roughness: 0.76, metalness: 0.08, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.35, emissive: 0x8e101d, emissiveIntensity: 1.4, flatShading: true }),
    ];
    const hitMeshes: THREE.Object3D[] = [];
    const addPart = (parent: THREE.Group, geometry: THREE.BufferGeometry, materialIndex: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
      const part = new THREE.Mesh(geometry, materials[materialIndex]);
      part.position.set(x, y, z);
      part.rotation.set(rx, ry, rz);
      part.castShadow = true;
      part.userData.enemyId = id;
      parent.add(part);
      hitMeshes.push(part);
      return part;
    };

    // Thrall: a long, funereal silhouette with a bone mask and bladed shoulders.
    addPart(thrallVisual, new THREE.ConeGeometry(0.72, 1.75, 6, 1, true), 3, 0, 0.9, 0, 0, 0, Math.PI);
    addPart(thrallVisual, new THREE.CapsuleGeometry(0.38, 0.72, 3, 6), 0, 0, 1.48, 0);
    addPart(thrallVisual, new THREE.BoxGeometry(1.24, 0.18, 0.34), 3, 0, 1.72, 0.02, 0, 0, -0.03);
    const thrallHead = addPart(thrallVisual, new THREE.IcosahedronGeometry(0.36, 1), 1, 0, 2.28, -0.03);
    thrallHead.scale.set(0.85, 1.05, 0.78);
    thrallHead.userData.hitZone = "head";
    addPart(thrallVisual, new THREE.ConeGeometry(0.105, 0.56, 5), 1, -0.26, 2.68, 0, 0, 0, -0.38).userData.hitZone = "head";
    addPart(thrallVisual, new THREE.ConeGeometry(0.105, 0.56, 5), 1, 0.26, 2.68, 0, 0, 0, 0.38).userData.hitZone = "head";
    for (const side of [-1, 1]) {
      addPart(thrallVisual, new THREE.CapsuleGeometry(0.12, 0.9, 2, 5), 0, side * 0.56, 1.18, 0, 0, side * 0.24);
      addPart(thrallVisual, new THREE.ConeGeometry(0.11, 0.48, 4), 1, side * 0.72, 0.56, -0.04, 0, 0, side * Math.PI);
      addPart(thrallVisual, new THREE.CapsuleGeometry(0.14, 0.9, 2, 5), 0, side * 0.24, 0.4, 0, 0, 0, side * 0.06);
      addPart(thrallVisual, new THREE.ConeGeometry(0.13, 0.48, 4), 2, side * 0.7, 1.72, 0.02, 0, 0, side * 1.4);
    }
    for (const x of [-0.13, 0.13]) {
      const eye = addPart(thrallVisual, new THREE.OctahedronGeometry(0.055, 0), 4, x, 2.34, -0.29);
      eye.userData.hitZone = "head";
    }

    // Stalker: low, predatory, quadrupedal and sharply different at a glance.
    const spine = addPart(stalkerVisual, new THREE.CapsuleGeometry(0.34, 1.18, 3, 6), 0, 0, 0.92, 0.12, 0, Math.PI / 2);
    spine.scale.set(1, 1.25, 0.78);
    const stalkerHead = addPart(stalkerVisual, new THREE.IcosahedronGeometry(0.34, 1), 1, 0, 0.91, -1.08, 0.18);
    stalkerHead.scale.set(0.92, 0.72, 1.25);
    stalkerHead.userData.hitZone = "head";
    addPart(stalkerVisual, new THREE.ConeGeometry(0.24, 0.72, 5), 2, 0, 0.83, -1.47, -Math.PI / 2);
    for (const side of [-1, 1]) {
      for (const z of [-0.62, 0.58]) {
        addPart(stalkerVisual, new THREE.CapsuleGeometry(0.105, 0.68, 2, 5), 0, side * 0.5, 0.52, z, 0, 0, side * 0.66);
        addPart(stalkerVisual, new THREE.ConeGeometry(0.11, 0.42, 4), 1, side * 0.76, 0.18, z - 0.14, Math.PI / 2, 0, side * 0.16);
      }
      addPart(stalkerVisual, new THREE.ConeGeometry(0.09, 0.46, 4), 1, side * 0.27, 1.25, 0.5, 0, 0, side * 0.32);
      const eye = addPart(stalkerVisual, new THREE.SphereGeometry(0.055, 5, 4), 4, side * 0.14, 0.98, -1.36);
      eye.userData.hitZone = "head";
    }
    for (let i = 0; i < 4; i += 1) addPart(stalkerVisual, new THREE.ConeGeometry(0.075, 0.35, 4), 1, 0, 1.25, 0.15 + i * 0.27, Math.PI / 2);
    stalkerVisual.visible = false;

    return {
      id,
      kind: "thrall",
      root,
      hitMeshes,
      position: root.position,
      radius: 0.52,
      blood: 1,
      maxBlood: 1,
      alive: false,
      attacking: false,
      speed: 1,
      damage: 1,
      attackCooldown: 0,
      hurtFlash: 0,
      leapCooldown: 0,
      blockedTime: 0,
      avoidanceSign: 1,
      phase: 0,
      path: [],
      pathIndex: 0,
      repathTimer: 0,
      activeVisual: thrallVisual,
      thrallVisual,
      stalkerVisual,
      materials,
    };
  }

  private configureAppearance(enemy: EnemyRuntime): void {
    if (enemy.kind === "thrall") {
      enemy.thrallVisual.visible = true;
      enemy.stalkerVisual.visible = false;
      enemy.activeVisual = enemy.thrallVisual;
      enemy.materials[0].color.setHex(0x302326);
      enemy.materials[1].color.setHex(0xa29989);
    } else {
      enemy.thrallVisual.visible = false;
      enemy.stalkerVisual.visible = true;
      enemy.activeVisual = enemy.stalkerVisual;
      enemy.materials[0].color.setHex(0x171316);
      enemy.materials[1].color.setHex(0x696159);
    }
  }

  private updateFlash(enemy: EnemyRuntime): void {
    for (let index = 0; index < enemy.materials.length; index += 1) {
      const material = enemy.materials[index];
      const base = index === 4 ? 0.28 : 0;
      material.emissive.setRGB(base + enemy.hurtFlash * 0.72, base * 0.05 + enemy.hurtFlash * 0.035, base * 0.05 + enemy.hurtFlash * 0.025);
    }
  }

  private findEnemyId(object: THREE.Object3D): number | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (typeof current.userData.enemyId === "number") return current.userData.enemyId as number;
      current = current.parent;
    }
    return null;
  }
}
