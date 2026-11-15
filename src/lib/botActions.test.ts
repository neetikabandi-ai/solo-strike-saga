import { describe, expect, it } from "vitest";
import { applyBotConsumable, chooseBotConsumable } from "./botActions";

describe("bot consumables", () => {
  it("uses a medkit to restore a damaged bot to 150 health", () => {
    const needs = { health: 70, shield: 20, medkits: 1, shieldPotions: 1 };
    expect(chooseBotConsumable(needs, false)).toBe("med");
    expect(applyBotConsumable(needs, "med")).toEqual({
      health: 150,
      shield: 20,
      medkits: 0,
      shieldPotions: 1,
    });
  });

  it("uses a shield potion when shield is low and adds up to 50 shield", () => {
    const needs = { health: 120, shield: 35, medkits: 1, shieldPotions: 1 };
    expect(chooseBotConsumable(needs, false)).toBe("shield");
    expect(applyBotConsumable(needs, "shield")).toEqual({
      health: 120,
      shield: 85,
      medkits: 1,
      shieldPotions: 0,
    });
  });

  it("does not consume healing items while fighting", () => {
    expect(chooseBotConsumable({ health: 20, shield: 0, medkits: 1, shieldPotions: 1 }, true)).toBeNull();
  });
});