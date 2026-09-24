import type * as THREE from "three";

export type GamePhase =
  | "landing"
  | "playing"
  | "intermission"
  | "dying"
  | "tally"
  | "paused";
export type EnemyKind = "thrall" | "stalker";
export type WeaponId = "pistol" | "shotgun";

export type InputAction =
  | "forward"
  | "back"
  | "left"
  | "right"
  | "sprint"
  | "jump"
  | "crouch"
  | "fire"
  | "aim"
  | "reload"
  | "knife"
  | "interact"
  | "pause";
export interface MovementProfile {
  maxBlood: number;
  walkSpeed: number;
  sprintSpeed: number;
  groundAcceleration: number;
  airAcceleration: number;
  groundFriction: number;
  jumpSpeed: number;
  slideDuration: number;
  slideBoost: number;
}
export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  clipSize: number;
  reserveSize: number;
  damage: number;
  fireDelay: number;
  reloadTime: number;
  range: number;
  pellets: number;
  spread: number;
}
export interface AttackWindow {
  windup: number;
  active: number;
  recovery: number;
  range: number;
  coneCosine: number;
  damage: number;
}
export interface DamageResult {
  amount: number;
  zone: "head" | "body";
  killed: boolean;
  remaining: number;
}
export interface EnemyArchetype {
  kind: EnemyKind;
  blood: number;
  speed: number;
  damage: number;
  radius: number;
  attack: AttackWindow;
}
export interface NavigationAgent {
  path: THREE.Vector3[];
  pathIndex: number;
  progressTime: number;
  repaths: number;
  recoveries: number;
}
export type IntensityState =
  | "anticipation"
  | "build"
  | "peak"
  | "relief"
  | "cleanup";
export interface MoonDefinition {
  moon: number;
  quota: number;
  cap: number;
  stalkerEvery: number;
  spawnInterval: number;
}
export interface QualityProfile {
  id: "high" | "balanced" | "performance";
  scale: number;
  shadows: boolean;
  reflections: boolean;
  particles: number;
  animationHz: number;
  postProcessing: boolean;
}
export interface AssetManifest {
  version: number;
  assets: Record<
    string,
    { url: string; source: string; animations: string[]; triangles: number }
  >;
}

export interface ShotResult {
  fired: boolean;
  hit: boolean;
  killed: boolean;
}

export interface EnemyTarget {
  id: number;
  kind: EnemyKind;
  root: THREE.Group;
  hitMeshes: THREE.Object3D[];
  position: THREE.Vector3;
  radius: number;
  blood: number;
  maxBlood: number;
  alive: boolean;
  attacking: boolean;
}

export interface GameEvents {
  onPlayerDamage(amount: number): void;
  onEnemyKilled(enemy: EnemyTarget, distance: number, melee: boolean): void;
  onEnemyHit(enemy: EnemyTarget, killed: boolean): void;
}
