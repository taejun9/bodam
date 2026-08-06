<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";

import type {
  Customer,
  CustomerInput,
} from "@/features/customer/types/customer";
import AppButton from "@/shared/components/AppButton.vue";
import AppDialog from "@/shared/components/AppDialog.vue";

type FieldName = keyof CustomerInput;
type FieldErrors = Partial<Record<FieldName, string>>;

const props = withDefaults(
  defineProps<{
    open: boolean;
    customer?: Customer | null | undefined;
    submitting?: boolean;
    errors?: FieldErrors;
    submitError?: string | undefined;
  }>(),
  {
    customer: null,
    submitting: false,
    errors: () => ({}),
    submitError: undefined,
  },
);

const emit = defineEmits<{
  close: [];
  submit: [input: CustomerInput];
}>();

const formElement = ref<HTMLFormElement>();
const localErrors = reactive<FieldErrors>({});
const form = reactive({
  name: "",
  birthDate: "",
  gender: "",
  phone: "",
  address: "",
  memo: "",
  status: "",
  isManaged: true,
});

const isEditing = computed(() => props.customer !== null);

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resetForm() {
  const customer = props.customer;
  form.name = customer?.name ?? "";
  form.birthDate = customer?.birthDate ?? "";
  form.gender = customer?.gender ?? "";
  form.phone = customer?.phone ?? "";
  form.address = customer?.address ?? "";
  form.memo = customer?.memo ?? "";
  form.status = customer?.status ?? "";
  form.isManaged = customer?.isManaged ?? true;
  for (const key of Object.keys(localErrors) as FieldName[]) {
    delete localErrors[key];
  }
}

function errorFor(field: FieldName): string | undefined {
  return localErrors[field] ?? props.errors[field];
}

function clearError(field: FieldName) {
  delete localErrors[field];
}

function focusFirstError() {
  void nextTick(() => {
    formElement.value
      ?.querySelector<HTMLElement>("[aria-invalid='true']")
      ?.focus();
  });
}

function submit() {
  const name = form.name.trim();
  if (!name) {
    localErrors.name = "이름을 입력해 주세요.";
    focusFirstError();
    return;
  }

  emit("submit", {
    name,
    birthDate: nullable(form.birthDate),
    gender: nullable(form.gender),
    phone: nullable(form.phone),
    address: nullable(form.address),
    memo: nullable(form.memo),
    status: nullable(form.status),
    isManaged: form.isManaged,
  });
}

watch(
  () => [props.open, props.customer?.id] as const,
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
    :title="isEditing ? '고객 정보 수정' : '새 고객 등록'"
    description="이름만 필수이며, 나머지는 나중에 입력할 수 있습니다."
    size="large"
    @close="emit('close')"
  >
    <form ref="formElement" class="customer-form" novalidate @submit.prevent="submit">
      <p v-if="submitError" class="form-submit-error" role="alert">
        {{ submitError }}
      </p>
      <div class="form-grid">
        <label class="field field-wide">
          <span>이름 <em>필수</em></span>
          <input
            v-model="form.name"
            name="name"
            autocomplete="name"
            placeholder="예: 김보담"
            :aria-invalid="Boolean(errorFor('name'))"
            :aria-describedby="errorFor('name') ? 'name-error' : undefined"
            autofocus
            @input="clearError('name')"
          />
          <small v-if="errorFor('name')" id="name-error" class="field-error">
            {{ errorFor("name") }}
          </small>
        </label>

        <label class="field">
          <span>생년월일</span>
          <input
            v-model="form.birthDate"
            name="birthDate"
            type="date"
            :aria-invalid="Boolean(errorFor('birthDate'))"
            @input="clearError('birthDate')"
          />
          <small v-if="errorFor('birthDate')" class="field-error">
            {{ errorFor("birthDate") }}
          </small>
        </label>

        <label class="field">
          <span>성별</span>
          <input
            v-model="form.gender"
            name="gender"
            placeholder="선택 입력"
            :aria-invalid="Boolean(errorFor('gender'))"
            @input="clearError('gender')"
          />
          <small v-if="errorFor('gender')" class="field-error">
            {{ errorFor("gender") }}
          </small>
        </label>

        <label class="field">
          <span>연락처</span>
          <input
            v-model="form.phone"
            name="phone"
            type="tel"
            autocomplete="tel"
            placeholder="예: 010-0000-0000"
            :aria-invalid="Boolean(errorFor('phone'))"
            @input="clearError('phone')"
          />
          <small v-if="errorFor('phone')" class="field-error">
            {{ errorFor("phone") }}
          </small>
        </label>

        <label class="field">
          <span>담당 상태</span>
          <input
            v-model="form.status"
            name="status"
            placeholder="예: 상담 중"
            :aria-invalid="Boolean(errorFor('status'))"
            @input="clearError('status')"
          />
          <small v-if="errorFor('status')" class="field-error">
            {{ errorFor("status") }}
          </small>
        </label>

        <label class="field field-wide">
          <span>주소</span>
          <input
            v-model="form.address"
            name="address"
            autocomplete="street-address"
            placeholder="선택 입력"
            :aria-invalid="Boolean(errorFor('address'))"
            @input="clearError('address')"
          />
          <small v-if="errorFor('address')" class="field-error">
            {{ errorFor("address") }}
          </small>
        </label>

        <label class="field field-wide">
          <span>메모</span>
          <textarea
            v-model="form.memo"
            name="memo"
            rows="4"
            placeholder="고객 응대에 필요한 일반 메모"
            :aria-invalid="Boolean(errorFor('memo'))"
            @input="clearError('memo')"
          />
          <small class="privacy-hint">
            주민등록번호, 보험사 로그인 정보, 민감 병력이나 상세 병력은 저장하지 마세요.
          </small>
          <small v-if="errorFor('memo')" class="field-error">
            {{ errorFor("memo") }}
          </small>
        </label>

        <label class="switch-field field-wide">
          <input v-model="form.isManaged" name="isManaged" type="checkbox" />
          <span class="switch-track" aria-hidden="true"><i /></span>
          <span>
            <strong>관리 대상</strong>
            <small>향후 연락·일정 대상에 포함합니다.</small>
          </span>
        </label>
      </div>

      <footer class="form-actions">
        <AppButton :disabled="submitting" @click="emit('close')">취소</AppButton>
        <AppButton variant="primary" type="submit" :loading="submitting">
          {{ isEditing ? "변경사항 저장" : "고객 등록" }}
        </AppButton>
      </footer>
    </form>
  </AppDialog>
</template>
