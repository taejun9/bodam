<script setup lang="ts">
import { RouterLink } from "vue-router";

import { dateOnlyLabel } from "@/features/dashboard/components/dashboard-display";
import type {
  InsuranceAgeItem,
  MaturityItem,
} from "@/features/dashboard/types/dashboard";

const props = defineProps<{ item: InsuranceAgeItem | MaturityItem }>();

function isMaturity(item: InsuranceAgeItem | MaturityItem): item is MaturityItem {
  return "policyId" in item;
}

function itemId(item: InsuranceAgeItem | MaturityItem): string {
  return isMaturity(item) ? item.policyId : item.customerId;
}
</script>

<template>
  <li
    data-testid="dashboard-item"
    :data-item-id="itemId(props.item)"
    :data-customer-id="props.item.customerId"
    :data-policy-id="isMaturity(props.item) ? props.item.policyId : undefined"
    :data-insurance-age="isMaturity(props.item) ? undefined : props.item.insuranceAgeYears"
    :data-bucket="props.item.bucket"
  >
    <RouterLink class="dashboard-item-link" :to="`/customers/${props.item.customerId}`">
      <span class="dashboard-item-main">
        <span class="dashboard-item-identity">
          <strong>{{ props.item.customerName }}</strong>
          <small v-if="isMaturity(props.item)">
            {{ props.item.insurer }} · {{ props.item.productName }}
          </small>
          <small v-else>보험 나이 {{ props.item.insuranceAgeYears }}세</small>
        </span>
        <strong class="dashboard-item-value">
          <time :datetime="props.item.eventOn">{{ dateOnlyLabel(props.item.eventOn) }}</time>
        </strong>
      </span>
      <span class="dashboard-item-meta">
        <span>{{ props.item.bucket }}일 구간</span>
      </span>
      <span
        class="dashboard-reason"
        data-testid="dashboard-reason"
        :data-reason="props.item.reason"
      >{{ props.item.reason }}</span>
    </RouterLink>
  </li>
</template>
