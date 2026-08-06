<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

import { customerApplication } from "@/app/composition/customer";
import CustomerDeleteDialog from "@/features/customer/components/CustomerDeleteDialog.vue";
import CustomerFormDialog from "@/features/customer/components/CustomerFormDialog.vue";
import CustomerTable from "@/features/customer/components/CustomerTable.vue";
import type {
  Customer,
  CustomerInput,
} from "@/features/customer/types/customer";
import {
  CustomerValidationError,
  customerSafeMessage,
} from "@/features/customer/types/customer-error";
import AppButton from "@/shared/components/AppButton.vue";
import AppIcon from "@/shared/components/AppIcon.vue";

type FieldErrors = Partial<Record<keyof CustomerInput, string>>;

const customers = ref<Customer[]>([]);
const search = ref("");
const initialLoading = ref(true);
const refreshing = ref(false);
const loadError = ref<string>();

const formOpen = ref(false);
const selectedCustomer = ref<Customer>();
const submitting = ref(false);
const formErrors = ref<FieldErrors>({});
const formSubmitError = ref<string>();

const deleteOpen = ref(false);
const deletingCustomer = ref<Customer>();
const deleting = ref(false);
const deleteError = ref<string>();

const notice = ref<string>();
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
let requestNumber = 0;

function showNotice(message: string) {
  notice.value = message;
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice.value = undefined;
  }, 3500);
}

async function loadCustomers(mode: "initial" | "refresh" = "refresh") {
  const currentRequest = ++requestNumber;
  if (mode === "initial") initialLoading.value = true;
  else refreshing.value = true;
  loadError.value = undefined;

  try {
    const result = await customerApplication.list(search.value);
    if (currentRequest === requestNumber) customers.value = result;
  } catch (error) {
    if (currentRequest === requestNumber) loadError.value = customerSafeMessage(error);
  } finally {
    if (currentRequest === requestNumber) {
      initialLoading.value = false;
      refreshing.value = false;
    }
  }
}

function createCustomer() {
  selectedCustomer.value = undefined;
  formErrors.value = {};
  formSubmitError.value = undefined;
  formOpen.value = true;
}

function editCustomer(customer: Customer) {
  selectedCustomer.value = customer;
  formErrors.value = {};
  formSubmitError.value = undefined;
  formOpen.value = true;
}

function closeForm() {
  if (submitting.value) return;
  formOpen.value = false;
}

async function saveCustomer(input: CustomerInput) {
  submitting.value = true;
  formErrors.value = {};
  formSubmitError.value = undefined;

  try {
    if (selectedCustomer.value) {
      await customerApplication.update(selectedCustomer.value.id, input);
      showNotice("고객 정보를 저장했습니다.");
    } else {
      await customerApplication.create(input);
      showNotice("새 고객을 등록했습니다.");
    }
    formOpen.value = false;
    await loadCustomers();
  } catch (error) {
    if (error instanceof CustomerValidationError) {
      const errors: FieldErrors = {};
      for (const issue of error.issues) {
        if (issue.field in input) {
          errors[issue.field as keyof CustomerInput] = issue.message;
        }
      }
      formErrors.value = errors;
      if (Object.keys(errors).length === 0) formSubmitError.value = error.message;
    } else {
      formSubmitError.value = customerSafeMessage(error);
    }
  } finally {
    submitting.value = false;
  }
}

function requestDelete(customer: Customer) {
  deletingCustomer.value = customer;
  deleteError.value = undefined;
  deleteOpen.value = true;
}

function closeDelete() {
  if (deleting.value) return;
  deleteOpen.value = false;
}

async function confirmDelete() {
  if (!deletingCustomer.value) return;
  deleting.value = true;
  deleteError.value = undefined;
  try {
    await customerApplication.remove(deletingCustomer.value.id);
    deleteOpen.value = false;
    showNotice("고객을 기본 목록에서 제외했습니다.");
    await loadCustomers();
  } catch (error) {
    deleteError.value = customerSafeMessage(error);
  } finally {
    deleting.value = false;
  }
}

function clearSearch() {
  search.value = "";
}

watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void loadCustomers(), 240);
});

onMounted(() => void loadCustomers("initial"));
onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
  if (noticeTimer) clearTimeout(noticeTimer);
});
</script>

<template>
  <section class="customer-page" aria-labelledby="customer-section-title">
    <header class="customer-toolbar">
      <div>
        <h2 id="customer-section-title">고객 목록</h2>
        <p v-if="!initialLoading">
          {{ search ? `검색 결과 ${customers.length}명` : `등록 고객 ${customers.length}명` }}
        </p>
      </div>
      <AppButton variant="primary" data-testid="create-customer" @click="createCustomer">
        <span class="button-plus" aria-hidden="true">+</span>
        고객 등록
      </AppButton>
    </header>

    <div class="customer-controls surface">
      <label class="search-field">
        <span class="sr-only">고객 검색</span>
        <AppIcon name="search" :size="18" />
        <input
          v-model="search"
          type="search"
          autocomplete="off"
          maxlength="100"
          placeholder="이름, 연락처, 담당 상태로 검색"
          aria-label="고객 검색"
        />
        <button v-if="search" type="button" aria-label="검색어 지우기" @click="clearSearch">
          ×
        </button>
      </label>
      <span v-if="refreshing" class="refresh-state" role="status">
        <i aria-hidden="true" />
        불러오는 중
      </span>
    </div>

    <p v-if="notice" class="toast-notice" role="status">{{ notice }}</p>

    <div v-if="loadError && customers.length > 0" class="inline-alert" role="alert">
      <span>{{ loadError }}</span>
      <button type="button" @click="loadCustomers()">다시 시도</button>
    </div>

    <section v-if="initialLoading" class="state-panel surface" aria-live="polite">
      <div class="large-spinner" aria-hidden="true" />
      <strong>고객 목록을 불러오는 중입니다</strong>
      <span>이 PC에 저장된 데이터를 확인하고 있습니다.</span>
    </section>

    <section v-else-if="loadError && customers.length === 0" class="state-panel surface" role="alert">
      <span class="state-symbol is-error" aria-hidden="true">!</span>
      <strong>고객 목록을 열지 못했습니다</strong>
      <span>{{ loadError }}</span>
      <AppButton @click="loadCustomers()">다시 시도</AppButton>
    </section>

    <section v-else-if="customers.length === 0" class="state-panel surface">
      <span class="state-symbol" aria-hidden="true">
        <AppIcon :name="search ? 'search' : 'customers'" :size="27" />
      </span>
      <strong>{{ search ? "일치하는 고객이 없습니다" : "첫 고객을 등록해 보세요" }}</strong>
      <span>
        {{ search ? "검색어를 바꾸거나 지워 주세요." : "이름만으로 빠르게 시작할 수 있습니다." }}
      </span>
      <AppButton v-if="search" @click="clearSearch">전체 고객 보기</AppButton>
      <AppButton v-else variant="primary" @click="createCustomer">고객 등록</AppButton>
    </section>

    <section v-else class="customer-list surface" :aria-busy="refreshing">
      <CustomerTable :customers="customers" @edit="editCustomer" @remove="requestDelete" />
    </section>

    <CustomerFormDialog
      :open="formOpen"
      :customer="selectedCustomer"
      :submitting="submitting"
      :errors="formErrors"
      :submit-error="formSubmitError"
      @close="closeForm"
      @submit="saveCustomer"
    />
    <CustomerDeleteDialog
      :open="deleteOpen"
      :customer="deletingCustomer"
      :deleting="deleting"
      :error="deleteError"
      @close="closeDelete"
      @confirm="confirmDelete"
    />
  </section>
</template>
