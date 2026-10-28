<script setup lang="ts">
/**
 * Заметки к фильму: быстрая запись с типом, список и удаление
 * с подтверждением. Редактирование и поиск — в журнале (ТЗ §13).
 */
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import { addNote, deleteNote } from '@/domain/progress/progress.actions'
import { NOTE_KIND_LABEL, notesForFilm } from '@/domain/progress/progress.selectors'
import type { Note, NoteKind } from '@/domain/progress/progress.types'
import { formatDateTime } from '@/domain/shared/dates'
import { excerpt, normalizeText } from '@/domain/shared/text'
import AnswerField from '@/components/AnswerField.vue'
import AppButton from '@/components/AppButton.vue'
import ChoiceChips from '@/components/ChoiceChips.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const props = withDefaults(defineProps<{ filmId: string; readonly?: boolean }>(), { readonly: false })

const store = useProgressStore()
const notes = computed(() =>
  [...notesForFilm(store.progress, props.filmId)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

const KINDS = (['observation', 'hypothesis', 'question', 'free'] as const).map((k) => ({ value: k, label: NOTE_KIND_LABEL[k] }))
const kind = ref<NoteKind>('observation')
const text = ref('')
const message = ref('')
const form = ref<HTMLElement | null>(null)

function save() {
  if (props.readonly || normalizeText(text.value) === '') return
  const input = { text: text.value, kind: kind.value, filmId: props.filmId }
  store.apply((q, now) => addNote(q, input, now))
  text.value = ''
  message.value = 'Заметка сохранена — она появится и в журнале.'
}

const pending = ref<Note | null>(null)

function confirmDelete() {
  const note = pending.value
  pending.value = null
  if (!note) return
  store.apply((q, now) => deleteNote(q, note.id, now))
  message.value = 'Заметка удалена.'
}

/** Для кнопки «Записать заметку» в шапке страницы. */
function focusInput() {
  form.value?.querySelector('textarea')?.focus()
}
defineExpose({ focusInput, el: form })
</script>

<template>
  <section class="notes" aria-labelledby="notes-title">
    <h2 id="notes-title">Заметки к фильму</h2>
    <p class="notes__lead">
      Мысль, которая пришла во время просмотра или через неделю. Все заметки собираются в
      <RouterLink :to="{ name: 'journal', query: { film: filmId } }">журнале</RouterLink>.
    </p>

    <form v-if="!readonly" ref="form" class="notes__form card" @submit.prevent="save">
      <ChoiceChips v-model="kind" legend="Что это" :options="KINDS" />
      <AnswerField v-model="text" label="Новая заметка" :rows="3" />
      <div>
        <AppButton type="submit" variant="primary" :disabled="normalizeText(text) === ''">Сохранить заметку</AppButton>
      </div>
    </form>
    <p class="notes__message" role="status">{{ message }}</p>

    <ul v-if="notes.length" class="notes__list">
      <li v-for="n in notes" :key="n.id" class="note">
        <p class="note__meta">
          <span class="note__kind">{{ NOTE_KIND_LABEL[n.kind] }}</span>
          <span> · {{ formatDateTime(n.createdAt) }}</span>
        </p>
        <p class="note__text">{{ n.text }}</p>
        <AppButton v-if="!readonly" variant="ghost" class="note__delete" @click="pending = n">
          Удалить<span class="visually-hidden"> заметку «{{ excerpt(n.text, 40) }}»</span>
        </AppButton>
      </li>
    </ul>
    <p v-else class="notes__empty">Заметок к этому фильму пока нет.</p>

    <ConfirmDialog
      :open="pending !== null"
      title="Удалить заметку?"
      confirm-label="Удалить"
      danger
      @confirm="confirmDelete"
      @cancel="pending = null"
    >
      <p>«{{ pending ? excerpt(pending.text, 120) : '' }}»</p>
      <p>Заметку нельзя будет восстановить, если она не сохранена в JSON-копии.</p>
    </ConfirmDialog>
  </section>
</template>

<style scoped>
.notes {
  display: grid;
  gap: 0.9rem;
}
.notes__lead {
  max-width: var(--measure);
  color: var(--ink-soft);
}
.notes__form {
  display: grid;
  gap: 1rem;
  max-width: 48rem;
}
.notes__message:empty {
  display: none;
}
.notes__message {
  font-weight: 560;
  color: var(--moss);
}
.notes__list {
  display: grid;
  gap: 0.75rem;
  max-width: 48rem;
  padding: 0;
  list-style: none;
}
.note {
  display: grid;
  gap: 0.35rem;
  padding: 0.9rem 1.1rem 0.5rem;
  border-left: 3px solid var(--line-strong);
  background: var(--paper-raised);
  border-radius: 0 var(--radius-s) var(--radius-s) 0;
}
.note__meta {
  font-size: 0.88rem;
  color: var(--ink-soft);
}
.note__kind {
  font-weight: 560;
  color: var(--ink);
}
.note__text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.note__delete {
  justify-self: start;
  margin-left: -0.5rem;
}
.notes__empty {
  color: var(--ink-faint);
}
</style>
