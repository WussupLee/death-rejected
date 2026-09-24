import * as THREE from "three";

export class PerformanceGovernor {
  private sampleTime = 0;
  private frameTime = 0;
  private frames = 0;
  private quality: "high" | "balanced" | "performance" = "high";

  constructor(private readonly renderer: THREE.WebGLRenderer) {}

  update(delta: number): void {
    this.sampleTime += delta;
    this.frameTime += delta;
    this.frames += 1;
    if (this.sampleTime < 2.4) return;

    const averageMs = (this.frameTime / Math.max(1, this.frames)) * 1000;
    if (averageMs > 24 && this.quality !== "performance") this.apply("performance");
    else if (averageMs > 18 && this.quality === "high") this.apply("balanced");
    else if (averageMs < 14.8 && this.quality === "performance") this.apply("balanced");
    else if (averageMs < 13.2 && this.quality === "balanced") this.apply("high");
    this.sampleTime = 0;
    this.frameTime = 0;
    this.frames = 0;
  }

  resize(): void {
    this.apply(this.quality);
  }

  get label(): string {
    return this.quality;
  }

  private apply(quality: "high" | "balanced" | "performance"): void {
    this.quality = quality;
    const cap = quality === "high" ? 1.6 : quality === "balanced" ? 1.25 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, cap));
    this.renderer.shadowMap.enabled = quality !== "performance";
    document.documentElement.dataset.quality = quality;
  }
}
