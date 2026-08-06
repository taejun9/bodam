<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "primary" | "secondary" | "ghost" | "danger";
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    loading?: boolean;
  }>(),
  {
    variant: "secondary",
    type: "button",
    disabled: false,
    loading: false,
  },
);
</script>

<template>
  <button
    class="app-button"
    :class="`is-${variant}`"
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading"
  >
    <span v-if="loading" class="button-spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
.app-button {
  display: inline-flex;
  min-height: 38px;
  padding: 0 15px;
  color: var(--text-main);
  background: var(--bg-surface);
  border: 1px solid var(--border-strong);
  border-radius: 7px;
  box-shadow: var(--shadow-sm);
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.app-button:hover:not(:disabled) {
  background: var(--bg-muted);
}

.app-button:active:not(:disabled) {
  transform: translateY(1px);
}

.app-button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.is-primary {
  color: #fff;
  background: var(--brand-600);
  border-color: var(--brand-600);
}

.is-primary:hover:not(:disabled) {
  background: var(--brand-700);
  border-color: var(--brand-700);
}

.is-ghost {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}

.is-danger {
  color: #fff;
  background: var(--danger);
  border-color: var(--danger);
}

.is-danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--danger) 85%, #000);
}

.button-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: button-spin 700ms linear infinite;
}

@keyframes button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
