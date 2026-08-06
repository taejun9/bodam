<script setup lang="ts">
import BackupRestoreSection from "@/features/backup/components/BackupRestoreSection.vue";
import CoverageBenchmarkSection from "@/features/coverage-benchmark/components/CoverageBenchmarkSection.vue";
import AppSettingsSection from "@/features/settings/components/AppSettingsSection.vue";
</script>

<template>
  <section class="settings-page" aria-labelledby="settings-page-title">
    <header class="settings-page-header">
      <div>
        <span>Workspace settings</span>
        <h2 id="settings-page-title">환경과 업무 기준</h2>
        <p>이 PC에서 사용할 화면, 대시보드, 백업과 고객 보장 비교 기준을 관리합니다.</p>
      </div>
    </header>

    <div class="settings-page-content">
      <AppSettingsSection />
      <BackupRestoreSection />
      <CoverageBenchmarkSection />
    </div>
  </section>
</template>

<style scoped>
.settings-page-content {
  display: grid;
  min-width: 0;
  gap: 14px;
}
</style>
