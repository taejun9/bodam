<script setup lang="ts">
import { ref } from "vue";

import AppButton from "@/shared/components/AppButton.vue";
import {
  backupLocationLabel,
  backupReasonLabel,
  backupTimestampLabel,
} from "./backup-display";
import RestoreConfirmDialog from "./RestoreConfirmDialog.vue";
import { useBackupRestoreSection } from "./use-backup-restore-section";

const root = ref<HTMLElement>();
const state = useBackupRestoreSection(root);
</script>

<template>
  <section
    ref="root"
    class="backup-section surface"
    aria-labelledby="backup-section-title"
    :aria-busy="state.loading.value || state.busy.value !== null"
  >
    <header class="backup-section-header">
      <div>
        <span>Local recovery</span>
        <h3 id="backup-section-title">백업과 복원</h3>
        <p>이 PC의 SQLite 전체 snapshot을 검증해 보관하고 선택한 시점으로 복원합니다.</p>
      </div>
    </header>

    <aside class="backup-privacy-note">
      백업은 암호화되지 않은 평문이며 고객·계약·상담·일정과 삭제된 원본까지 포함합니다.
      같은 디스크의 백업은 기기 손상·분실에 대한 별도 복구 수단이 아닙니다.
    </aside>

    <p
      v-if="!state.nativeAvailable"
      id="backup-browser-note"
      class="backup-native-note"
    >백업 폴더 선택, 파일 생성과 복원은 설치된 데스크톱 앱에서만 사용할 수 있습니다.</p>

    <div v-if="state.loading.value" class="backup-state" role="status">
      백업 상태를 확인하는 중입니다.
    </div>
    <div
      v-else-if="state.error.value"
      class="backup-state is-error"
      data-testid="backup-error"
      role="alert"
      tabindex="-1"
    >
      <strong>백업 작업을 완료하지 못했습니다</strong>
      <span>{{ state.error.value }}</span>
      <button type="button" @click="state.load(true)">다시 확인</button>
    </div>

    <template v-if="state.status.value">
      <dl class="backup-summary" data-testid="backup-status" tabindex="-1">
        <div>
          <dt>저장 위치</dt>
          <dd>{{ backupLocationLabel(state.status.value.location) }}</dd>
        </div>
        <div>
          <dt>마지막 성공</dt>
          <dd>{{ backupTimestampLabel(state.status.value.lastSuccessfulAt) }}</dd>
        </div>
        <div>
          <dt>자동 백업</dt>
          <dd>{{ state.status.value.automaticCount }} / {{ state.status.value.maxAutomaticCount }}</dd>
        </div>
        <div>
          <dt>위치 상태</dt>
          <dd>{{ state.status.value.location.available ? "사용 가능" : "확인 필요" }}</dd>
        </div>
      </dl>

      <p v-if="state.status.value.lastFailure" class="backup-inline-warning" role="status">
        {{ state.status.value.lastFailure }}
      </p>
      <p
        v-if="state.status.value.restoreStartup"
        class="backup-restore-status"
        :class="{ 'is-warning': state.status.value.restoreStartup.outcome === 'rolled_back' }"
        role="status"
      >{{ state.status.value.restoreStartup.message }}</p>

      <div class="backup-actions">
        <AppButton
          data-testid="choose-backup-directory"
          :disabled="!state.nativeAvailable || state.busy.value !== null"
          :loading="state.busy.value === 'directory'"
          :aria-describedby="!state.nativeAvailable ? 'backup-browser-note' : undefined"
          @click="state.chooseDirectory"
        >백업 폴더 변경</AppButton>
        <AppButton
          :disabled="!state.nativeAvailable || state.status.value.location.kind === 'default' || state.busy.value !== null"
          :loading="state.busy.value === 'default'"
          @click="state.useDefault"
        >기본 위치 사용</AppButton>
        <AppButton
          variant="primary"
          :disabled="!state.nativeAvailable || !state.status.value.location.available || state.busy.value !== null"
          :loading="state.busy.value === 'manual'"
          @click="state.createManual"
        >지금 백업</AppButton>
        <AppButton
          data-testid="choose-restore"
          variant="danger"
          :disabled="!state.nativeAvailable || state.busy.value !== null"
          :loading="state.busy.value === 'restore-file'"
          :aria-describedby="!state.nativeAvailable ? 'backup-browser-note' : undefined"
          @click="state.chooseRestore"
        >백업에서 복원</AppButton>
      </div>
    </template>

    <p v-if="state.cancelled.value" class="backup-cancelled" role="status">
      선택을 취소했습니다. 파일과 설정은 변경되지 않았습니다.
    </p>
    <p v-if="state.notice.value" class="backup-cancelled" role="status">
      {{ state.notice.value }}
    </p>
    <section
      v-if="state.result.value"
      class="backup-result"
      data-testid="backup-result"
      role="status"
      tabindex="-1"
    >
      <strong>검증된 백업을 만들었습니다</strong>
      <span>{{ state.result.value.basename }}</span>
      <small>
        {{ backupReasonLabel(state.result.value.reason) }} ·
        {{ backupTimestampLabel(state.result.value.createdAt) }}
      </small>
      <em v-if="state.result.value.retentionWarning">
        새 백업은 안전하지만 이전 자동 백업 일부를 정리하지 못했습니다.
      </em>
    </section>

    <RestoreConfirmDialog
      :open="state.preview.value !== undefined"
      :preview="state.preview.value"
      :restoring="state.busy.value === 'restore'"
      :discarding="state.busy.value === 'restore-discard'"
      :error="state.restoreError.value"
      @close="state.closeRestore"
      @confirm="state.confirmRestore"
    />
  </section>
</template>

<style src="./backup-restore-section.css"></style>
