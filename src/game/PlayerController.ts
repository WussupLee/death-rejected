import * as THREE from "three";
import { PLAYER, WORLD } from "./config";
import { damp } from "./math";
import type { Environment } from "./Environment";

export class PlayerController {
  readonly camera = new THREE.PerspectiveCamera(78, 1, 0.06, 140);
  readonly position = new THREE.Vector3(-10, 0, 7);
  readonly velocity = new THREE.Vector3();
  readonly yaw = new THREE.Object3D();
  readonly pitch = new THREE.Object3D();
  enabled = false;
  fallbackLookEnabled = false;
  isGrounded = true;
  isSliding = false;
  isCrouching = false;

  private readonly keys = new Set<string>();
  private slideTime = 0;
  private eyeHeight: number = WORLD.standingHeight;
  private bobTime = 0;
  private verticalSpeed = 0;
  private shakeStrength = 0;
  private readonly moveDirection = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private fallbackEdgeX = 0;
  private fallbackEdgeY = 0;

  constructor(
    private readonly environment: Environment,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.yaw.add(this.pitch);
    this.pitch.add(this.camera);
    this.camera.rotation.order = "YXZ";
    this.camera.position.set(0, 0, 0);
    this.bindInput();
    this.syncRig(0);
  }

  reset(): void {
    this.position.set(-10, 0, 7);
    this.velocity.set(0, 0, 0);
    this.verticalSpeed = 0;
    this.yaw.rotation.y = -0.55;
    this.pitch.rotation.x = 0;
    this.isGrounded = true;
    this.isSliding = false;
    this.isCrouching = false;
    this.slideTime = 0;
    this.eyeHeight = WORLD.standingHeight;
    this.syncRig(0);
  }

  update(delta: number): void {
    if (!this.enabled) {
      this.syncRig(delta);
      return;
    }

    if (this.fallbackLookEnabled && (this.fallbackEdgeX !== 0 || this.fallbackEdgeY !== 0)) {
      this.yaw.rotation.y -= this.fallbackEdgeX * delta * 2.65;
      this.pitch.rotation.x -= this.fallbackEdgeY * delta * 2.1;
      this.pitch.rotation.x = THREE.MathUtils.clamp(this.pitch.rotation.x, -1.48, 1.48);
      this.canvas.dataset.lookYaw = this.lookYaw.toFixed(3);
      this.canvas.dataset.lookPitch = this.lookPitch.toFixed(3);
    }

    const forwardAmount = (this.isDown("KeyW") ? 1 : 0) - (this.isDown("KeyS") ? 1 : 0);
    const sideAmount = (this.isDown("KeyD") ? 1 : 0) - (this.isDown("KeyA") ? 1 : 0);
    const hasInput = forwardAmount !== 0 || sideAmount !== 0;
    const sprinting = this.isDown("ShiftLeft") || this.isDown("ShiftRight");

    this.forward.set(-Math.sin(this.yaw.rotation.y), 0, -Math.cos(this.yaw.rotation.y));
    this.right.set(Math.cos(this.yaw.rotation.y), 0, -Math.sin(this.yaw.rotation.y));
    this.moveDirection.set(0, 0, 0)
      .addScaledVector(this.forward, forwardAmount)
      .addScaledVector(this.right, sideAmount);
    if (this.moveDirection.lengthSq() > 1) this.moveDirection.normalize();

    if (this.isSliding) {
      this.slideTime -= delta;
      if (this.slideTime <= 0 || this.speed < 4.2) this.isSliding = false;
      if (hasInput && !this.isGrounded) this.applyAirControl(delta, PLAYER.sprintSpeed);
      this.velocity.multiplyScalar(Math.exp(-0.72 * delta));
    } else if (this.isGrounded) {
      const targetSpeed = sprinting && forwardAmount > 0 ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      if (hasInput) {
        const desiredX = this.moveDirection.x * targetSpeed;
        const desiredZ = this.moveDirection.z * targetSpeed;
        this.velocity.x = damp(this.velocity.x, desiredX, PLAYER.groundAcceleration / Math.max(targetSpeed, 1), delta);
        this.velocity.z = damp(this.velocity.z, desiredZ, PLAYER.groundAcceleration / Math.max(targetSpeed, 1), delta);
      } else {
        const friction = Math.exp(-PLAYER.groundFriction * delta);
        this.velocity.x *= friction;
        this.velocity.z *= friction;
      }
    } else if (hasInput) {
      this.applyAirControl(delta, sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed);
    }

    this.verticalSpeed -= WORLD.gravity * delta;
    this.position.y += this.verticalSpeed * delta;
    if (this.position.y <= WORLD.floorY) {
      this.position.y = WORLD.floorY;
      this.verticalSpeed = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    this.moveWithCollision(delta);
    this.isCrouching = this.isDown("ControlLeft") || this.isDown("ControlRight") || this.isDown("KeyC");
    const targetEye = this.isSliding || this.isCrouching ? WORLD.crouchingHeight : WORLD.standingHeight;
    this.eyeHeight = damp(this.eyeHeight, targetEye, this.isSliding ? 22 : 13, delta);
    this.syncRig(delta);
  }

  startSlide(): void {
    if (!this.enabled || !this.isGrounded || this.isSliding || this.speed < 6.1) return;
    this.isSliding = true;
    this.slideTime = PLAYER.slideDuration;
    const direction = this.speed > 0.1
      ? this.velocity.clone().setY(0).normalize()
      : this.forward.clone();
    const carriedSpeed = Math.max(this.speed * 1.08, PLAYER.slideBoost);
    this.velocity.x = direction.x * carriedSpeed;
    this.velocity.z = direction.z * carriedSpeed;
  }

  jump(): void {
    if (!this.enabled || !this.isGrounded) return;
    this.verticalSpeed = PLAYER.jumpSpeed;
    this.position.y = 0.025;
    this.isGrounded = false;
    if (this.isSliding) {
      const boost = Math.max(this.speed, PLAYER.slideBoost * 1.03);
      const planar = this.velocity.clone().setY(0).normalize();
      this.velocity.x = planar.x * boost;
      this.velocity.z = planar.z * boost;
      this.isSliding = false;
    }
  }

  addImpulse(direction: THREE.Vector3, amount: number): void {
    this.velocity.addScaledVector(direction.clone().setY(0).normalize(), amount);
  }

  addShake(strength: number): void {
    this.shakeStrength = Math.max(this.shakeStrength, strength);
  }

  get speed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  get isAirborne(): boolean {
    return !this.isGrounded;
  }

  get lookYaw(): number {
    return this.yaw.rotation.y;
  }

  get lookPitch(): number {
    return this.pitch.rotation.x;
  }

  getViewDirection(target = new THREE.Vector3()): THREE.Vector3 {
    return this.camera.getWorldDirection(target);
  }

  private applyAirControl(delta: number, maxSpeed: number): void {
    const desiredX = this.moveDirection.x * maxSpeed;
    const desiredZ = this.moveDirection.z * maxSpeed;
    const amount = PLAYER.airAcceleration * delta;
    this.velocity.x = THREE.MathUtils.clamp(this.velocity.x + THREE.MathUtils.clamp(desiredX - this.velocity.x, -amount, amount), -21, 21);
    this.velocity.z = THREE.MathUtils.clamp(this.velocity.z + THREE.MathUtils.clamp(desiredZ - this.velocity.z, -amount, amount), -21, 21);
  }

  private moveWithCollision(delta: number): void {
    const radius = WORLD.playerRadius;
    const nextX = this.position.clone();
    nextX.x += this.velocity.x * delta;
    if (!this.environment.isBlocked(nextX, radius)) this.position.x = nextX.x;
    else this.velocity.x *= -0.08;

    const nextZ = this.position.clone();
    nextZ.z += this.velocity.z * delta;
    if (!this.environment.isBlocked(nextZ, radius)) this.position.z = nextZ.z;
    else this.velocity.z *= -0.08;
  }

  private syncRig(delta: number): void {
    const moving = this.speed > 0.7 && this.isGrounded && this.enabled;
    if (moving) this.bobTime += delta * (this.isSliding ? 15 : 8 + this.speed * 0.6);
    const bob = moving && !this.isSliding ? Math.sin(this.bobTime) * Math.min(0.045, this.speed * 0.004) : 0;
    this.shakeStrength = damp(this.shakeStrength, 0, 14, delta);
    const shakeX = (Math.random() - 0.5) * this.shakeStrength;
    const shakeY = (Math.random() - 0.5) * this.shakeStrength;
    this.yaw.position.set(this.position.x + shakeX, this.position.y + this.eyeHeight + bob + shakeY, this.position.z);
    this.pitch.rotation.z = damp(this.pitch.rotation.z, this.isSliding ? -0.045 : 0, 10, delta);
  }

  private isDown(code: string): boolean {
    return this.keys.has(code);
  }

  private bindInput(): void {
    window.addEventListener("keydown", (event) => {
      this.keys.add(event.code);
      if (["Space", "KeyC", "ControlLeft", "ControlRight"].includes(event.code)) event.preventDefault();
      if (event.code === "Space" && !event.repeat) this.jump();
      if (["KeyC", "ControlLeft", "ControlRight"].includes(event.code) && !event.repeat) this.startSlide();
    });
    window.addEventListener("keyup", (event) => this.keys.delete(event.code));
    const updateLook = (event: MouseEvent): void => {
      if (!this.enabled) return;
      this.yaw.rotation.y -= event.movementX * 0.00215;
      this.pitch.rotation.x -= event.movementY * 0.0019;
      this.pitch.rotation.x = THREE.MathUtils.clamp(this.pitch.rotation.x, -1.48, 1.48);
    };
    window.addEventListener("mousemove", (event) => {
      if (document.pointerLockElement !== this.canvas) return;
      updateLook(event);
    });
    this.canvas.addEventListener("mousemove", (event) => {
      if (!this.fallbackLookEnabled) return;
      updateLook(event);
      const bounds = this.canvas.getBoundingClientRect();
      const normalizedX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      const normalizedY = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
      const edgeStrength = (value: number): number => {
        const threshold = 0.78;
        const magnitude = Math.abs(value);
        return magnitude <= threshold ? 0 : Math.sign(value) * (magnitude - threshold) / (1 - threshold);
      };
      this.fallbackEdgeX = edgeStrength(normalizedX);
      this.fallbackEdgeY = edgeStrength(normalizedY);
      this.canvas.dataset.lookYaw = this.lookYaw.toFixed(3);
      this.canvas.dataset.lookPitch = this.lookPitch.toFixed(3);
    });
    this.canvas.addEventListener("mouseleave", () => {
      this.fallbackEdgeX = 0;
      this.fallbackEdgeY = 0;
    });
    window.addEventListener("blur", () => this.keys.clear());
  }
}
