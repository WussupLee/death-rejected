import * as THREE from "three";

export function damp(
  current: number,
  target: number,
  lambda: number,
  delta: number,
): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * delta));
}

export function clampLength2D(vector: THREE.Vector3, max: number): void {
  const length = Math.hypot(vector.x, vector.z);
  if (length > max) {
    vector.x = (vector.x / length) * max;
    vector.z = (vector.z / length) * max;
  }
}

export function approach(
  current: number,
  target: number,
  amount: number,
): number {
  if (current < target) return Math.min(current + amount, target);
  return Math.max(current - amount, target);
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function circleIntersects(
  ax: number,
  az: number,
  ar: number,
  bx: number,
  bz: number,
  br: number,
): boolean {
  return Math.hypot(ax - bx, az - bz) < ar + br;
}
