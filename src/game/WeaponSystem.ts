import * as THREE from "three";
import type { AudioManager } from "./AudioManager";
import type { EnemySystem } from "./EnemySystem";
import type { PlayerController } from "./PlayerController";
import type { WeaponId } from "./types";

interface WeaponDefinition {
  id: WeaponId;
  name: string;
  clipSize: number;
  reserveSize: number;
  damage: number;
  fireDelay: number;
  reloadTime: number;
  range: number;
  pellets: number;
  spread: number;
}

interface WeaponState {
  definition: WeaponDefinition;
  ammo: number;
  reserve: number;
  owned: boolean;
}

const DEFINITIONS: Record<WeaponId, WeaponDefinition> = {
  pistol: {
    id: "pistol", name: "BLACKTHORN .45", clipSize: 12, reserveSize: 72,
    damage: 38, fireDelay: 0.19, reloadTime: 1.05, range: 75, pellets: 1, spread: 0.0025,
  },
  shotgun: {
    id: "shotgun", name: "WIDOWMAKER 12G", clipSize: 6, reserveSize: 30,
    damage: 17, fireDelay: 0.72, reloadTime: 1.38, range: 38, pellets: 8, spread: 0.052,
  },
};

const MELEE_DURATION = 0.42;
const MELEE_RANGE = 3.15;

export class WeaponSystem {
  readonly group = new THREE.Group();
  enabled = false;
  currentId: WeaponId = "pistol";

  private readonly weapons: Record<WeaponId, WeaponState> = {
    pistol: { definition: DEFINITIONS.pistol, ammo: 12, reserve: 72, owned: true },
    shotgun: { definition: DEFINITIONS.shotgun, ammo: 6, reserve: 30, owned: false },
  };
  private triggerHeld = false;
  private aimHeld = false;
  private fireCooldown = 0;
  private meleeCooldown = 0;
  private meleeTimer = 0;
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
    private readonly onFireFeedback: (hit: boolean, heavy: boolean, headshot: boolean) => void,
  ) {
    this.group.position.set(0.36, -0.32, -0.62);
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
    this.meleeModel.visible = false;
    this.canvas.dataset.meleeRange = String(MELEE_RANGE);
    this.reloadTimer = 0;
    this.reloading = false;
    this.triggerHeld = false;
    this.updateModelVisibility();
  }

  update(delta: number): void {
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
      this.meleeModel.position.set(0.58 - slash * 0.7, -0.54 + slash * 0.2, -0.58 - slash * 0.42);
      this.meleeModel.rotation.set(-0.38 - slash * 0.32, -0.18 - slash * 1.05, -0.28 - slash * 1.7);
    } else {
      this.meleeModel.visible = false;
      this.canvas.dataset.meleeActive = "false";
    }

    if (this.reloading) {
      this.reloadTimer -= delta;
      if (this.reloadTimer <= 0) this.finishReload();
    }
    if (this.enabled && this.triggerHeld && !this.reloading) this.fire();

    const moveSway = this.player.speed > 0.5 ? Math.sin(performance.now() * 0.008) * 0.018 : 0;
    this.sway += (moveSway - this.sway) * (1 - Math.exp(-9 * delta));
    this.recoil += (0 - this.recoil) * (1 - Math.exp(-13 * delta));
    const aim = this.aimHeld ? 0.42 : 1;
    this.group.position.x += ((0.36 * aim + this.sway) - this.group.position.x) * (1 - Math.exp(-10 * delta));
    this.group.position.y += ((-0.32 - Math.abs(this.sway) - this.recoil * 0.18) - this.group.position.y) * (1 - Math.exp(-12 * delta));
    this.group.rotation.x = this.recoil * 0.16;
    this.group.rotation.z = this.player.isSliding ? 0.18 : -this.sway * 0.9;
    this.player.camera.fov += ((this.aimHeld ? 66 : 78) - this.player.camera.fov) * (1 - Math.exp(-12 * delta));
    this.player.camera.updateProjectionMatrix();
  }

  reload(): void {
    if (!this.enabled || this.reloading) return;
    const state = this.current;
    if (state.ammo >= state.definition.clipSize || state.reserve <= 0) return;
    this.reloading = true;
    this.reloadTimer = state.definition.reloadTime;
    this.audio.reload();
  }

  knife(): void {
    if (!this.enabled || this.meleeCooldown > 0) return;
    this.meleeCooldown = 0.46;
    this.meleeTimer = MELEE_DURATION;
    this.recoil = -0.65;
    this.audio.knife();
    const result = this.enemies.melee(this.player.position, this.player.getViewDirection(), 74, MELEE_RANGE);
    if (result) {
      this.onFireFeedback(true, false, false);
      this.player.addImpulse(this.player.getViewDirection(), 0.7);
    }
  }

  switchTo(id: WeaponId): void {
    if (!this.weapons[id].owned || this.currentId === id) return;
    this.currentId = id;
    this.reloading = false;
    this.updateModelVisibility();
  }

  purchaseShotgun(): boolean {
    if (this.weapons.shotgun.owned) return false;
    this.weapons.shotgun.owned = true;
    this.currentId = "shotgun";
    this.updateModelVisibility();
    return true;
  }

  refillAmmo(): boolean {
    let changed = false;
    for (const state of Object.values(this.weapons)) {
      if (!state.owned || state.reserve >= state.definition.reserveSize) continue;
      state.reserve = state.definition.reserveSize;
      changed = true;
    }
    return changed;
  }

  get hasShotgun(): boolean {
    return this.weapons.shotgun.owned;
  }

  get hud(): { name: string; ammo: number; reserve: number; reloading: boolean; slot: number } {
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
    if (!this.enabled || this.fireCooldown > 0 || this.reloading) return;
    const state = this.current;
    if (state.ammo <= 0) {
      this.reload();
      this.fireCooldown = 0.16;
      return;
    }
    state.ammo -= 1;
    this.fireCooldown = state.definition.fireDelay;
    this.recoil = this.currentId === "shotgun" ? 1 : 0.48;
    this.muzzleTimer = 0.045;
    this.player.addShake(this.currentId === "shotgun" ? 0.045 : 0.017);
    if (this.currentId === "shotgun") {
      this.audio.shotgun();
      this.player.addImpulse(this.player.getViewDirection().multiplyScalar(-1), 0.36);
    } else {
      this.audio.pistol();
    }

    let hit = false;
    let headshot = false;
    for (let pellet = 0; pellet < state.definition.pellets; pellet += 1) {
      this.localDirection.set(
        (Math.random() - 0.5) * state.definition.spread,
        (Math.random() - 0.5) * state.definition.spread,
        -1,
      ).normalize();
      this.rayDirection.copy(this.localDirection).applyQuaternion(this.player.camera.getWorldQuaternion(new THREE.Quaternion()));
      const result = this.enemies.hitScan(
        this.player.camera.getWorldPosition(new THREE.Vector3()),
        this.rayDirection,
        state.definition.damage,
        state.definition.range,
      );
      hit ||= result != null;
      headshot ||= result?.headshot === true;
    }
    this.onFireFeedback(hit, this.currentId === "shotgun", headshot);
    if (state.ammo === 0 && state.reserve > 0) window.setTimeout(() => this.reload(), 210);
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

  private buildModels(): void {
    const black = new THREE.MeshStandardMaterial({ color: 0x121313, roughness: 0.34, metalness: 0.82 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x4e5552, roughness: 0.28, metalness: 0.9 });
    const red = new THREE.MeshStandardMaterial({ color: 0x5f0711, roughness: 0.45, metalness: 0.5, emissive: 0x180003 });
    const bone = new THREE.MeshStandardMaterial({ color: 0xb9aa90, roughness: 0.7 });
    const glove = new THREE.MeshStandardMaterial({ color: 0x171315, roughness: 0.92 });
    const blade = new THREE.MeshStandardMaterial({ color: 0xd5ddd9, roughness: 0.2, metalness: 0.92 });

    const pistolBody = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.7), black);
    pistolBody.position.z = -0.2;
    const pistolSlide = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.78), steel);
    pistolSlide.position.set(0, 0.12, -0.24);
    const pistolGrip = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.42, 0.22), red);
    pistolGrip.position.set(0, -0.25, 0.03);
    pistolGrip.rotation.x = -0.25;
    const pistolSigil = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 5, 10), bone);
    pistolSigil.position.set(0.126, -0.05, -0.14);
    pistolSigil.rotation.y = Math.PI / 2;
    this.pistolModel.add(pistolBody, pistolSlide, pistolGrip, pistolSigil);

    const shotgunBody = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.27, 1.25), black);
    shotgunBody.position.z = -0.38;
    const shotgunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 1.22, 8), steel);
    shotgunBarrel.rotation.x = Math.PI / 2;
    shotgunBarrel.position.set(0, 0.12, -0.95);
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.4), red);
    pump.position.set(0, -0.05, -0.72);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.48), bone);
    stock.position.set(0, -0.08, 0.4);
    stock.rotation.x = -0.12;
    this.shotgunModel.add(shotgunBody, shotgunBarrel, pump, stock);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.52, 3, 7), glove);
    forearm.rotation.x = Math.PI / 2;
    forearm.position.set(0.08, -0.03, 0.22);
    const fist = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.28), glove);
    fist.position.z = -0.17;
    const knifeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.3, 7), red);
    knifeHandle.rotation.x = Math.PI / 2;
    knifeHandle.position.z = -0.37;
    const knifeBlade = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.62, 4), blade);
    knifeBlade.rotation.x = -Math.PI / 2;
    knifeBlade.rotation.z = Math.PI / 4;
    knifeBlade.position.z = -0.78;
    this.meleeModel.add(forearm, fist, knifeHandle, knifeBlade);
    this.meleeModel.visible = false;
    this.meleeModel.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = true;
    });

    for (const model of [this.pistolModel, this.shotgunModel]) {
      model.traverse((object) => {
        if (object instanceof THREE.Mesh) object.castShadow = true;
      });
      this.group.add(model);
    }
  }

  private bindInput(): void {
    this.canvas.addEventListener("mousedown", (event) => {
      if (event.button === 0) this.triggerHeld = true;
      if (event.button === 2) this.aimHeld = true;
    });
    window.addEventListener("mouseup", (event) => {
      if (event.button === 0) this.triggerHeld = false;
      if (event.button === 2) this.aimHeld = false;
    });
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    window.addEventListener("keydown", (event) => {
      if (event.repeat) return;
      if (event.code === "Digit1") this.switchTo("pistol");
      if (event.code === "Digit2") this.switchTo("shotgun");
      if (event.code === "KeyQ") this.knife();
      if (event.code === "KeyR") this.reload();
    });
    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      if (this.hasShotgun) this.switchTo(this.currentId === "pistol" ? "shotgun" : "pistol");
    }, { passive: false });
  }
}
