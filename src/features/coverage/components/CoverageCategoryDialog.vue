<script setup lang="ts">
import { nextTick, ref, watch } from "vue";

import { coverageApplication } from "@/app/composition/coverage";
import {
  categoryDisplayLabel,
  categoryIdentityHint,
} from "@/features/coverage/components/coverage-category-label";
import {
  CoverageValidationError,
  coverageSafeMessage,
} from "@/features/coverage/types/coverage-error";
import type {
  Coverage,
  CoverageCategory,
  CoverageCategoryInput,
} from "@/features/coverage/types/coverage";
import AppButton from "@/shared/components/AppButton.vue";
import AppDialog from "@/shared/components/AppDialog.vue";

type CategoryMode = "list" | "edit" | "delete";

const props = defineProps<{
  open: boolean;
  categories: readonly CoverageCategory[];
  coverages: readonly Coverage[];
  benchmarkUsageCounts?: Readonly<Record<string, number>>;
}>();
const emit = defineEmits<{ close: []; changed: [message: string] }>();

const content = ref<HTMLElement>();
const nameInput = ref<HTMLInputElement>();
const mode = ref<CategoryMode>("list");
const selected = ref<CoverageCategory>();
const name = ref("");
const nameError = ref<string>();
const actionError = ref<string>();
const working = ref(false);

function usageCount(categoryId: string): number {
  return coverageApplication.categoryUsageCount(props.coverages, categoryId);
}

function benchmarkUsageCount(categoryId: string): number {
  return props.benchmarkUsageCounts?.[categoryId] ?? 0;
}

function categoryMeta(category: CoverageCategory): string {
  const usage = `현재 고객 연결 보장 ${usageCount(category.id)}건 · 활성 비교 기준 ${benchmarkUsageCount(category.id)}건`;
  const identity = categoryIdentityHint(props.categories, category.id);
  return identity ? `${identity} · ${usage}` : usage;
}

function focusList() {
  void nextTick(() => {
    content.value?.querySelector<HTMLElement>("[data-category-action]")?.focus();
  });
}

function beginEdit(category: CoverageCategory) {
  selected.value = category;
  name.value = category.name;
  nameError.value = undefined;
  actionError.value = undefined;
  mode.value = "edit";
  void nextTick(() => nameInput.value?.focus());
}

function beginDelete(category: CoverageCategory) {
  selected.value = category;
  actionError.value = undefined;
  mode.value = "delete";
}

function returnToList() {
  if (working.value) return;
  mode.value = "list";
  selected.value = undefined;
  nameError.value = undefined;
  actionError.value = undefined;
  focusList();
}

function requestClose() {
  if (!working.value) emit("close");
}

function inputFromName(): CoverageCategoryInput | undefined {
  const normalized = name.value.trim();
  if (!normalized) nameError.value = "카테고리 이름을 입력해 주세요.";
  else if (Array.from(normalized).length > 100) {
    nameError.value = "카테고리 이름은 100자 이내로 입력해 주세요.";
  }
  if (nameError.value) {
    void nextTick(() => nameInput.value?.focus());
    return undefined;
  }
  return { name: normalized };
}

async function saveName() {
  const category = selected.value;
  const input = inputFromName();
  if (!category || !input) return;
  working.value = true;
  actionError.value = undefined;
  try {
    await coverageApplication.updateCategory(category.id, input);
    mode.value = "list";
    selected.value = undefined;
    emit("changed", "보장 카테고리 이름을 저장했습니다.");
    focusList();
  } catch (error) {
    if (error instanceof CoverageValidationError) {
      const issue = error.issues.find((item) => item.field === "name");
      if (issue) {
        nameError.value = issue.message;
        void nextTick(() => nameInput.value?.focus());
      } else actionError.value = error.message;
    } else actionError.value = coverageSafeMessage(error);
  } finally {
    working.value = false;
  }
}

async function confirmDelete() {
  const category = selected.value;
  if (!category) return;
  working.value = true;
  actionError.value = undefined;
  try {
    await coverageApplication.removeCategory(category.id);
    mode.value = "list";
    selected.value = undefined;
    emit("changed", "보장 카테고리를 기본 목록에서 삭제했습니다.");
    focusList();
  } catch (error) {
    actionError.value = coverageSafeMessage(error);
  } finally {
    working.value = false;
  }
}

watch(() => props.open, (open) => {
  if (!open) return;
  mode.value = "list";
  selected.value = undefined;
  nameError.value = undefined;
  actionError.value = undefined;
});
</script>

<template>
  <AppDialog
    :open="open"
    title="보장 카테고리 관리"
    description="공통 카테고리의 이름을 바꾸거나 기본 목록에서 삭제합니다."
    size="large"
    @close="requestClose"
  >
    <section ref="content" class="category-dialog" data-testid="category-settings-dialog">
      <template v-if="mode === 'list'">
        <p class="category-scope-note">
          카테고리는 모든 고객에게 공통으로 적용됩니다. 신규 생성과 삭제 복원은 아직 제공하지 않습니다.
        </p>
        <div v-if="categories.length === 0" class="coverage-dialog-state is-compact">
          <strong>활성 카테고리가 없습니다</strong>
          <span>삭제된 카테고리의 복원은 후속 기능에서 제공합니다.</span>
        </div>
        <ul v-else class="category-row-list">
          <li v-for="(category, index) in categories" :key="category.id">
            <span>
              <strong>{{ category.name }}</strong>
              <small>{{ categoryMeta(category) }}</small>
            </span>
            <span class="category-row-actions">
              <button
                type="button"
                data-category-action="edit"
                :data-category-id="category.id"
                :autofocus="index === 0"
                :aria-label="`${categoryDisplayLabel(categories, category.id)} 카테고리 이름 변경`"
                @click="beginEdit(category)"
              >이름 변경</button>
              <button
                class="danger-action"
                type="button"
                data-category-action="delete"
                :data-category-id="category.id"
                :aria-label="`${categoryDisplayLabel(categories, category.id)} 카테고리 삭제`"
                @click="beginDelete(category)"
              >삭제</button>
            </span>
          </li>
        </ul>
      </template>

      <form v-else-if="mode === 'edit'" class="category-edit-form" novalidate @submit.prevent="saveName">
        <p>카테고리 ID는 유지되므로 연결된 보장에는 새 이름이 즉시 표시됩니다.</p>
        <label class="field">
          <span>카테고리 이름 <em>필수</em></span>
          <input
            ref="nameInput"
            v-model="name"
            name="name"
            maxlength="200"
            autocomplete="off"
            autofocus
            :aria-invalid="Boolean(nameError)"
            @input="nameError = undefined"
          />
          <small v-if="nameError" class="field-error">{{ nameError }}</small>
        </label>
        <p v-if="actionError" class="form-submit-error" role="alert">{{ actionError }}</p>
        <footer class="form-actions coverage-form-actions">
          <AppButton :disabled="working" @click="returnToList">목록으로</AppButton>
          <AppButton variant="primary" type="submit" :loading="working">이름 저장</AppButton>
        </footer>
      </form>

      <template v-else>
        <section class="coverage-delete-confirm">
          <span class="delete-symbol" aria-hidden="true">!</span>
          <div>
            <h3>{{ selected ? categoryDisplayLabel(categories, selected.id) : "카테고리" }}를 삭제할까요?</h3>
            <p>
              현재 고객 연결 보장 {{ selected ? usageCount(selected.id) : 0 }}건과 활성 비교 기준
              {{ selected ? benchmarkUsageCount(selected.id) : 0 }}건이 목록·합계·판정에서 숨겨집니다.
            </p>
            <small>다른 고객의 연결 보장과 비교 판정도 함께 숨겨질 수 있으며 원본 행은 보존됩니다.</small>
          </div>
        </section>
        <p v-if="actionError" class="delete-error" role="alert">{{ actionError }}</p>
        <footer class="form-actions coverage-form-actions">
          <AppButton :disabled="working" autofocus @click="returnToList">목록으로</AppButton>
          <AppButton variant="danger" :loading="working" @click="confirmDelete">카테고리 삭제</AppButton>
        </footer>
      </template>
    </section>
  </AppDialog>
</template>
