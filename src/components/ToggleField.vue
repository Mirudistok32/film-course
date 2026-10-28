<script setup lang="ts">
/**
 * Переключатель-флажок с видимой подписью и пояснением. Состояние
 * дублируется словами «включено» / «выключено» (ТЗ §34).
 */
import { useId } from 'vue'

withDefaults(defineProps<{ label: string; hint?: string }>(), { hint: '' })

const model = defineModel<boolean>({ required: true })
const uid = useId()
</script>

<template>
  <div class="toggle">
    <input :id="`${uid}-input`" v-model="model" type="checkbox" :aria-describedby="hint ? `${uid}-hint` : undefined" />
    <label :for="`${uid}-input`" class="toggle__label">
      {{ label }}
      <span class="toggle__state">{{ model ? 'включено' : 'выключено' }}</span>
    </label>
    <p v-if="hint" :id="`${uid}-hint`" class="toggle__hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.toggle {
  display: grid;
  grid-template-columns: 1.35rem minmax(0, 1fr);
  gap: 0.15rem 0.75rem;
  align-items: start;
  padding: 0.75rem 0;
}
.toggle input {
  width: 1.3rem;
  height: 1.3rem;
  margin: 0.2rem 0 0;
  accent-color: var(--moss);
  cursor: pointer;
}
.toggle__label {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.1rem 0.6rem;
  font-weight: 560;
  cursor: pointer;
}
.toggle__state {
  font-size: 0.85rem;
  font-weight: 400;
  color: var(--ink-soft);
}
.toggle:has(input:checked) .toggle__state {
  color: var(--moss);
  font-weight: 600;
}
.toggle__hint {
  grid-column: 2;
  font-size: 0.92rem;
  color: var(--ink-soft);
}
</style>
