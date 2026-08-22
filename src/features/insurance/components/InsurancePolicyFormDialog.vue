<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";

import type {
  InsurancePolicy,
  InsurancePolicyInput,
} from "@/features/insurance/types/insurance-policy";
import {
  createPolicyFormState,
  policyInputFromForm,
  resetPolicyForm,
  type InsurancePolicyFieldErrors as FieldErrors,
  type InsurancePolicyFieldName as FieldName,
} from "@/features/insurance/components/insurance-policy-form";
import AppButton from "@/shared/components/AppButton.vue";
import AppDialog from "@/shared/components/AppDialog.vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    policy?: InsurancePolicy | null | undefined;
    submitting?: boolean;
    errors?: FieldErrors;
    submitError?: string | undefined;
  }>(),
  {
    policy: null,
    submitting: false,
    errors: () => ({}),
    submitError: undefined,
  },
);

const emit = defineEmits<{
  close: [];
  submit: [input: InsurancePolicyInput];
}>();

const formElement = ref<HTMLFormElement>();
const localErrors = reactive<FieldErrors>({});
const form = reactive(createPolicyFormState());

const isEditing = computed(() => props.policy !== null);

function resetForm() {
  resetPolicyForm(form, props.policy, localErrors);
}

function errorFor(field: FieldName): string | undefined {
  return localErrors[field] ?? props.errors[field];
}

function describedBy(field: FieldName): string | undefined {
  return errorFor(field) ? `insurance-policy-${field}-error` : undefined;
}

function clearError(field: FieldName) {
  delete localErrors[field];
}

function focusFirstError() {
  void nextTick(() => {
    formElement.value?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  });
}

function submit() {
  const input = policyInputFromForm(form, localErrors);
  if (input === undefined) {
    focusFirstError();
    return;
  }
  emit("submit", input);
}

watch(
  () => [props.open, props.policy?.id] as const,
  ([open]) => {
    if (open) resetForm();
  },
);

watch(
  () => props.errors,
  (errors) => {
    if (Object.keys(errors).length > 0) focusFirstError();
  },
  { deep: true },
);
</script>

<template>
  <AppDialog
    :open="open"
    :title="isEditing ? '보험계약 수정' : '새 보험계약 등록'"
    description="보험사, 상품명, 월보험료는 필수입니다. 금액은 원 단위로 입력하세요."
    size="large"
    @close="emit('close')"
  >
    <form ref="formElement" class="insurance-form" novalidate @submit.prevent="submit">
      <p v-if="submitError" class="form-submit-error" role="alert">{{ submitError }}</p>
      <div class="form-grid">
        <label class="field">
          <span>보험사 <em>필수</em></span>
          <input
            v-model="form.insurer"
            name="insurer"
            maxlength="200"
            autocomplete="off"
            placeholder="예: 합성손해보험"
            autofocus
            :aria-invalid="Boolean(errorFor('insurer'))"
            :aria-describedby="describedBy('insurer')"
            @input="clearError('insurer')"
          />
          <small
            v-if="errorFor('insurer')"
            id="insurance-policy-insurer-error"
            class="field-error"
          >{{ errorFor("insurer") }}</small>
        </label>

        <label class="field">
          <span>상품명 <em>필수</em></span>
          <input
            v-model="form.productName"
            name="productName"
            maxlength="200"
            autocomplete="off"
            placeholder="예: 합성 안심보험"
            :aria-invalid="Boolean(errorFor('productName'))"
            :aria-describedby="describedBy('productName')"
            @input="clearError('productName')"
          />
          <small
            v-if="errorFor('productName')"
            id="insurance-policy-productName-error"
            class="field-error"
          >{{ errorFor("productName") }}</small>
        </label>

        <label class="field field-wide">
          <span>월보험료 <em>필수</em></span>
          <div class="money-input">
            <input
              v-model="form.monthlyPremiumWon"
              name="monthlyPremiumWon"
              inputmode="numeric"
              maxlength="19"
              autocomplete="off"
              placeholder="예: 125000"
              :aria-invalid="Boolean(errorFor('monthlyPremiumWon'))"
              :aria-describedby="describedBy('monthlyPremiumWon')"
              @input="clearError('monthlyPremiumWon')"
            />
            <span>원 / 월</span>
          </div>
          <small
            v-if="errorFor('monthlyPremiumWon')"
            id="insurance-policy-monthlyPremiumWon-error"
            class="field-error"
          >
            {{ errorFor("monthlyPremiumWon") }}
          </small>
        </label>

        <label class="field">
          <span>가입일</span>
          <input
            v-model="form.joinedOn"
            name="joinedOn"
            type="date"
            :aria-invalid="Boolean(errorFor('joinedOn'))"
            :aria-describedby="describedBy('joinedOn')"
            @input="clearError('joinedOn')"
          />
          <small
            v-if="errorFor('joinedOn')"
            id="insurance-policy-joinedOn-error"
            class="field-error"
          >{{ errorFor("joinedOn") }}</small>
        </label>

        <label class="field">
          <span>만기일</span>
          <input
            v-model="form.maturesOn"
            name="maturesOn"
            type="date"
            :aria-invalid="Boolean(errorFor('maturesOn'))"
            :aria-describedby="describedBy('maturesOn')"
            @input="clearError('maturesOn')"
          />
          <small
            v-if="errorFor('maturesOn')"
            id="insurance-policy-maturesOn-error"
            class="field-error"
          >{{ errorFor("maturesOn") }}</small>
        </label>

        <label class="field">
          <span>보험기간</span>
          <input
            v-model="form.coverageTerm"
            name="coverageTerm"
            maxlength="200"
            placeholder="예: 종신 또는 20년"
            :aria-invalid="Boolean(errorFor('coverageTerm'))"
            :aria-describedby="describedBy('coverageTerm')"
            @input="clearError('coverageTerm')"
          />
          <small
            v-if="errorFor('coverageTerm')"
            id="insurance-policy-coverageTerm-error"
            class="field-error"
          >{{ errorFor("coverageTerm") }}</small>
        </label>

        <label class="field">
          <span>납입기간</span>
          <input
            v-model="form.paymentTerm"
            name="paymentTerm"
            maxlength="200"
            placeholder="예: 20년납"
            :aria-invalid="Boolean(errorFor('paymentTerm'))"
            :aria-describedby="describedBy('paymentTerm')"
            @input="clearError('paymentTerm')"
          />
          <small
            v-if="errorFor('paymentTerm')"
            id="insurance-policy-paymentTerm-error"
            class="field-error"
          >{{ errorFor("paymentTerm") }}</small>
        </label>

        <label class="field">
          <span>고지플랜</span>
          <input
            v-model="form.disclosurePlan"
            name="disclosurePlan"
            maxlength="200"
            placeholder="선택 입력"
            :aria-invalid="Boolean(errorFor('disclosurePlan'))"
            :aria-describedby="describedBy('disclosurePlan')"
            @input="clearError('disclosurePlan')"
          />
          <small
            v-if="errorFor('disclosurePlan')"
            id="insurance-policy-disclosurePlan-error"
            class="field-error"
          >{{ errorFor("disclosurePlan") }}</small>
        </label>

        <label class="field">
          <span>계약 상태</span>
          <input
            v-model="form.status"
            name="status"
            maxlength="200"
            placeholder="예: 정상 유지"
            :aria-invalid="Boolean(errorFor('status'))"
            :aria-describedby="describedBy('status')"
            @input="clearError('status')"
          />
          <small
            v-if="errorFor('status')"
            id="insurance-policy-status-error"
            class="field-error"
          >{{ errorFor("status") }}</small>
        </label>

        <div class="policy-switches field-wide">
          <label class="switch-field">
            <input v-model="form.renewable" name="renewable" type="checkbox" />
            <span class="switch-track" aria-hidden="true"><i /></span>
            <span><strong>갱신형 계약</strong><small>갱신 여부만 기록합니다.</small></span>
          </label>
          <label class="switch-field">
            <input v-model="form.isIncluded" name="isIncluded" type="checkbox" />
            <span class="switch-track" aria-hidden="true"><i /></span>
            <span><strong>월보험료 합계 포함</strong><small>고객 합계에 반영합니다.</small></span>
          </label>
        </div>
      </div>

      <footer class="form-actions">
        <AppButton :disabled="submitting" @click="emit('close')">취소</AppButton>
        <AppButton variant="primary" type="submit" :loading="submitting">
          {{ isEditing ? "변경사항 저장" : "계약 등록" }}
        </AppButton>
      </footer>
    </form>
  </AppDialog>
</template>
