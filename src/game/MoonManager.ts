import type * as THREE from "three";
import { MOON } from "./config";
import type { AudioManager } from "./AudioManager";
import type { EnemySystem } from "./EnemySystem";
import type { EnemyKind } from "./types";

export type MoonState = "idle" | "opening" | "combat" | "intermission";

export class MoonManager {
  currentMoon = 1;
  state: MoonState = "idle";
  timer = 0;
  private quota = 0;
  private spawned = 0;
  private spawnTimer = 0;

  constructor(
    private readonly enemies: EnemySystem,
    private readonly audio: AudioManager,
    private readonly onAnnouncement: (title: string, detail: string, duration?: number) => void,
    private readonly onMoonCleared: (moon: number, reward: number) => void,
  ) {}

  reset(): void {
    this.currentMoon = 1;
    this.state = "idle";
    this.timer = 0;
    this.quota = 0;
    this.spawned = 0;
    this.spawnTimer = 0;
    this.enemies.clear();
    this.audio.setCombat(false);
  }

  startRun(): void {
    this.state = "opening";
    this.timer = MOON.openingDelay;
    this.onAnnouncement("MOON I", "THE HUNT BEGINS", 2.2);
  }

  update(delta: number, playerPosition: THREE.Vector3): void {
    if (this.state === "idle") return;
    if (this.state === "opening") {
      this.timer -= delta;
      if (this.timer <= 0) this.beginCombat();
      return;
    }
    if (this.state === "intermission") {
      this.timer -= delta;
      if (this.timer <= 0) {
        this.currentMoon += 1;
        this.beginCombat();
      }
      return;
    }

    this.spawnTimer -= delta;
    if (this.spawned < this.quota && this.spawnTimer <= 0) {
      const kind = this.chooseEnemyKind();
      if (this.enemies.spawn(kind, playerPosition)) {
        this.spawned += 1;
        this.spawnTimer = MOON.spawnInterval * Math.max(0.52, 1 - this.currentMoon * 0.035);
      }
    }
    if (this.spawned >= this.quota && this.enemies.activeCount === 0) this.clearMoon();
  }

  get remaining(): number {
    return Math.max(0, this.quota - this.spawned) + this.enemies.activeCount;
  }

  get countdown(): number {
    return Math.max(0, Math.ceil(this.timer));
  }

  private beginCombat(): void {
    this.state = "combat";
    this.quota = Math.min(27, 5 + this.currentMoon * 3);
    this.spawned = 0;
    this.spawnTimer = 0.2;
    this.enemies.setMoon(this.currentMoon);
    this.audio.setCombat(true);
    this.audio.moon();
    this.onAnnouncement(`MOON ${this.roman}`, this.currentMoon === 5 ? "ELITE PRESSURE" : "SURVIVE", 1.8);
  }

  private clearMoon(): void {
    const cleared = this.currentMoon;
    const reward = 85 + cleared * 35;
    this.state = "intermission";
    this.timer = MOON.intermissionSeconds;
    this.audio.setCombat(false);
    this.onMoonCleared(cleared, reward);
    this.onAnnouncement(`MOON ${this.roman} CLEARED`, `+${reward} MARKS // NEXT MOON IN 20`, 3.2);
  }

  private chooseEnemyKind(): EnemyKind {
    if (this.currentMoon === 1) return "thrall";
    const stalkerChance = this.currentMoon === 5 ? 0.48 : Math.min(0.42, 0.12 + this.currentMoon * 0.055);
    return Math.random() < stalkerChance ? "stalker" : "thrall";
  }

  private get roman(): string {
    const values: Array<[number, string]> = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
    let remaining = this.currentMoon;
    let text = "";
    for (const [value, numeral] of values) {
      while (remaining >= value) { text += numeral; remaining -= value; }
    }
    return text;
  }
}
