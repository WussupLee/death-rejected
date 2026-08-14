import * as THREE from "three";
import { COLORS } from "./config";
import { randomRange } from "./math";
import type { Environment } from "./Environment";
import type { EnemyKind, EnemyTarget, GameEvents } from "./types";

interface EnemyRuntime extends EnemyTarget {
  speed: number;
  damage: number;
  attackCooldown: number;
  hurtFlash: number;
  leapCooldown: number;
  phase: number;
  materials: THREE.MeshStandardMaterial[];
}

export class EnemySystem {
  readonly group = new THREE.Group();
  private readonly pool: EnemyRuntime[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly liveRoots: THREE.Object3D[] = [];
  private moon = 1;

  constructor(
    scene: THREE.Scene,
    private readonly environment: Environment,
    private readonly events: GameEvents,
  ) {
    this.group.name = "Enemy Pool";
    scene.add(this.group);
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
    enemy.phase = randomRange(0, Math.PI * 2);
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
      const directionX = dx / distance;
      const directionZ = dz / distance;
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
        const next = enemy.position.clone();
        next.x += (directionX * moveSpeed + separation.x) * delta;
        next.z += (directionZ * moveSpeed + separation.z) * delta;
        if (!this.environment.isBlocked(next, enemy.radius)) enemy.position.copy(next);
        else {
          const alternate = enemy.position.clone();
          alternate.x += directionZ * moveSpeed * delta;
          alternate.z -= directionX * moveSpeed * delta;
          if (!this.environment.isBlocked(alternate, enemy.radius)) enemy.position.copy(alternate);
        }
      }

      enemy.phase += delta * (enemy.kind === "stalker" ? 11 : 6);
      const visual = enemy.root.children[0];
      visual.position.y = Math.sin(enemy.phase) * (enemy.kind === "stalker" ? 0.07 : 0.035);
      visual.rotation.z = Math.sin(enemy.phase * 0.5) * 0.035;

      enemy.attacking = distance < (enemy.kind === "stalker" ? 1.65 : 1.3);
      if (enemy.attacking && enemy.attackCooldown <= 0) {
        this.events.onPlayerDamage(enemy.damage);
        enemy.attackCooldown = enemy.kind === "stalker" ? 0.72 : 1.05;
      }
    }
  }

  hitScan(origin: THREE.Vector3, direction: THREE.Vector3, damage: number, range: number): { enemy: EnemyTarget; killed: boolean; distance: number } | null {
    this.liveRoots.length = 0;
    for (const enemy of this.pool) if (enemy.alive) this.liveRoots.push(enemy.root);
    this.raycaster.set(origin, direction);
    this.raycaster.far = range;
    const intersections = this.raycaster.intersectObjects(this.liveRoots, true);
    for (const intersection of intersections) {
      const id = this.findEnemyId(intersection.object);
      if (id == null) continue;
      const enemy = this.pool[id];
      if (!enemy?.alive) continue;
      const killed = this.damageEnemy(enemy, damage, intersection.distance, false);
      return { enemy, killed, distance: intersection.distance };
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

  private createEnemy(id: number): EnemyRuntime {
    const root = new THREE.Group();
    root.visible = false;
    root.userData.enemyId = id;
    const visual = new THREE.Group();
    root.add(visual);
    this.group.add(root);

    const materials = [
      new THREE.MeshStandardMaterial({ color: 0x3a3030, roughness: 0.88, emissive: 0x000000 }),
      new THREE.MeshStandardMaterial({ color: COLORS.bone, roughness: 0.75, emissive: 0x000000 }),
      new THREE.MeshStandardMaterial({ color: COLORS.blood, roughness: 0.55, emissive: 0x2a0005 }),
    ];
    const hitMeshes: THREE.Object3D[] = [];
    const addPart = (geometry: THREE.BufferGeometry, materialIndex: number, x: number, y: number, z: number, rx = 0, rz = 0) => {
      const part = new THREE.Mesh(geometry, materials[materialIndex]);
      part.position.set(x, y, z);
      part.rotation.x = rx;
      part.rotation.z = rz;
      part.castShadow = true;
      part.userData.enemyId = id;
      visual.add(part);
      hitMeshes.push(part);
      return part;
    };
    addPart(new THREE.CapsuleGeometry(0.42, 0.95, 3, 7), 0, 0, 1.25, 0);
    addPart(new THREE.IcosahedronGeometry(0.38, 0), 1, 0, 2.18, 0);
    addPart(new THREE.CapsuleGeometry(0.13, 0.8, 2, 5), 0, -0.48, 1.28, 0, 0, -0.25);
    addPart(new THREE.CapsuleGeometry(0.13, 0.8, 2, 5), 0, 0.48, 1.28, 0, 0, 0.25);
    addPart(new THREE.CapsuleGeometry(0.15, 0.86, 2, 5), 0, -0.22, 0.45, 0, 0, 0.08);
    addPart(new THREE.CapsuleGeometry(0.15, 0.86, 2, 5), 0, 0.22, 0.45, 0, 0, -0.08);
    for (const x of [-0.16, 0.16]) addPart(new THREE.SphereGeometry(0.055, 6, 4), 2, x, 2.23, -0.34);

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
      phase: 0,
      materials,
    };
  }

  private configureAppearance(enemy: EnemyRuntime): void {
    const visual = enemy.root.children[0] as THREE.Group;
    if (enemy.kind === "thrall") {
      visual.scale.set(1, 1, 1);
      visual.rotation.x = 0;
      enemy.materials[0].color.setHex(0x342829);
      enemy.materials[1].color.setHex(0x9d9182);
    } else {
      visual.scale.set(1.16, 0.68, 1.36);
      visual.rotation.x = Math.PI / 2.8;
      enemy.materials[0].color.setHex(0x171316);
      enemy.materials[1].color.setHex(0x5c5550);
    }
  }

  private updateFlash(enemy: EnemyRuntime): void {
    for (const material of enemy.materials) {
      material.emissive.setRGB(enemy.hurtFlash * 0.7, enemy.hurtFlash * 0.035, enemy.hurtFlash * 0.025);
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
