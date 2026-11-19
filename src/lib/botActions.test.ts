import { describe, expect, it } from "vitest";
import { applyBotConsumable, assignStartingCarDrivers, BOT_AIRCRAFT_BOARD_RANGE, BOT_CAR_BOARD_RANGE, BOT_MAX_HEALTH, BOT_MAX_SHIELD, BOT_STARTING_CAR_COUNT, canBotBoardVehicle, chooseBotConsumable } from "./botActions";

describe("bot survivability", () => {
  it("starts bots with 250 health and 100 shield", () => {
    expect(BOT_MAX_HEALTH).toBe(250);
    expect(BOT_MAX_SHIELD).toBe(100);
  });

  it("starts eight bots driving visible cars and keeps each car tied to its bot", () => {
    const cars = Array.from({ length: 10 }, (_, id) => ({ id, botDriver: null as number | null }));
    const assignments = assignStartingCarDrivers(cars, 3);

    expect(BOT_STARTING_CAR_COUNT).toBe(8);
    expect(assignments).toHaveLength(8);
    expect(assignments.map(({ botId }) => botId)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    expect(cars.slice(0, 8).map((car) => car.botDriver)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    expect(cars[8]?.botDriver).toBeNull();
  });

  it("uses a medkit to restore a damaged bot to 250 health", () => {
    const needs = { health: 70, shield: 20, medkits: 1, shieldPotions: 1 };
    expect(chooseBotConsumable(needs, false)).toBe("med");
    expect(applyBotConsumable(needs, "med")).toEqual({
      health: 250,
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

  it("waits when health and shield are already healthy", () => {
    expect(chooseBotConsumable({ health: 100, shield: 100, medkits: 1, shieldPotions: 1 }, false)).toBeNull();
  });
});

describe("bot vehicle access", () => {
  it("allows nearby bots to board free cars and aircraft, but not occupied or distant ones", () => {
    expect(canBotBoardVehicle(18, false, BOT_CAR_BOARD_RANGE)).toBe(true);
    expect(canBotBoardVehicle(55, false, BOT_AIRCRAFT_BOARD_RANGE)).toBe(true);
    expect(canBotBoardVehicle(18.1, false, BOT_CAR_BOARD_RANGE)).toBe(false);
    expect(canBotBoardVehicle(5, true, BOT_CAR_BOARD_RANGE)).toBe(false);
  });
});