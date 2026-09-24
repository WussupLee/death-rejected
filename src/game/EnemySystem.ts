import * as THREE from "three";
import { NavigationGrid } from "./NavigationGrid";
import { resolveDamage } from "./Simulation";
import type { Environment } from "./Environment";
import { AssetLibrary, AnimatedAsset } from "./AssetLibrary";
import type {
  EnemyArchetype,
  EnemyKind,
  EnemyTarget,
  GameEvents,
  NavigationAgent,
} from "./types";
export const ARCHETYPES: Record<EnemyKind, EnemyArchetype> = {
  thrall: {
    kind: "thrall",
    blood: 76,
    speed: 3.1,
    damage: 11,
    radius: 0.44,
    attack: {
      windup: 0.36,
      active: 0.1,
      recovery: 0.58,
      range: 1.65,
      coneCosine: 0.3,
      damage: 11,
    },
  },
  stalker: {
    kind: "stalker",
    blood: 57,
    speed: 4.8,
    damage: 9,
    radius: 0.48,
    attack: {
      windup: 0.3,
      active: 0.12,
      recovery: 0.7,
      range: 1.85,
      coneCosine: 0.3,
      damage: 9,
    },
  },
};
interface Runtime extends EnemyTarget, NavigationAgent {
  actor: AnimatedAsset;
  speed: number;
  cooldown: number;
  attackTime: number;
  attackHit: boolean;
  deadTime: number;
  stagger: number;
  repathTimer: number;
  previous: THREE.Vector3;
  lastSafe: THREE.Vector3;
  progressDistance: number;
  leapTime: number;
  leapDirection: THREE.Vector3;
  animTime: number;
}
export class EnemySystem {
  readonly group = new THREE.Group();
  lastHitZone: "head" | "body" | null = null;
  private readonly pool: Runtime[] = [];
  private readonly navigation: NavigationGrid;
  private readonly ray = new THREE.Ray();
  private moon = 1;
  animationHz = 60;
  constructor(
    scene: THREE.Scene,
    private readonly environment: Environment,
    private readonly events: GameEvents,
    private readonly assets: AssetLibrary,
  ) {
    scene.add(this.group);
    this.navigation = new NavigationGrid(environment);
    for (let i = 0; i < 28; i++) {
      const kind: EnemyKind = i % 2 ? "stalker" : "thrall";
      const actor = this.assets.create(kind);
      const root = new THREE.Group();
      root.add(actor.root);
      root.visible = false;
      this.group.add(root);
      this.pool.push({
        id: i,
        kind,
        root,
        actor,
        hitMeshes: [],
        position: root.position,
        radius: ARCHETYPES[kind].radius,
        blood: 1,
        maxBlood: 1,
        alive: false,
        attacking: false,
        speed: 1,
        cooldown: 0,
        attackTime: -1,
        attackHit: false,
        deadTime: 0,
        stagger: 0,
        repathTimer: 0,
        path: [],
        pathIndex: 0,
        progressTime: 0,
        repaths: 0,
        recoveries: 0,
        previous: new THREE.Vector3(),
        lastSafe: new THREE.Vector3(),
        progressDistance: Infinity,
        leapTime: 0,
        leapDirection: new THREE.Vector3(),
        animTime: 0,
      });
    }
  }
  setMoon(moon: number): void {
    this.moon = moon;
  }
  spawn(kind: EnemyKind, player: THREE.Vector3): boolean {
    const e = this.pool.find(
      (e) => !e.alive && e.deadTime <= 0 && e.kind === kind,
    );
    if (!e) return false;
    const options = this.environment.spawnPoints.filter(
      (p) =>
        p.distanceTo(player) > 13 && !this.environment.isBlocked(p, e.radius),
    );
    if (!options.length) return false;
    const point =
      options[
        (e.id + this.moon + Math.floor(Math.random() * options.length)) %
          options.length
      ];
    const def = ARCHETYPES[kind];
    e.position.copy(point);
    e.lastSafe.copy(point);
    e.previous.copy(point);
    e.blood = def.blood + (this.moon - 1) * 3;
    e.maxBlood = e.blood;
    e.speed = def.speed + Math.min(5, this.moon) * 0.13;
    e.alive = true;
    e.root.visible = true;
    e.root.scale.setScalar(1);
    e.root.rotation.set(0, 0, 0);
    e.actor.root.position.set(0, 0, 0);
    e.actor.root.rotation.set(0, 0, 0);
    e.cooldown = 0.6;
    e.attackTime = -1;
    e.stagger = 0;
    e.deadTime = 0;
    e.leapTime = 0;
    e.path = [];
    e.pathIndex = 0;
    e.repathTimer = 0;
    e.progressTime = 0;
    e.progressDistance = Infinity;
    e.repaths = 0;
    e.recoveries = 0;
    e.actor.play("walk");
    return true;
  }
  update(dt: number, player: THREE.Vector3, active: boolean): void {
    this.navigation.clearReservations();
    for (const e of this.pool) {
      if (!e.alive) {
        if (e.deadTime > 0) {
          e.deadTime -= dt;
          e.actor.root.rotation.z = THREE.MathUtils.damp(
            e.actor.root.rotation.z,
            1.4,
            5,
            dt,
          );
          e.actor.root.position.y = -0.3 * (1 - e.deadTime / 1.3);
          if (e.deadTime <= 0) e.root.visible = false;
        }
        continue;
      }
      if (!active) continue;
      e.cooldown -= dt;
      const wasStaggered = e.stagger > 0;
      e.stagger = Math.max(0, e.stagger - dt);
      if (wasStaggered && e.stagger === 0) e.actor.play("walk");
      const distance = e.position.distanceTo(player);
      const def = ARCHETYPES[e.kind];
      const eye = e.position
        .clone()
        .add(new THREE.Vector3(0, e.kind === "thrall" ? 1.3 : 0.8, 0));
      const chest = player.clone().add(new THREE.Vector3(0, 1, 0));
      const sight = chest.clone().sub(eye);
      const visible =
        this.environment.rayDistance(
          eye,
          sight.clone().normalize(),
          sight.length(),
        ) >=
        sight.length() - 0.05;
      if (e.attackTime >= 0) {
        e.attackTime += dt;
        const w = def.attack;
        if (e.attackTime >= w.windup && !e.attackHit) {
          e.attackHit = true;
          if (
            distance < w.range &&
            Math.abs(e.position.y - player.y) < 1.2 &&
            visible
          )
            this.events.onPlayerDamage(def.damage + Math.min(this.moon, 5));
        }
        if (e.attackTime > w.windup + w.active + w.recovery) {
          e.attackTime = -1;
          e.attacking = false;
          e.cooldown = 0.2;
          e.actor.play("walk");
        }
        continue;
      }
      if (e.stagger > 0) continue;
      if (distance < def.attack.range && visible && e.cooldown <= 0) {
        e.attackTime = 0;
        e.attackHit = false;
        e.attacking = true;
        e.actor.play("attack", true);
        continue;
      }
      if (distance < def.attack.range * 0.82 && visible) {
        e.actor.play("idle");
        continue;
      }
      e.repathTimer -= dt;
      if (e.repathTimer <= 0) {
        const angle = e.id * 2.399963;
        const flank = player
          .clone()
          .add(
            new THREE.Vector3(
              Math.cos(angle) * 1.05,
              0,
              Math.sin(angle) * 1.05,
            ),
          );
        const goal =
          !this.environment.isBlocked(flank, e.radius) &&
          Math.abs(this.environment.floorAt(flank) - player.y) < 0.3
            ? flank
            : player;
        e.path = this.navigation.findPath(e.position, goal, e.radius);
        e.pathIndex = 0;
        e.repaths++;
        e.repathTimer = 0.65 + (e.id % 5) * 0.09;
      }
      while (
        e.pathIndex < e.path.length &&
        e.position.distanceTo(e.path[e.pathIndex]) < 0.06
      )
        e.pathIndex++;
      const target = e.path[e.pathIndex];
      if (!target) {
        e.progressTime += dt;
        if (e.progressTime > 1.2) {
          const safe = this.environment.findNearestOpen(e.position, e.radius);
          if (safe) {
            e.position.copy(safe);
            e.recoveries++;
          }
          e.progressTime = 0;
          e.repathTimer = 0;
        }
        continue;
      }
      if (e.leapTime <= 0) e.actor.play("walk");
      const direction = target.clone().sub(e.position).setY(0);
      const travel = direction.length();
      direction.normalize();
      // A telegraphed, sustained pounce; navigation still constrains every step.
      if (
        e.kind === "stalker" &&
        visible &&
        distance > 4 &&
        distance < 9 &&
        e.cooldown <= 0 &&
        e.leapTime <= 0
      ) {
        e.leapTime = 0.65;
        e.leapDirection.copy(direction);
        e.cooldown = 3;
        e.actor.play("attack", true);
      }
      let speed = e.speed;
      if (e.leapTime > 0) {
        e.leapTime = Math.max(0, e.leapTime - dt);
        speed = e.leapTime > 0.42 ? 0 : e.speed * 2.6;
        e.actor.root.position.y =
          Math.sin((1 - e.leapTime / 0.65) * Math.PI) * 0.55;
        if (e.leapTime === 0) {
          e.actor.root.position.y = 0;
          e.actor.play("walk");
        }
      }
      const next = e.position
        .clone()
        .addScaledVector(direction, Math.min(travel, speed * dt));
      for (const other of this.pool) {
        if (
          !other.alive ||
          other === e ||
          Math.abs(e.position.y - other.position.y) > 1
        )
          continue;
        const offset = next.clone().sub(other.position).setY(0),
          sep = offset.length();
        if (sep > 0.01 && sep < e.radius + other.radius + 0.12)
          next.addScaledVector(
            offset.normalize(),
            Math.min(0.04, (e.radius + other.radius + 0.12 - sep) * dt * 3),
          );
      }
      next.y = this.environment.floorAt(next);
      if (
        Math.abs(next.y - e.position.y) < 0.65 &&
        !this.environment.isBlocked(next, e.radius) &&
        this.navigation.reserve(target, e.id)
      )
        e.position.copy(next);
      e.root.rotation.y = Math.atan2(direction.x, direction.z);
      e.progressTime += dt;
      if (e.progressTime > 0.8) {
        const moved = e.position.distanceTo(e.previous);
        if (moved < 0.22 && distance > 2) {
          e.repathTimer = 0;
          e.recoveries++;
          // Only move to a locally connected point; never teleport across walls or floors.
          const safe = this.environment.findNearestOpen(e.position, e.radius);
          if (safe) e.position.copy(safe);
        } else e.lastSafe.copy(e.position);
        e.previous.copy(e.position);
        e.progressTime = 0;
      }
    }
  }
  render(dt: number): void {
    for (const e of this.pool)
      if (e.root.visible) {
        e.animTime += dt;
        if (e.animTime >= 1 / this.animationHz) {
          e.actor.update(e.animTime);
          e.animTime = 0;
        }
      }
  }
  hitScan(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    damage: number,
    range: number,
  ): {
    enemy: EnemyTarget;
    killed: boolean;
    distance: number;
    headshot: boolean;
  } | null {
    this.ray.set(origin, direction);
    let nearest = this.environment.rayDistance(origin, direction, range),
      chosen: Runtime | null = null,
      headshot = false;
    const hit = new THREE.Vector3();
    for (const e of this.pool)
      if (e.alive) {
        const head = e.actor.root
          .getObjectByName("head")!
          .getWorldPosition(new THREE.Vector3());
        const sphere = new THREE.Sphere(
          head,
          e.kind === "thrall" ? 0.23 : 0.25,
        );
        const headHit = this.ray.intersectSphere(sphere, hit)
          ? origin.distanceTo(hit)
          : Infinity;
        const body = new THREE.Box3(
          e.position.clone().add(new THREE.Vector3(-0.43, 0.12, -0.42)),
          e.position
            .clone()
            .add(
              new THREE.Vector3(0.43, e.kind === "thrall" ? 1.74 : 1.0, 0.42),
            ),
        );
        const bodyHit = this.ray.intersectBox(body, hit)
          ? origin.distanceTo(hit)
          : Infinity;
        const distance = Math.min(headHit, bodyHit);
        if (distance < nearest) {
          nearest = distance;
          chosen = e;
          headshot = headHit <= bodyHit;
        }
      }
    if (!chosen) return null;
    this.lastHitZone = headshot ? "head" : "body";
    const result = resolveDamage(chosen.blood, damage, this.lastHitZone);
    return {
      enemy: chosen,
      killed: this.damageEnemy(chosen, result.amount, nearest, false),
      distance: nearest,
      headshot,
    };
  }
  melee(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    damage: number,
    range: number,
    hitIds: Set<number> = new Set(),
  ): { enemy: EnemyTarget; killed: boolean; distance: number }[] {
    const hits = [];
    const forward = direction.clone().setY(0).normalize();
    for (const e of this.pool) {
      if (
        !e.alive ||
        hitIds.has(e.id) ||
        Math.abs(e.position.y - origin.y) > 1.3
      )
        continue;
      const offset = e.position.clone().sub(origin).setY(0),
        distance = offset.length();
      if (distance > range || forward.dot(offset.normalize()) < 0.52) continue;
      const from = origin.clone().add(new THREE.Vector3(0, 1, 0)),
        to = e.position.clone().add(new THREE.Vector3(0, 1, 0)),
        ray = to.sub(from);
      if (
        this.environment.rayDistance(
          from,
          ray.clone().normalize(),
          ray.length(),
        ) <
        ray.length() - 0.05
      )
        continue;
      hitIds.add(e.id);
      hits.push({
        enemy: e,
        killed: this.damageEnemy(e, damage, distance, true),
        distance,
      });
    }
    return hits;
  }
  private damageEnemy(
    e: Runtime,
    amount: number,
    distance: number,
    melee: boolean,
  ): boolean {
    e.blood = Math.max(0, e.blood - amount);
    const killed = e.blood <= 0;
    this.events.onEnemyHit(e, killed);
    if (killed) {
      e.alive = false;
      e.deadTime = 1.3;
      e.actor.play("death", true);
      this.events.onEnemyKilled(e, distance, melee);
    } else {
      e.stagger = 0.2;
      e.attackTime = -1;
      e.attacking = false;
      e.cooldown = 0.35;
      e.actor.play("hurt", true);
    }
    return killed;
  }
  clear(): void {
    for (const e of this.pool) {
      e.alive = false;
      e.deadTime = 0;
      e.root.visible = false;
    }
    this.lastHitZone = null;
  }
  get activeCount(): number {
    return this.pool.filter((e) => e.alive).length;
  }
  get snapshot(): unknown {
    return this.pool
      .filter((e) => e.alive)
      .map((e) => ({
        id: e.id,
        kind: e.kind,
        position: e.position.toArray(),
        blood: e.blood,
        path: e.path.length,
        index: e.pathIndex,
        repaths: e.repaths,
        recoveries: e.recoveries,
        attack: e.attackTime,
      }));
  }
}
