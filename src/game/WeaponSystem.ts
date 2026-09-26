import * as THREE from "three";
import type { AudioManager } from "./AudioManager";
import type { EnemySystem } from "./EnemySystem";
import type { PlayerController } from "./PlayerController";
import type { WeaponId, WeaponDefinition } from "./types";
import { AssetLibrary, AnimatedAsset } from "./AssetLibrary";
import type { CombatEffects } from "./CombatEffects";
import { KNIFE, attackPhase } from "./Simulation";

interface WeaponState {
  definition: WeaponDefinition;
  ammo: number;
  reserve: number;
  owned: boolean;
}

const DEFINITIONS: Record<WeaponId, WeaponDefinition> = {
  pistol: {
    id: "pistol",
    name: "BLACKTHORN .45",
    clipSize: 12,
    reserveSize: 72,
    damage: 38,
    fireDelay: 0.19,
    reloadTime: 1.05,
    range: 75,
    pellets: 1,
    spread: 0.0025,
  },
  shotgun: {
    id: "shotgun",
    name: "WIDOWMAKER 12G",
    clipSize: 6,
    reserveSize: 30,
    damage: 17,
    fireDelay: 0.72,
    reloadTime: 1.38,
    range: 38,
    pellets: 8,
    spread: 0.052,
  },
};

const MELEE_DURATION = KNIFE.windup + KNIFE.active + KNIFE.recovery;
const MELEE_RANGE = 3.15;

export class WeaponSystem {
  readonly group = new THREE.Group();
  enabled = false;
  currentId: WeaponId = "pistol";

  private readonly weapons: Record<WeaponId, WeaponState> = {
    pistol: {
      definition: DEFINITIONS.pistol,
      ammo: 12,
      reserve: 72,
      owned: true,
    },
    shotgun: {
      definition: DEFINITIONS.shotgun,
      ammo: 6,
      reserve: 30,
      owned: false,
    },
  };
  private triggerHeld = false;
  private aimHeld = false;
  private fireCooldown = 0;
  private meleeCooldown = 0;
  private meleeTimer = 0;
  private readonly meleeHits = new Set<number>();
  private readonly actors: AnimatedAsset[] = [];
  private visualTime = 0;
  private debugCone: THREE.Mesh | null = null;
  private autoReload = 0;
  private equipTimer = 0;
  private reloadTimer = 0;
  private reloading = false;
  private recoil = 0;
  private sway = 0;
  private muzzleTimer = 0;
  private readonly muzzle: THREE.PointLight;
  private readonly pistolModel = new THREE.Group();
  private readonly shotgunModel = new THREE.Group();
  private readonly meleeModel = new THREE.Group();
  private readonly rayDirection = new THREE.Vector3();
  private readonly localDirection = new THREE.Vector3();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly player: PlayerController,
    private readonly enemies: EnemySystem,
    private readonly audio: AudioManager,
    private readonly assets: AssetLibrary,
    private readonly effects: CombatEffects,
    private readonly onFireFeedback: (
      hit: boolean,
      heavy: boolean,
      headshot: boolean,
    ) => void,
  ) {
    this.group.position.set(0.28, -0.24, -0.5);
    this.player.camera.add(this.group);
    this.player.camera.add(this.meleeModel);
    this.buildModels();
    this.muzzle = new THREE.PointLight(0xff7b38, 0, 5, 2);
    this.muzzle.position.set(0.1, 0, -1.1);
    this.group.add(this.muzzle);
    this.bindInput();
    this.updateModelVisibility();
  }

  reset(): void {
    this.weapons.pistol.ammo = DEFINITIONS.pistol.clipSize;
    this.weapons.pistol.reserve = DEFINITIONS.pistol.reserveSize;
    this.weapons.pistol.owned = true;
    this.weapons.shotgun.ammo = DEFINITIONS.shotgun.clipSize;
    this.weapons.shotgun.reserve = DEFINITIONS.shotgun.reserveSize;
    this.weapons.shotgun.owned = false;
    this.currentId = "pistol";
    this.fireCooldown = 0;
    this.meleeCooldown = 0;
    this.meleeTimer = 0;
    this.meleeHits.clear();
    this.meleeModel.visible = false;
    this.canvas.dataset.meleeRange = String(MELEE_RANGE);
    this.reloadTimer = 0;
    this.reloading = false;
    this.clearInput();
    this.autoReload = 0;
    this.recoil = 0;
    this.muzzleTimer = 0;
    this.updateModelVisibility();
  }

  update(delta: number): void {
    if (!this.enabled) return;
    this.equipTimer = Math.max(0, this.equipTimer - delta);
    this.autoReload = Math.max(0, this.autoReload - delta);
    if (
      this.current.ammo === 0 &&
      this.current.reserve > 0 &&
      this.autoReload === 0 &&
      !this.reloading &&
      this.fireCooldown <= 0
    )
      this.reload();
    this.fireCooldown = Math.max(0, this.fireCooldown - delta);
    this.meleeCooldown = Math.max(0, this.meleeCooldown - delta);
    this.meleeTimer = Math.max(0, this.meleeTimer - delta);
    this.muzzleTimer = Math.max(0, this.muzzleTimer - delta);
    this.muzzle.intensity = this.muzzleTimer > 0 ? 22 : 0;

    if (this.meleeTimer > 0) {
      const progress = 1 - this.meleeTimer / MELEE_DURATION;
      const slash = Math.sin(Math.min(1, progress) * Math.PI);
      this.meleeModel.visible = true;
      this.canvas.dataset.meleeActive = "true";
      this.meleeModel.position.set(
        0.58 - slash * 0.7,
        -0.54 + slash * 0.2,
        -0.58 - slash * 0.42,
      );
      this.meleeModel.rotation.set(
        -0.38 - slash * 0.32,
        -0.18 - slash * 1.05,
        -0.28 - slash * 1.7,
      );
      if (this.attackWindow === "active") {
        const direction = this.player.getViewDirection();
        const results = this.enemies.melee(
          this.player.position,
          direction,
          KNIFE.damage,
          MELEE_RANGE,
          this.meleeHits,
        );
        if (results.length) {
          this.onFireFeedback(true, false, false);
          this.player.addImpulse(direction, 0.15);
        }
      }
    } else {
      this.meleeModel.visible = false;
      this.canvas.dataset.meleeActive = "false";
    }

    if (this.reloading) {
      this.reloadTimer -= delta;
      if (this.reloadTimer <= 0) this.finishReload();
    }
    if (this.enabled && this.triggerHeld && !this.reloading) this.fire();
  }

  render(delta: number): void {
    if (!this.enabled) return;
    this.visualTime += delta;
    for (const actor of this.actors) actor.update(delta);
    const moveSway =
      this.player.speed > 0.5 ? Math.sin(this.visualTime * 8) * 0.018 : 0;
    this.sway += (moveSway - this.sway) * (1 - Math.exp(-9 * delta));
    this.recoil += (0 - this.recoil) * (1 - Math.exp(-13 * delta));
    const aim = this.aimHeld ? 0.42 : 1;
    this.group.position.x +=
      (0.28 * aim + this.sway - this.group.position.x) *
      (1 - Math.exp(-10 * delta));
    this.group.position.y +=
      (-0.24 -
        Math.abs(this.sway) +
        this.recoil * 0.035 -
        this.group.position.y) *
      (1 - Math.exp(-12 * delta));
    this.group.position.z = -0.5 + this.recoil * 0.09;
    const reloadProgress = this.reloading
      ? 1 - this.reloadTimer / this.current.definition.reloadTime
      : 0;
    const reloadArc = Math.sin(reloadProgress * Math.PI);
    this.group.position.y =
      -0.24 -
      Math.abs(this.sway) +
      this.recoil * 0.035 -
      reloadArc * 0.14 -
      this.equipTimer * 0.8 +
      Math.sin(this.visualTime * 1.8) * 0.002;
    this.group.rotation.x = this.recoil * 0.2 - reloadArc * 0.3;
    this.group.rotation.y = reloadArc * -0.5;
    this.group.visible = this.meleeTimer <= 0;
    this.group.rotation.z = this.player.isSliding ? 0.18 : -this.sway * 0.9;
    this.player.camera.fov +=
      ((this.aimHeld ? 66 : 78) - this.player.camera.fov) *
      (1 - Math.exp(-12 * delta));
    this.player.camera.updateProjectionMatrix();
  }

  reload(): void {
    if (!this.enabled || this.reloading || this.meleeTimer > 0) return;
    const state = this.current;
    if (state.ammo >= state.definition.clipSize || state.reserve <= 0) return;
    this.reloading = true;
    this.reloadTimer = state.definition.reloadTime;
    this.audio.reload();
    this.actors[this.currentId === "pistol" ? 0 : 1].play("reload", true);
  }

  knife(): void {
    if (!this.enabled || this.meleeCooldown > 0) return;
    this.reloading = false;
    this.meleeHits.clear();
    this.meleeCooldown = 0.46;
    this.meleeTimer = MELEE_DURATION;
    this.actors[2].play("slash", true);
    this.recoil = -0.65;
    this.audio.knife();
  }

  switchTo(id: WeaponId): void {
    if (
      !this.enabled ||
      this.meleeTimer > 0 ||
      !this.weapons[id].owned ||
      this.currentId === id
    )
      return;
    this.currentId = id;
    this.equipTimer = 0.22;
    this.reloading = false;
    this.updateModelVisibility();
  }

  purchaseShotgun(): boolean {
    if (this.weapons.shotgun.owned) return false;
    this.weapons.shotgun.owned = true;
    this.currentId = "shotgun";
    this.reloading = false;
    this.updateModelVisibility();
    return true;
  }

  refillAmmo(): boolean {
    let changed = false;
    for (const state of Object.values(this.weapons)) {
      if (!state.owned || state.reserve >= state.definition.reserveSize)
        continue;
      state.reserve = state.definition.reserveSize;
      changed = true;
    }
    return changed;
  }

  get hasShotgun(): boolean {
    return this.weapons.shotgun.owned;
  }

  get hud(): {
    name: string;
    ammo: number;
    reserve: number;
    reloading: boolean;
    slot: number;
  } {
    return {
      name: this.current.definition.name,
      ammo: this.current.ammo,
      reserve: this.current.reserve,
      reloading: this.reloading,
      slot: this.currentId === "pistol" ? 1 : 2,
    };
  }

  private get current(): WeaponState {
    return this.weapons[this.currentId];
  }

  private fire(): void {
    if (
      !this.enabled ||
      this.fireCooldown > 0 ||
      this.reloading ||
      this.meleeTimer > 0
    )
      return;
    const state = this.current;
    if (state.ammo <= 0) {
      this.reload();
      this.fireCooldown = 0.16;
      return;
    }
    state.ammo -= 1;
    this.actors[this.currentId === "pistol" ? 0 : 1].play("fire", true);
    this.fireCooldown = state.definition.fireDelay;
    this.recoil = this.currentId === "shotgun" ? 1 : 0.48;
    this.muzzleTimer = 0.055;
    const origin = this.player.camera.getWorldPosition(new THREE.Vector3());
    const forward = this.player.getViewDirection();
    this.effects.emit(
      origin.clone().addScaledVector(forward, 0.65),
      forward,
      "smoke",
    );
    const right = new THREE.Vector3(1, 0.3, 0).applyQuaternion(
      this.player.camera.getWorldQuaternion(new THREE.Quaternion()),
    );
    this.effects.emit(
      origin.clone().addScaledVector(forward, 0.4),
      right,
      "shell",
    );
    this.player.addShake(this.currentId === "shotgun" ? 0.045 : 0.017);
    if (this.currentId === "shotgun") {
      this.audio.shotgun();
      this.player.addImpulse(
        this.player.getViewDirection().multiplyScalar(-1),
        0.36,
      );
    } else {
      this.audio.pistol();
    }

    let hit = false;
    let headshot = false;
    for (let pellet = 0; pellet < state.definition.pellets; pellet += 1) {
      this.localDirection
        .set(
          (Math.random() - 0.5) * state.definition.spread,
          (Math.random() - 0.5) * state.definition.spread,
          -1,
        )
        .normalize();
      this.rayDirection
        .copy(this.localDirection)
        .applyQuaternion(
          this.player.camera.getWorldQuaternion(new THREE.Quaternion()),
        );
      const result = this.enemies.hitScan(
        this.player.camera.getWorldPosition(new THREE.Vector3()),
        this.rayDirection,
        state.definition.damage,
        state.definition.range,
      );
      if (result)
        this.effects.emit(
          result.enemy.position
            .clone()
            .add(new THREE.Vector3(0, result.headshot ? 1.95 : 1.1, 0)),
          this.rayDirection,
          "blood",
        );
      hit ||= result != null;
      headshot ||= result?.headshot === true;
    }
    this.onFireFeedback(hit, this.currentId === "shotgun", headshot);
    if (state.ammo === 0 && state.reserve > 0) this.autoReload = 0.21;
  }

  private finishReload(): void {
    const state = this.current;
    const needed = state.definition.clipSize - state.ammo;
    const amount = Math.min(needed, state.reserve);
    state.ammo += amount;
    state.reserve -= amount;
    this.reloading = false;
  }

  private updateModelVisibility(): void {
    this.pistolModel.visible = this.currentId === "pistol";
    this.shotgunModel.visible = this.currentId === "shotgun";
  }

  get attackWindow(): string {
    return this.meleeTimer > 0
      ? attackPhase(MELEE_DURATION - this.meleeTimer, KNIFE)
      : "idle";
  }
  clearInput(): void {
    this.triggerHeld = false;
    this.aimHeld = false;
  }
  setTrigger(held: boolean): void {
    this.triggerHeld = held && this.enabled;
    if (this.triggerHeld) this.fire();
  }
  setAim(held: boolean): void {
    this.aimHeld = held && this.enabled;
  }
  private buildModels(): void {
    for (const [index, id] of ["blackthorn", "widowmaker", "knife"].entries()) {
      const actor = this.assets.create(id);
      this.actors.push(actor);
      const target = [this.pistolModel, this.shotgunModel, this.meleeModel][
        index
      ];
      actor.root.scale.setScalar(0.68);
      target.add(actor.root);
      if (index < 2) this.group.add(target);
    }
    const fill = new THREE.PointLight(0xd9c2a2, 2, 2, 1);
    fill.position.set(-0.4, 0.2, -0.2);
    this.player.camera.add(fill);
    this.meleeModel.visible = false;
    if (import.meta.env.DEV) {
      this.debugCone = new THREE.Mesh(
        new THREE.ConeGeometry(1.9, KNIFE.range, 18, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xff2244,
          wireframe: true,
          transparent: true,
          opacity: 0.25,
          depthTest: false,
        }),
      );
      this.debugCone.rotation.x = -Math.PI / 2;
      this.debugCone.position.z = -KNIFE.range / 2;
      this.debugCone.visible = false;
      this.player.camera.add(this.debugCone);
      window.addEventListener("keydown", (event) => {
        if (event.code === "F8" && this.debugCone)
          this.debugCone.visible = !this.debugCone.visible;
      });
    }
  }

  private bindInput(): void {
    this.canvas.addEventListener("mousedown", (event) => {
      if (!this.enabled || this.canvas.dataset.mouseMode === "touch") return;
      if (event.button === 0) {
        this.triggerHeld = true;
        this.fire();
      }
      if (event.button === 2) this.aimHeld = true;
    });
    window.addEventListener("blur", () => this.clearInput());
    window.addEventListener("mouseup", (event) => {
      if (event.button === 0) this.triggerHeld = false;
      if (event.button === 2) this.aimHeld = false;
    });
    this.canvas.addEventListener("contextmenu", (event) =>
      event.preventDefault(),
    );
    window.addEventListener("keydown", (event) => {
      if (event.repeat) return;
      if (event.code === "Digit1") this.switchTo("pistol");
      if (event.code === "Digit2") this.switchTo("shotgun");
      if (event.code === "KeyQ") this.knife();
      if (event.code === "KeyR") this.reload();
    });
    this.canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        if (this.hasShotgun)
          this.switchTo(this.currentId === "pistol" ? "shotgun" : "pistol");
      },
      { passive: false },
    );
  }
}
