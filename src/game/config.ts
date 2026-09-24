import type { MovementProfile } from "./types";
export const WORLD = {
  halfWidth: 30,
  halfDepth: 24,
  floorY: 0,
  playerRadius: 0.42,
  standingHeight: 1.72,
  crouchingHeight: 1.02,
  gravity: 26,
} as const;

export const PLAYER: MovementProfile = {
  maxBlood: 100,
  walkSpeed: 7.2,
  sprintSpeed: 14.6,
  groundAcceleration: 52,
  airAcceleration: 13,
  groundFriction: 9,
  jumpSpeed: 9.2,
  slideDuration: 0.92,
  slideBoost: 16.8,
} as const;

export const MOON = {
  openingDelay: 2.5,
  intermissionSeconds: 20,
  spawnInterval: 0.72,
} as const;

export const COLORS = {
  bone: 0xe9e0cf,
  blood: 0x8e101d,
  darkBlood: 0x3b060d,
  charcoal: 0x090a0a,
  mallCyan: 0x70d7cc,
  mallGreen: 0x547f65,
  amber: 0xe9b36a,
} as const;

export function toRoman(value: number): string {
  const pairs: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let rest = Math.max(1, Math.floor(value));
  let result = "";
  for (const [amount, numeral] of pairs) {
    while (rest >= amount) {
      result += numeral;
      rest -= amount;
    }
  }
  return result;
}
