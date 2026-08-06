import type { Coverage, CoverageInput } from "@/features/coverage/types/coverage";

export type CoverageFieldName = keyof CoverageInput;
export type CoverageFieldErrors = Partial<Record<CoverageFieldName, string>>;

export interface CoverageFormState {
  categoryId: string;
  amountWon: string;
}

const MAX_SQLITE_INTEGER = 9_223_372_036_854_775_807n;

export function createCoverageFormState(): CoverageFormState {
  return { categoryId: "", amountWon: "" };
}

export function resetCoverageForm(
  form: CoverageFormState,
  coverage: Coverage | null | undefined,
  errors: CoverageFieldErrors,
) {
  form.categoryId = coverage?.categoryId ?? "";
  form.amountWon = coverage?.amountWon.toString() ?? "";
  for (const key of Object.keys(errors) as CoverageFieldName[]) delete errors[key];
}

export function coverageInputFromForm(
  form: CoverageFormState,
  errors: CoverageFieldErrors,
): CoverageInput | undefined {
  if (!form.categoryId) errors.categoryId = "보장 카테고리를 선택해 주세요.";

  const amount = form.amountWon;
  if (!/^(0|[1-9][0-9]*)$/.test(amount)) {
    errors.amountWon = "보장금액은 0 이상의 원 단위 정수로 입력해 주세요.";
  } else if (BigInt(amount) > MAX_SQLITE_INTEGER) {
    errors.amountWon = "보장금액이 저장 가능한 범위를 넘었습니다.";
  }
  if (Object.keys(errors).length > 0) return undefined;

  return { categoryId: form.categoryId, amountWon: BigInt(amount) };
}
