<script setup lang="ts">
import AppShell from "@/app/shell/AppShell.vue";
import BackupLifecycleGuard from "@/app/lifecycle/BackupLifecycleGuard.vue";
</script>

<template>
  <AppShell />
  <BackupLifecycleGuard />
</template>
