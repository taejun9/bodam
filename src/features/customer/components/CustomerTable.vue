<script setup lang="ts">
import { RouterLink } from "vue-router";

import type { Customer } from "@/features/customer/types/customer";

defineProps<{
  customers: readonly Customer[];
}>();

const emit = defineEmits<{
  edit: [customer: Customer];
  remove: [customer: Customer];
}>();

function textOrDash(value: string | null): string {
  return value?.trim() || "—";
}

function dateOrDash(value: string | null): string {
  return value ? value.replaceAll("-", ". ") : "—";
}
</script>

<template>
  <div class="customer-table-wrap">
    <table class="customer-table">
      <caption class="sr-only">고객 목록</caption>
      <thead>
        <tr>
          <th scope="col">고객</th>
          <th scope="col">연락처</th>
          <th scope="col">생년월일</th>
          <th scope="col">담당 상태</th>
          <th scope="col">관리 여부</th>
          <th scope="col"><span class="sr-only">작업</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="customer in customers" :key="customer.id" data-testid="customer-row">
          <td>
            <RouterLink
              class="customer-name"
              :to="{ name: 'customer-detail', params: { customerId: customer.id } }"
              data-testid="customer-detail-link"
            >
              <span class="customer-avatar" aria-hidden="true">
                {{ customer.name.slice(0, 1) }}
              </span>
              <span>
                <strong>{{ customer.name }}</strong>
                <small>{{ textOrDash(customer.gender) }}</small>
              </span>
            </RouterLink>
          </td>
          <td>{{ textOrDash(customer.phone) }}</td>
          <td class="numeric-cell">{{ dateOrDash(customer.birthDate) }}</td>
          <td>
            <span v-if="customer.status" class="status-chip">{{ customer.status }}</span>
            <span v-else class="muted-value">미입력</span>
          </td>
          <td>
            <span class="managed-state" :class="{ 'is-off': !customer.isManaged }">
              <i aria-hidden="true" />
              {{ customer.isManaged ? "관리 중" : "제외" }}
            </span>
          </td>
          <td>
            <div class="row-actions">
              <RouterLink
                :to="{ name: 'customer-detail', params: { customerId: customer.id } }"
              >
                계약
              </RouterLink>
              <button type="button" @click="emit('edit', customer)">수정</button>
              <button class="danger-action" type="button" @click="emit('remove', customer)">
                제외
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="customer-cards" aria-label="고객 목록">
      <article v-for="customer in customers" :key="customer.id" class="customer-card">
        <header>
          <RouterLink
            class="customer-card-identity"
            :to="{ name: 'customer-detail', params: { customerId: customer.id } }"
          >
            <span class="customer-avatar" aria-hidden="true">
              {{ customer.name.slice(0, 1) }}
            </span>
            <span>
              <strong>{{ customer.name }}</strong>
              <small>{{ textOrDash(customer.phone) }}</small>
            </span>
          </RouterLink>
          <span class="managed-state" :class="{ 'is-off': !customer.isManaged }">
            <i aria-hidden="true" />
            {{ customer.isManaged ? "관리 중" : "제외" }}
          </span>
        </header>
        <dl>
          <div>
            <dt>생년월일</dt>
            <dd>{{ dateOrDash(customer.birthDate) }}</dd>
          </div>
          <div>
            <dt>담당 상태</dt>
            <dd>{{ textOrDash(customer.status) }}</dd>
          </div>
        </dl>
        <footer>
          <RouterLink
            :to="{ name: 'customer-detail', params: { customerId: customer.id } }"
          >
            계약 보기
          </RouterLink>
          <button type="button" @click="emit('edit', customer)">수정</button>
          <button class="danger-action" type="button" @click="emit('remove', customer)">
            목록에서 제외
          </button>
        </footer>
      </article>
    </div>
  </div>
</template>
