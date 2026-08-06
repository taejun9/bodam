<script setup lang="ts">
import { computed } from "vue";

import AppButton from "@/shared/components/AppButton.vue";

import type {
  CustomerResolution,
  DuplicateAction,
  ImportUiCustomer,
  ImportUiRow,
  ImportUiRowDecision,
  NewCustomerDefinition,
} from "./data-exchange-ui";
import { rowNeedsCustomer } from "./data-exchange-ui";

const props = defineProps<{
  row: ImportUiRow;
  decision: ImportUiRowDecision;
  customers: readonly ImportUiCustomer[];
  newCustomers: readonly NewCustomerDefinition[];
  disabled: boolean;
}>();

const emit = defineEmits<{
  change: [decision: ImportUiRowDecision];
  createCustomer: [sourceRow: number];
}>();

const hasDuplicate = computed(() =>
  props.row.duplicateCandidates.length > 0 || props.row.batchDuplicateOf !== null,
);
const needsCustomer = computed(() => rowNeedsCustomer(props.decision));
const customerValue = computed(() => {
  const resolution = props.decision.customer;
  if (!resolution) return "";
  return resolution.kind === "existing"
    ? `existing:${resolution.customerId}`
    : `new:${resolution.clientKey}`;
});

const existingCustomerOptions = computed(() => {
  const nameCounts = new Map<string, number>();
  for (const customer of props.customers) {
    nameCounts.set(customer.name, (nameCounts.get(customer.name) ?? 0) + 1);
  }
  const nameIndexes = new Map<string, number>();
  return props.customers.map((customer) => {
    const total = nameCounts.get(customer.name) ?? 1;
    const index = (nameIndexes.get(customer.name) ?? 0) + 1;
    nameIndexes.set(customer.name, index);
    return {
      ...customer,
      displayLabel: customer.label ?? (total > 1
        ? `${customer.name} (동명이인 ${index}/${total})`
        : customer.name),
    };
  });
});
const duplicateOptions = computed(() => {
  const labels = props.row.duplicateCandidates.map((candidate) =>
    `${candidate.customerName} · ${candidate.productName}`,
  );
  const totals = new Map<string, number>();
  labels.forEach((label) => totals.set(label, (totals.get(label) ?? 0) + 1));
  const indexes = new Map<string, number>();
  return props.row.duplicateCandidates.map((candidate, candidateIndex) => {
    const label = labels[candidateIndex] ?? candidate.productName;
    const index = (indexes.get(label) ?? 0) + 1;
    indexes.set(label, index);
    const total = totals.get(label) ?? 1;
    return {
      ...candidate,
      displayLabel: total > 1 ? `${label} (동일 후보 ${index}/${total})` : label,
    };
  });
});

function update(values: Partial<ImportUiRowDecision>) {
  emit("change", { ...props.decision, ...values });
}

function changeSelected(event: Event) {
  update({ selected: (event.target as HTMLInputElement).checked });
}

function changeAction(event: Event) {
  const action = (event.target as HTMLSelectElement).value as DuplicateAction;
  const onlyTarget = props.row.duplicateCandidates.length === 1
    ? props.row.duplicateCandidates[0]?.policyId ?? null
    : null;
  update({
    duplicateAction: action,
    duplicateTargetPolicyId: action === "update" ? onlyTarget : null,
    customer: action === "skip" || action === "update"
      ? null
      : props.decision.customer,
  });
}

function changeTarget(event: Event) {
  update({ duplicateTargetPolicyId: (event.target as HTMLSelectElement).value || null });
}

function changeCustomer(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  let customer: CustomerResolution | null = null;
  if (value.startsWith("existing:")) {
    customer = { kind: "existing", customerId: value.slice("existing:".length) };
  } else if (value.startsWith("new:")) {
    customer = { kind: "new", clientKey: value.slice("new:".length) };
  }
  update({ customer });
}
</script>

<template>
  <fieldset class="row-controls" :disabled="disabled">
    <legend class="sr-only">원본 {{ row.sourceRow }}행 반영 결정</legend>

    <label class="row-selection">
      <input
        type="checkbox"
        :checked="decision.selected"
        :disabled="row.mapped === null || row.issues.length > 0 || disabled"
        :aria-label="`원본 ${row.sourceRow}행 선택`"
        @change="changeSelected"
      />
      <span>{{ decision.selected ? "선택됨" : "제외됨" }}</span>
    </label>

    <label v-if="hasDuplicate" class="control-field">
      <span>중복 처리</span>
      <select
        :value="decision.duplicateAction"
        :disabled="!decision.selected || disabled"
        :aria-label="`원본 ${row.sourceRow}행 중복 처리`"
        @change="changeAction"
      >
        <option value="skip">건너뛰기 (기본)</option>
        <option v-if="row.duplicateCandidates.length" value="update">기존 계약 갱신</option>
        <option value="separate-create">별도 계약 생성</option>
      </select>
    </label>
    <p v-else class="create-state">새 계약 생성</p>

    <label
      v-if="decision.duplicateAction === 'update'"
      class="control-field"
    >
      <span>갱신할 계약</span>
      <select
        :value="decision.duplicateTargetPolicyId ?? ''"
        :disabled="!decision.selected || disabled"
        :aria-invalid="decision.selected && !decision.duplicateTargetPolicyId"
        :aria-label="`원본 ${row.sourceRow}행 갱신 대상`"
        @change="changeTarget"
      >
        <option value="">계약을 선택해 주세요</option>
        <option
          v-for="candidate in duplicateOptions"
          :key="candidate.policyId"
          :value="candidate.policyId"
        >
          {{ candidate.displayLabel }}
        </option>
      </select>
    </label>

    <div v-if="needsCustomer" class="customer-resolution">
      <label class="control-field">
        <span>연결 고객</span>
        <select
          :value="customerValue"
          :disabled="!decision.selected || disabled"
          :aria-invalid="decision.selected && !decision.customer"
          :aria-label="`원본 ${row.sourceRow}행 연결 고객`"
          @change="changeCustomer"
        >
          <option value="">고객을 명시적으로 선택해 주세요</option>
          <optgroup v-if="existingCustomerOptions.length" label="기존 활성 고객">
            <option
              v-for="customer in existingCustomerOptions"
              :key="customer.id"
              :value="`existing:${customer.id}`"
            >
              {{ customer.displayLabel }}
            </option>
          </optgroup>
          <optgroup v-if="newCustomers.length" label="이번 가져오기에 새로 만들 고객">
            <option
              v-for="customer in newCustomers"
              :key="customer.clientKey"
              :value="`new:${customer.clientKey}`"
            >
              {{ customer.name }}
            </option>
          </optgroup>
        </select>
      </label>
      <AppButton
        variant="ghost"
        :disabled="!decision.selected || disabled"
        :data-new-customer-row="row.sourceRow"
        @click="emit('createCustomer', row.sourceRow)"
      >
        새 고객 정의
      </AppButton>
    </div>
  </fieldset>
</template>

<style scoped src="./data-exchange-row-controls.css"></style>
