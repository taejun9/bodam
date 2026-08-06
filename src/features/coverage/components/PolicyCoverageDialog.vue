<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";

import { coverageApplication } from "@/app/composition/coverage";
import { categoryDisplayLabel } from "@/features/coverage/components/coverage-category-label";
import type { CoverageFieldErrors } from "@/features/coverage/components/coverage-form";
import PolicyCoverageDelete from "@/features/coverage/components/PolicyCoverageDelete.vue";
import PolicyCoverageForm from "@/features/coverage/components/PolicyCoverageForm.vue";
import PolicyCoverageList from "@/features/coverage/components/PolicyCoverageList.vue";
import {
  CoverageValidationError,
  coverageSafeMessage,
} from "@/features/coverage/types/coverage-error";
import type {
  Coverage,
  CoverageCategory,
  CoverageInput,
} from "@/features/coverage/types/coverage";
import type { InsurancePolicy } from "@/features/insurance/types/insurance-policy";
import AppDialog from "@/shared/components/AppDialog.vue";

type DialogMode = "list" | "form" | "delete";

const props = withDefaults(
  defineProps<{
    open: boolean;
    customerId: string;
    policy?: InsurancePolicy | null | undefined;
  }>(),
  { policy: null },
);

const emit = defineEmits<{ close: []; changed: [message: string] }>();
const dialogContent = ref<HTMLElement>();
const mode = ref<DialogMode>("list");
const categories = ref<CoverageCategory[]>([]);
const coverages = ref<Coverage[]>([]);
const selectedCoverage = ref<Coverage>();
const loading = ref(false);
const working = ref(false);
const loadError = ref<string>();
const formErrors = ref<CoverageFieldErrors>({});
const actionError = ref<string>();
let loadNumber = 0;

const dialogTitle = computed(() => {
  if (mode.value === "form") return selectedCoverage.value ? "보장 수정" : "새 보장 등록";
  if (mode.value === "delete") return "보장 삭제";
  return "계약별 보장 관리";
});

function focusCurrentPanel() {
  void nextTick(() => {
    dialogContent.value?.querySelector<HTMLElement>("[autofocus]")?.focus();
  });
}

async function load(showLoading = true) {
  const currentLoad = ++loadNumber;
  const expectedCustomerId = props.customerId;
  const expectedPolicyId = props.policy?.id;
  if (!expectedPolicyId) return;
  if (showLoading) loading.value = true;
  loadError.value = undefined;
  try {
    const [loadedCategories, loadedCoverages] = await Promise.all([
      coverageApplication.listCategories(),
      coverageApplication.list(expectedCustomerId),
    ]);
    if (
      currentLoad !== loadNumber
      || expectedCustomerId !== props.customerId
      || expectedPolicyId !== props.policy?.id
    ) return;
    categories.value = loadedCategories;
    coverages.value = coverageApplication.forPolicy(loadedCoverages, expectedPolicyId);
    if (mode.value === "list") focusCurrentPanel();
  } catch (error) {
    if (currentLoad === loadNumber) loadError.value = coverageSafeMessage(error);
  } finally {
    if (currentLoad === loadNumber) loading.value = false;
  }
}

function beginCreate() {
  selectedCoverage.value = undefined;
  formErrors.value = {};
  actionError.value = undefined;
  mode.value = "form";
  focusCurrentPanel();
}

function beginEdit(coverage: Coverage) {
  selectedCoverage.value = coverage;
  formErrors.value = {};
  actionError.value = undefined;
  mode.value = "form";
  focusCurrentPanel();
}

function beginDelete(coverage: Coverage) {
  selectedCoverage.value = coverage;
  actionError.value = undefined;
  mode.value = "delete";
  focusCurrentPanel();
}

function returnToList() {
  if (working.value) return;
  mode.value = "list";
  selectedCoverage.value = undefined;
  actionError.value = undefined;
  void nextTick(() => {
    dialogContent.value?.querySelector<HTMLElement>("[data-testid='create-coverage']")?.focus();
  });
}

function requestClose() {
  if (!working.value) emit("close");
}

async function save(input: CoverageInput) {
  const policy = props.policy;
  if (!policy) return;
  const expectedCustomerId = props.customerId;
  const selected = selectedCoverage.value;
  working.value = true;
  formErrors.value = {};
  actionError.value = undefined;
  try {
    if (selected) {
      await coverageApplication.update(expectedCustomerId, selected.id, input);
    } else {
      await coverageApplication.create(expectedCustomerId, policy.id, input);
    }
    if (expectedCustomerId !== props.customerId || policy.id !== props.policy?.id) return;
    mode.value = "list";
    selectedCoverage.value = undefined;
    await load(false);
    emit("changed", selected ? "보장을 저장했습니다." : "새 보장을 등록했습니다.");
  } catch (error) {
    if (expectedCustomerId !== props.customerId) return;
    if (error instanceof CoverageValidationError) {
      const errors: CoverageFieldErrors = {};
      for (const issue of error.issues) {
        if (issue.field === "categoryId" || issue.field === "amountWon") {
          errors[issue.field] = issue.message;
        }
      }
      formErrors.value = errors;
      if (Object.keys(errors).length === 0) actionError.value = error.message;
    } else {
      actionError.value = coverageSafeMessage(error);
    }
  } finally {
    working.value = false;
  }
}

async function confirmDelete() {
  const coverage = selectedCoverage.value;
  if (!coverage) return;
  const expectedCustomerId = props.customerId;
  working.value = true;
  actionError.value = undefined;
  try {
    await coverageApplication.remove(expectedCustomerId, coverage.id);
    if (expectedCustomerId !== props.customerId) return;
    mode.value = "list";
    selectedCoverage.value = undefined;
    await load(false);
    emit("changed", "보장을 기본 목록에서 삭제했습니다.");
  } catch (error) {
    if (expectedCustomerId === props.customerId) actionError.value = coverageSafeMessage(error);
  } finally {
    working.value = false;
  }
}

watch(
  () => [props.open, props.customerId, props.policy?.id] as const,
  ([open]) => {
    loadNumber += 1;
    if (!open || !props.policy) return;
    mode.value = "list";
    selectedCoverage.value = undefined;
    categories.value = [];
    coverages.value = [];
    actionError.value = undefined;
    void load();
  },
  { immediate: true },
);
</script>

<template>
  <AppDialog
    :open="open"
    :title="dialogTitle"
    :description="policy ? `${policy.insurer} · ${policy.productName}` : undefined"
    size="large"
    @close="requestClose"
  >
    <section ref="dialogContent" data-testid="policy-coverage-dialog">
      <p v-if="policy && !policy.isIncluded" class="coverage-excluded-notice" role="note">
        이 계약은 합계대상에서 제외되어 있습니다. 보장 원본은 관리할 수 있지만 고객 보장 합계에는 반영되지 않습니다.
      </p>
      <PolicyCoverageList
        v-if="mode === 'list'"
        :categories="categories"
        :coverages="coverages"
        :loading="loading"
        :error="loadError"
        @create="beginCreate"
        @edit="beginEdit"
        @remove="beginDelete"
        @retry="load()"
      />
      <PolicyCoverageForm
        v-else-if="mode === 'form'"
        :key="selectedCoverage?.id ?? 'create'"
        :coverage="selectedCoverage"
        :categories="categories"
        :submitting="working"
        :errors="formErrors"
        :submit-error="actionError"
        @cancel="returnToList"
        @submit="save"
      />
      <PolicyCoverageDelete
        v-else
        :coverage="selectedCoverage"
        :category-name="selectedCoverage
          ? categoryDisplayLabel(categories, selectedCoverage.categoryId)
          : '보장'"
        :deleting="working"
        :error="actionError"
        @cancel="returnToList"
        @confirm="confirmDelete"
      />
    </section>
  </AppDialog>
</template>
