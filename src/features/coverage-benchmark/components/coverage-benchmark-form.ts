import type {
  CoverageBenchmark,
  CoverageBenchmarkInput,
} from "@/features/coverage-benchmark/types/coverage-benchmark";

export type CoverageBenchmarkFieldName = keyof CoverageBenchmarkInput;
export type CoverageBenchmarkFieldErrors = Partial<
  Record<CoverageBenchmarkFieldName, string>
>;

export interface CoverageBenchmarkFormState {
  categoryId: string;
  gender: string;
  minAgeYears: string;
  maxAgeYears: string;
  adequateMinWon: string;
  excessiveMinWon: string;
}

const decimalPattern = /^(0|[1-9]\d*)$/;

export function createCoverageBenchmarkFormState(): CoverageBenchmarkFormState {
  return {
    categoryId: "",
    gender: "",
    minAgeYears: "",
    maxAgeYears: "",
    adequateMinWon: "",
    excessiveMinWon: "",
  };
}

export function resetCoverageBenchmarkForm(
  form: CoverageBenchmarkFormState,
  benchmark: CoverageBenchmark | null | undefined,
  errors: CoverageBenchmarkFieldErrors,
) {
  Object.keys(errors).forEach((field) => {
    delete errors[field as CoverageBenchmarkFieldName];
  });
  form.categoryId = benchmark?.categoryId ?? "";
  form.gender = benchmark?.gender ?? "";
  form.minAgeYears = benchmark ? String(benchmark.minAgeYears) : "";
  form.maxAgeYears = benchmark ? String(benchmark.maxAgeYears) : "";
  form.adequateMinWon = benchmark ? String(benchmark.adequateMinWon) : "";
  form.excessiveMinWon = benchmark ? String(benchmark.excessiveMinWon) : "";
}

function requiredDecimal(
  value: string,
  field: CoverageBenchmarkFieldName,
  label: string,
  errors: CoverageBenchmarkFieldErrors,
): bigint | undefined {
  if (!decimalPattern.test(value)) {
    errors[field] = `${label}은 0 이상의 정수로 입력해 주세요.`;
    return undefined;
  }
  return BigInt(value);
}

export function coverageBenchmarkInputFromForm(
  form: CoverageBenchmarkFormState,
  errors: CoverageBenchmarkFieldErrors,
): CoverageBenchmarkInput | undefined {
  Object.keys(errors).forEach((field) => {
    delete errors[field as CoverageBenchmarkFieldName];
  });
  const categoryId = form.categoryId.trim();
  const gender = form.gender.trim();
  if (!categoryId) errors.categoryId = "보장 카테고리를 선택해 주세요.";
  if (!gender) errors.gender = "고객 성별 저장값을 입력해 주세요.";
  else if (Array.from(gender).length > 100) {
    errors.gender = "성별 저장값은 100자 이내로 입력해 주세요.";
  }
  const minAge = requiredDecimal(form.minAgeYears, "minAgeYears", "최소 만나이", errors);
  const maxAge = requiredDecimal(form.maxAgeYears, "maxAgeYears", "최대 만나이", errors);
  const adequate = requiredDecimal(form.adequateMinWon, "adequateMinWon", "적정 하한", errors);
  const excessive = requiredDecimal(form.excessiveMinWon, "excessiveMinWon", "과다 하한", errors);
  if (Object.keys(errors).length > 0) return undefined;

  return {
    categoryId,
    gender,
    minAgeYears: Number(minAge),
    maxAgeYears: Number(maxAge),
    adequateMinWon: adequate!,
    excessiveMinWon: excessive!,
  };
}
