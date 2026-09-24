import * as THREE from "three";
import { WORLD } from "./config";
import type { Environment } from "./Environment";

type Node = { x: number; z: number; g: number; f: number; parent?: Node };

export class NavigationGrid {
  private readonly cell = 2;
  private readonly columns = Math.floor((WORLD.halfWidth * 2) / this.cell);
  private readonly rows = Math.floor((WORLD.halfDepth * 2) / this.cell);

  constructor(private readonly environment: Environment) {}

  findPath(from: THREE.Vector3, to: THREE.Vector3, radius: number): THREE.Vector3[] {
    const start = this.toCell(from);
    const goal = this.toCell(to);
    const open: Node[] = [{ ...start, g: 0, f: this.heuristic(start, goal) }];
    const closed = new Set<string>();
    const best = new Map<string, number>([[this.key(start.x, start.z), 0]]);
    const directions = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ];

    while (open.length > 0 && closed.size < 850) {
      open.sort((a, b) => a.f - b.f);
      const current = open.shift()!;
      const currentKey = this.key(current.x, current.z);
      if (closed.has(currentKey)) continue;
      closed.add(currentKey);
      if (current.x === goal.x && current.z === goal.z) return this.reconstruct(current);

      for (const [dx, dz] of directions) {
        const x = current.x + dx;
        const z = current.z + dz;
        if (x < 0 || z < 0 || x >= this.columns || z >= this.rows) continue;
        const key = this.key(x, z);
        if (closed.has(key)) continue;
        const position = this.toWorld(x, z);
        if (this.environment.isBlocked(position, radius + 0.18)) continue;
        if (dx !== 0 && dz !== 0) {
          if (this.environment.isBlocked(this.toWorld(current.x + dx, current.z), radius) ||
              this.environment.isBlocked(this.toWorld(current.x, current.z + dz), radius)) continue;
        }
        const nextG = current.g + (dx !== 0 && dz !== 0 ? 1.414 : 1);
        if (nextG >= (best.get(key) ?? Infinity)) continue;
        best.set(key, nextG);
        open.push({ x, z, g: nextG, f: nextG + this.heuristic({ x, z }, goal), parent: current });
      }
    }
    return [];
  }

  private reconstruct(end: Node): THREE.Vector3[] {
    const path: THREE.Vector3[] = [];
    let current: Node | undefined = end;
    while (current?.parent) {
      path.push(this.toWorld(current.x, current.z));
      current = current.parent;
    }
    path.reverse();
    return this.simplify(path);
  }

  private simplify(path: THREE.Vector3[]): THREE.Vector3[] {
    if (path.length < 3) return path;
    const result = [path[0]];
    let previousX = Math.sign(path[1].x - path[0].x);
    let previousZ = Math.sign(path[1].z - path[0].z);
    for (let i = 2; i < path.length; i += 1) {
      const nextX = Math.sign(path[i].x - path[i - 1].x);
      const nextZ = Math.sign(path[i].z - path[i - 1].z);
      if (nextX !== previousX || nextZ !== previousZ) result.push(path[i - 1]);
      previousX = nextX;
      previousZ = nextZ;
    }
    result.push(path[path.length - 1]);
    return result;
  }

  private toCell(position: THREE.Vector3): { x: number; z: number } {
    return {
      x: THREE.MathUtils.clamp(Math.floor((position.x + WORLD.halfWidth) / this.cell), 0, this.columns - 1),
      z: THREE.MathUtils.clamp(Math.floor((position.z + WORLD.halfDepth) / this.cell), 0, this.rows - 1),
    };
  }

  private toWorld(x: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(-WORLD.halfWidth + (x + 0.5) * this.cell, 0, -WORLD.halfDepth + (z + 0.5) * this.cell);
  }

  private heuristic(a: { x: number; z: number }, b: { x: number; z: number }): number {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  private key(x: number, z: number): string { return `${x}:${z}`; }
}
