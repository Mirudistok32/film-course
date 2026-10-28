<script setup lang="ts">
/** Однострочное поле с видимой подписью — в паре с AnswerField для коротких значений и поиска. */
import { useId } from 'vue'

withDefaults(
  defineProps<{
    label: string
    hint?: string
    type?: 'text' | 'search'
    maxlength?: number
    /** Мелкая подпись — для фильтров и поиска. */
    compact?: boolean
  }>(),
  { hint: '', type: 'text', maxlength: 300, compact: false },
)

const model = defineModel<string>({ default: '' })
const uid = useId()
</script>

<template>
  <div class="field" :class="{ 'field--compact': compact }">
    <label :for="`${uid}-input`" class="field__label">{{ label }}</label>
    <p v-if="hint" :id="`${uid}-hint`" class="field__hint">{{ hint }}</p>
    <input
      :id="`${uid}-input`"
      v-model="model"
      class="field__input"
      :type="type"
      :maxlength="maxlength"
      :aria-describedby="hint ? `${uid}-hint` : undefined"
      autocomplete="off"
      spellcheck="true"
    />
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
.field__hint {
  font-size: 0.92rem;
  color: var(--ink-soft);
}
.field__input {
  width: 100%;
  min-height: 2.9rem;
  padding: 0.5rem 0.9rem;
  border: 1.5px solid var(--line-strong);
  border-radius: var(--radius-s);
  background: var(--paper-raised);
}
.field__input:focus-visible {
  outline-offset: 1px;
  border-color: var(--focus);
}
</style>
