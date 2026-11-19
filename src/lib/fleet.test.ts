import { describe, expect, it } from "vitest";
import { assignStartingHelicopters, HELI_COUNT, makeAircraft, NUKE_RADIUS } from "./fleet";

describe("nuke radius", () => {
  it("uses the requested 600-meter blast radius", () => {
    expect(NUKE_RADIUS).toBe(600);
  });
});

describe("starting bot helicopters", () => {
  it("assigns the first three helicopters to bots at match start", () => {
    const aircraft = makeAircraft();
    const assignments = assignStartingHelicopters(aircraft);

    expect(assignments).toHaveLength(3);
    expect(HELI_COUNT).toBe(10);
    expect(assignments.map(({ aircraftId }) => aircraft.find((a) => a.id === aircraftId)?.pilotBotId)).toEqual([
      0,
      1,
      2,
    ]);
    expect(assignments.map(({ aircraftId }) => aircraft.find((a) => a.id === aircraftId)?.kind)).toEqual([
      "heli",
      "heli",
      "heli",
    ]);
  });
});