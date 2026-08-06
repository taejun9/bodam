<script setup lang="ts">
import AppButton from "@/shared/components/AppButton.vue";
import AppDialog from "@/shared/components/AppDialog.vue";

const props = defineProps<{
  open: boolean;
  creating: number;
  updating: number;
  skipping: number;
  newCustomers: number;
  committing: boolean;
  blocked?: boolean;
  error?: string | undefined;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();

function requestClose() {
  if (!props.committing) emit("close");
}
</script>

<template>
  <AppDialog
    :open="open"
    title="선택한 계약을 반영할까요?"
    description="확인한 모든 쓰기 행을 하나의 작업으로 처리합니다."
    size="small"
    :dismiss-disabled="committing"
    :busy="committing"
    @close="requestClose"
  >
    <div class="commit-summary">
      <dl>
        <div><dt>새 계약</dt><dd>{{ creating }}</dd></div>
        <div><dt>기존 계약 갱신</dt><dd>{{ updating }}</dd></div>
        <div><dt>건너뛰기</dt><dd>{{ skipping }}</dd></div>
        <div><dt>새 고객</dt><dd>{{ newCustomers }}</dd></div>
      </dl>
      <p>
        어느 한 행이라도 검증 또는 중복 상태가 달라졌다면 전체 반영을 취소하고 새 미리보기를 요청합니다.
      </p>
    </div>

    <p v-if="error" class="commit-error" role="alert">{{ error }}</p>

    <footer class="commit-actions">
      <AppButton :disabled="committing" autofocus @click="requestClose">
        취소
      </AppButton>
      <AppButton
        variant="primary"
        :loading="committing"
        :disabled="blocked"
        data-testid="confirm-import"
        @click="emit('confirm')"
      >
        모두 반영
      </AppButton>
    </footer>
  </AppDialog>
</template>

<style scoped>
.commit-summary {
  display: grid;
  gap: 14px;
}

.commit-summary dl {
  display: grid;
  margin: 0;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}

.commit-summary dl > div {
  display: grid;
  padding: 10px;
  background: var(--bg-subtle);
  border-radius: 7px;
}

.commit-summary dt {
  color: var(--text-secondary);
  font-size: 9px;
}

.commit-summary dd {
  margin: 2px 0 0;
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 750;
}

.commit-summary p,
.commit-error {
  margin: 0;
  padding: 10px 11px;
  border-radius: 7px;
  font-size: 10px;
  line-height: 1.55;
}

.commit-summary p {
  color: var(--text-secondary);
  background: var(--warning-bg);
}

.commit-error {
  margin-top: 14px;
  color: var(--danger);
  background: var(--danger-bg);
}

.commit-actions {
  display: flex;
  margin-top: 20px;
  justify-content: flex-end;
  gap: 8px;
}
</style>
