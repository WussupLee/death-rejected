import { toRoman } from "./config";
import type { GamePhase } from "./types";

export class UIManager {
  private readonly landing = this.get("landing");
  private readonly pause = this.get("pause-screen");
  private readonly death = this.get("death-screen");
  private readonly tally = this.get("tally-screen");
  private readonly hud = this.get("hud");
  private readonly announcement = this.get("announcement");
  private readonly rewardFeed = this.get("reward-feed");
  private readonly interactPrompt = this.get("interact-prompt");
  private readonly hitMarker = this.get("hit-marker");
  private readonly damageFlash = this.get("damage-flash");
  private announcementTimer = 0;
  private hitTimer = 0;
  private damageTimer = 0;
  private rewardId = 0;

  readonly beginButton = this.button("begin-button");
  readonly resumeButton = this.button("resume-button");
  readonly restartButton = this.button("restart-button");

  constructor() {
    this.drawPortrait();
  }

  update(delta: number): void {
    this.announcementTimer -= delta;
    if (this.announcementTimer <= 0) this.announcement.classList.remove("announcement--visible");
    this.hitTimer -= delta;
    if (this.hitTimer <= 0) this.hitMarker.classList.remove("hit-marker--visible");
    this.damageTimer -= delta;
    if (this.damageTimer <= 0) this.damageFlash.classList.remove("damage-flash--visible");
  }

  setPhase(phase: GamePhase): void {
    this.landing.classList.toggle("overlay--visible", phase === "landing");
    this.pause.classList.toggle("overlay--visible", phase === "paused");
    this.death.classList.toggle("overlay--visible", phase === "dying");
    this.tally.classList.toggle("overlay--visible", phase === "tally");
    this.hud.classList.toggle("hud--hidden", !["playing", "intermission", "paused"].includes(phase));
  }

  setAttempt(attempts: number): void {
    this.get("attempt-number").textContent = String(attempts + 1).padStart(3, "0");
  }

  updateHud(data: {
    blood: number;
    maxBlood: number;
    marks: number;
    moon: number;
    moonState: "idle" | "opening" | "combat" | "intermission";
    enemies: number;
    countdown: number;
    weaponName: string;
    ammo: number;
    reserve: number;
    reloading: boolean;
    slot: number;
    bestMoon: number;
    speed: number;
    sliding: boolean;
  }): void {
    const bloodRatio = Math.max(0, Math.min(1, data.blood / data.maxBlood));
    this.get("blood-value").textContent = String(Math.ceil(data.blood));
    (this.get("blood-fill") as HTMLElement).style.width = `${bloodRatio * 100}%`;
    this.get("marks-value").textContent = String(data.marks).padStart(4, "0");
    this.get("moon-label").textContent = `MOON ${toRoman(data.moon)}`;
    this.get("moon-state").textContent = data.moonState === "intermission" ? "INTERMISSION" : "BLOOD MOON";
    this.get("enemy-count").textContent = data.moonState === "intermission"
      ? `NEXT MOON IN ${data.countdown}`
      : `${data.enemies} REMAIN`;
    this.get("weapon-name").textContent = data.weaponName;
    this.get("ammo-value").textContent = String(data.ammo).padStart(2, "0");
    this.get("reserve-value").textContent = String(data.reserve).padStart(2, "0");
    this.get("reload-state").textContent = data.reloading ? "RELOADING" : `${data.slot} · ${data.slot === 1 ? "PISTOL" : "SHOTGUN"}`;
    this.get("best-moon").textContent = `BEST MOON ${toRoman(data.bestMoon)}`;
    this.get("speed-state").textContent = data.sliding ? "SLIDE CHAIN" : data.speed > 10 ? "MOMENTUM" : data.speed > 5 ? "MOVING" : "READY";
  }

  announce(title: string, detail: string, duration = 2.2): void {
    this.announcement.innerHTML = `<strong>${title}</strong><span>${detail}</span>`;
    this.announcement.classList.add("announcement--visible");
    this.announcementTimer = duration;
  }

  reward(text: string): void {
    const id = ++this.rewardId;
    const line = document.createElement("div");
    line.dataset.rewardId = String(id);
    line.textContent = text;
    this.rewardFeed.prepend(line);
    window.setTimeout(() => line.classList.add("reward--exit"), 1450);
    window.setTimeout(() => line.remove(), 1950);
  }

  showHit(killed: boolean): void {
    this.hitMarker.classList.add("hit-marker--visible");
    this.hitMarker.classList.toggle("hit-marker--kill", killed);
    this.hitTimer = 0.14;
  }

  showDamage(): void {
    this.damageFlash.classList.add("damage-flash--visible");
    this.damageTimer = 0.18;
  }

  setInteract(text: string | null): void {
    if (text) {
      this.interactPrompt.innerHTML = text;
      this.interactPrompt.classList.add("interact-prompt--visible");
    } else {
      this.interactPrompt.classList.remove("interact-prompt--visible");
    }
  }

  showTally(attempts: number, reachedMoon: number, kills: number): void {
    const container = this.get("tally-marks");
    container.innerHTML = "";
    const displayed = Math.min(35, Math.max(1, attempts));
    for (let i = 0; i < displayed; i += 1) {
      const mark = document.createElement("i");
      mark.style.setProperty("--tilt", `${-14 + ((i * 17) % 28)}deg`);
      if (i === displayed - 1) mark.classList.add("tally-mark--new");
      container.appendChild(mark);
    }
    this.get("run-summary").textContent = `MOON ${toRoman(reachedMoon)} // ${kills} KILLS // ATTEMPT ${String(attempts).padStart(3, "0")}`;
  }

  private drawPortrait(): void {
    const canvas = this.get("portrait") as HTMLCanvasElement;
    const context = canvas.getContext("2d")!;
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#0b0b0b";
    context.fillRect(0, 0, 64, 64);
    context.fillStyle = "#20191a";
    context.fillRect(8, 10, 48, 54);
    context.fillStyle = "#2b1918";
    context.fillRect(14, 17, 36, 39);
    context.fillStyle = "#181313";
    context.fillRect(7, 11, 10, 28);
    context.fillRect(15, 6, 10, 17);
    context.fillRect(24, 4, 10, 16);
    context.fillRect(35, 7, 13, 17);
    context.fillRect(47, 13, 8, 27);
    context.fillStyle = "#ddd7c8";
    context.fillRect(18, 27, 9, 4);
    context.fillRect(38, 27, 9, 4);
    context.fillStyle = "#fff";
    context.fillRect(20, 27, 5, 3);
    context.fillRect(40, 27, 5, 3);
    context.fillStyle = "#090909";
    context.fillRect(28, 42, 10, 6);
    context.fillRect(30, 49, 7, 4);
    context.strokeStyle = "#8e101d";
    context.lineWidth = 2;
    context.beginPath(); context.moveTo(15, 32); context.lineTo(24, 38); context.stroke();
    context.beginPath(); context.moveTo(45, 33); context.lineTo(39, 40); context.stroke();
    context.fillStyle = "#b29b70";
    context.fillRect(12, 55, 40, 3);
  }

  private get(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing UI element #${id}`);
    return element;
  }

  private button(id: string): HTMLButtonElement {
    return this.get(id) as HTMLButtonElement;
  }
}
