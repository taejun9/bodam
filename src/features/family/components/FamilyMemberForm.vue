<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";

import type { NamedIdentity } from "@/features/family/components/family-identity";
import { identityLabel } from "@/features/family/components/family-identity";
import type {
  FamilyCustomerOption,
  FamilyMemberView,
} from "@/features/family/types/family";
import AppButton from "@/shared/components/AppButton.vue";

interface MemberFieldErrors {
  customerId?: string;
  relationshipName?: string;
}

const props = withDefaults(
  defineProps<{
    member?: FamilyMemberView | null | undefined;
    customers: readonly FamilyCustomerOption[];
    identities: readonly NamedIdentity[];
    submitting?: boolean;
    errors?: MemberFieldErrors;
    submitError?: string | undefined;
  }>(),
  {
    member: null,
    submitting: false,
    errors: () => ({}),
    submitError: undefined,
  },
);
const emit = defineEmits<{
  cancel: [];
  submit: [input: { customerId: string; relationshipName: string | null }];
}>();

const customerSelect = ref<HTMLSelectElement>();
const relationshipInput = ref<HTMLInputElement>();
const customerId = ref("");
const relationshipName = ref("");
const localErrors = ref<MemberFieldErrors>({});
const isEditing = computed(() => props.member !== null);
const customerError = computed(() => localErrors.value.customerId ?? props.errors.customerId);
const relationshipError = computed(
  () => localErrors.value.relationshipName ?? props.errors.relationshipName,
);

function reset() {
  customerId.value = props.member?.customerId ?? "";
  relationshipName.value = props.member?.relationshipName ?? "";
  localErrors.value = {};
}

function focusFirstError() {
  void nextTick(() => {
    if (customerError.value) customerSelect.value?.focus();
    else if (relationshipError.value) relationshipInput.value?.focus();
  });
}

function clearLocalError(field: keyof MemberFieldErrors) {
  const errors = { ...localErrors.value };
  delete errors[field];
  localErrors.value = errors;
}

function submit() {
  const errors: MemberFieldErrors = {};
  const normalizedRelationship = relationshipName.value.trim();
  if (!isEditing.value && !customerId.value) errors.customerId = "고객을 선택해 주세요.";
  if (Array.from(normalizedRelationship).length > 100) {
    errors.relationshipName = "관계명은 100자 이내로 입력해 주세요.";
  }
  localErrors.value = errors;
  if (Object.keys(errors).length > 0) return focusFirstError();
  emit("submit", {
    customerId: customerId.value,
    relationshipName: normalizedRelationship || null,
  });
}

watch(() => props.member?.membershipId, reset, { immediate: true });
watch(() => props.errors, focusFirstError, { deep: true });
</script>

<template>
  <form class="family-member-form" novalidate @submit.prevent="submit">
    <p v-if="submitError" class="form-submit-error" role="alert">{{ submitError }}</p>

    <div v-if="isEditing" class="family-selected-customer">
      <span>고객</span>
      <strong>{{ identityLabel(identities, customerId, "고객") }}</strong>
    </div>
    <label v-else class="field">
      <span>고객 <em>필수</em></span>
      <select
        ref="customerSelect"
        v-model="customerId"
        name="customerId"
        :disabled="submitting"
        :aria-invalid="Boolean(customerError)"
        :aria-describedby="customerError ? 'family-member-customer-error' : undefined"
        autofocus
        @change="clearLocalError('customerId')"
      >
        <option value="" disabled>추가할 고객을 선택하세요</option>
        <option v-for="customer in customers" :key="customer.id" :value="customer.id">
          {{ identityLabel(identities, customer.id, "고객") }}
        </option>
      </select>
      <small v-if="customerError" id="family-member-customer-error" class="field-error">
        {{ customerError }}
      </small>
    </label>

    <label class="field">
      <span>관계명 <em>선택</em></span>
      <input
        ref="relationshipInput"
        v-model="relationshipName"
        name="relationshipName"
        maxlength="200"
        autocomplete="off"
        :disabled="submitting"
        :autofocus="isEditing"
        :aria-invalid="Boolean(relationshipError)"
        :aria-describedby="relationshipError ? 'family-member-relationship-error' : undefined"
        placeholder="예: 배우자, 자녀, 부모"
        @input="clearLocalError('relationshipName')"
      />
      <small
        v-if="relationshipError"
        id="family-member-relationship-error"
        class="field-error"
      >{{ relationshipError }}</small>
    </label>

    <p class="family-relationship-note" role="note">
      관계명은 가족 안에서 구분하기 위한 자유 입력 표시에 불과하며 법적 관계·성별·대표자를 뜻하지 않습니다.
      주민등록번호·보험사 로그인 정보·병력·진단·치료 내용은 입력하지 마세요.
    </p>

    <footer class="form-actions family-dialog-actions">
      <AppButton :disabled="submitting" @click="emit('cancel')">목록으로</AppButton>
      <AppButton variant="primary" type="submit" :loading="submitting">
        {{ isEditing ? "관계명 저장" : "구성원 추가" }}
      </AppButton>
    </footer>
  </form>
</template>
