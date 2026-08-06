<script setup lang="ts">
import type { ImportUiResult } from "./data-exchange-ui";
import AppButton from "@/shared/components/AppButton.vue";

defineProps<{
  result: ImportUiResult;
}>();

const emit = defineEmits<{
  reset: [];
}>();
</script>

<template>
  <section
    class="import-result"
    data-testid="import-result"
    aria-labelledby="import-result-title"
    tabindex="-1"
  >
    <span class="result-symbol" aria-hidden="true">✓</span>
    <div class="result-copy">
      <h3 id="import-result-title">계약 가져오기를 마쳤습니다</h3>
      <p>선택한 행은 한 번에 반영됐으며 원본 파일은 변경되지 않았습니다.</p>
    </div>
    <dl>
      <div><dt>생성</dt><dd data-result-count="created">{{ result.createdCount }}</dd></div>
      <div><dt>갱신</dt><dd data-result-count="updated">{{ result.updatedCount }}</dd></div>
      <div><dt>건너뜀</dt><dd data-result-count="skipped">{{ result.skippedCount }}</dd></div>
      <div><dt>선택 제외</dt><dd data-result-count="unselected">{{ result.unselectedCount }}</dd></div>
      <div><dt>오류 행</dt><dd data-result-count="invalid">{{ result.invalidCount }}</dd></div>
    </dl>
    <AppButton variant="primary" data-testid="import-another-file" @click="emit('reset')">
      다른 파일 가져오기
    </AppButton>
  </section>
</template>

<style scoped>
.import-result {
  display: grid;
  min-width: 0;
  padding: 24px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 11px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
}

.import-result:focus {
  outline: 3px solid color-mix(in srgb, var(--focus) 30%, transparent);
}

.result-symbol {
  display: grid;
  width: 42px;
  height: 42px;
  color: var(--success);
  background: var(--success-bg);
  border-radius: 50%;
  font-size: 20px;
  font-weight: 800;
  place-items: center;
}

.result-copy h3 {
  margin: 0;
  font-size: 16px;
}

.result-copy p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 10px;
}

.import-result dl {
  display: grid;
  margin: 0;
  grid-template-columns: repeat(5, auto);
  gap: 6px;
}

.import-result dl > div {
  display: grid;
  min-width: 54px;
  padding: 7px;
  background: var(--bg-subtle);
  border-radius: 6px;
  text-align: center;
}

.import-result dt {
  color: var(--text-secondary);
  font-size: 8px;
}

.import-result dd {
  margin: 1px 0 0;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 750;
}

@media (max-width: 840px) {
  .import-result {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .import-result dl,
  .import-result :deep(.app-button) {
    grid-column: 1 / -1;
  }

  .import-result dl {
    grid-template-columns: repeat(5, 1fr);
  }
}

@media (max-width: 440px) {
  .import-result {
    padding: 17px;
  }

  .import-result dl {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
