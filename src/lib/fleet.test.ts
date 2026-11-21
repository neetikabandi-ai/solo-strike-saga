import { describe, expect, it } from "vitest";
import { assignStartingHelicopters, HELI_COUNT, JET_AFTERBURNER_SPEED, JET_CRUISE_SPEED, makeAircraft, NUKE_RADIUS, SPEED_OF_SOUND, updateJetSpeed } from "./fleet";

describe("nuke radius", () => {
  it("uses the requested 600-meter blast radius", () => {
    expect(NUKE_RADIUS).toBe(600);
  });
});

describe("jet afterburner", () => {
  it("can exceed the speed of sound", () => {
    expect(JET_AFTERBURNER_SPEED).toBeGreaterThan(SPEED_OF_SOUND);

    let speed = 0;
    for (let frame = 0; frame < 100; frame++) speed = updateJetSpeed(speed, 1, true, 0.05);
    expect(speed).toBe(JET_AFTERBURNER_SPEED);
  });

  it("keeps normal jet throttle below supersonic speed", () => {
    let speed = 0;
    for (let frame = 0; frame < 100; frame++) speed = updateJetSpeed(speed, 1, false, 0.05);
    expect(speed).toBe(JET_CRUISE_SPEED);
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