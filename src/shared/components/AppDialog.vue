<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from "vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description?: string | undefined;
    size?: "small" | "medium" | "large";
    closeLabel?: string;
    dismissDisabled?: boolean;
    busy?: boolean;
  }>(),
  {
    description: undefined,
    size: "medium",
    closeLabel: "닫기",
    dismissDisabled: false,
    busy: false,
  },
);

const emit = defineEmits<{
  close: [];
}>();

const dialog = ref<HTMLDialogElement>();
const titleId = useId();
const descriptionId = useId();
let previouslyFocused: HTMLElement | null = null;

async function openDialog() {
  previouslyFocused = document.activeElement as HTMLElement | null;
  await nextTick();
  if (!dialog.value?.open) dialog.value?.showModal();
  await nextTick();
  dialog.value?.querySelector<HTMLElement>("[autofocus]")?.focus();
}

function closeDialog() {
  if (dialog.value?.open) dialog.value.close();
  previouslyFocused?.focus();
  previouslyFocused = null;
}

function requestClose() {
  if (props.dismissDisabled) return;
  emit("close");
}

function handleBackdrop(event: MouseEvent) {
  if (event.target !== dialog.value || !dialog.value) return;
  const rect = dialog.value.getBoundingClientRect();
  const inside =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom;
  if (!inside) requestClose();
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) void openDialog();
    else closeDialog();
  },
  { immediate: true },
);

onBeforeUnmount(closeDialog);
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="app-dialog"
      :class="`is-${size}`"
      :aria-labelledby="titleId"
      :aria-describedby="description ? descriptionId : undefined"
      :aria-busy="busy ? 'true' : undefined"
      @cancel.prevent="requestClose"
      @click="handleBackdrop"
      @keydown.esc.stop.prevent="requestClose"
    >
      <section class="dialog-panel">
        <header class="dialog-header">
          <div>
            <h2 :id="titleId">{{ title }}</h2>
            <p v-if="description" :id="descriptionId">{{ description }}</p>
          </div>
          <button
            class="dialog-close"
            type="button"
            :aria-label="closeLabel"
            :disabled="dismissDisabled"
            @click="requestClose"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div class="dialog-body">
          <slot />
        </div>
      </section>
    </dialog>
  </Teleport>
</template>

<style scoped>
.app-dialog {
  width: min(calc(100vw - 32px), 560px);
  max-height: min(88vh, 760px);
  padding: 0;
  color: var(--text-main);
  background: transparent;
  border: 0;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-dialog);
  overflow: hidden;
}

.app-dialog.is-small {
  width: min(calc(100vw - 32px), 430px);
}

.app-dialog.is-large {
  width: min(calc(100vw - 32px), 720px);
}

.app-dialog::backdrop {
  background: rgb(3 10 18 / 55%);
  backdrop-filter: blur(2px);
}

.dialog-panel {
  max-height: inherit;
  background: var(--bg-surface);
  overflow: auto;
}

.dialog-header {
  position: sticky;
  z-index: 2;
  top: 0;
  display: flex;
  padding: 22px 24px 17px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.dialog-header h2 {
  margin: 0;
  font-size: 18px;
  letter-spacing: -0.02em;
}

.dialog-header p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 12px;
}

.dialog-close {
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  color: var(--text-muted);
  background: transparent;
  border-radius: 7px;
  cursor: pointer;
  place-items: center;
  font-size: 24px;
  line-height: 1;
}

.dialog-close:hover {
  color: var(--text-main);
  background: var(--bg-muted);
}

.dialog-close:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.dialog-body {
  padding: 22px 24px 24px;
}

@media (max-width: 560px) {
  .app-dialog,
  .app-dialog.is-small,
  .app-dialog.is-large {
    width: 100vw;
    max-width: none;
    max-height: calc(100vh - 16px);
    margin: auto 0 0;
    border-radius: 16px 16px 0 0;
  }

  .dialog-header,
  .dialog-body {
    padding-inline: 18px;
  }
}
</style>
