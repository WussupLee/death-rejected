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
    for (const id of ["settings-button", "controls-button", "pause-settings"])
      this.button(id).addEventListener("click", () => {
        this.get("settings-screen").hidden = false;
        this.get("quality-setting").focus();
      });
    this.button("settings-back").addEventListener("click", () => {
      this.get("settings-screen").hidden = true;
      this.get(
        document.body.dataset.phase === "paused"
          ? "resume-button"
          : "begin-button",
      ).focus();
    });
    window.addEventListener("keydown", (event) => {
      if (
        !["landing", "paused", "tally"].includes(
          document.body.dataset.phase ?? "",
        )
      )
        return;
      const overlay = !this.get("settings-screen").hidden
        ? this.get("settings-screen")
        : document.querySelector(".overlay--visible");
      const buttons = Array.from(
        overlay?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ??
          [],
      );
      const editingSetting = document.activeElement?.matches("input, select");
      if (
        !editingSetting &&
        ["ArrowUp", "ArrowDown"].includes(event.code) &&
        buttons.length
      ) {
        event.preventDefault();
        const current = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        buttons[
          (current + (event.code === "ArrowDown" ? 1 : -1) + buttons.length) %
            buttons.length
        ].focus();
      }
      if (event.code === "Escape" && !this.get("settings-screen").hidden)
        this.button("settings-back").click();
    });
  }

  update(delta: number): void {
    this.announcementTimer -= delta;
    if (this.announcementTimer <= 0)
      this.announcement.classList.remove("announcement--visible");
    this.hitTimer -= delta;
    if (this.hitTimer <= 0)
      this.hitMarker.classList.remove("hit-marker--visible");
    this.damageTimer -= delta;
    if (this.damageTimer <= 0)
      this.damageFlash.classList.remove("damage-flash--visible");
  }

  setPhase(phase: GamePhase): void {
    document.body.dataset.phase = phase;
    if (phase === "paused") this.resumeButton.focus();
    if (phase === "tally") this.restartButton.focus();
    this.landing.classList.toggle("overlay--visible", phase === "landing");
    this.pause.classList.toggle("overlay--visible", phase === "paused");
    this.death.classList.toggle("overlay--visible", phase === "dying");
    this.tally.classList.toggle("overlay--visible", phase === "tally");
    this.hud.classList.toggle(
      "hud--hidden",
      !["playing", "intermission", "paused"].includes(phase),
    );
  }

  setAttempt(attempts: number): void {
    this.get("attempt-number").textContent = String(attempts + 1).padStart(
      3,
      "0",
    );
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
    (this.get("blood-fill") as HTMLElement).style.width =
      `${bloodRatio * 100}%`;
    this.get("marks-value").textContent = String(data.marks).padStart(4, "0");
    this.get("moon-label").textContent = `MOON ${toRoman(data.moon)}`;
    this.get("moon-state").textContent =
      data.moonState === "intermission" ? "INTERMISSION" : "BLOOD MOON";
    this.get("enemy-count").textContent =
      data.moonState === "intermission"
        ? `NEXT MOON IN ${data.countdown}`
        : `${data.enemies} REMAIN`;
    this.get("weapon-name").textContent = data.weaponName;
    this.get("ammo-value").textContent = String(data.ammo).padStart(2, "0");
    this.get("reserve-value").textContent = String(data.reserve).padStart(
      2,
      "0",
    );
    this.get("reload-state").textContent = data.reloading
      ? "RELOADING"
      : `${data.slot} · ${data.slot === 1 ? "PISTOL" : "SHOTGUN"}`;
    this.get("best-moon").textContent = `BEST MOON ${toRoman(data.bestMoon)}`;
    this.get("speed-state").textContent = data.sliding
      ? "SLIDE CHAIN"
      : data.speed > 10
        ? "MOMENTUM"
        : data.speed > 5
          ? "MOVING"
          : "READY";
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
    while (this.rewardFeed.children.length > 3)
      this.rewardFeed.lastElementChild?.remove();
    window.setTimeout(() => line.classList.add("reward--exit"), 1450);
    window.setTimeout(() => line.remove(), 1950);
  }

  showHeadshot(): void {
    this.hitMarker.classList.add("hit-marker--headshot", "hit-marker--visible");
    this.hitTimer = 0.22;
  }

  showHit(killed: boolean): void {
    this.hitMarker.classList.remove("hit-marker--headshot");
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
    this.get("run-summary").textContent =
      `MOON ${toRoman(reachedMoon)} // ${kills} KILLS // ATTEMPT ${String(attempts).padStart(3, "0")}`;
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
