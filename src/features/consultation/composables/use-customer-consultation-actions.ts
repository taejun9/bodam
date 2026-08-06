import { ref } from "vue";

import { consultationApplication } from "@/app/composition/consultation";
import type {
  Consultation,
  ConsultationInput,
} from "@/features/consultation/types/consultation";
import {
  ConsultationValidationError,
  consultationSafeMessage,
} from "@/features/consultation/types/consultation-error";

import type {
  ConsultationFieldErrors,
  ConsultationFieldName,
} from "../components/consultation-form";

interface ConsultationActionOptions {
  customerId: () => string;
  reload: (expectedCustomerId: string) => Promise<void>;
  showNotice: (message: string) => void;
  focusCreate: () => Promise<void>;
}

export function useCustomerConsultationActions(options: ConsultationActionOptions) {
  const formOpen = ref(false);
  const selectedConsultation = ref<Consultation>();
  const submitting = ref(false);
  const formErrors = ref<ConsultationFieldErrors>({});
  const formSubmitError = ref<string>();
  const deleteOpen = ref(false);
  const deletingConsultation = ref<Consultation>();
  const deleting = ref(false);
  const deleteError = ref<string>();

  function resetDialogs() {
    formOpen.value = false;
    deleteOpen.value = false;
    selectedConsultation.value = undefined;
    deletingConsultation.value = undefined;
    formErrors.value = {};
    formSubmitError.value = undefined;
    deleteError.value = undefined;
  }

  function createConsultation() {
    selectedConsultation.value = undefined;
    formErrors.value = {};
    formSubmitError.value = undefined;
    formOpen.value = true;
  }

  function editConsultation(consultation: Consultation) {
    selectedConsultation.value = consultation;
    formErrors.value = {};
    formSubmitError.value = undefined;
    formOpen.value = true;
  }

  function clearFormError(field: ConsultationFieldName) {
    const errors = { ...formErrors.value };
    delete errors[field];
    formErrors.value = errors;
  }

  function closeForm() {
    if (!submitting.value) formOpen.value = false;
  }

  async function saveConsultation(input: ConsultationInput) {
    const expectedCustomerId = options.customerId();
    const consultation = selectedConsultation.value;
    submitting.value = true;
    formErrors.value = {};
    formSubmitError.value = undefined;
    try {
      if (consultation) await consultationApplication.update(consultation.id, input);
      else await consultationApplication.create(expectedCustomerId, input);
      if (expectedCustomerId !== options.customerId()) return;
      formOpen.value = false;
      options.showNotice(
        consultation ? "상담 기록을 저장했습니다." : "새 상담 기록을 저장했습니다.",
      );
      await options.reload(expectedCustomerId);
      if (expectedCustomerId === options.customerId()) await options.focusCreate();
    } catch (error) {
      if (expectedCustomerId !== options.customerId()) return;
      if (error instanceof ConsultationValidationError) {
        const errors: ConsultationFieldErrors = {};
        for (const issue of error.issues) {
          if (
            issue.field === "consultedAt" ||
            issue.field === "content" ||
            issue.field === "nextContactOn" ||
            issue.field === "result"
          ) {
            errors[issue.field] = issue.message;
          }
        }
        formErrors.value = errors;
        if (Object.keys(errors).length === 0) formSubmitError.value = error.message;
      } else {
        formSubmitError.value = consultationSafeMessage(error);
      }
    } finally {
      submitting.value = false;
    }
  }

  function requestDelete(consultation: Consultation) {
    deletingConsultation.value = consultation;
    deleteError.value = undefined;
    deleteOpen.value = true;
  }

  function closeDelete() {
    if (!deleting.value) deleteOpen.value = false;
  }

  async function confirmDelete() {
    const consultation = deletingConsultation.value;
    if (!consultation) return;
    const expectedCustomerId = options.customerId();
    deleting.value = true;
    deleteError.value = undefined;
    try {
      await consultationApplication.remove(consultation.id);
      if (expectedCustomerId !== options.customerId()) return;
      deleteOpen.value = false;
      options.showNotice("상담 기록을 기본 목록에서 삭제했습니다.");
      await options.reload(expectedCustomerId);
      if (expectedCustomerId === options.customerId()) await options.focusCreate();
    } catch (error) {
      if (expectedCustomerId === options.customerId()) {
        deleteError.value = consultationSafeMessage(error);
      }
    } finally {
      deleting.value = false;
    }
  }

  return {
    formOpen,
    selectedConsultation,
    submitting,
    formErrors,
    formSubmitError,
    deleteOpen,
    deletingConsultation,
    deleting,
    deleteError,
    resetDialogs,
    createConsultation,
    editConsultation,
    clearFormError,
    closeForm,
    saveConsultation,
    requestDelete,
    closeDelete,
    confirmDelete,
  };
}
