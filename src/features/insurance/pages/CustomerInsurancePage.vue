<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";

import { customerApplication } from "@/app/composition/customer";
import { insuranceApplication } from "@/app/composition/insurance";
import CustomerConsultationSection from "@/features/consultation/components/CustomerConsultationSection.vue";
import type { Customer } from "@/features/customer/types/customer";
import { customerSafeMessage } from "@/features/customer/types/customer-error";
import CustomerCoverageSection from "@/features/coverage/components/CustomerCoverageSection.vue";
import PolicyCoverageDialog from "@/features/coverage/components/PolicyCoverageDialog.vue";
import InsurancePolicyDeleteDialog from "@/features/insurance/components/InsurancePolicyDeleteDialog.vue";
import InsurancePolicyFormDialog from "@/features/insurance/components/InsurancePolicyFormDialog.vue";
import InsurancePolicyTable from "@/features/insurance/components/InsurancePolicyTable.vue";
import { useCustomerInsuranceActions } from "@/features/insurance/composables/use-customer-insurance-actions";
import type { InsurancePolicy } from "@/features/insurance/types/insurance-policy";
import {
  InsuranceRepositoryError,
  InsuranceValidationError,
  insuranceSafeMessage,
} from "@/features/insurance/types/insurance-error";
import AppButton from "@/shared/components/AppButton.vue";
import AppIcon from "@/shared/components/AppIcon.vue";

const route = useRoute();
const customer = ref<Customer>();
const policies = ref<InsurancePolicy[]>([]);
const initialLoading = ref(true);
const refreshing = ref(false);
const pageError = ref<string>();
const notice = ref<string>();

const moneyFormatter = new Intl.NumberFormat("ko-KR");
const totalPremium = computed(() => insuranceApplication.total(policies.value));
const includedCount = computed(() => policies.value.filter((policy) => policy.isIncluded).length);
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
let loadNumber = 0;

function customerId(): string {
  return String(route.params.customerId ?? "");
}

function showNotice(message: string) {
  notice.value = message;
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice.value = undefined;
  }, 3500);
}

const {
  formOpen,
  selectedPolicy,
  submitting,
  formErrors,
  formSubmitError,
  deleteOpen,
  deletingPolicy,
  deleting,
  deleteError,
  coverageDialogOpen,
  coveragePolicy,
  coverageRefreshKey,
  resetDialogs,
  createPolicy,
  editPolicy,
  closeForm,
  savePolicy,
  requestDelete,
  closeDelete,
  confirmDelete,
  manageCoverage,
  coverageChanged,
} = useCustomerInsuranceActions({ customerId, loadPolicies, showNotice });

async function loadPage() {
  const currentLoad = ++loadNumber;
  initialLoading.value = true;
  refreshing.value = false;
  customer.value = undefined;
  policies.value = [];
  pageError.value = undefined;
  notice.value = undefined;
  resetDialogs();
  try {
    const [customers, loadedPolicies] = await Promise.all([
      customerApplication.list(),
      insuranceApplication.list(customerId()),
    ]);
    if (currentLoad !== loadNumber) return;
    const activeCustomer = customers.find((item) => item.id === customerId());
    if (!activeCustomer) {
      pageError.value = "활성 고객을 찾을 수 없습니다.";
      return;
    }
    customer.value = activeCustomer;
    policies.value = loadedPolicies;
  } catch (error) {
    if (currentLoad === loadNumber) {
      pageError.value = error instanceof InsuranceValidationError
        || error instanceof InsuranceRepositoryError
        ? insuranceSafeMessage(error)
        : customerSafeMessage(error);
    }
  } finally {
    if (currentLoad === loadNumber) initialLoading.value = false;
  }
}

async function loadPolicies(expectedCustomerId = customerId()) {
  refreshing.value = true;
  pageError.value = undefined;
  try {
    const loadedPolicies = await insuranceApplication.list(expectedCustomerId);
    if (expectedCustomerId === customerId()) policies.value = loadedPolicies;
  } catch (error) {
    if (expectedCustomerId !== customerId()) return;
    policies.value = [];
    pageError.value = insuranceSafeMessage(error);
  } finally {
    if (expectedCustomerId === customerId()) refreshing.value = false;
  }
}

watch(() => route.params.customerId, () => void loadPage(), { immediate: true });
onBeforeUnmount(() => {
  if (noticeTimer) clearTimeout(noticeTimer);
});
</script>

<template>
  <section class="insurance-page" aria-labelledby="insurance-section-title">
    <nav class="detail-breadcrumb" aria-label="현재 위치">
      <RouterLink to="/customers">고객 목록</RouterLink>
      <span aria-hidden="true">/</span>
      <span>{{ customer?.name ?? "고객 상세" }}</span>
    </nav>

    <section v-if="initialLoading" class="state-panel surface" aria-live="polite">
      <div class="large-spinner" aria-hidden="true" />
      <strong>고객과 보험계약을 불러오는 중입니다</strong>
      <span>이 PC에 저장된 데이터를 확인하고 있습니다.</span>
    </section>

    <section v-else-if="!customer" class="state-panel surface" role="alert">
      <span class="state-symbol is-error" aria-hidden="true">!</span>
      <strong>고객 상세를 열지 못했습니다</strong>
      <span>{{ pageError ?? "활성 고객을 찾을 수 없습니다." }}</span>
      <RouterLink class="state-link" to="/customers">고객 목록으로 돌아가기</RouterLink>
    </section>

    <template v-else>
      <section class="policy-overview surface">
        <div class="policy-customer">
          <span class="customer-avatar" aria-hidden="true">{{ customer.name.slice(0, 1) }}</span>
          <div>
            <h2 id="insurance-section-title">{{ customer.name }}</h2>
            <p>{{ customer.phone ?? "연락처 미입력" }} · {{ customer.status ?? "담당 상태 미입력" }}</p>
          </div>
        </div>
        <div class="premium-summary">
          <span>월 보험료 합계</span>
          <strong data-testid="premium-total">{{ moneyFormatter.format(totalPremium) }}원</strong>
          <small>합계대상 {{ includedCount }}건 / 전체 {{ policies.length }}건</small>
        </div>
        <AppButton variant="primary" data-testid="create-policy" @click="createPolicy">
          <span class="button-plus" aria-hidden="true">+</span>
          보험계약 등록
        </AppButton>
      </section>

      <p v-if="notice" class="toast-notice" role="status">{{ notice }}</p>
      <div v-if="pageError" class="inline-alert" role="alert">
        <span>{{ pageError }}</span>
        <button type="button" @click="loadPolicies()">다시 시도</button>
      </div>

      <CustomerCoverageSection
        :customer="customer"
        :policies="policies"
        :refresh-key="coverageRefreshKey"
        @changed="coverageChanged"
      />

      <header class="policy-list-heading">
        <div>
          <h3>보험계약</h3>
          <p>활성 계약 {{ policies.length }}건</p>
        </div>
        <span v-if="refreshing" class="refresh-state" role="status"><i aria-hidden="true" />불러오는 중</span>
      </header>

      <section v-if="policies.length === 0 && !pageError" class="state-panel policy-empty surface">
        <span class="state-symbol" aria-hidden="true"><AppIcon name="policy" :size="27" /></span>
        <strong>등록된 보험계약이 없습니다</strong>
        <span>보험사, 상품명, 월보험료만으로 시작할 수 있습니다.</span>
        <AppButton variant="primary" @click="createPolicy">첫 보험계약 등록</AppButton>
      </section>
      <section v-else-if="policies.length > 0" class="policy-list surface" :aria-busy="refreshing">
        <InsurancePolicyTable
          :policies="policies"
          @manage-coverage="manageCoverage"
          @edit="editPolicy"
          @remove="requestDelete"
        />
      </section>

      <CustomerConsultationSection :customer-id="customerId()" />
    </template>

    <InsurancePolicyFormDialog
      :open="formOpen"
      :policy="selectedPolicy"
      :submitting="submitting"
      :errors="formErrors"
      :submit-error="formSubmitError"
      @close="closeForm"
      @submit="savePolicy"
    />
    <InsurancePolicyDeleteDialog
      :open="deleteOpen"
      :policy="deletingPolicy"
      :deleting="deleting"
      :error="deleteError"
      @close="closeDelete"
      @confirm="confirmDelete"
    />
    <PolicyCoverageDialog
      :open="coverageDialogOpen"
      :customer-id="customerId()"
      :policy="coveragePolicy"
      @close="coverageDialogOpen = false"
      @changed="coverageChanged"
    />
  </section>
</template>
