import type {
  InsurancePolicy,
  InsurancePolicyInput,
} from "@/features/insurance/types/insurance-policy";

export type InsurancePolicyFieldName = keyof InsurancePolicyInput;
export type InsurancePolicyFieldErrors = Partial<
  Record<InsurancePolicyFieldName, string>
>;

export interface InsurancePolicyFormState {
  insurer: string;
  productName: string;
  monthlyPremiumWon: string;
  joinedOn: string;
  maturesOn: string;
  coverageTerm: string;
  paymentTerm: string;
  disclosurePlan: string;
  status: string;
  renewable: boolean;
  isIncluded: boolean;
}

const maximumPremiumWon = 9_223_372_036_854_775_807n;

export function createPolicyFormState(): InsurancePolicyFormState {
  return {
    insurer: "",
    productName: "",
    monthlyPremiumWon: "",
    joinedOn: "",
    maturesOn: "",
    coverageTerm: "",
    paymentTerm: "",
    disclosurePlan: "",
    status: "",
    renewable: false,
    isIncluded: true,
  };
}

export function resetPolicyForm(
  form: InsurancePolicyFormState,
  policy: InsurancePolicy | null | undefined,
  errors: InsurancePolicyFieldErrors,
) {
  form.insurer = policy?.insurer ?? "";
  form.productName = policy?.productName ?? "";
  form.monthlyPremiumWon = policy?.monthlyPremiumWon.toString() ?? "";
  form.joinedOn = policy?.joinedOn ?? "";
  form.maturesOn = policy?.maturesOn ?? "";
  form.coverageTerm = policy?.coverageTerm ?? "";
  form.paymentTerm = policy?.paymentTerm ?? "";
  form.disclosurePlan = policy?.disclosurePlan ?? "";
  form.status = policy?.status ?? "";
  form.renewable = policy?.renewable ?? false;
  form.isIncluded = policy?.isIncluded ?? true;
  for (const key of Object.keys(errors) as InsurancePolicyFieldName[]) delete errors[key];
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function policyInputFromForm(
  form: InsurancePolicyFormState,
  errors: InsurancePolicyFieldErrors,
): InsurancePolicyInput | undefined {
  if (!form.insurer.trim()) errors.insurer = "보험사를 입력해 주세요.";
  if (!form.productName.trim()) errors.productName = "상품명을 입력해 주세요.";

  const premium = form.monthlyPremiumWon.trim();
  if (!/^(0|[1-9][0-9]*)$/.test(premium)) {
    errors.monthlyPremiumWon = "월보험료는 0 이상의 원 단위 정수로 입력해 주세요.";
  } else if (BigInt(premium) > maximumPremiumWon) {
    errors.monthlyPremiumWon = "월보험료가 저장 가능한 범위를 넘었습니다.";
  }
  if (Object.keys(errors).length > 0) return undefined;

  return {
    insurer: form.insurer.trim(),
    productName: form.productName.trim(),
    monthlyPremiumWon: BigInt(premium),
    joinedOn: nullable(form.joinedOn),
    maturesOn: nullable(form.maturesOn),
    coverageTerm: nullable(form.coverageTerm),
    paymentTerm: nullable(form.paymentTerm),
    disclosurePlan: nullable(form.disclosurePlan),
    status: nullable(form.status),
    renewable: form.renewable,
    isIncluded: form.isIncluded,
  };
}
