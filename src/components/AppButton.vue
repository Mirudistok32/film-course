<script setup lang="ts">
/** Кнопка или ссылка-кнопка (если передан `to`). */
import { RouterLink, type RouteLocationRaw } from 'vue-router'

withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'm' | 'l'
    to?: RouteLocationRaw
    type?: 'button' | 'submit'
    disabled?: boolean
  }>(),
  { variant: 'secondary', size: 'm', to: undefined, type: 'button', disabled: false },
)
</script>

<template>
  <RouterLink v-if="to" :to="to" class="btn" :class="[`btn--${variant}`, `btn--${size}`]">
    <slot />
  </RouterLink>
  <button v-else :type="type" class="btn" :class="[`btn--${variant}`, `btn--${size}`]" :disabled="disabled">
    <slot />
  </button>
</template>

<style scoped>
.btn {
  --btn-bg: transparent;
  --btn-fg: var(--ink);
  --btn-border: var(--line-strong);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5em;
  min-height: 2.75rem;
  padding: 0.55em 1.15em;
  border: 1.5px solid var(--btn-border);
  border-radius: var(--radius-s);
  background: var(--btn-bg);
  color: var(--btn-fg);
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: 560;
  line-height: 1.2;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color var(--dur) var(--ease),
    color var(--dur) var(--ease),
    border-color var(--dur) var(--ease),
    transform var(--dur) var(--ease);
}
.btn:hover {
  color: var(--btn-fg);
}
.btn:active:not(:disabled) {
  transform: translateY(1px);
}
/* Недоступная кнопка любого вида — пунктирный контур без заливки: видно, что её
   пока нельзя нажать, но текст читается (контраст как у вторичного текста). */
.btn:disabled {
  --btn-bg: transparent;
  --btn-fg: var(--ink-soft);
  --btn-border: var(--ink-soft);
  border-style: dashed;
  cursor: not-allowed;
}

.btn--primary {
  --btn-bg: var(--ink);
  --btn-fg: var(--paper);
  --btn-border: var(--ink);
}
.btn--primary:hover:not(:disabled) {
  --btn-bg: var(--accent);
  --btn-fg: var(--accent-ink);
  --btn-border: var(--accent);
}

.btn--secondary:hover:not(:disabled) {
  --btn-bg: var(--paper-sunken);
  --btn-border: var(--ink);
}

.btn--ghost {
  --btn-border: transparent;
  padding-inline: 0.6em;
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, currentColor 40%, transparent);
  text-underline-offset: 0.2em;
}
.btn--ghost:hover:not(:disabled) {
  --btn-fg: var(--accent);
}

.btn--danger {
  --btn-fg: var(--accent);
  --btn-border: var(--accent);
}
.btn--danger:hover:not(:disabled) {
  --btn-bg: var(--accent);
  --btn-fg: var(--accent-ink);
}

.btn--l {
  min-height: 3.25rem;
  padding: 0.7em 1.6em;
  font-size: 1.125rem;
}
</style>
