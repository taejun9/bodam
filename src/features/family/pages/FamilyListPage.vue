<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import "@/assets/family-dialog.css";
import "@/assets/family-page.css";
import { familyApplication } from "@/app/composition/family";
import FamilyDeleteDialog from "@/features/family/components/FamilyDeleteDialog.vue";
import FamilyFormDialog from "@/features/family/components/FamilyFormDialog.vue";
import {
  familyIdentities as buildFamilyIdentities,
  identityLabel,
} from "@/features/family/components/family-identity";
import FamilyMembersDialog from "@/features/family/components/FamilyMembersDialog.vue";
import FamilyTable from "@/features/family/components/FamilyTable.vue";
import type { FamilyInput, FamilySummary } from "@/features/family/types/family";
import {
  FamilyValidationError,
  familySafeMessage,
} from "@/features/family/types/family-error";
import AppButton from "@/shared/components/AppButton.vue";
import AppIcon from "@/shared/components/AppIcon.vue";

type FieldErrors = Partial<Record<keyof FamilyInput, string>>;

const families = ref<FamilySummary[]>([]);
const search = ref("");
const searchInput = ref<HTMLInputElement>();
const initialLoading = ref(true);
const refreshing = ref(false);
const loadError = ref<string>();

const formOpen = ref(false);
const selectedFamily = ref<FamilySummary>();
const submitting = ref(false);
const formErrors = ref<FieldErrors>({});
const formSubmitError = ref<string>();

const deleteOpen = ref(false);
const deletingFamily = ref<FamilySummary>();
const deleting = ref(false);
const deleteError = ref<string>();

const membersOpen = ref(false);
const memberFamily = ref<FamilySummary>();
const notice = ref<string>();
const identities = computed(() => buildFamilyIdentities(families.value));
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
let requestNumber = 0;

function label(summary: FamilySummary | undefined): string | undefined {
  return summary ? identityLabel(identities.value, summary.family.id, "가족") : undefined;
}

function showNotice(message: string) {
  notice.value = message;
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice.value = undefined;
  }, 3500);
}

async function focusSearchInput() {
  await nextTick();
  searchInput.value?.focus();
}

async function loadFamilies(mode: "initial" | "refresh" = "refresh") {
  const currentRequest = ++requestNumber;
  if (mode === "initial") initialLoading.value = true;
  else refreshing.value = true;
  loadError.value = undefined;
  try {
    const result = await familyApplication.list(search.value);
    if (currentRequest !== requestNumber) return;
    families.value = result;
    if (memberFamily.value) {
      memberFamily.value = result.find(
        (summary) => summary.family.id === memberFamily.value?.family.id,
      ) ?? memberFamily.value;
    }
  } catch (error) {
    if (currentRequest === requestNumber) loadError.value = familySafeMessage(error);
  } finally {
    if (currentRequest === requestNumber) {
      initialLoading.value = false;
      refreshing.value = false;
    }
  }
}

function createFamily() {
  selectedFamily.value = undefined;
  formErrors.value = {};
  formSubmitError.value = undefined;
  formOpen.value = true;
}

function editFamily(family: FamilySummary) {
  selectedFamily.value = family;
  formErrors.value = {};
  formSubmitError.value = undefined;
  formOpen.value = true;
}

function closeForm() {
  if (!submitting.value) formOpen.value = false;
}

async function saveFamily(input: FamilyInput) {
  const selected = selectedFamily.value;
  submitting.value = true;
  formErrors.value = {};
  formSubmitError.value = undefined;
  try {
    if (selected) await familyApplication.update(selected.family.id, input);
    else await familyApplication.create(input);
    formOpen.value = false;
    showNotice(selected ? "가족 이름을 저장했습니다." : "새 가족을 등록했습니다.");
    await loadFamilies();
    if (selected) await focusSearchInput();
  } catch (error) {
    if (error instanceof FamilyValidationError) {
      const errors: FieldErrors = {};
      for (const issue of error.issues) {
        if (issue.field === "name") errors.name = issue.message;
      }
      formErrors.value = errors;
      if (!errors.name) formSubmitError.value = error.message;
    } else {
      formSubmitError.value = familySafeMessage(error);
    }
  } finally {
    submitting.value = false;
  }
}

function requestDelete(family: FamilySummary) {
  deletingFamily.value = family;
  deleteError.value = undefined;
  deleteOpen.value = true;
}

function closeDelete() {
  if (!deleting.value) deleteOpen.value = false;
}

async function confirmDelete() {
  const family = deletingFamily.value;
  if (!family) return;
  deleting.value = true;
  deleteError.value = undefined;
  try {
    await familyApplication.remove(family.family.id);
    deleteOpen.value = false;
    showNotice("가족을 기본 목록에서 삭제했습니다.");
    await loadFamilies();
    await focusSearchInput();
  } catch (error) {
    deleteError.value = familySafeMessage(error);
  } finally {
    deleting.value = false;
  }
}

function manageMembers(family: FamilySummary) {
  memberFamily.value = family;
  membersOpen.value = true;
}

function closeMembers() {
  membersOpen.value = false;
}

async function membersChanged(message: string) {
  showNotice(message);
  await loadFamilies();
}

function clearSearch() {
  search.value = "";
}

watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void loadFamilies(), 240);
});

onMounted(() => void loadFamilies("initial"));
onBeforeUnmount(() => {
  requestNumber += 1;
  if (searchTimer) clearTimeout(searchTimer);
  if (noticeTimer) clearTimeout(noticeTimer);
});
</script>

<template>
  <section class="family-page" aria-labelledby="family-section-title">
    <header class="family-toolbar">
      <div>
        <h2 id="family-section-title">가족 목록</h2>
        <p v-if="!initialLoading">
          {{ search ? `검색 결과 ${families.length}개` : `등록 가족 ${families.length}개` }}
        </p>
      </div>
      <AppButton variant="primary" data-testid="create-family" @click="createFamily">
        <span class="button-plus" aria-hidden="true">+</span>
        가족 등록
      </AppButton>
    </header>

    <div class="family-controls surface">
      <label class="search-field">
        <span class="sr-only">가족 검색</span>
        <AppIcon name="search" :size="18" />
        <input
          ref="searchInput"
          v-model="search"
          type="search"
          maxlength="200"
          autocomplete="off"
          placeholder="가족 이름으로 검색"
          aria-label="가족 검색"
        />
        <button v-if="search" type="button" aria-label="검색어 지우기" @click="clearSearch">×</button>
      </label>
      <span v-if="refreshing" class="refresh-state" role="status">
        <i aria-hidden="true" />
        불러오는 중
      </span>
    </div>

    <p v-if="notice" class="toast-notice" role="status">{{ notice }}</p>
    <div v-if="loadError && families.length > 0" class="inline-alert" role="alert">
      <span>{{ loadError }}</span>
      <button type="button" @click="loadFamilies()">다시 시도</button>
    </div>

    <section v-if="initialLoading" class="state-panel surface" aria-live="polite">
      <div class="large-spinner" aria-hidden="true" />
      <strong>가족 목록을 불러오는 중입니다</strong>
      <span>활성 고객과 합계대상 보험료를 확인하고 있습니다.</span>
    </section>
    <section v-else-if="loadError && families.length === 0" class="state-panel surface" role="alert">
      <span class="state-symbol is-error" aria-hidden="true">!</span>
      <strong>가족 목록을 열지 못했습니다</strong>
      <span>{{ loadError }}</span>
      <AppButton @click="loadFamilies()">다시 시도</AppButton>
    </section>
    <section v-else-if="families.length === 0" class="state-panel surface">
      <span class="state-symbol" aria-hidden="true">
        <AppIcon :name="search ? 'search' : 'family'" :size="27" />
      </span>
      <strong>{{ search ? "일치하는 가족이 없습니다" : "첫 가족을 등록해 보세요" }}</strong>
      <span>{{ search ? "검색어를 바꾸거나 지워 주세요." : "가족 이름만으로 빠르게 시작할 수 있습니다." }}</span>
      <AppButton v-if="search" @click="clearSearch">전체 가족 보기</AppButton>
      <AppButton v-else variant="primary" @click="createFamily">가족 등록</AppButton>
    </section>
    <section v-else class="family-list surface" :aria-busy="refreshing">
      <FamilyTable
        :families="families"
        @manage="manageMembers"
        @edit="editFamily"
        @remove="requestDelete"
      />
    </section>

    <FamilyFormDialog
      :open="formOpen"
      :family="selectedFamily"
      :family-label="label(selectedFamily)"
      :submitting="submitting"
      :errors="formErrors"
      :submit-error="formSubmitError"
      @close="closeForm"
      @submit="saveFamily"
    />
    <FamilyDeleteDialog
      :open="deleteOpen"
      :family="deletingFamily"
      :family-label="label(deletingFamily)"
      :deleting="deleting"
      :error="deleteError"
      @close="closeDelete"
      @confirm="confirmDelete"
    />
    <FamilyMembersDialog
      :open="membersOpen"
      :family="memberFamily"
      :family-label="label(memberFamily)"
      @close="closeMembers"
      @changed="membersChanged"
    />
  </section>
</template>
