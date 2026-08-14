import type * as THREE from "three";

export type GamePhase = "landing" | "playing" | "intermission" | "dying" | "tally" | "paused";
export type EnemyKind = "thrall" | "stalker";
export type WeaponId = "pistol" | "shotgun";

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
