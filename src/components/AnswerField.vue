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
      :class="{ 'answer__input--filled': model.length > 0 }"
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
  /* Чуть темнее обычной серой подписи: подсказку читают, пока пишут. */
  color: color-mix(in srgb, var(--ink-soft) 60%, var(--ink));
}
.answer__input {
  /* Цвет уровня, если поле внутри блока с data-tint; иначе — тушь. */
  --field-ink: var(--tint-ink, var(--ink-soft));
  width: 100%;
  min-height: 6.5rem;
  field-sizing: content;
  padding: 0.75rem 0.9rem;
  border: 1.5px solid color-mix(in srgb, var(--field-ink) 60%, var(--line-strong));
  border-radius: var(--radius-s);
  background: var(--paper-raised);
  line-height: 1.6;
  resize: vertical;
  transition:
    border-color var(--dur) var(--ease),
    box-shadow var(--dur) var(--ease);
  /* Линованная бумага блокнота — только пока поле пустое. */
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
.answer__input--filled {
  background-image: none;
}
.answer__input:hover:not(:read-only) {
  border-color: var(--field-ink);
}
.answer__input:read-only {
  border-style: dashed;
  border-color: var(--line-strong);
  background-color: var(--paper-sunken);
}
.answer__input::placeholder {
  color: var(--ink-faint);
}
.answer__input:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 2px;
  border-color: var(--field-ink);
  box-shadow: inset 0 0 0 1px var(--field-ink);
}
</style>
