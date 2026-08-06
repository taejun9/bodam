<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";

import type { CalendarCustomerOption } from "@/features/calendar/types/calendar";
import type { ScheduleInput } from "@/features/schedule/types/schedule";
import { CALENDAR_VIEW_MAX_DATE } from "@/shared/calendar-date";
import AppButton from "@/shared/components/AppButton.vue";
import AppDialog from "@/shared/components/AppDialog.vue";

import {
  createScheduleFormState,
  resetScheduleForm,
  scheduleInputFromForm,
  type ScheduleFieldErrors,
  type ScheduleFieldName,
  type ScheduleFormValue,
} from "./schedule-form";

const props = withDefaults(
  defineProps<{
    open: boolean;
    defaultDate: string;
    customers: readonly CalendarCustomerOption[];
    schedule?: ScheduleFormValue | null | undefined;
    submitting?: boolean;
    errors?: ScheduleFieldErrors;
    submitError?: string | undefined;
  }>(),
  {
    schedule: null,
    submitting: false,
    errors: () => ({}),
    submitError: undefined,
  },
);

const emit = defineEmits<{
  close: [];
  submit: [input: ScheduleInput];
  clearError: [field: ScheduleFieldName];
}>();

const formElement = ref<HTMLFormElement>();
const form = reactive(createScheduleFormState());
const localErrors = reactive<ScheduleFieldErrors>({});
const isEditing = computed(() => props.schedule !== null);
const customerChoices = computed(() => {
  const totals = new Map<string, number>();
  const positions = new Map<string, number>();
  for (const customer of props.customers) {
    totals.set(customer.name, (totals.get(customer.name) ?? 0) + 1);
  }
  return props.customers.map((customer) => {
    const position = (positions.get(customer.name) ?? 0) + 1;
    positions.set(customer.name, position);
    const total = totals.get(customer.name) ?? 1;
    return {
      ...customer,
      label: total > 1 ? `${customer.name} (동명이인 ${position}/${total})` : customer.name,
    };
  });
});

function errorFor(field: ScheduleFieldName): string | undefined {
  return localErrors[field] ?? props.errors[field];
}

function describedBy(field: ScheduleFieldName): string | undefined {
  const ids: string[] = [];
  if (field === "title") ids.push("schedule-title-limit");
  if (field === "memo") ids.push("schedule-memo-privacy");
  if (errorFor(field)) ids.push(`schedule-${field}-error`);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function clearError(field: ScheduleFieldName): void {
  delete localErrors[field];
  emit("clearError", field);
}

function focusFirstError(): void {
  void nextTick(() => {
    formElement.value?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  });
}

function submit(): void {
  const input = scheduleInputFromForm(form, localErrors);
  if (!input) {
    focusFirstError();
    return;
  }
  emit("submit", input);
}

watch(
  () => [props.open, props.schedule?.id, props.defaultDate] as const,
  ([open]) => {
    if (open) resetScheduleForm(form, props.schedule, props.defaultDate, localErrors);
  },
  { immediate: true },
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
    :title="isEditing ? '일정 수정' : '새 일정'"
    description="이 PC의 달력에 저장할 일정입니다. 제목과 날짜는 필수입니다."
    size="large"
    @close="emit('close')"
  >
    <form ref="formElement" class="schedule-form" novalidate @submit.prevent="submit">
      <p v-if="submitError" class="form-submit-error" role="alert">{{ submitError }}</p>
      <div class="form-grid">
        <label class="field field-wide">
          <span>제목 <em>필수</em></span>
          <input
            v-model="form.title"
            name="title"
            type="text"
            autocomplete="off"
            autofocus
            :aria-invalid="Boolean(errorFor('title'))"
            :aria-describedby="describedBy('title')"
            @input="clearError('title')"
          />
          <small v-if="errorFor('title')" id="schedule-title-error" class="field-error">
            {{ errorFor("title") }}
          </small>
          <small id="schedule-title-limit" class="privacy-hint">최대 200자</small>
        </label>

        <label class="field">
          <span>날짜 <em>필수</em></span>
          <input
            v-model="form.scheduledOn"
            name="scheduledOn"
            type="date"
            :max="CALENDAR_VIEW_MAX_DATE"
            :aria-invalid="Boolean(errorFor('scheduledOn'))"
            :aria-describedby="describedBy('scheduledOn')"
            @input="clearError('scheduledOn')"
          />
          <small
            v-if="errorFor('scheduledOn')"
            id="schedule-scheduledOn-error"
            class="field-error"
          >{{ errorFor("scheduledOn") }}</small>
        </label>

        <label class="field">
          <span>시간</span>
          <input
            v-model="form.scheduledTime"
            name="scheduledTime"
            type="time"
            step="60"
            :aria-invalid="Boolean(errorFor('scheduledTime'))"
            :aria-describedby="describedBy('scheduledTime')"
            @input="clearError('scheduledTime')"
          />
          <small
            v-if="errorFor('scheduledTime')"
            id="schedule-scheduledTime-error"
            class="field-error"
          >{{ errorFor("scheduledTime") }}</small>
        </label>

        <label class="field field-wide">
          <span>연결 고객</span>
          <select
            v-model="form.customerId"
            name="customerId"
            :aria-invalid="Boolean(errorFor('customerId'))"
            :aria-describedby="describedBy('customerId')"
            @change="clearError('customerId')"
          >
            <option value="">연결하지 않음</option>
            <option v-for="customer in customerChoices" :key="customer.id" :value="customer.id">
              {{ customer.label }}
            </option>
          </select>
          <small
            v-if="errorFor('customerId')"
            id="schedule-customerId-error"
            class="field-error"
          >{{ errorFor("customerId") }}</small>
        </label>

        <label class="field field-wide">
          <span>메모</span>
          <textarea
            v-model="form.memo"
            name="memo"
            rows="5"
            placeholder="필요한 다음 단계만 간단히 기록하세요."
            :aria-invalid="Boolean(errorFor('memo'))"
            :aria-describedby="describedBy('memo')"
            @input="clearError('memo')"
          />
          <small id="schedule-memo-privacy" class="privacy-hint">
            최대 4,000자. 주민등록번호, 보험사 로그인 정보, 민감 병력이나 상세 병력은 저장하지 마세요.
          </small>
          <small v-if="errorFor('memo')" id="schedule-memo-error" class="field-error">
            {{ errorFor("memo") }}
          </small>
        </label>

        <label class="switch-field field-wide">
          <input v-model="form.isCompleted" name="isCompleted" type="checkbox" />
          <span class="switch-track" aria-hidden="true"><i /></span>
          <span>
            <strong>완료한 일정</strong>
            <small>완료해도 달력에서 숨기지 않습니다.</small>
          </span>
        </label>
      </div>

      <footer class="form-actions">
        <AppButton :disabled="submitting" @click="emit('close')">취소</AppButton>
        <AppButton variant="primary" type="submit" :loading="submitting">
          {{ isEditing ? "변경사항 저장" : "일정 저장" }}
        </AppButton>
      </footer>
    </form>
  </AppDialog>
</template>
