<script setup lang="ts">
/**
 * Поле ответа: видимая подпись (не только placeholder), подсказка,
 * связанная через aria-describedby, высота растёт вместе с текстом.
 */
import { useId } from 'vue'

withDefaults(
  defineProps<{
    label: string
    hint?: string
    placeholder?: string
    rows?: number
    maxlength?: number
    /** Только чтение: например, закрытый уровень в строгом порядке. */
    readonly?: boolean
  }>(),
  { hint: '', placeholder: '', rows: 3, maxlength: 20000, readonly: false },
)

const model = defineModel<string>({ default: '' })
const uid = useId()
</script>

<template>
  <div class="answer">
    <label :for="`${uid}-input`" class="answer__label">{{ label }}</label>
    <p v-if="hint" :id="`${uid}-hint`" class="answer__hint">{{ hint }}</p>
    <textarea
      :id="`${uid}-input`"
      v-model="model"
      class="answer__input"
      :rows="rows"
      :placeholder="placeholder"
      :maxlength="maxlength"
      :readonly="readonly"
      :aria-describedby="hint ? `${uid}-hint` : undefined"
      spellcheck="true"
    />
  </div>
</template>

<style scoped>
.answer {
  display: grid;
  gap: 0.35rem;
}
.answer__label {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.3rem;
  line-height: 1.2;
}
.answer__hint {
  font-size: 0.92rem;
  color: var(--ink-soft);
}
.answer__input {
  width: 100%;
  min-height: 6.5rem;
  field-sizing: content;
  padding: 0.75rem 0.9rem;
  border: 1.5px solid var(--line-strong);
  border-radius: var(--radius-s);
  background: var(--paper-raised);
  line-height: 1.6;
  resize: vertical;
  /* Линованная бумага блокнота. */
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent calc(1.6em - 1px),
    color-mix(in srgb, var(--line) 70%, transparent) calc(1.6em - 1px),
    color-mix(in srgb, var(--line) 70%, transparent) 1.6em
  );
  background-position: 0 0.75rem;
  background-attachment: local;
}
.answer__input:read-only {
  border-style: dashed;
  background-color: var(--paper-sunken);
}
.answer__input::placeholder {
  color: var(--ink-faint);
}
.answer__input:focus-visible {
  outline-offset: 1px;
  border-color: var(--focus);
}
</style>
