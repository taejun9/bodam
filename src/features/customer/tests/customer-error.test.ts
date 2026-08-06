import { describe, expect, it } from "vitest";

import {
  CustomerRepositoryError,
  CustomerValidationError,
  customerSafeMessage,
} from "../types/customer-error";

describe("customerSafeMessage", () => {
  it("preserves only allowlisted customer application errors", () => {
    expect(
      customerSafeMessage(new CustomerRepositoryError("고객을 찾을 수 없습니다.")),
    ).toBe("고객을 찾을 수 없습니다.");
    expect(
      customerSafeMessage(
        new CustomerValidationError([{ field: "name", message: "이름이 필요합니다." }]),
      ),
    ).toBe("입력 내용을 확인해 주세요.");
  });

  it("redacts unexpected error messages and values", () => {
    expect(customerSafeMessage(new Error("sqlite failed for Synthetic Private Value"))).toBe(
      "작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });
});
