<script setup lang="ts">
import { RouterLink } from "vue-router";

import {
  bigintDataValue,
  moneyLabel,
} from "@/features/dashboard/components/dashboard-display";
import type {
  FamilyPremiumItem,
  PremiumTopItem,
} from "@/features/dashboard/types/dashboard";

const props = defineProps<{ item: FamilyPremiumItem | PremiumTopItem }>();

function isFamily(item: FamilyPremiumItem | PremiumTopItem): item is FamilyPremiumItem {
  return "familyId" in item;
}
</script>

<template>
  <li
    data-testid="dashboard-item"
    :data-item-id="isFamily(props.item) ? props.item.familyId : props.item.customerId"
    :data-family-id="isFamily(props.item) ? props.item.familyId : undefined"
    :data-customer-id="isFamily(props.item) ? undefined : props.item.customerId"
    :data-amount-won="bigintDataValue(props.item.amountWon)"
  >
    <RouterLink
      class="dashboard-item-link"
      :to="isFamily(props.item) ? '/families' : `/customers/${props.item.customerId}`"
    >
      <span class="dashboard-item-main">
        <span class="dashboard-item-identity">
          <strong>
            {{ isFamily(props.item) ? props.item.familyName : props.item.customerName }}
          </strong>
          <small v-if="isFamily(props.item)">활성 구성원 {{ props.item.memberCount }}명</small>
        </span>
        <strong class="dashboard-item-value is-money">
          {{ moneyLabel(props.item.amountWon) }}
        </strong>
      </span>
      <span
        class="dashboard-reason"
        data-testid="dashboard-reason"
        :data-reason="props.item.reason"
      >{{ props.item.reason }}</span>
    </RouterLink>
  </li>
</template>
