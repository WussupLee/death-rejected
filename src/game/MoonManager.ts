import type * as THREE from "three";
import { MOON } from "./config";
import type { AudioManager } from "./AudioManager";
import type { EnemySystem } from "./EnemySystem";
import type { EnemyKind, MoonDefinition, IntensityState } from "./types";

export type MoonState = "idle" | "opening" | "combat" | "intermission";
export type CombatIntensity = IntensityState;

export function moonDefinition(moon: number): MoonDefinition {
  return {
    moon,
    quota: Math.min(27, 5 + moon * 3),
    cap: Math.min(13, 4 + moon * 2),
    stalkerEvery: moon < 2 ? 999 : moon >= 5 ? 2 : 3,
    spawnInterval: Math.max(0.8, 1.6 - moon * 0.12),
  };
}
export class MoonManager {
  currentMoon = 1;
  state: MoonState = "idle";
  timer = 0;
  private quota = 0;
  private spawned = 0;
  private spawnTimer = 0;
  private pressureClock = 0;
  private playerBlood = 100;
  private mercyTimer = 0;

  constructor(
    private readonly enemies: EnemySystem,
    private readonly audio: AudioManager,
    private readonly onAnnouncement: (
      title: string,
      detail: string,
      duration?: number,
    ) => void,
    private readonly onMoonCleared: (moon: number, reward: number) => void,
  ) {}

  reset(): void {
    this.currentMoon = 1;
    this.state = "idle";
    this.timer = 0;
    this.quota = 0;
    this.spawned = 0;
    this.spawnTimer = 0;
    this.pressureClock = 0;
    this.mercyTimer = 0;
    this.playerBlood = 100;
    this.enemies.clear();
    this.audio.setCombat(false);
  }

  startRun(): void {
    this.state = "opening";
    this.timer = MOON.openingDelay;
    this.onAnnouncement("MOON I", "THE HUNT BEGINS", 2.2);
  }

  update(delta: number, playerPosition: THREE.Vector3, blood = 100): void {
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

    if (blood < this.playerBlood && blood < 30) this.mercyTimer = 3;
    this.playerBlood = blood;
    this.mercyTimer = Math.max(0, this.mercyTimer - delta);
    this.spawnTimer -= delta;
    this.pressureClock += delta;
    const definition = moonDefinition(this.currentMoon);
    const maxAlive =
      this.intensity === "build"
        ? Math.ceil(definition.cap * 0.65)
        : definition.cap;
    if (
      this.spawned < this.quota &&
      this.spawnTimer <= 0 &&
      this.enemies.activeCount < maxAlive &&
      !["anticipation", "relief"].includes(this.intensity)
    ) {
      const kind = this.chooseEnemyKind();
      if (this.enemies.spawn(kind, playerPosition)) {
        this.spawned += 1;
        const intensityScale =
          this.intensity === "peak"
            ? 0.55
            : this.intensity === "relief"
              ? 1.55
              : 1;
        this.spawnTimer = definition.spawnInterval * intensityScale;
      }
    }
    if (this.spawned >= this.quota && this.enemies.activeCount === 0)
      this.clearMoon();
  }

  get remaining(): number {
    return Math.max(0, this.quota - this.spawned) + this.enemies.activeCount;
  }

  get countdown(): number {
    return Math.max(0, Math.ceil(this.timer));
  }

  get intensity(): CombatIntensity {
    if (this.state !== "combat") return "anticipation";
    if (this.spawned >= this.quota) return "cleanup";
    if (this.mercyTimer > 0) return "relief";
    const cycle = this.pressureClock % 17;
    if (cycle < 3.2) return "anticipation";
    if (cycle < 8.5) return "build";
    if (cycle < 13.2) return "peak";
    return "relief";
  }

  private beginCombat(): void {
    this.state = "combat";
    this.quota = moonDefinition(this.currentMoon).quota;
    this.spawned = 0;
    this.spawnTimer = 0.2;
    this.pressureClock = 0;
    this.enemies.setMoon(this.currentMoon);
    this.audio.setCombat(true);
    this.audio.moon();
    this.onAnnouncement(
      `MOON ${this.roman}`,
      this.currentMoon === 5 ? "ELITE PRESSURE" : "SURVIVE",
      1.8,
    );
  }

  private clearMoon(): void {
    const cleared = this.currentMoon;
    const reward = 85 + cleared * 35;
    this.state = "intermission";
    this.timer = MOON.intermissionSeconds;
    this.audio.setCombat(false);
    this.onMoonCleared(cleared, reward);
    this.onAnnouncement(
      `MOON ${this.roman} CLEARED`,
      `+${reward} MARKS // NEXT MOON IN 20`,
      3.2,
    );
  }

  private chooseEnemyKind(): EnemyKind {
    if (this.currentMoon === 1) return "thrall";
    return (this.spawned + 1) %
      moonDefinition(this.currentMoon).stalkerEvery ===
      0
      ? "stalker"
      : "thrall";
  }

  private get roman(): string {
    const values: Array<[number, string]> = [
      [10, "X"],
      [9, "IX"],
      [5, "V"],
      [4, "IV"],
      [1, "I"],
    ];
    let remaining = this.currentMoon;
    let text = "";
    for (const [value, numeral] of values) {
      while (remaining >= value) {
        text += numeral;
        remaining -= value;
      }
    }
    return text;
  }
}
