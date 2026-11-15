import { describe, expect, it } from "vitest";
import { NUKE_RADIUS } from "./fleet";

describe("nuke radius", () => {
  it("uses the requested 600-meter blast radius", () => {
    expect(NUKE_RADIUS).toBe(600);
  });
});