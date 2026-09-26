import type * as THREE from "three";
import type { QualityProfile } from "./types";
import { isTouchDevice } from "./TouchControls";
export const QUALITY: Record<QualityProfile["id"], QualityProfile> = {
  high: {
    id: "high",
    scale: 1,
    shadows: true,
    reflections: true,
    particles: 96,
    animationHz: 60,
    postProcessing: true,
  },
  balanced: {
    id: "balanced",
    scale: 0.8,
    shadows: false,
    reflections: true,
    particles: 48,
    animationHz: 30,
    postProcessing: true,
  },
  performance: {
    id: "performance",
    scale: 0.6,
    shadows: false,
    reflections: false,
    particles: 20,
    animationHz: 20,
    postProcessing: false,
  },
};
export class PerformanceGovernor {
  private sample = 0;
  private frames = 0;
  private cooldown = 0;
  private current: QualityProfile = QUALITY.balanced;
  private manual = false;
  averageMs = 0;
  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.apply(isTouchDevice() ? "performance" : "balanced");
  }
  update(dt: number): void {
    if (dt <= 0 || dt > 1) return;
    this.sample += dt;
    this.frames++;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.sample < 3) return;
    this.averageMs = (this.sample / this.frames) * 1000;
    if (!this.manual && this.cooldown === 0) {
      const order = ["performance", "balanced", "high"] as const;
      const index = order.indexOf(this.current.id);
      if (this.averageMs > 21 && index > 0) this.apply(order[index - 1]);
      else if (this.averageMs < 14 && index < (isTouchDevice() ? 1 : 2))
        this.apply(order[index + 1]);
    }
    this.sample = 0;
    this.frames = 0;
  }
  select(id: QualityProfile["id"] | "auto"): void {
    this.manual = id !== "auto";
    if (id !== "auto") this.apply(id);
  }
  resize(): void {
    this.apply(this.current.id);
  }
  get label(): string {
    return this.current.id;
  }
  get profile(): QualityProfile {
    return this.current;
  }
  private apply(id: QualityProfile["id"]): void {
    this.current = QUALITY[id];
    this.cooldown = 8;
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, isTouchDevice() ? 1.25 : 1.5) *
        this.current.scale,
    );
    this.renderer.shadowMap.enabled = this.current.shadows;
    document.documentElement.dataset.quality = id;
  }
}
