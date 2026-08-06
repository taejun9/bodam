<script setup lang="ts">
import AppButton from "@/shared/components/AppButton.vue";
import AppIcon from "@/shared/components/AppIcon.vue";

defineProps<{
  monthLabel: string;
  timeZone: string;
  refreshing: boolean;
  canMovePrevious: boolean;
  canMoveNext: boolean;
}>();

const emit = defineEmits<{
  previous: [];
  next: [];
  today: [];
  create: [];
}>();
</script>

<template>
  <header class="calendar-toolbar surface">
    <div class="calendar-month-navigation">
      <button
        type="button"
        aria-label="이전 달"
        :disabled="!canMovePrevious"
        @click="emit('previous')"
      >
        <AppIcon name="chevron-left" :size="18" />
      </button>
      <button
        type="button"
        aria-label="다음 달"
        :disabled="!canMoveNext"
        @click="emit('next')"
      >
        <AppIcon class="is-next" name="chevron-left" :size="18" />
      </button>
      <AppButton data-testid="calendar-today" @click="emit('today')">오늘</AppButton>
    </div>
    <div class="calendar-month-title">
      <h2 data-testid="calendar-month-label">{{ monthLabel }}</h2>
      <span>{{ timeZone }}</span>
    </div>
    <div class="calendar-toolbar-action">
      <span v-if="refreshing" class="refresh-state" role="status">
        최신 정보 확인 중
      </span>
      <AppButton variant="primary" data-testid="create-schedule" @click="emit('create')">
        <span aria-hidden="true">+</span>
        일정 등록
      </AppButton>
    </div>
  </header>
</template>
