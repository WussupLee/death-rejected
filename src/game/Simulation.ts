import type { AttackWindow, DamageResult } from "./types";

export const FIXED_DT = 1 / 120;
export class FixedSimulation {
  accumulator = 0;
  elapsed = 0;
  droppedSeconds = 0;
  advance(frameSeconds: number, step: (dt: number) => void): number {
    const accepted = Math.min(Math.max(frameSeconds, 0), 0.1);
    this.droppedSeconds += Math.max(0, frameSeconds - accepted);
    this.accumulator += accepted;
    let steps = 0;
    while (this.accumulator + 1e-9 >= FIXED_DT) {
      step(FIXED_DT);
      this.elapsed += FIXED_DT;
      this.accumulator -= FIXED_DT;
      steps++;
    }
    return steps;
  }
  reset(): void {
    this.accumulator = 0;
    this.elapsed = 0;
  }
}
export const KNIFE: AttackWindow = {
  windup: 0.09,
  active: 0.13,
  recovery: 0.22,
  range: 3.15,
  coneCosine: 0.52,
  damage: 78,
};
export function attackPhase(
  elapsed: number,
  window: AttackWindow,
): "idle" | "windup" | "active" | "recovery" {
  if (elapsed < 0 || elapsed >= window.windup + window.active + window.recovery)
    return "idle";
  return elapsed < window.windup
    ? "windup"
    : elapsed < window.windup + window.active
      ? "active"
      : "recovery";
}
export function resolveDamage(
  blood: number,
  damage: number,
  zone: "body" | "head",
): DamageResult {
  const amount = Math.max(0, damage) * (zone === "head" ? 2.25 : 1);
  return {
    amount,
    zone,
    remaining: Math.max(0, blood - amount),
    killed: blood <= amount,
  };
}
export function killReward(
  kind: string,
  style: "execution" | "slide" | "air" | "multi" | "normal",
  distance: number,
): { marks: number; blood: number; bonus: number } {
  const bonus = { execution: 20, slide: 15, air: 20, multi: 30, normal: 0 }[
    style
  ];
  return {
    marks: (kind === "stalker" ? 34 : 24) + bonus,
    bonus,
    blood: style === "execution" ? 14 : distance < 3.4 ? 7 : 0,
  };
}
