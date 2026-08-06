<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";

import { familyApplication } from "@/app/composition/family";
import {
  customerIdentities,
  identityLabel,
} from "@/features/family/components/family-identity";
import FamilyMemberDelete from "@/features/family/components/FamilyMemberDelete.vue";
import FamilyMemberForm from "@/features/family/components/FamilyMemberForm.vue";
import FamilyMemberList from "@/features/family/components/FamilyMemberList.vue";
import type {
  FamilyCustomerOption,
  FamilyDetail,
  FamilyMemberView,
  FamilyMembershipInput,
  FamilySummary,
} from "@/features/family/types/family";
import {
  FamilyValidationError,
  familySafeMessage,
} from "@/features/family/types/family-error";
import AppButton from "@/shared/components/AppButton.vue";
import AppDialog from "@/shared/components/AppDialog.vue";

type DialogMode = "list" | "form" | "delete";
type MemberFieldErrors = Partial<Record<keyof FamilyMembershipInput, string>>;

const props = withDefaults(
  defineProps<{
    open: boolean;
    family?: FamilySummary | null | undefined;
    familyLabel?: string | undefined;
  }>(),
  { family: null, familyLabel: undefined },
);
const emit = defineEmits<{ close: []; changed: [message: string] }>();

const dialogContent = ref<HTMLElement>();
const mode = ref<DialogMode>("list");
const detail = ref<FamilyDetail>();
const available = ref<FamilyCustomerOption[]>([]);
const selectedMember = ref<FamilyMemberView>();
const loading = ref(false);
const working = ref(false);
const loadError = ref<string>();
const formErrors = ref<MemberFieldErrors>({});
const actionError = ref<string>();
let loadNumber = 0;

const identities = computed(() => customerIdentities(detail.value, available.value));
const dialogTitle = computed(() => {
  if (mode.value === "form") return selectedMember.value ? "구성원 관계명 수정" : "구성원 추가";
  if (mode.value === "delete") return "구성원 연결 삭제";
  return "가족 구성원 관리";
});

async function focusCurrentPanel() {
  await nextTick();
  dialogContent.value?.querySelector<HTMLElement>("[autofocus]")?.focus();
}

async function load() {
  const familyId = props.family?.family.id;
  if (!familyId) return;
  const currentLoad = ++loadNumber;
  loading.value = true;
  loadError.value = undefined;
  detail.value = undefined;
  available.value = [];
  try {
    const [loadedDetail, loadedAvailable] = await Promise.all([
      familyApplication.detail(familyId),
      familyApplication.availableCustomers(familyId),
    ]);
    if (currentLoad !== loadNumber || familyId !== props.family?.family.id || !props.open) return;
    detail.value = loadedDetail;
    available.value = loadedAvailable;
  } catch (error) {
    if (currentLoad === loadNumber && familyId === props.family?.family.id) {
      loadError.value = familySafeMessage(error);
    }
  } finally {
    if (currentLoad === loadNumber) {
      loading.value = false;
      if (familyId === props.family?.family.id && props.open && mode.value === "list") {
        await focusCurrentPanel();
      }
    }
  }
}

function beginCreate() {
  if (available.value.length === 0) return;
  selectedMember.value = undefined;
  formErrors.value = {};
  actionError.value = undefined;
  mode.value = "form";
  void focusCurrentPanel();
}

function beginEdit(member: FamilyMemberView) {
  selectedMember.value = member;
  formErrors.value = {};
  actionError.value = undefined;
  mode.value = "form";
  void focusCurrentPanel();
}

function beginDelete(member: FamilyMemberView) {
  selectedMember.value = member;
  actionError.value = undefined;
  mode.value = "delete";
  void focusCurrentPanel();
}

function returnToList() {
  if (working.value) return;
  mode.value = "list";
  selectedMember.value = undefined;
  actionError.value = undefined;
  void nextTick(() => {
    dialogContent.value
      ?.querySelector<HTMLElement>(
        "[data-testid='add-family-member']:not(:disabled), [data-testid='family-member-customer-link']",
      )
      ?.focus();
  });
}

function requestClose() {
  if (!working.value) emit("close");
}

async function save(input: FamilyMembershipInput) {
  const familyId = props.family?.family.id;
  if (!familyId) return;
  const selected = selectedMember.value;
  working.value = true;
  formErrors.value = {};
  actionError.value = undefined;
  try {
    if (selected) {
      await familyApplication.updateMembership(familyId, selected.membershipId, {
        relationshipName: input.relationshipName,
      });
    } else {
      await familyApplication.addMembership(familyId, input);
    }
    if (familyId !== props.family?.family.id || !props.open) return;
    mode.value = "list";
    selectedMember.value = undefined;
    await load();
    emit("changed", selected ? "구성원 관계명을 저장했습니다." : "구성원을 추가했습니다.");
  } catch (error) {
    if (familyId !== props.family?.family.id) return;
    if (error instanceof FamilyValidationError) {
      const errors: MemberFieldErrors = {};
      for (const issue of error.issues) {
        if (issue.field === "customerId" || issue.field === "relationshipName") {
          errors[issue.field] = issue.message;
        }
      }
      formErrors.value = errors;
      if (Object.keys(errors).length === 0) actionError.value = error.message;
    } else {
      actionError.value = familySafeMessage(error);
    }
  } finally {
    working.value = false;
  }
}

async function confirmDelete() {
  const familyId = props.family?.family.id;
  const member = selectedMember.value;
  if (!familyId || !member) return;
  working.value = true;
  actionError.value = undefined;
  try {
    await familyApplication.removeMembership(familyId, member.membershipId);
    if (familyId !== props.family?.family.id || !props.open) return;
    mode.value = "list";
    selectedMember.value = undefined;
    await load();
    emit("changed", "구성원 연결을 삭제했습니다.");
  } catch (error) {
    if (familyId === props.family?.family.id) actionError.value = familySafeMessage(error);
  } finally {
    working.value = false;
  }
}

watch(
  () => [props.open, props.family?.family.id] as const,
  ([open]) => {
    loadNumber += 1;
    if (!open || !props.family) return;
    mode.value = "list";
    detail.value = undefined;
    available.value = [];
    selectedMember.value = undefined;
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
    :description="familyLabel ?? family?.family.name"
    size="large"
    @close="requestClose"
  >
    <section ref="dialogContent" data-testid="family-members-dialog">
      <template v-if="mode === 'list'">
        <div v-if="loading" class="family-member-state" aria-live="polite">
          <div class="large-spinner" aria-hidden="true" />
          <strong>가족 구성원을 불러오는 중입니다</strong>
        </div>
        <div v-else-if="loadError" class="family-member-state is-error" role="alert">
          <strong>가족 구성원을 열지 못했습니다</strong>
          <span>{{ loadError }}</span>
          <AppButton autofocus @click="load">다시 시도</AppButton>
        </div>
        <FamilyMemberList
          v-else-if="detail"
          :detail="detail"
          :available="available"
          @add="beginCreate"
          @edit="beginEdit"
          @remove="beginDelete"
        />
      </template>
      <FamilyMemberForm
        v-else-if="mode === 'form'"
        :key="selectedMember?.membershipId ?? 'add'"
        :member="selectedMember"
        :customers="available"
        :identities="identities"
        :submitting="working"
        :errors="formErrors"
        :submit-error="actionError"
        @cancel="returnToList"
        @submit="save"
      />
      <FamilyMemberDelete
        v-else
        :member="selectedMember"
        :customer-label="selectedMember
          ? identityLabel(identities, selectedMember.customerId, '고객')
          : undefined"
        :deleting="working"
        :error="actionError"
        @cancel="returnToList"
        @confirm="confirmDelete"
      />
    </section>
  </AppDialog>
</template>
