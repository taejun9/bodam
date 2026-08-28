<script setup lang="ts">
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";

import { appSettingsApplication } from "@/app/composition/settings";
import { useUiStore } from "@/app/stores/ui";
import AppButton from "@/shared/components/AppButton.vue";

import {
  DEFAULT_APP_SETTINGS_INPUT,
  type AppSettings,
  type AppSettingsInput,
  type ThemeMode,
} from "../types/app-settings";
import {
  AppSettingsValidationError,
  appSettingsSafeMessage,
} from "../types/app-settings-error";

type PreferenceField = Exclude<keyof AppSettingsInput, "theme">;
type FieldErrors = Partial<Record<PreferenceField, string>>;

interface SettingsDraft {
  theme: ThemeMode;
  recentConsultationDays: string;
  unconsultedDays: string;
  dashboardItemLimit: string;
}

const ui = useUiStore();
const sectionElement = ref<HTMLElement>();
const alertElement = ref<HTMLElement>();
const resultElement = ref<HTMLElement>();
const draft = reactive<SettingsDraft>(toDraft(DEFAULT_APP_SETTINGS_INPUT));
const loaded = ref<AppSettings>();
const loading = ref(true);
const saving = ref(false);
const loadError = ref<string>();
const saveError = ref<string>();
const fieldErrors = ref<FieldErrors>({});
const notice = ref<string>();
let requestNumber = 0;

function toDraft(settings: AppSettingsInput): SettingsDraft {
  return {
    theme: settings.theme,
    recentConsultationDays: String(settings.recentConsultationDays),
    unconsultedDays: String(settings.unconsultedDays),
    dashboardItemLimit: String(settings.dashboardItemLimit),
  };
}

function replaceDraft(settings: AppSettingsInput): void {
  Object.assign(draft, toDraft(settings));
}

function input(): AppSettingsInput {
  return {
    theme: draft.theme,
    recentConsultationDays: Number(draft.recentConsultationDays),
    unconsultedDays: Number(draft.unconsultedDays),
    dashboardItemLimit: Number(draft.dashboardItemLimit),
  };
}

async function load(focusResult = false): Promise<void> {
  const request = ++requestNumber;
  let succeeded = false;
  loading.value = true;
  loadError.value = undefined;
  try {
    const settings = await appSettingsApplication.load();
    if (request !== requestNumber) return;
    loaded.value = settings;
    replaceDraft(settings);
    ui.setThemePreference(settings.theme);
    succeeded = true;
  } catch (error: unknown) {
    if (request !== requestNumber) return;
    loaded.value = undefined;
    loadError.value = appSettingsSafeMessage(error);
  } finally {
    if (request === requestNumber) loading.value = false;
  }
  if (request !== requestNumber || !focusResult) return;
  await nextTick();
  if (succeeded) {
    sectionElement.value?.querySelector<HTMLInputElement>("input[name='theme']")
      ?.focus();
  } else {
    alertElement.value?.focus();
  }
}

async function save(): Promise<void> {
  if (saving.value) return;
  let focusTarget: "result" | "invalid" | "alert" | undefined;
  saving.value = true;
  fieldErrors.value = {};
  saveError.value = undefined;
  notice.value = undefined;
  try {
    const settings = await appSettingsApplication.update(input());
    loaded.value = settings;
    replaceDraft(settings);
    ui.setThemePreference(settings.theme);
    notice.value = "화면과 대시보드 설정을 저장했습니다.";
    focusTarget = "result";
  } catch (error: unknown) {
    if (error instanceof AppSettingsValidationError) {
      fieldErrors.value = Object.fromEntries(
        error.issues.map((issue) => [issue.field, issue.message]),
      ) as FieldErrors;
      focusTarget = "invalid";
    } else {
      saveError.value = appSettingsSafeMessage(error);
      focusTarget = "alert";
    }
  } finally {
    saving.value = false;
  }
  await nextTick();
  if (focusTarget === "result") resultElement.value?.focus();
  else if (focusTarget === "invalid") focusFirstInvalidField();
  else if (focusTarget === "alert") alertElement.value?.focus();
}

function clearFieldError(field: PreferenceField): void {
  const next = { ...fieldErrors.value };
  delete next[field];
  fieldErrors.value = next;
  saveError.value = undefined;
  notice.value = undefined;
}

function focusFirstInvalidField(): void {
  const first = Object.keys(fieldErrors.value)[0];
  if (!first) return;
  sectionElement.value
    ?.querySelector<HTMLInputElement>(`[name='${first}']`)
    ?.focus();
}

watch(
  () => ui.themePreference,
  (theme) => {
    if (loaded.value && !saving.value) draft.theme = theme;
  },
);

onMounted(() => void load());
onBeforeUnmount(() => {
  requestNumber += 1;
});
</script>

<template>
  <section
    ref="sectionElement"
    class="app-settings-section surface"
    data-testid="app-settings-section"
    aria-labelledby="app-settings-title"
    :aria-busy="loading || saving"
  >
    <header class="app-settings-header">
      <div>
        <span>Appearance &amp; dashboard</span>
        <h3 id="app-settings-title">화면과 대시보드</h3>
        <p>이 PC에서 사용할 테마와 업무 요약의 기간·표시 건수를 관리합니다.</p>
      </div>
    </header>

    <div v-if="loading" class="app-settings-state" role="status">
      <span class="button-spinner" aria-hidden="true" />
      <strong>설정을 불러오는 중입니다</strong>
    </div>

    <section
      v-else-if="loadError"
      ref="alertElement"
      class="app-settings-alert"
      role="alert"
      tabindex="-1"
    >
      <strong>설정을 불러오지 못했습니다</strong>
      <p>{{ loadError }}</p>
      <AppButton @click="load(true)">다시 시도</AppButton>
    </section>

    <form v-else class="app-settings-form" novalidate @submit.prevent="save">
      <fieldset class="theme-fieldset" :disabled="saving">
        <legend>화면 테마</legend>
        <p id="theme-help">시스템은 운영체제의 라이트·다크 모드를 자동으로 따릅니다.</p>
        <div class="theme-options" aria-describedby="theme-help">
          <label>
            <input v-model="draft.theme" type="radio" name="theme" value="light">
            <span>라이트</span>
          </label>
          <label>
            <input v-model="draft.theme" type="radio" name="theme" value="dark">
            <span>다크</span>
          </label>
          <label>
            <input v-model="draft.theme" type="radio" name="theme" value="system">
            <span>시스템</span>
          </label>
        </div>
      </fieldset>

      <div class="dashboard-preferences" aria-labelledby="dashboard-preferences-title">
        <div class="dashboard-preferences-heading">
          <h4 id="dashboard-preferences-title">대시보드 표시 기준</h4>
          <p>상령·만기 30/60/90일 구간과 카드 전체 건수는 바뀌지 않습니다.</p>
        </div>
        <label v-for="field in ([
          ['recentConsultationDays', '최근 상담 기간', '일'],
          ['unconsultedDays', '미상담 기준', '일 이상'],
          ['dashboardItemLimit', '카드별 표시 건수', '건'],
        ] as const)" :key="field[0]" class="preference-field">
          <span>{{ field[1] }}</span>
          <span class="number-control">
            <input
              v-model="draft[field[0]]"
              type="number"
              inputmode="numeric"
              :name="field[0]"
              :min="field[0] === 'dashboardItemLimit' ? 1 : 1"
              :max="field[0] === 'recentConsultationDays' ? 365 : field[0] === 'unconsultedDays' ? 3650 : 10"
              step="1"
              :disabled="saving"
              :aria-invalid="fieldErrors[field[0]] ? 'true' : undefined"
              :aria-describedby="fieldErrors[field[0]] ? `${field[0]}-error` : undefined"
              @input="clearFieldError(field[0])"
            >
            <small>{{ field[2] }}</small>
          </span>
          <small v-if="fieldErrors[field[0]]" :id="`${field[0]}-error`" class="field-error">
            {{ fieldErrors[field[0]] }}
          </small>
        </label>
      </div>

      <p class="period-note">
        최근 상담은 오늘 포함 N일, 미상담은 마지막 상담 후 N일 이상이며 미상담 기준은 최근 상담 기간 이상이어야 합니다.
      </p>

      <section
        v-if="saveError"
        ref="alertElement"
        class="app-settings-alert"
        role="alert"
        tabindex="-1"
      >
        <strong>설정을 저장하지 못했습니다</strong>
        <p>{{ saveError }}</p>
      </section>

      <p
        v-if="notice"
        ref="resultElement"
        class="app-settings-result"
        role="status"
        tabindex="-1"
      >{{ notice }}</p>

      <footer class="app-settings-actions">
        <AppButton variant="primary" type="submit" :loading="saving">
          설정 저장
        </AppButton>
      </footer>
    </form>
  </section>
</template>

<style scoped src="./app-settings-section.css"></style>
