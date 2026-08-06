import { ref } from "vue";

import { insuranceApplication } from "@/app/composition/insurance";
import type {
  InsurancePolicy,
  InsurancePolicyInput,
} from "@/features/insurance/types/insurance-policy";
import {
  InsuranceValidationError,
  insuranceSafeMessage,
} from "@/features/insurance/types/insurance-error";

type PolicyFieldErrors = Partial<Record<keyof InsurancePolicyInput, string>>;

interface CustomerInsuranceActionOptions {
  customerId: () => string;
  loadPolicies: (expectedCustomerId?: string) => Promise<void>;
  showNotice: (message: string) => void;
}

export function useCustomerInsuranceActions(options: CustomerInsuranceActionOptions) {
  const formOpen = ref(false);
  const selectedPolicy = ref<InsurancePolicy>();
  const submitting = ref(false);
  const formErrors = ref<PolicyFieldErrors>({});
  const formSubmitError = ref<string>();
  const deleteOpen = ref(false);
  const deletingPolicy = ref<InsurancePolicy>();
  const deleting = ref(false);
  const deleteError = ref<string>();
  const coverageDialogOpen = ref(false);
  const coveragePolicy = ref<InsurancePolicy>();
  const coverageRefreshKey = ref(0);

  function resetDialogs() {
    formOpen.value = false;
    deleteOpen.value = false;
    coverageDialogOpen.value = false;
    selectedPolicy.value = undefined;
    deletingPolicy.value = undefined;
    coveragePolicy.value = undefined;
  }

  function createPolicy() {
    selectedPolicy.value = undefined;
    formErrors.value = {};
    formSubmitError.value = undefined;
    formOpen.value = true;
  }

  function editPolicy(policy: InsurancePolicy) {
    selectedPolicy.value = policy;
    formErrors.value = {};
    formSubmitError.value = undefined;
    formOpen.value = true;
  }

  function closeForm() {
    if (!submitting.value) formOpen.value = false;
  }

  async function savePolicy(input: InsurancePolicyInput) {
    const expectedCustomerId = options.customerId();
    const policy = selectedPolicy.value;
    submitting.value = true;
    formErrors.value = {};
    formSubmitError.value = undefined;
    try {
      if (policy) await insuranceApplication.update(policy.id, input);
      else await insuranceApplication.create(expectedCustomerId, input);
      if (expectedCustomerId !== options.customerId()) return;
      options.showNotice(policy ? "보험계약을 저장했습니다." : "새 보험계약을 등록했습니다.");
      formOpen.value = false;
      await options.loadPolicies(expectedCustomerId);
    } catch (error) {
      if (expectedCustomerId !== options.customerId()) return;
      if (error instanceof InsuranceValidationError) {
        const errors: PolicyFieldErrors = {};
        for (const issue of error.issues) {
          if (issue.field in input) {
            errors[issue.field as keyof InsurancePolicyInput] = issue.message;
          }
        }
        formErrors.value = errors;
        if (Object.keys(errors).length === 0) formSubmitError.value = error.message;
      } else formSubmitError.value = insuranceSafeMessage(error);
    } finally {
      submitting.value = false;
    }
  }

  function requestDelete(policy: InsurancePolicy) {
    deletingPolicy.value = policy;
    deleteError.value = undefined;
    deleteOpen.value = true;
  }

  function closeDelete() {
    if (!deleting.value) deleteOpen.value = false;
  }

  async function confirmDelete() {
    if (!deletingPolicy.value) return;
    const expectedCustomerId = options.customerId();
    const policyId = deletingPolicy.value.id;
    deleting.value = true;
    deleteError.value = undefined;
    try {
      await insuranceApplication.remove(policyId);
      if (expectedCustomerId !== options.customerId()) return;
      deleteOpen.value = false;
      options.showNotice("보험계약을 기본 목록에서 삭제했습니다.");
      await options.loadPolicies(expectedCustomerId);
    } catch (error) {
      if (expectedCustomerId === options.customerId()) {
        deleteError.value = insuranceSafeMessage(error);
      }
    } finally {
      deleting.value = false;
    }
  }

  function manageCoverage(policy: InsurancePolicy) {
    coveragePolicy.value = policy;
    coverageDialogOpen.value = true;
  }

  function coverageChanged(message: string) {
    coverageRefreshKey.value += 1;
    options.showNotice(message);
  }

  return {
    formOpen,
    selectedPolicy,
    submitting,
    formErrors,
    formSubmitError,
    deleteOpen,
    deletingPolicy,
    deleting,
    deleteError,
    coverageDialogOpen,
    coveragePolicy,
    coverageRefreshKey,
    resetDialogs,
    createPolicy,
    editPolicy,
    closeForm,
    savePolicy,
    requestDelete,
    closeDelete,
    confirmDelete,
    manageCoverage,
    coverageChanged,
  };
}
