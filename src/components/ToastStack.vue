<script setup lang="ts">
/**
 * Уведомления: ачивки, новый ранг, ошибки. Исчезают сами, но их можно
 * закрыть раньше; ошибки висят, пока их не закроют.
 */
import { onBeforeUnmount, watch } from 'vue'
import { useProgressStore, type Toast } from '@/stores/progress'
import HankoStamp from '@/illustrations/HankoStamp.vue'

const store = useProgressStore()
const timers = new Map<number, ReturnType<typeof setTimeout>>()
const LIFETIME_MS = 8000

watch(
  () => store.toasts,
  (toasts) => {
    for (const t of toasts) {
      if (t.kind === 'error' || timers.has(t.id)) continue
      timers.set(
        t.id,
        setTimeout(() => {
          timers.delete(t.id)
          store.dismissToast(t.id)
        }, LIFETIME_MS),
      )
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => timers.forEach(clearTimeout))

const KIND_LABEL: Record<Toast['kind'], string> = {
  achievement: 'Достижение',
  rank: 'Ранг',
  info: 'Сообщение',
  error: 'Ошибка',
}
</script>

<template>
  <section class="toasts" aria-label="Уведомления">
    <div role="status" aria-live="polite" class="toasts__list">
      <article v-for="t in store.toasts" :key="t.id" class="toast" :class="`toast--${t.kind}`">
        <HankoStamp v-if="t.kind === 'achievement'" class="toast__seal" text="открыто" center="★" aria-hidden="true" />
        <div class="toast__body">
          <p class="toast__kind">{{ KIND_LABEL[t.kind] }}</p>
          <p class="toast__title">{{ t.title }}</p>
          <p v-if="t.text" class="toast__text">{{ t.text }}</p>
        </div>
        <button type="button" class="toast__close" @click="store.dismissToast(t.id)">
          <span aria-hidden="true">×</span>
          <span class="visually-hidden">Закрыть уведомление «{{ t.title }}»</span>
        </button>
      </article>
    </div>
  </section>
</template>

<style scoped>
.toasts {
  position: fixed;
  right: max(1rem, env(safe-area-inset-right));
  bottom: max(1rem, env(safe-area-inset-bottom));
  z-index: 80;
  width: min(100% - 2rem, 24rem);
  pointer-events: none;
}
.toasts__list {
  display: grid;
  gap: 0.6rem;
}
.toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.85rem 0.75rem 0.85rem 1rem;
  border: 1px solid var(--line-strong);
  border-left: 4px solid var(--ink);
  border-radius: var(--radius-s);
  background: var(--paper-raised);
  box-shadow: var(--edge), var(--shadow);
  animation: toast-in 240ms var(--ease);
}
.toast--achievement {
  border-left-color: var(--accent);
}
.toast--rank {
  border-left-color: var(--gold);
}
.toast--error {
  border-left-color: var(--accent);
  background: color-mix(in srgb, var(--accent-wash) 100%, var(--paper-raised));
}
.toast__seal {
  --hanko-size: 3rem;
}
.toast__body {
  flex: 1;
  min-width: 0;
}
.toast__kind {
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
.toast__title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.25rem;
  line-height: 1.2;
}
.toast__text {
  font-size: 0.9rem;
  color: var(--ink-soft);
}
.toast__close {
  flex: none;
  width: 2.25rem;
  height: 2.25rem;
  border: 0;
  border-radius: var(--radius-s);
  background: transparent;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
}
.toast__close:hover {
  background: var(--paper-sunken);
}
@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
@media (max-width: 40rem) {
  .toasts {
    left: 1rem;
    right: 1rem;
    width: auto;
  }
}
</style>
