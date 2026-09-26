import type { PlayerController } from "./PlayerController";
import type { WeaponSystem } from "./WeaponSystem";

export const isTouchDevice = (): boolean =>
  navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches;

/** Independent pointer ownership allows walking, aiming and firing together. */
export class TouchControls {
  readonly available = isTouchDevice();
  private readonly root = document.createElement("div");
  private active = false;
  private readonly releases = new Set<() => void>();

  constructor(
    private readonly player: PlayerController,
    private readonly weapons: WeaponSystem,
    pause: () => void,
    interact: () => void,
  ) {
    if (!this.available) return;
    document.documentElement.dataset.input = "touch";
    this.root.id = "touch-controls";
    this.root.hidden = true;
    this.root.innerHTML = `
      <div id="touch-look" aria-label="Swipe to look"></div>
      <div id="touch-stick" aria-label="Movement joystick"><i></i><span>MOVE / SPRINT</span></div>
      <button id="touch-pause" aria-label="Pause game">Ⅱ</button>
      <button id="touch-fullscreen" aria-label="Enter fullscreen">FULL</button>
      <div class="touch-actions">
        <button id="touch-aim" aria-label="Toggle aim" aria-pressed="false">AIM</button>
        <button id="touch-reload" aria-label="Reload weapon">RELOAD</button>
        <button id="touch-switch" aria-label="Switch weapon">SWAP</button>
        <button id="touch-knife" aria-label="Swing knife">KNIFE</button>
        <button id="touch-fire" aria-label="Hold to fire and drag to aim">FIRE</button>
        <button id="touch-jump" aria-label="Jump">JUMP</button>
        <button id="touch-slide" aria-label="Slide">SLIDE</button>
      </div>
      <button id="touch-use" aria-label="Buy weapon or refill ammo" hidden>USE SHOP</button>`;
    document.getElementById("game-shell")!.append(this.root);
    this.root.addEventListener("contextmenu", (event) =>
      event.preventDefault(),
    );
    const rotate = document.createElement("div");
    rotate.id = "rotate-prompt";
    rotate.setAttribute("role", "status");
    rotate.innerHTML =
      "<strong>TURN YOUR PHONE</strong><p>The hunt plays sideways.</p><small>Rotate to landscape to continue.</small>";
    document.getElementById("game-shell")!.append(rotate);
    document.getElementById("controls-help")!.textContent =
      "Left stick: move; full forward: sprint. Swipe right side: look. Hold FIRE and drag: shoot and aim. AIM toggles sights. SLIDE, JUMP, KNIFE, RELOAD and SWAP control combat. USE SHOP appears at the counter. Pause with Ⅱ.";
    document.querySelector(".title-lockup small")!.textContent =
      "LANDSCAPE TOUCH CONTROLS // HEADPHONES RECOMMENDED";
    document.querySelector(".pause-card small")!.textContent =
      "TAP RETURN TO CONTINUE THE HUNT";

    this.bindStick();
    this.bindPointer(
      "touch-look",
      () => {},
      () => {},
      true,
    );
    this.bindPointer(
      "touch-fire",
      () => weapons.setTrigger(true),
      () => weapons.setTrigger(false),
      true,
    );
    this.bindPointer("touch-jump", () => player.jump());
    this.bindPointer("touch-slide", () => player.startSlide());
    this.bindPointer("touch-knife", () => weapons.knife());
    this.bindPointer("touch-reload", () => weapons.reload());
    this.bindPointer("touch-switch", () =>
      weapons.switchTo(weapons.currentId === "pistol" ? "shotgun" : "pistol"),
    );
    this.bindPointer("touch-use", interact);
    this.bindPointer("touch-aim", () => {
      const button = this.element("touch-aim");
      const held = button.getAttribute("aria-pressed") !== "true";
      button.setAttribute("aria-pressed", String(held));
      weapons.setAim(held);
    });
    this.element("touch-pause").addEventListener("click", pause);
    const fullscreen = this.element("touch-fullscreen");
    fullscreen.hidden = !document.documentElement.requestFullscreen;
    fullscreen.addEventListener("click", () => {
      if (!document.fullscreenElement)
        void document.documentElement.requestFullscreen?.().catch(() => {});
      else void document.exitFullscreen?.().catch(() => {});
    });
    window.addEventListener("resize", () => {
      this.reset();
      if (innerHeight > innerWidth) pause();
    });
    window.addEventListener("blur", () => this.reset());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.reset();
    });
  }

  setActive(active: boolean): void {
    this.active = active;
    this.root.hidden = !active;
    if (!active) this.reset();
  }

  setShopAvailable(available: boolean): void {
    if (this.available) this.element("touch-use").hidden = !available;
  }

  private element(id: string): HTMLElement {
    return this.root.querySelector<HTMLElement>(`#${id}`)!;
  }

  private reset(): void {
    for (const release of this.releases) release();
    this.player.setTouchMovement(0, 0);
    this.weapons.clearInput();
    if (this.available)
      this.element("touch-aim").setAttribute("aria-pressed", "false");
  }

  private bindPointer(
    id: string,
    down: () => void,
    up = () => {},
    look = false,
  ): void {
    const el = this.element(id);
    let pointer: number | null = null;
    let x = 0,
      y = 0;
    const release = () => {
      if (pointer === null) return;
      const previous = pointer;
      pointer = null;
      el.classList.remove("held");
      up();
      if (el.hasPointerCapture(previous)) el.releasePointerCapture(previous);
    };
    this.releases.add(release);
    el.addEventListener("pointerdown", (e) => {
      if (!this.active || pointer !== null) return;
      e.preventDefault();
      pointer = e.pointerId;
      x = e.clientX;
      y = e.clientY;
      el.setPointerCapture(pointer);
      el.classList.add("held");
      down();
    });
    el.addEventListener("pointermove", (e) => {
      if (pointer !== e.pointerId) return;
      if (look) this.player.touchLook(e.clientX - x, e.clientY - y);
      x = e.clientX;
      y = e.clientY;
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      el.addEventListener(type, (e) => {
        if ((e as PointerEvent).pointerId === pointer) release();
      });
  }

  private bindStick(): void {
    const el = this.element("touch-stick");
    const knob = el.querySelector("i")!;
    let pointer: number | null = null;
    let cx = 0,
      cy = 0,
      radius = 1;
    const move = (e: PointerEvent) => {
      const dx = e.clientX - cx,
        dy = e.clientY - cy;
      const magnitude = Math.hypot(dx, dy);
      const scale = Math.min(1, magnitude / radius);
      const strength = scale < 0.12 ? 0 : (scale - 0.12) / 0.88;
      this.player.setTouchMovement(
        magnitude ? (dx / magnitude) * strength : 0,
        magnitude ? (-dy / magnitude) * strength : 0,
      );
      knob.style.transform = `translate(${magnitude ? (dx / magnitude) * scale * radius : 0}px, ${magnitude ? (dy / magnitude) * scale * radius : 0}px)`;
      el.classList.toggle("sprinting", -dy / radius > 0.8);
    };
    const release = () => {
      const previous = pointer;
      pointer = null;
      this.player.setTouchMovement(0, 0);
      knob.style.transform = "translate(0, 0)";
      el.classList.remove("sprinting");
      if (previous !== null && el.hasPointerCapture(previous))
        el.releasePointerCapture(previous);
    };
    this.releases.add(release);
    el.addEventListener("pointerdown", (e) => {
      if (!this.active || pointer !== null) return;
      e.preventDefault();
      pointer = e.pointerId;
      const rect = el.getBoundingClientRect();
      cx = rect.left + rect.width / 2;
      cy = rect.top + rect.height / 2;
      radius = rect.width * 0.38;
      el.setPointerCapture(pointer);
      move(e);
    });
    el.addEventListener("pointermove", (e) => {
      if (e.pointerId === pointer) move(e);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      el.addEventListener(type, (e) => {
        if ((e as PointerEvent).pointerId === pointer) release();
      });
  }
}
