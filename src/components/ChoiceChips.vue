<script setup lang="ts" generic="T extends string">
/**
 * Чипы-переключатели: радиокнопки под видом пилюль. Работают как обычная
 * группа радио — стрелки, Tab, подпись группы в legend.
 */
import { useId } from 'vue'

defineProps<{
  legend: string
  options: readonly { value: T; label: string }[]
  /** Подпись группы только для скринридера (когда рядом уже есть заголовок). */
  hiddenLegend?: boolean
}>()

const model = defineModel<T>({ required: true })
const name = useId()
</script>

<template>
  <fieldset class="chips">
    <legend class="chips__legend" :class="{ 'visually-hidden': hiddenLegend }">{{ legend }}</legend>
    <label v-for="o in options" :key="o.value" class="chip">
      <input v-model="model" type="radio" :name="name" :value="o.value" />
      <span>{{ o.label }}</span>
    </label>
  </fieldset>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  border: 0;
}
.chips__legend {
  margin-bottom: 0.5rem;
  padding: 0;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.3rem;
}
.chip {
  position: relative;
  cursor: pointer;
}
.chip input {
  position: absolute;
  opacity: 0;
  inset: 0;
  cursor: inherit;
}
.chip span {
  display: inline-flex;
  align-items: center;
  min-height: 2.5rem;
  padding: 0.3rem 0.9rem;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: var(--paper);
}
.chip input:checked + span {
  border-color: var(--ink);
  background: var(--ink);
  color: var(--paper);
}
.chip input:focus-visible + span {
  outline: 3px solid var(--focus);
  outline-offset: 2px;
}
</style>
