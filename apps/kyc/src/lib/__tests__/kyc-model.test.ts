import { describe, expect, it } from "vitest";
import { kycCaseModel } from "../kyc-model";

describe("kycCaseModel registration", () => {
  it("registers cleanly via defineModel with valid fields and listColumns", () => {
    expect(kycCaseModel.name).toBe("kyc_case");
    expect(kycCaseModel.resource).toBe("kyc_case");
    expect(kycCaseModel.listColumns.length).toBeGreaterThan(0);
  });
});
