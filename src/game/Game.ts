import * as THREE from "three";
import { COLORS, PLAYER } from "./config";
import { AudioManager } from "./AudioManager";
import { EnemySystem } from "./EnemySystem";
import { Environment } from "./Environment";
import { MoonManager } from "./MoonManager";
import { PerformanceGovernor } from "./PerformanceGovernor";
import { PlayerController } from "./PlayerController";
import { SaveManager } from "./SaveManager";
import { UIManager } from "./UIManager";
import { WeaponSystem } from "./WeaponSystem";
import type { EnemyTarget, GameEvents, GamePhase } from "./types";

import { CombatEffects } from "./CombatEffects";
import { TallyScene } from "./TallyScene";
import { FixedSimulation, killReward } from "./Simulation";
import type { AssetLibrary } from "./AssetLibrary";

export class Game implements GameEvents {
  private readonly scene = new THREE.Scene();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly menuCamera = new THREE.PerspectiveCamera(62, 1, 0.1, 150);
  private readonly tallyScene: TallyScene;
  private menuTime = 0;
  private readonly clock = new THREE.Clock();
  private readonly effects: CombatEffects;
  private readonly environment: Environment;
  private readonly player: PlayerController;
  private readonly enemies: EnemySystem;
  private readonly weapons: WeaponSystem;
  private readonly moon: MoonManager;
  private readonly audio = new AudioManager();
  private readonly ui = new UIManager();
  private readonly save = new SaveManager();
  private readonly canvas: HTMLCanvasElement;
  private readonly performanceGovernor: PerformanceGovernor;
  private phase: GamePhase = "landing";
  private playPhase: "playing" | "intermission" = "playing";
  private blood: number = PLAYER.maxBlood;
  private marks = 0;
  private kills = 0;
  private lastKillAt = 0;
  private deathTimer = 0;
  private readonly simulation = new FixedSimulation();
  private uiTime = 0;
  private frameMs = 0;
  private isNearShop = false;
  private captureRequest = 0;

  constructor(assets: AssetLibrary) {
    const canvas = document.getElementById("game-canvas");
    if (!(canvas instanceof HTMLCanvasElement))
      throw new Error("Missing game canvas");
    this.canvas = canvas;
    this.tallyScene = new TallyScene(assets);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.performanceGovernor = new PerformanceGovernor(this.renderer);

    this.scene.background = new THREE.Color(0x060807);
    this.scene.fog = new THREE.FogExp2(0x080c0b, 0.018);
    this.environment = new Environment(this.scene, assets);
    this.effects = new CombatEffects(this.scene);
    this.player = new PlayerController(this.environment, this.canvas);
    this.scene.add(this.player.yaw);
    this.enemies = new EnemySystem(this.scene, this.environment, this, assets);
    this.weapons = new WeaponSystem(
      this.canvas,
      this.player,
      this.enemies,
      this.audio,
      assets,
      this.effects,
      (hit, heavy, headshot) => {
        if (hit && headshot) this.ui.showHeadshot();
        if (heavy) this.renderer.toneMappingExposure = 1.08;
        if (headshot) this.ui.reward("HEADSHOT // 2.25X DAMAGE");
      },
    );
    this.moon = new MoonManager(
      this.enemies,
      this.audio,
      (title, detail, duration) => this.ui.announce(title, detail, duration),
      (moon, reward) => this.onMoonCleared(moon, reward),
    );

    this.buildLighting();
    this.environment.captureReflections(this.renderer);
    this.bindActions();
    this.resize();
    this.ui.setAttempt(this.save.data.attempts);
    this.ui.setPhase("landing");
    this.renderHud();
    (window as unknown as { __deathRejected?: unknown }).__deathRejected = {
      getSnapshot: () => ({
        phase: this.phase,
        blood: this.blood,
        marks: this.marks,
        kills: this.kills,
        moon: this.moon.currentMoon,
        moonState: this.moon.state,
        intensity: this.moon.intensity,
        enemiesRemaining: this.moon.remaining,
        attempts: this.save.data.attempts,
        bestMoon: this.save.data.bestMoon,
        weapon: this.weapons.hud,
        player: {
          x: Number(this.player.position.x.toFixed(2)),
          y: Number(this.player.position.y.toFixed(2)),
          z: Number(this.player.position.z.toFixed(2)),
          speed: Number(this.player.speed.toFixed(2)),
          sliding: this.player.isSliding,
          airborne: this.player.isAirborne,
          yaw: Number(this.player.lookYaw.toFixed(3)),
          pitch: Number(this.player.lookPitch.toFixed(3)),
        },
        mouseMode:
          document.pointerLockElement === this.canvas
            ? "pointer-lock"
            : this.player.fallbackLookEnabled
              ? "preview-fallback"
              : "released",
        quality: this.performanceGovernor.profile,
        frameMs: this.frameMs,
        simulation: {
          elapsed: this.simulation.elapsed,
          dropped: this.simulation.droppedSeconds,
        },
        attackWindow: this.weapons.attackWindow,
        hitZone: this.enemies.lastHitZone,
        navigation: this.enemies.snapshot,
        drawCalls: this.renderer.info.render.calls,
      }),
    };
    if (import.meta.env.DEV)
      Object.assign(
        (window as unknown as { __deathRejected: object }).__deathRejected,
        {
          test: {
            game: this,
            player: this.player,
            enemies: this.enemies,
            weapons: this.weapons,
            moon: this.moon,
            environment: this.environment,
            renderer: this.renderer,
          },
        },
      );
    this.renderer.setAnimationLoop(() => this.update());
  }

  onPlayerDamage(amount: number): void {
    if (this.phase !== "playing" && this.phase !== "intermission") return;
    this.blood = Math.max(0, this.blood - amount);
    this.player.addShake(0.065);
    this.ui.showDamage();
    this.audio.hurt();
    if (this.blood <= 0) this.die();
  }

  onEnemyKilled(enemy: EnemyTarget, distance: number, melee: boolean): void {
    this.kills += 1;
    const now = this.simulation.elapsed * 1000;
    let bonus = 0;
    let label = "";
    if (melee) {
      bonus += 20;
      label = "EXECUTION";
    } else if (this.player.isSliding) {
      bonus += 15;
      label = "SLIDE KILL";
    } else if (this.player.isAirborne) {
      bonus += 20;
      label = "AIR KILL";
    } else if (now - this.lastKillAt < 800) {
      bonus += 30;
      label = "MULTI-KILL";
    }
    const style = melee
      ? "execution"
      : this.player.isSliding
        ? "slide"
        : this.player.isAirborne
          ? "air"
          : now - this.lastKillAt < 800
            ? "multi"
            : "normal";
    const reward = killReward(enemy.kind, style, distance);
    const base = reward.marks - reward.bonus;
    this.marks += reward.marks;
    this.blood = Math.min(PLAYER.maxBlood, this.blood + reward.blood);
    this.lastKillAt = now;
    if (label) this.ui.reward(`+${bonus} MARKS — ${label}`);
    else this.ui.reward(`+${base} MARKS`);
    this.ui.showHit(true);
    this.audio.kill();
  }

  onEnemyHit(_enemy: EnemyTarget, killed: boolean): void {
    this.ui.showHit(killed);
    if (!killed) this.audio.hit();
  }

  private update(): void {
    const rawDelta = this.clock.getDelta();
    const delta = Math.min(rawDelta, 0.1);
    this.frameMs = rawDelta * 1000;
    this.ui.update(delta);
    if (!document.hidden) this.performanceGovernor.update(rawDelta);
    this.environment.setMoon(this.moon.currentMoon);
    this.audio.setIntensity(this.moon.intensity);
    this.audio.update();
    if (this.phase === "playing" || this.phase === "intermission") {
      this.simulation.advance(rawDelta, (dt) => {
        if (this.phase !== "playing" && this.phase !== "intermission") return;
        this.player.update(dt);
        this.scene.updateMatrixWorld(true);
        this.weapons.update(dt);
        this.moon.update(dt, this.player.position, this.blood);
        this.enemies.update(
          dt,
          this.player.position,
          this.moon.state === "combat",
        );
      });
      this.updateShopPrompt();
      if (this.phase === "playing" || this.phase === "intermission") {
        this.playPhase =
          this.moon.state === "intermission" ? "intermission" : "playing";
        this.phase = this.playPhase;
      }
    }
    if (this.phase === "dying") {
      this.enemies.update(delta * 0.12, this.player.position, true);
      this.deathTimer -= delta;
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.density = Math.min(
          0.08,
          0.018 + (2.6 - this.deathTimer) * 0.022,
        );
      }
      if (this.deathTimer <= 0) this.showTally();
    }
    this.renderer.toneMappingExposure +=
      (0.95 - this.renderer.toneMappingExposure) * (1 - Math.exp(-8 * delta));
    this.uiTime += delta;
    if (this.uiTime > 0.05) {
      this.renderHud();
      this.uiTime = 0;
    }
    this.weapons.render(delta);
    if (this.phase !== "paused")
      this.enemies.render(this.phase === "dying" ? delta * 0.12 : delta);
    this.effects.budget = this.performanceGovernor.profile.particles;
    if (this.phase !== "paused") this.effects.update(delta);
    this.environment.setReflections(
      this.performanceGovernor.profile.reflections,
    );
    this.enemies.animationHz = this.performanceGovernor.profile.animationHz;
    if (this.phase === "tally") {
      this.tallyScene.update(delta);
      this.renderer.render(this.tallyScene.scene, this.tallyScene.camera);
    } else if (this.phase === "landing") {
      this.menuTime += delta;
      this.weapons.group.visible = false;
      this.menuCamera.position.set(
        1 + Math.sin(this.menuTime * 0.08) * 0.8,
        2.4,
        15,
      );
      this.menuCamera.lookAt(0, 8, -1);
      this.renderer.render(this.scene, this.menuCamera);
    } else this.renderer.render(this.scene, this.player.camera);
  }

  private beginRun(): void {
    void this.audio.unlock();
    this.audio.setCollapsed(false);
    this.blood = PLAYER.maxBlood;
    this.marks = 0;
    this.kills = 0;
    this.lastKillAt = 0;
    this.simulation.reset();
    this.player.reset();
    this.enemies.clear();
    this.effects.clear();
    this.weapons.reset();
    this.moon.reset();
    this.playPhase = "playing";
    this.scene.fog = new THREE.FogExp2(0x080c0b, 0.018);
    this.setPhase("playing");
    this.moon.startRun();
    this.captureMouse();
  }

  private die(): void {
    if (this.phase === "dying" || this.phase === "tally") return;
    this.captureRequest++;
    document.exitPointerLock();
    this.setPhase("dying");
    this.deathTimer = 2.6;
    this.audio.setCombat(false);
    this.audio.reject();
    this.audio.setCollapsed(true);
    this.enemies.update(0, this.player.position, false);
    this.save.recordDeath(this.moon.currentMoon);
  }

  private showTally(): void {
    this.setPhase("tally");
    this.tallyScene.begin(this.save.data.attempts);
    this.ui.showTally(
      this.save.data.attempts,
      this.moon.currentMoon,
      this.kills,
    );
    this.ui.setAttempt(this.save.data.attempts);
  }

  private setPhase(phase: GamePhase): void {
    this.phase = phase;
    const active = phase === "playing" || phase === "intermission";
    this.player.enabled = active;
    this.weapons.enabled = active;
    if (!active) {
      this.player.clearInput();
      this.weapons.clearInput();
    }
    this.audio.setCombat(active && this.moon.state === "combat");
    this.ui.setPhase(phase);
  }

  private onMoonCleared(moon: number, reward: number): void {
    this.marks += reward;
    this.blood = Math.min(PLAYER.maxBlood, this.blood + 18);
    this.save.recordMoon(moon);
  }

  private updateShopPrompt(): void {
    this.isNearShop =
      this.environment.distanceToShop(this.player.position) < 5.4;
    if (!this.isNearShop) {
      this.ui.setInteract(null);
      return;
    }
    if (!this.weapons.hasShotgun) {
      this.ui.setInteract(`<kbd>E</kbd> BUY WIDOWMAKER 12G <b>450 MARKS</b>`);
    } else {
      this.ui.setInteract(`<kbd>E</kbd> REFILL AMMO <b>120 MARKS</b>`);
    }
  }

  private useShop(): void {
    if (!this.isNearShop || !["playing", "intermission"].includes(this.phase))
      return;
    if (!this.weapons.hasShotgun) {
      if (this.marks < 450) {
        this.ui.reward("NOT ENOUGH MARKS");
        return;
      }
      this.marks -= 450;
      this.weapons.purchaseShotgun();
      this.ui.announce("WIDOWMAKER 12G", "PURCHASED // PRESS 2 TO EQUIP", 2.2);
      return;
    }
    if (this.marks < 120) {
      this.ui.reward("NOT ENOUGH MARKS");
      return;
    }
    if (!this.weapons.refillAmmo()) {
      this.ui.reward("AMMO ALREADY FULL");
      return;
    }
    this.marks -= 120;
    this.ui.reward("AMMUNITION RESTORED");
  }

  private renderHud(): void {
    const weapon = this.weapons.hud;
    this.ui.updateHud({
      blood: this.blood,
      maxBlood: PLAYER.maxBlood,
      marks: this.marks,
      moon: this.moon.currentMoon,
      moonState: this.moon.state,
      enemies: this.moon.remaining,
      countdown: this.moon.countdown,
      weaponName: weapon.name,
      ammo: weapon.ammo,
      reserve: weapon.reserve,
      reloading: weapon.reloading,
      slot: weapon.slot,
      bestMoon: this.save.data.bestMoon,
      speed: this.player.speed,
      sliding: this.player.isSliding,
    });
  }

  private buildLighting(): void {
    const hemisphere = new THREE.HemisphereLight(0xb8c9bb, 0x34201f, 2.3);
    this.scene.add(hemisphere);
    const moonlight = new THREE.DirectionalLight(0xef8a7a, 2.1);
    moonlight.position.set(0, 21.5, -2.5);
    moonlight.castShadow = true;
    moonlight.shadow.mapSize.set(1024, 1024);
    moonlight.shadow.camera.left = -35;
    moonlight.shadow.camera.right = 35;
    moonlight.shadow.camera.top = 30;
    moonlight.shadow.camera.bottom = -30;
    this.scene.add(moonlight);
    const bloodMoonGlow = new THREE.PointLight(0xff3543, 24, 62, 1.45);
    bloodMoonGlow.position.set(0, 10.5, -2.5);
    this.scene.add(bloodMoonGlow);
    const altarGlow = new THREE.PointLight(COLORS.blood, 7, 19, 1.7);
    altarGlow.position.set(0, 4, 0);
    this.scene.add(altarGlow);
    for (const [x, z] of [
      [-21, -17],
      [17, -17],
      [-20, 17],
      [20, 17],
    ]) {
      const fluorescent = new THREE.PointLight(COLORS.mallCyan, 35, 24, 1.8);
      fluorescent.position.set(x, 6.5, z);
      this.scene.add(fluorescent);
    }
  }

  private bindActions(): void {
    (
      document.getElementById("quality-setting") as HTMLSelectElement
    ).addEventListener("change", (event) =>
      this.performanceGovernor.select(
        (event.target as HTMLSelectElement).value as
          | "auto"
          | "high"
          | "balanced"
          | "performance",
      ),
    );
    (
      document.getElementById("sensitivity-setting") as HTMLInputElement
    ).addEventListener(
      "input",
      (event) =>
        (this.player.sensitivity = Number(
          (event.target as HTMLInputElement).value,
        )),
    );
    (
      document.getElementById("volume-setting") as HTMLInputElement
    ).addEventListener("input", (event) =>
      this.audio.setVolume(Number((event.target as HTMLInputElement).value)),
    );
    this.ui.beginButton.addEventListener("click", () => this.beginRun());
    this.ui.restartButton.addEventListener("click", () => this.beginRun());
    this.ui.resumeButton.addEventListener("click", () => this.captureMouse());
    this.canvas.addEventListener("click", () => {
      if (this.phase === "paused") this.captureMouse();
      else if (
        ["playing", "intermission"].includes(this.phase) &&
        document.pointerLockElement == null
      )
        this.captureMouse();
    });
    document.addEventListener("pointerlockerror", () => {
      if (["playing", "intermission"].includes(this.phase))
        this.activatePreviewLook();
    });
    document.addEventListener("pointerlockchange", () => {
      if (!this.pointerLockAvailable) return;
      const locked = document.pointerLockElement === this.canvas;
      if (locked) {
        this.player.fallbackLookEnabled = false;
        this.canvas.dataset.mouseMode = "pointer-lock";
      }
      if (!locked && ["playing", "intermission"].includes(this.phase))
        this.setPhase("paused");
      else if (locked && this.phase === "paused") this.setPhase(this.playPhase);
    });
    window.addEventListener("keydown", (event) => {
      if (event.code === "KeyE" && !event.repeat) this.useShop();
      if (
        event.code === "Escape" &&
        !event.repeat &&
        ["playing", "intermission"].includes(this.phase)
      ) {
        this.captureRequest++;
        if (document.pointerLockElement === this.canvas)
          document.exitPointerLock();
        else this.setPhase("paused");
      }
    });
    window.addEventListener("blur", () => {
      if (["playing", "intermission"].includes(this.phase)) {
        document.exitPointerLock();
        this.setPhase("paused");
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && ["playing", "intermission"].includes(this.phase)) {
        document.exitPointerLock();
        this.setPhase("paused");
      }
    });
    window.addEventListener("resize", () => this.resize());
  }

  private get pointerLockAvailable(): boolean {
    return (
      typeof this.canvas.requestPointerLock === "function" &&
      "pointerLockElement" in document
    );
  }

  private captureMouse(): void {
    const requestId = ++this.captureRequest;
    const fallback = () => {
      if (
        requestId === this.captureRequest &&
        ["playing", "intermission", "paused"].includes(this.phase)
      )
        this.activatePreviewLook();
    };
    if (this.pointerLockAvailable) {
      try {
        const request = this.canvas.requestPointerLock();
        if (request instanceof Promise) void request.catch(fallback);
      } catch {
        fallback();
      }
    } else fallback();
  }

  private activatePreviewLook(): void {
    this.player.fallbackLookEnabled = true;
    this.canvas.dataset.mouseMode = "preview-fallback";
    if (this.phase === "paused") this.setPhase(this.playPhase);
    this.ui.announce(
      "PREVIEW LOOK ACTIVE",
      "MOVE TO LOOK // HOLD AT EDGE FOR 360 TURN // ESC TO PAUSE",
      3.4,
    );
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.performanceGovernor.resize();
    this.menuCamera.aspect = width / height;
    this.menuCamera.updateProjectionMatrix();
    this.tallyScene.resize(width / height);
    this.player.camera.aspect = width / height;
    this.player.camera.updateProjectionMatrix();
  }
}
