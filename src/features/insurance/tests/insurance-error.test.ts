import { describe, expect, it } from "vitest";

import {
  InsuranceRepositoryError,
  InsuranceValidationError,
  insuranceSafeMessage,
} from "../types/insurance-error";

describe("insuranceSafeMessage", () => {
  it("allows known messages and redacts unexpected error details", () => {
    expect(
      insuranceSafeMessage(
        new InsuranceValidationError([
          { field: "insurer", message: "보험사를 입력해 주세요." },
        ]),
      ),
    ).toBe("입력 내용을 확인해 주세요.");
    expect(
      insuranceSafeMessage(
        new InsuranceRepositoryError("보험계약을 찾을 수 없습니다.", "not_found"),
      ),
    ).toBe("보험계약을 찾을 수 없습니다.");
    expect(insuranceSafeMessage(new Error("synthetic private database detail"))).toBe(
      "작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });
});
