import * as THREE from "three";
import { WORLD } from "./config";

export const BALCONY_Y = 5.4;
export const RAMPS = [-9, 9].map((x) => ({
  x,
  halfWidth: 1.7,
  start: 7,
  end: 19,
}));
export interface Solid {
  name: string;
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  bottom: number;
  top: number;
}
export const SOLIDS: Solid[] = [
  ...[-1, 1].flatMap((side) =>
    Array.from({ length: 7 }, (_, i) => ({
      name: `pillar-${side}-${i}`,
      x: side === 1 && Math.abs(i - 3) === 1 ? (i - 3) * 5 : (i - 3) * 8,
      z: side * 18.2,
      halfX: 0.56,
      halfZ: 0.56,
      bottom: 0,
      top: 5.1,
    })),
  ),
  {
    name: "directory",
    x: -19,
    z: 2.5,
    halfX: 1.1,
    halfZ: 0.75,
    bottom: 0,
    top: 3.9,
  },
  {
    name: "shop-counter",
    x: 26.7,
    z: -4.5,
    halfX: 1.35,
    halfZ: 5.15,
    bottom: 0,
    top: 1.4,
  },
];
export class WorldLayout {
  rampHeight(x: number, z: number, margin = 0): number | null {
    for (const ramp of RAMPS)
      if (
        Math.abs(x - ramp.x) <= ramp.halfWidth - margin &&
        z >= ramp.start &&
        z <= ramp.end
      )
        return ((z - ramp.start) / (ramp.end - ramp.start)) * BALCONY_Y;
    return null;
  }
  onBalcony(x: number, z: number, margin = 0): boolean {
    return (
      Math.abs(x) < 29.5 - margin &&
      Math.abs(z) < 23.5 - margin &&
      (Math.abs(x) >= 24 + margin || Math.abs(z) >= 18 + margin)
    );
  }
  floorAt(position: THREE.Vector3): number {
    const ramp = this.rampHeight(position.x, position.z);
    if (ramp !== null) return ramp;
    return position.y >= BALCONY_Y - 0.7 &&
      this.onBalcony(position.x, position.z)
      ? BALCONY_Y
      : 0;
  }
  isBlocked(position: THREE.Vector3, radius: number): boolean {
    const { x, y, z } = position;
    if (
      Math.abs(x) + radius > WORLD.halfWidth - 0.5 ||
      Math.abs(z) + radius > WORLD.halfDepth - 0.5
    )
      return true;
    const ramp = this.rampHeight(x, z);
    if (ramp !== null && y < ramp - 0.2) return true;
    if (y < 0.85 && Math.hypot(x, z) < 4.55 + radius) return true;
    if (y < 2.95 && Math.hypot(x, z) < 1.75 + radius) return true;
    for (const s of SOLIDS) {
      if (y >= s.top || y + 1.2 <= s.bottom) continue;
      if (
        Math.hypot(
          x - THREE.MathUtils.clamp(x, s.x - s.halfX, s.x + s.halfX),
          z - THREE.MathUtils.clamp(z, s.z - s.halfZ, s.z + s.halfZ),
        ) < radius
      )
        return true;
    }
    // The inner glass rail has openings at both escalators. Airborne players can vault it.
    if (y >= BALCONY_Y - 0.5 && y < BALCONY_Y + 1.05) {
      const atRamp = RAMPS.some(
        (r) => Math.abs(x - r.x) < r.halfWidth + 0.15 && z > 16.5,
      );
      if (
        !atRamp &&
        Math.abs(x) < 24 &&
        Math.abs(Math.abs(z) - 17.95) < radius + 0.06
      )
        return true;
      if (Math.abs(z) < 18 && Math.abs(Math.abs(x) - 23.95) < radius + 0.06)
        return true;
    }
    return false;
  }
  segmentClear(
    from: THREE.Vector3,
    to: THREE.Vector3,
    radius: number,
  ): boolean {
    const steps = Math.ceil(from.distanceTo(to) / 0.22);
    for (let i = 1; i <= steps; i++)
      if (this.isBlocked(from.clone().lerp(to, i / steps), radius))
        return false;
    return true;
  }
  rayDistance(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    range: number,
  ): number {
    const ray = new THREE.Ray(origin, direction);
    const target = new THREE.Vector3();
    let closest = range;
    const boxes = [
      ...SOLIDS,
      {
        name: "north-wall",
        x: 0,
        z: -24,
        halfX: 30,
        halfZ: 0.3,
        bottom: 0,
        top: 10,
      },
      {
        name: "south-wall",
        x: 0,
        z: 24,
        halfX: 30,
        halfZ: 0.3,
        bottom: 0,
        top: 10,
      },
      {
        name: "east-wall",
        x: 30,
        z: 0,
        halfX: 0.3,
        halfZ: 24,
        bottom: 0,
        top: 10,
      },
      {
        name: "west-wall",
        x: -30,
        z: 0,
        halfX: 0.3,
        halfZ: 24,
        bottom: 0,
        top: 10,
      },
      {
        name: "basin",
        x: 0,
        z: 0,
        halfX: 3.7,
        halfZ: 3.7,
        bottom: 0,
        top: 0.85,
      },
      {
        name: "pedestal",
        x: 0,
        z: 0,
        halfX: 1.3,
        halfZ: 1.3,
        bottom: 0,
        top: 2.95,
      },
      ...[-1, 1].flatMap((side) => [
        {
          name: "slab",
          x: 0,
          z: side * 20.8,
          halfX: 29.5,
          halfZ: 2.8,
          bottom: BALCONY_Y - 0.35,
          top: BALCONY_Y,
        },
        {
          name: "slab",
          x: side * 26.75,
          z: 0,
          halfX: 2.75,
          halfZ: 18,
          bottom: BALCONY_Y - 0.35,
          top: BALCONY_Y,
        },
      ]),
    ];
    for (const s of boxes) {
      if (
        ray.intersectBox(
          new THREE.Box3(
            new THREE.Vector3(s.x - s.halfX, s.bottom, s.z - s.halfZ),
            new THREE.Vector3(s.x + s.halfX, s.top, s.z + s.halfZ),
          ),
          target,
        )
      )
        closest = Math.min(closest, origin.distanceTo(target));
    }
    // Sample the escalator wedge; shots below its tread cannot pass through it.
    for (let d = 0.1; d < closest; d += 0.18) {
      target.copy(direction).multiplyScalar(d).add(origin);
      const height = this.rampHeight(target.x, target.z);
      if (
        target.y < 0 ||
        (height !== null && target.y < height && target.y > 0)
      )
        return d;
    }
    return closest;
  }
  findNearestOpen(
    position: THREE.Vector3,
    radius: number,
  ): THREE.Vector3 | null {
    for (let ring = 0.35; ring <= 2.1; ring += 0.35)
      for (let i = 0; i < 16; i++) {
        const candidate = position
          .clone()
          .add(
            new THREE.Vector3(
              Math.cos((i * Math.PI) / 8) * ring,
              0,
              Math.sin((i * Math.PI) / 8) * ring,
            ),
          );
        candidate.y = this.floorAt(candidate);
        if (
          Math.abs(candidate.y - position.y) < 0.7 &&
          !this.isBlocked(candidate, radius) &&
          this.segmentClear(position, candidate, radius)
        )
          return candidate;
      }
    return null;
  }
}
