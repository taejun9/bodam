<script setup lang="ts">
import { computed } from "vue";

import {
  familyIdentities,
  identityHint,
  identityLabel,
} from "@/features/family/components/family-identity";
import type { FamilySummary } from "@/features/family/types/family";

const props = defineProps<{ families: readonly FamilySummary[] }>();
const emit = defineEmits<{
  manage: [family: FamilySummary];
  edit: [family: FamilySummary];
  remove: [family: FamilySummary];
}>();

const moneyFormatter = new Intl.NumberFormat("ko-KR");
const identities = computed(() => familyIdentities(props.families));

function label(summary: FamilySummary): string {
  return identityLabel(identities.value, summary.family.id, "가족");
}

function hint(summary: FamilySummary): string | undefined {
  return identityHint(identities.value, summary.family.id, "가족");
}
</script>

<template>
  <div class="family-table-wrap">
    <table class="family-table">
      <caption class="sr-only">가족 목록과 월보험료 합계</caption>
      <thead>
        <tr>
          <th scope="col">가족</th>
          <th scope="col">활성 구성원</th>
          <th scope="col">월보험료 합계</th>
          <th scope="col"><span class="sr-only">작업</span></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="summary in families"
          :key="summary.family.id"
          data-testid="family-row"
          :data-family-id="summary.family.id"
        >
          <td>
            <span class="family-identity">
              <strong>{{ summary.family.name }}</strong>
              <small v-if="hint(summary)" class="identity-hint">{{ hint(summary) }}</small>
            </span>
          </td>
          <td class="family-count">{{ summary.memberCount }}명</td>
          <td class="family-money">
            {{ moneyFormatter.format(summary.totalMonthlyPremiumWon) }}원
          </td>
          <td>
            <div class="family-actions">
              <button
                type="button"
                data-testid="manage-family-members"
                :data-family-id="summary.family.id"
                :aria-label="`${label(summary)} 구성원 관리`"
                @click="emit('manage', summary)"
              >구성원 관리</button>
              <button
                type="button"
                data-testid="edit-family"
                :data-family-id="summary.family.id"
                :aria-label="`${label(summary)} 이름 수정`"
                @click="emit('edit', summary)"
              >수정</button>
              <button
                class="danger-action"
                type="button"
                data-testid="delete-family"
                :data-family-id="summary.family.id"
                :aria-label="`${label(summary)} 삭제`"
                @click="emit('remove', summary)"
              >삭제</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="family-cards" aria-label="가족 목록과 월보험료 합계">
      <article
        v-for="summary in families"
        :key="summary.family.id"
        class="family-card"
        data-testid="family-card"
        :data-family-id="summary.family.id"
      >
        <header>
          <span class="family-card-identity">
            <strong>{{ summary.family.name }}</strong>
            <small v-if="hint(summary)" class="identity-hint">{{ hint(summary) }}</small>
          </span>
          <span class="family-card-count">활성 구성원 {{ summary.memberCount }}명</span>
        </header>
        <p class="family-card-money">
          {{ moneyFormatter.format(summary.totalMonthlyPremiumWon) }}원
          <small>/ 월</small>
        </p>
        <footer>
          <button
            type="button"
            data-testid="manage-family-members"
            :data-family-id="summary.family.id"
            :aria-label="`${label(summary)} 구성원 관리`"
            @click="emit('manage', summary)"
          >구성원 관리</button>
          <button
            type="button"
            data-testid="edit-family"
            :data-family-id="summary.family.id"
            :aria-label="`${label(summary)} 이름 수정`"
            @click="emit('edit', summary)"
          >수정</button>
          <button
            class="danger-action"
            type="button"
            data-testid="delete-family"
            :data-family-id="summary.family.id"
            :aria-label="`${label(summary)} 삭제`"
            @click="emit('remove', summary)"
          >삭제</button>
        </footer>
      </article>
    </div>
  </div>
</template>
