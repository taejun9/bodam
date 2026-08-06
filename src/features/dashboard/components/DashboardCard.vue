<script setup lang="ts">
defineProps<{
  metric: string;
  title: string;
  description: string;
  totalCount: number;
  visibleCount: number;
  isTruncated: boolean;
  emptyText: string;
}>();
</script>

<template>
  <section
    class="dashboard-card surface"
    data-testid="dashboard-card"
    :data-dashboard-metric="metric"
    :data-total-count="totalCount"
    :aria-labelledby="`dashboard-card-${metric}-title`"
  >
    <header class="dashboard-card-header">
      <div class="dashboard-card-heading">
        <h3 :id="`dashboard-card-${metric}-title`">{{ title }}</h3>
        <p>{{ description }}</p>
      </div>
      <span
        class="dashboard-card-count"
        data-testid="dashboard-card-count"
        :data-total-count="totalCount"
        :aria-label="`전체 ${totalCount}건`"
      >
        {{ totalCount }}건
      </span>
    </header>

    <p v-if="visibleCount === 0" class="dashboard-card-empty">
      {{ emptyText }}
    </p>
    <ul v-else class="dashboard-card-list">
      <slot />
    </ul>

    <footer v-if="isTruncated" class="dashboard-card-footer">
      전체 {{ totalCount }}건 중 앞선 {{ visibleCount }}건을 표시합니다.
    </footer>
  </section>
</template>
