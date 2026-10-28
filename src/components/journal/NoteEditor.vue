<script setup lang="ts">
/**
 * Форма заметки журнала: новая или редактирование. Тип, фильм (или «без
 * фильма») и текст. Шаблон «наблюдение → чувство → гипотеза → довод»
 * вставляется по кнопке — писать можно и свободно (ТЗ §13).
 */
import { computed, ref } from 'vue'
import { NOTE_KIND_LABEL } from '@/domain/progress/progress.selectors'
import { NO_FILM, NOTE_TEMPLATE } from '@/domain/progress/progress.journal'
import type { NoteKind } from '@/domain/progress/progress.types'
import { normalizeText } from '@/domain/shared/text'
import AnswerField from '@/components/AnswerField.vue'
import AppButton from '@/components/AppButton.vue'
import ChoiceChips from '@/components/ChoiceChips.vue'
import FilmSelect from '@/components/FilmSelect.vue'

const props = withDefaults(
  defineProps<{
    text?: string
    kind?: NoteKind
    filmId?: string | null
    submitLabel?: string
    /** Показать кнопку «Отмена» (при редактировании). */
    cancellable?: boolean
  }>(),
  { text: '', kind: 'free', filmId: null, submitLabel: 'Сохранить заметку', cancellable: false },
)

const emit = defineEmits<{ save: [value: { text: string; kind: NoteKind; filmId: string | null }]; cancel: [] }>()

const text = ref(props.text)
const kind = ref<NoteKind>(props.kind)
const film = ref(props.filmId ?? NO_FILM)

const KINDS: NoteKind[] = ['free', 'observation', 'hypothesis', 'question']
const kinds = computed(() =>
  (KINDS.includes(props.kind) ? KINDS : [...KINDS, props.kind]).map((k) => ({ value: k, label: NOTE_KIND_LABEL[k] })),
)

const root = ref<HTMLElement | null>(null)

function insertTemplate() {
  text.value = normalizeText(text.value) === '' ? NOTE_TEMPLATE : `${text.value.trimEnd()}\n\n${NOTE_TEMPLATE}`
  root.value?.querySelector('textarea')?.focus()
}

function submit() {
  if (normalizeText(text.value) === '') return
  emit('save', { text: text.value, kind: kind.value, filmId: film.value === NO_FILM ? null : film.value })
}

/** Сбросить форму после сохранения новой заметки. Фильм и тип остаются — удобно писать подряд. */
function clear() {
  text.value = ''
}
function focus() {
  root.value?.querySelector('textarea')?.focus()
}
defineExpose({ clear, focus })
</script>

<template>
  <form ref="root" class="editor" @submit.prevent="submit">
    <ChoiceChips v-model="kind" legend="Что это" :options="kinds" />
    <FilmSelect v-model="film" label="К какому фильму" none-label="Без фильма" />
    <AnswerField
      v-model="text"
      label="Текст заметки"
      hint="Можно писать свободно. Если мысль не складывается — попробуйте шаблон: наблюдение → чувство → гипотеза → подтверждение в форме."
      :rows="4"
    />
    <div class="editor__actions">
      <AppButton type="submit" variant="primary" :disabled="normalizeText(text) === ''">{{ submitLabel }}</AppButton>
      <AppButton variant="ghost" @click="insertTemplate">Вставить шаблон</AppButton>
      <AppButton v-if="cancellable" variant="secondary" @click="emit('cancel')">Отмена</AppButton>
    </div>
  </form>
</template>

<style scoped>
.editor {
  display: grid;
  gap: 1rem;
}
.editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}
</style>
