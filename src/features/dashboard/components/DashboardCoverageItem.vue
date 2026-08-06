<script setup lang="ts">
import { RouterLink } from "vue-router";

import {
  bigintDataValue,
  moneyLabel,
} from "@/features/dashboard/components/dashboard-display";
import type { CoverageInsufficientItem } from "@/features/dashboard/types/dashboard";

const props = defineProps<{ item: CoverageInsufficientItem }>();
</script>

<template>
  <li
    data-testid="dashboard-item"
    :data-item-id="props.item.customerId"
    :data-customer-id="props.item.customerId"
    :data-category-ids="props.item.categories.map((category) => category.categoryId).join(',')"
  >
    <RouterLink class="dashboard-item-link" :to="`/customers/${props.item.customerId}`">
      <span class="dashboard-item-main">
        <span class="dashboard-item-identity">
          <strong>{{ props.item.customerName }}</strong>
        </span>
        <strong class="dashboard-item-value">
          부족 {{ props.item.insufficientCategoryCount }}개
        </strong>
      </span>
      <ul class="dashboard-coverage-categories" aria-label="부족 보장 항목">
        <li
          v-for="category in props.item.categories"
          :key="category.categoryId"
          :data-category-id="category.categoryId"
          :data-amount-won="bigintDataValue(category.amountWon)"
          :data-adequate-min-won="bigintDataValue(category.adequateMinWon)"
          :data-shortfall-won="bigintDataValue(category.shortfallWon)"
        >
          {{ category.categoryName }} · 현재 {{ moneyLabel(category.amountWon) }} ·
          기준까지 {{ moneyLabel(category.shortfallWon) }} 부족
        </li>
      </ul>
      <span
        class="dashboard-reason"
        data-testid="dashboard-reason"
        :data-reason="props.item.reason"
      >{{ props.item.reason }}</span>
    </RouterLink>
  </li>
</template>
