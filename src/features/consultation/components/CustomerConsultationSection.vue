<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";

import { consultationApplication } from "@/app/composition/consultation";
import { useCustomerConsultationActions } from "@/features/consultation/composables/use-customer-consultation-actions";
import type { Consultation } from "@/features/consultation/types/consultation";
import { consultationSafeMessage } from "@/features/consultation/types/consultation-error";
import AppButton from "@/shared/components/AppButton.vue";

import ConsultationDeleteDialog from "./ConsultationDeleteDialog.vue";
import ConsultationFormDialog from "./ConsultationFormDialog.vue";
import ConsultationList from "./ConsultationList.vue";

const props = defineProps<{
  customerId: string;
}>();

const sectionElement = ref<HTMLElement>();
const consultations = ref<Consultation[]>([]);
const initialLoading = ref(true);
const refreshing = ref(false);
const loadError = ref<string>();
const notice = ref<string>();
let loadNumber = 0;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;

function showNotice(message: string) {
  notice.value = message;
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice.value = undefined;
  }, 3500);
}

async function focusCreate() {
  await nextTick();
  sectionElement.value
    ?.querySelector<HTMLElement>("[data-testid='create-consultation']")
    ?.focus();
}

async function loadConsultations(expectedCustomerId: string) {
  if (expectedCustomerId !== props.customerId) return;
  const currentLoad = ++loadNumber;
  const blankLoad = consultations.value.length === 0;
  if (blankLoad) initialLoading.value = true;
  else refreshing.value = true;
  loadError.value = undefined;
  try {
    const loaded = await consultationApplication.list(expectedCustomerId);
    if (currentLoad !== loadNumber || expectedCustomerId !== props.customerId) return;
    consultations.value = loaded;
  } catch (error) {
    if (currentLoad !== loadNumber || expectedCustomerId !== props.customerId) return;
    consultations.value = [];
    loadError.value = consultationSafeMessage(error);
  } finally {
    if (currentLoad === loadNumber && expectedCustomerId === props.customerId) {
      initialLoading.value = false;
      refreshing.value = false;
    }
  }
}

const {
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
} = useCustomerConsultationActions({
  customerId: () => props.customerId,
  reload: loadConsultations,
  showNotice,
  focusCreate,
});

function startCustomerLoad(customerId: string) {
  loadNumber += 1;
  consultations.value = [];
  initialLoading.value = true;
  refreshing.value = false;
  loadError.value = undefined;
  notice.value = undefined;
  if (noticeTimer) clearTimeout(noticeTimer);
  resetDialogs();
  void loadConsultations(customerId);
}

watch(() => props.customerId, startCustomerLoad, { immediate: true, flush: "sync" });

onBeforeUnmount(() => {
  loadNumber += 1;
  if (noticeTimer) clearTimeout(noticeTimer);
});
</script>

<template>
  <section
    ref="sectionElement"
    class="consultation-section"
    data-testid="consultation-section"
    aria-labelledby="consultation-section-title"
    :aria-busy="initialLoading || refreshing"
  >
    <header class="consultation-heading">
      <div>
        <h3 id="consultation-section-title">상담 기록</h3>
        <p>활성 상담 {{ consultations.length }}건</p>
      </div>
      <div class="consultation-heading-actions">
        <span v-if="refreshing" class="refresh-state" role="status">
          <i aria-hidden="true" />불러오는 중
        </span>
        <AppButton
          variant="primary"
          data-testid="create-consultation"
          @click="createConsultation"
        >
          <span class="button-plus" aria-hidden="true">+</span>
          상담 등록
        </AppButton>
      </div>
    </header>

    <p v-if="notice" class="toast-notice consultation-notice" role="status">{{ notice }}</p>

    <section v-if="initialLoading" class="state-panel consultation-state surface" aria-live="polite">
      <div class="large-spinner" aria-hidden="true" />
      <strong>상담 기록을 불러오는 중입니다</strong>
      <span>이 PC에 저장된 고객별 상담을 확인하고 있습니다.</span>
    </section>

    <div v-else-if="loadError" class="inline-alert consultation-alert" role="alert">
      <span>{{ loadError }}</span>
      <button type="button" @click="loadConsultations(customerId)">다시 시도</button>
    </div>

    <section
      v-else-if="consultations.length === 0"
      class="state-panel consultation-state surface"
    >
      <span class="state-symbol" aria-hidden="true">＋</span>
      <strong>등록된 상담 기록이 없습니다</strong>
      <span>상담 일시만으로 첫 기록을 시작할 수 있습니다.</span>
      <AppButton variant="primary" @click="createConsultation">첫 상담 등록</AppButton>
    </section>

    <section v-else class="consultation-list surface" :aria-busy="refreshing">
      <ConsultationList
        :consultations="consultations"
        @edit="editConsultation"
        @remove="requestDelete"
      />
    </section>

    <ConsultationFormDialog
      :open="formOpen"
      :consultation="selectedConsultation"
      :submitting="submitting"
      :errors="formErrors"
      :submit-error="formSubmitError"
      @clear-error="clearFormError"
      @close="closeForm"
      @submit="saveConsultation"
    />
    <ConsultationDeleteDialog
      :open="deleteOpen"
      :consultation="deletingConsultation"
      :deleting="deleting"
      :error="deleteError"
      @close="closeDelete"
      @confirm="confirmDelete"
    />
  </section>
</template>
