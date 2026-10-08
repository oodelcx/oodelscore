import { describe, it, expect } from "vitest";
import { severeResponseReason } from "./severeResponse";

describe("severeResponseReason", () => {
  it("is severe for a 1-star response", () => {
    expect(severeResponseReason([{ type: "star_1_5", value: 1 }])).toContain("1 out of 5");
  });
  it("uses the average of several star answers", () => {
    expect(severeResponseReason([{ type: "star_1_5", value: 1 }, { type: "star_1_5", value: 2 }])).not.toBeNull();
    expect(severeResponseReason([{ type: "star_1_5", value: 1 }, { type: "star_1_5", value: 3 }])).toBeNull();
  });
  it("is severe for a recommend score of 0 to 2 only", () => {
    expect(severeResponseReason([{ type: "nps_0_10", value: 2 }])).not.toBeNull();
    expect(severeResponseReason([{ type: "nps_0_10", value: 3 }])).toBeNull();
  });
  it("is not severe with no scored answers", () => {
    expect(severeResponseReason([{ type: "open_text", value: "ok" }])).toBeNull();
  });
});
