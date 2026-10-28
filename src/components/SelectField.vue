<script setup lang="ts">
/** Нативный select с видимой подписью; пункты передаются слотом (option, optgroup). */
import { useId } from 'vue'

withDefaults(defineProps<{ label: string; compact?: boolean }>(), { compact: false })

const model = defineModel<string>({ default: '' })
const uid = useId()
</script>

<template>
  <div class="field" :class="{ 'field--compact': compact }">
    <label :for="`${uid}-select`" class="field__label">{{ label }}</label>
    <select :id="`${uid}-select`" v-model="model" class="field__select">
      <slot />
    </select>
  </div>
</template>

<style scoped>
.field {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}
.field__label {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.3rem;
  line-height: 1.2;
}
.field--compact .field__label {
  font-family: var(--font-body);
  font-size: 0.92rem;
  font-weight: 560;
  color: var(--ink-soft);
}
.field__select {
  width: 100%;
  min-width: 0;
  min-height: 2.9rem;
  padding: 0.5rem 0.9rem;
  border: 1.5px solid var(--line-strong);
  border-radius: var(--radius-s);
  background: var(--paper-raised);
}
.field__select:focus-visible {
  outline-offset: 1px;
  border-color: var(--focus);
}
</style>
