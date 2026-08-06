<script setup lang="ts">
import type { ImportSourceValues, ImportUiIssue } from "./data-exchange-ui";
import { IMPORT_SOURCE_FIELDS } from "./data-exchange-ui";

defineProps<{
  source: ImportSourceValues;
  issues: readonly ImportUiIssue[];
}>();

function issueFor(field: string, issues: readonly ImportUiIssue[]): string | undefined {
  return issues.find((issue) => issue.field === field)?.message;
}
</script>

<template>
  <div class="source-detail">
    <p>
      이 원본 값은 가져오기 전 확인을 위해서만 표시됩니다. 빈 셀은 null로 보존됩니다.
    </p>
    <dl>
      <div
        v-for="[key, label] in IMPORT_SOURCE_FIELDS"
        :key="key"
        :class="{ 'has-error': issueFor(key, issues) }"
      >
        <dt>{{ label }}</dt>
        <dd :class="{ 'is-empty': source[key] === null }">
          {{ source[key] ?? "비어 있음" }}
        </dd>
        <small v-if="issueFor(key, issues)">{{ issueFor(key, issues) }}</small>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.source-detail {
  padding: 14px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.source-detail > p {
  margin: 0 0 11px;
  color: var(--text-secondary);
  font-size: 9px;
}

.source-detail dl {
  display: grid;
  margin: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.source-detail dl > div {
  display: grid;
  min-width: 0;
  padding: 8px 9px;
  background: var(--bg-surface);
  border: 1px solid transparent;
  border-radius: 6px;
  gap: 2px;
}

.source-detail dl > div.has-error {
  border-color: color-mix(in srgb, var(--danger) 45%, transparent);
}

.source-detail dt {
  color: var(--text-secondary);
  font-size: 8px;
  font-weight: 700;
}

.source-detail dd {
  min-width: 0;
  margin: 0;
  color: var(--text-main);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  font-size: 10px;
}

.source-detail dd.is-empty {
  color: var(--text-secondary);
  font-style: italic;
}

.source-detail small {
  margin-top: 3px;
  color: var(--danger);
  font-size: 8px;
}

@media (max-width: 720px) {
  .source-detail dl {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 420px) {
  .source-detail dl {
    grid-template-columns: 1fr;
  }
}
</style>
