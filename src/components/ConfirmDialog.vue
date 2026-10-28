<script setup lang="ts">
/**
 * Подтверждение необратимых действий (сброс, удаление, замена при импорте).
 * Нативный <dialog>: фокус удерживается браузером, Esc закрывает
 * как «Отмена». По умолчанию фокус на безопасной кнопке.
 */
import { nextTick, ref, useId, watch } from 'vue'
import AppButton from './AppButton.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
  }>(),
  { confirmLabel: 'Подтвердить', cancelLabel: 'Отмена', danger: false },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const cancelWrap = ref<HTMLElement | null>(null)
const uid = useId()

watch(
  () => props.open,
  async (open) => {
    const el = dialog.value
    if (!el) return
    if (open && !el.open) {
      el.showModal()
      await nextTick()
      cancelWrap.value?.querySelector('button')?.focus()
    } else if (!open && el.open) {
      el.close()
    }
  },
  { flush: 'post' },
)

/** Закрытие крестиком браузера или Esc — это отмена. */
function onClose() {
  if (props.open) emit('cancel')
}
</script>

<template>
  <dialog ref="dialog" class="dialog" :aria-labelledby="`${uid}-title`" @close="onClose">
    <h2 :id="`${uid}-title`" class="dialog__title">{{ title }}</h2>
    <div class="dialog__body">
      <slot />
    </div>
    <div class="dialog__actions">
      <span ref="cancelWrap">
        <AppButton variant="secondary" @click="emit('cancel')">{{ cancelLabel }}</AppButton>
      </span>
      <AppButton :variant="danger ? 'danger' : 'primary'" @click="emit('confirm')">{{ confirmLabel }}</AppButton>
    </div>
  </dialog>
</template>

<style scoped>
.dialog {
  width: min(100% - 2rem, 32rem);
  padding: clamp(1.25rem, 4vw, 2rem);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-m);
  background: var(--paper-raised);
  color: var(--ink);
  box-shadow: var(--shadow);
}
.dialog::backdrop {
  background: rgb(10 8 6 / 0.55);
}
.dialog__title {
  font-size: 1.6rem;
}
.dialog__body {
  margin: 0.9rem 0 1.5rem;
  color: var(--ink-soft);
}
.dialog__body :deep(p + p) {
  margin-top: 0.6rem;
}
.dialog__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
