<script setup lang="ts">
import { nextTick, ref, watch } from "vue";

import AppButton from "@/shared/components/AppButton.vue";
import AppDialog from "@/shared/components/AppDialog.vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    contractor?: string | null;
    insured?: string | null;
  }>(),
  {
    contractor: null,
    insured: null,
  },
);

const emit = defineEmits<{
  close: [];
  confirm: [name: string];
}>();

const name = ref("");
const error = ref<string>();
const nameInput = ref<HTMLInputElement>();

function reset() {
  name.value = "";
  error.value = undefined;
}

function copyName(value: string | null | undefined) {
  if (!value) return;
  name.value = value;
  error.value = undefined;
  void nextTick(() => nameInput.value?.focus());
}

function submit() {
  const normalized = name.value.trim();
  if (!normalized) {
    error.value = "새 고객 이름을 직접 입력하거나 참고 이름을 복사해 주세요.";
    void nextTick(() => nameInput.value?.focus());
    return;
  }
  if (Array.from(normalized).length > 4_000) {
    error.value = "고객 이름은 4,000자 이내로 입력해 주세요.";
    void nextTick(() => nameInput.value?.focus());
    return;
  }
  emit("confirm", normalized);
}

watch(
  () => props.open,
  (open) => {
    if (open) reset();
  },
);
</script>

<template>
  <AppDialog
    :open="open"
    title="새 고객 정의"
    description="가져올 행을 연결할 고객 이름을 사용자가 직접 확정합니다."
    size="small"
    @close="emit('close')"
  >
    <form class="new-customer-form" novalidate @submit.prevent="submit">
      <p class="customer-rule">
        계약자·피보험자 이름만으로 기존 고객을 자동 선택하거나 병합하지 않습니다.
      </p>

      <div v-if="contractor || insured" class="reference-names">
        <strong>원본 참고 이름</strong>
        <button
          v-if="contractor"
          type="button"
          @click="copyName(contractor)"
        >
          <span class="reference-kind">계약자</span>
          <span class="reference-value">{{ contractor }}</span>
          <small>복사</small>
        </button>
        <button
          v-if="insured"
          type="button"
          @click="copyName(insured)"
        >
          <span class="reference-kind">피보험자</span>
          <span class="reference-value">{{ insured }}</span>
          <small>복사</small>
        </button>
      </div>

      <label class="field">
        <span>새 고객 이름 <em>필수</em></span>
        <input
          ref="nameInput"
          v-model="name"
          name="newCustomerName"
          autocomplete="off"
          autofocus
          :aria-invalid="Boolean(error)"
          :aria-describedby="error ? 'new-customer-name-error' : undefined"
          @input="error = undefined"
        />
        <small v-if="error" id="new-customer-name-error" class="field-error">
          {{ error }}
        </small>
      </label>

      <p class="privacy-hint">
        주민등록번호, 보험사 로그인 정보, 민감 병력이나 상세 병력은 입력하지 마세요.
      </p>

      <footer class="new-customer-actions">
        <AppButton @click="emit('close')">취소</AppButton>
        <AppButton variant="primary" type="submit">고객 정의 추가</AppButton>
      </footer>
    </form>
  </AppDialog>
</template>

<style scoped>
.new-customer-form {
  display: grid;
  gap: 17px;
}

.customer-rule,
.privacy-hint {
  margin: 0;
  padding: 10px 12px;
  color: var(--text-secondary);
  background: var(--bg-subtle);
  border-radius: 8px;
  font-size: 11px;
  line-height: 1.55;
}

.reference-names {
  display: grid;
  gap: 7px;
}

.reference-names > strong {
  color: var(--text-secondary);
  font-size: 10px;
}

.reference-names button {
  display: grid;
  min-width: 0;
  padding: 9px 10px;
  color: var(--text-main);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 7px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  cursor: pointer;
  text-align: left;
}

.reference-names button:hover {
  border-color: var(--focus);
}

.reference-names .reference-kind,
.reference-names small {
  color: var(--text-secondary);
  font-size: 9px;
}

.reference-names .reference-value {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}

.field {
  display: grid;
  gap: 6px;
}

.field > span {
  font-size: 11px;
  font-weight: 700;
}

.field em {
  color: var(--brand-700);
  font-style: normal;
  font-size: 9px;
}

.field input {
  width: 100%;
  min-width: 0;
  height: 39px;
  padding: 0 10px;
  color: var(--text-main);
  background: var(--bg-surface);
  border: 1px solid var(--border-strong);
  border-radius: 7px;
}

.field input[aria-invalid="true"] {
  border-color: var(--danger);
}

.field-error {
  color: var(--danger);
  font-size: 10px;
}

.new-customer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
