<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";

import { dateOnlyLabel } from "@/features/dashboard/components/dashboard-display";
import type {
  RecentConsultationItem,
  TodayContactItem,
  UnconsultedItem,
} from "@/features/dashboard/types/dashboard";

type ContactItem = TodayContactItem | RecentConsultationItem | UnconsultedItem;

const props = defineProps<{ item: ContactItem }>();

const display = computed(() => {
  const item = props.item;
  if ("nextContactOn" in item) {
    return {
      itemId: item.customerId,
      consultationId: item.consultationId,
      dateTime: item.nextContactOn,
      dateLabel: dateOnlyLabel(item.nextContactOn),
      emptyLabel: undefined,
    };
  }
  if ("consultedOn" in item) {
    return {
      itemId: item.consultationId,
      consultationId: item.consultationId,
      dateTime: item.consultedAt,
      dateLabel: dateOnlyLabel(item.consultedOn),
      emptyLabel: undefined,
    };
  }
  return {
    itemId: item.customerId,
    consultationId: item.latestConsultationId ?? undefined,
    dateTime: item.latestConsultedAt ?? undefined,
    dateLabel: item.latestConsultedOn ? dateOnlyLabel(item.latestConsultedOn) : undefined,
    emptyLabel: item.latestConsultedOn ? undefined : "상담 기록 없음",
  };
});
</script>

<template>
  <li
    data-testid="dashboard-item"
    :data-item-id="display.itemId"
    :data-customer-id="props.item.customerId"
    :data-consultation-id="display.consultationId"
  >
    <RouterLink class="dashboard-item-link" :to="`/customers/${props.item.customerId}`">
      <span class="dashboard-item-main">
        <span class="dashboard-item-identity">
          <strong>{{ props.item.customerName }}</strong>
        </span>
        <strong class="dashboard-item-value">
          <time v-if="display.dateTime" :datetime="display.dateTime">
            {{ display.dateLabel }}
          </time>
          <span v-else>{{ display.emptyLabel }}</span>
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
