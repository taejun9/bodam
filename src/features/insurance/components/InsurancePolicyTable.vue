<script setup lang="ts">
import type { InsurancePolicy } from "@/features/insurance/types/insurance-policy";

defineProps<{
  policies: readonly InsurancePolicy[];
}>();

const emit = defineEmits<{
  edit: [policy: InsurancePolicy];
  remove: [policy: InsurancePolicy];
}>();

const moneyFormatter = new Intl.NumberFormat("ko-KR");

function formatKrw(value: bigint): string {
  return `${moneyFormatter.format(value)}원`;
}

function textOrDash(value: string | null): string {
  return value ?? "—";
}

function dateOrDash(value: string | null): string {
  return value ? value.replaceAll("-", ". ") : "—";
}
</script>

<template>
  <div class="policy-table-wrap">
    <table class="policy-table">
      <caption class="sr-only">고객 보험계약 목록</caption>
      <thead>
        <tr>
          <th scope="col">보험사 · 상품</th>
          <th scope="col">월보험료</th>
          <th scope="col">가입 · 만기</th>
          <th scope="col">납입기간</th>
          <th scope="col">상태</th>
          <th scope="col">합계</th>
          <th scope="col"><span class="sr-only">작업</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="policy in policies" :key="policy.id" data-testid="policy-row">
          <td>
            <span class="policy-product">
              <strong>{{ policy.productName }}</strong>
              <small>{{ policy.insurer }}</small>
            </span>
          </td>
          <td class="policy-money">{{ formatKrw(policy.monthlyPremiumWon) }}</td>
          <td class="policy-dates">
            <span>{{ dateOrDash(policy.joinedOn) }}</span>
            <small>{{ dateOrDash(policy.maturesOn) }}</small>
          </td>
          <td>{{ textOrDash(policy.paymentTerm) }}</td>
          <td>
            <span v-if="policy.status" class="status-chip">{{ policy.status }}</span>
            <span v-else class="muted-value">미입력</span>
          </td>
          <td>
            <span class="included-state" :class="{ 'is-off': !policy.isIncluded }">
              <i aria-hidden="true" />
              {{ policy.isIncluded ? "포함" : "제외" }}
            </span>
          </td>
          <td>
            <div class="policy-actions">
              <button type="button" @click="emit('edit', policy)">수정</button>
              <button class="danger-action" type="button" @click="emit('remove', policy)">
                삭제
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="policy-cards" aria-label="고객 보험계약 목록">
      <article v-for="policy in policies" :key="policy.id" class="policy-card" data-testid="policy-card">
        <header>
          <span>
            <small>{{ policy.insurer }}</small>
            <strong>{{ policy.productName }}</strong>
          </span>
          <span class="included-state" :class="{ 'is-off': !policy.isIncluded }">
            <i aria-hidden="true" />
            {{ policy.isIncluded ? "합계 포함" : "합계 제외" }}
          </span>
        </header>
        <p class="policy-card-money">{{ formatKrw(policy.monthlyPremiumWon) }} <small>/ 월</small></p>
        <dl>
          <div>
            <dt>가입일</dt>
            <dd>{{ dateOrDash(policy.joinedOn) }}</dd>
          </div>
          <div>
            <dt>만기일</dt>
            <dd>{{ dateOrDash(policy.maturesOn) }}</dd>
          </div>
          <div>
            <dt>보험기간</dt>
            <dd>{{ textOrDash(policy.coverageTerm) }}</dd>
          </div>
          <div>
            <dt>납입기간</dt>
            <dd>{{ textOrDash(policy.paymentTerm) }}</dd>
          </div>
        </dl>
        <p class="policy-card-meta">
          {{ textOrDash(policy.status) }} · {{ policy.renewable ? "갱신형" : "비갱신형" }}
        </p>
        <footer>
          <button type="button" @click="emit('edit', policy)">수정</button>
          <button class="danger-action" type="button" @click="emit('remove', policy)">
            삭제
          </button>
        </footer>
      </article>
    </div>
  </div>
</template>
