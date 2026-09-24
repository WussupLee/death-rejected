import * as THREE from "three";
import { WorldLayout, BALCONY_Y } from "./WorldLayout";
type Node = {
  x: number;
  z: number;
  layer: number;
  y: number;
  g: number;
  f: number;
  parent?: Node;
};
export class NavigationGrid {
  private readonly reservations = new Map<string, number>();
  constructor(private readonly world: WorldLayout) {}
  clearReservations(): void {
    this.reservations.clear();
  }
  reserve(position: THREE.Vector3, id: number): boolean {
    const key = [
      Math.round(position.x),
      Math.round(position.z),
      Math.round(position.y),
    ].join(":");
    const owner = this.reservations.get(key);
    if (owner !== undefined && owner !== id) return false;
    this.reservations.set(key, id);
    return true;
  }
  findPath(
    from: THREE.Vector3,
    to: THREE.Vector3,
    radius: number,
  ): THREE.Vector3[] {
    const key = (n: { x: number; z: number; layer: number }) =>
      [n.x, n.z, n.layer].join(":");
    const position = (n: { x: number; z: number; y: number }) =>
      new THREE.Vector3(n.x, n.y, n.z);
    const nodeAt = (x: number, z: number, layer: number): Node | null => {
      if (Math.abs(x) > 29 || Math.abs(z) > 23) return null;
      const ramp = this.world.rampHeight(x, z, radius);
      if (layer === 1 && !this.world.onBalcony(x, z, radius)) return null;
      const y = layer === 1 ? BALCONY_Y : (ramp ?? 0);
      const n = { x, z, layer, y, g: 0, f: 0 };
      return this.world.isBlocked(position(n), radius + 0.04) ? null : n;
    };
    const nearest = (point: THREE.Vector3): Node | null => {
      let best: Node | null = null,
        distance = Infinity;
      for (let dx = -2; dx <= 2; dx++)
        for (let dz = -2; dz <= 2; dz++)
          for (let layer = 0; layer < 2; layer++) {
            const n = nodeAt(
              Math.round(point.x) + dx,
              Math.round(point.z) + dz,
              layer,
            );
            if (!n || Math.abs(n.y - point.y) > 1.2) continue;
            const d = position(n).distanceTo(point);
            if (
              d < distance &&
              this.world.segmentClear(point, position(n), radius)
            ) {
              best = n;
              distance = d;
            }
          }
      return best;
    };
    const start = nearest(from),
      goal = nearest(to);
    if (!start || !goal) return [];
    const open: Node[] = [start],
      costs = new Map([[key(start), 0]]),
      closed = new Set<string>();
    while (open.length && closed.size < 5500) {
      open.sort((a, b) => a.f - b.f);
      const current = open.shift()!;
      if (closed.has(key(current))) continue;
      if (key(current) === key(goal)) {
        const path: THREE.Vector3[] = [];
        let n: Node | undefined = current;
        while (n) {
          path.push(position(n));
          n = n.parent;
        }
        path.reverse();
        if (
          this.world.segmentClear(path[path.length - 1], to, radius) &&
          Math.abs(goal.y - to.y) < 0.6
        )
          path.push(to.clone());
        return path;
      }
      closed.add(key(current));
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
        [0, 0],
      ])
        for (let layer = 0; layer < 2; layer++) {
          const n = nodeAt(current.x + dx, current.z + dz, layer);
          if (!n || closed.has(key(n)) || Math.abs(n.y - current.y) > 0.65)
            continue;
          if (
            !this.world.segmentClear(
              position(current),
              position(n),
              radius + 0.02,
            )
          )
            continue;
          const g = current.g + Math.hypot(dx, dz, n.y - current.y) + 0.01;
          if (g >= (costs.get(key(n)) ?? Infinity)) continue;
          costs.set(key(n), g);
          n.g = g;
          n.f = g + position(n).distanceTo(position(goal));
          n.parent = current;
          open.push(n);
        }
    }
    return [];
  }
}
