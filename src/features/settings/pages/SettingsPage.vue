<script setup lang="ts">
import CoverageBenchmarkSection from "@/features/coverage-benchmark/components/CoverageBenchmarkSection.vue";
</script>

<template>
  <section class="settings-page" aria-labelledby="settings-page-title">
    <header class="settings-page-header">
      <div>
        <span>Workspace settings</span>
        <h2 id="settings-page-title">업무 기준 설정</h2>
        <p>이 PC에서 고객 보장을 비교할 기준을 직접 관리합니다.</p>
      </div>
    </header>

    <CoverageBenchmarkSection />
  </section>
</template>
