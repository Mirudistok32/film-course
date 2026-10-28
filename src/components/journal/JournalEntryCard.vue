<script setup lang="ts">
/**
 * Запись журнала: заметка (читать, изменить на месте, удалить) или разбор
 * фильма (только чтение, правится на странице фильма). Заголовок — фильм
 * со ссылкой на урок, у свободной заметки — «Свободная заметка».
 */
import { computed, nextTick, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import { updateNote } from '@/domain/progress/progress.actions'
import { NOTE_KIND_LABEL } from '@/domain/progress/progress.selectors'
import { ANALYSIS_PART_LABEL, type JournalEntry } from '@/domain/progress/progress.journal'
import type { Note, NoteKind } from '@/domain/progress/progress.types'
import { formatDateTime } from '@/domain/shared/dates'
import { excerpt, normalizeText } from '@/domain/shared/text'
import { levelTint } from '@/domain/shared/tint'
import AppButton from '@/components/AppButton.vue'
import NoteEditor from './NoteEditor.vue'

const props = defineProps<{ entry: JournalEntry }>()
const emit = defineEmits<{ delete: [note: Note]; saved: [text: string] }>()

const store = useProgressStore()

const NOTE_EXCERPT = 360
const expanded = ref(false)
const editing = ref(false)
const root = ref<HTMLElement | null>(null)

const film = computed(() => props.entry.film)
const note = computed(() => (props.entry.type === 'note' ? props.entry.note : null))
const long = computed(() => (note.value ? normalizeText(note.value.text).length > NOTE_EXCERPT : false))
const edited = computed(() => (note.value ? note.value.updatedAt !== note.value.createdAt : false))

async function startEdit() {
  editing.value = true
  await nextTick()
  root.value?.querySelector('textarea')?.focus()
}

async function stopEdit() {
  editing.value = false
  await nextTick()
  root.value?.querySelector<HTMLElement>('.entry__edit')?.focus()
}

function save(value: { text: string; kind: NoteKind; filmId: string | null }) {
  const id = note.value?.id
  if (!id) return
  store.apply((q, now) => updateNote(q, id, value, now))
  emit('saved', excerpt(value.text, 40))
  stopEdit()
}
</script>

<template>
  <article
    ref="root"
    class="entry"
    :class="`entry--${entry.type}`"
    :data-tint="film ? levelTint(film.levelNumber) : 'lavender'"
  >
    <p class="entry__kind">
      {{ note ? NOTE_KIND_LABEL[note.kind] : 'Разбор фильма' }}
    </p>
    <h3 class="entry__title">
      <RouterLink v-if="film" :to="{ name: 'film', params: { filmId: film.id } }">{{ film.title }}</RouterLink>
      <template v-else>Свободная заметка</template>
    </h3>
    <p class="entry__meta">
      <template v-if="film">Уровень {{ film.levelNumber }} · {{ film.year }} · </template>
      <template v-if="note">
        {{ formatDateTime(note.createdAt) }}<template v-if="edited">, изменена {{ formatDateTime(note.updatedAt) }}</template>
      </template>
      <template v-else>обновлён {{ formatDateTime(entry.date) }}</template>
    </p>

    <template v-if="note">
      <NoteEditor
        v-if="editing"
        :text="note.text"
        :kind="note.kind"
        :film-id="note.filmId"
        submit-label="Сохранить изменения"
        cancellable
        @save="save"
        @cancel="stopEdit"
      />
      <template v-else>
        <p v-if="note.kind === 'merge-copy'" class="entry__notice">
          Эта версия пришла из импортированного файла и отличалась от вашей. Сравните и оставьте нужное.
        </p>
        <p class="entry__text">{{ long && !expanded ? excerpt(note.text, NOTE_EXCERPT) : note.text }}</p>
        <div class="entry__actions">
          <AppButton v-if="long" variant="ghost" :aria-expanded="expanded" @click="expanded = !expanded">
            {{ expanded ? 'Свернуть' : 'Читать полностью' }}
          </AppButton>
          <AppButton variant="ghost" class="entry__edit" @click="startEdit">
            Изменить<span class="visually-hidden"> заметку «{{ excerpt(note.text, 40) }}»</span>
          </AppButton>
          <AppButton variant="ghost" @click="emit('delete', note)">
            Удалить<span class="visually-hidden"> заметку «{{ excerpt(note.text, 40) }}»</span>
          </AppButton>
        </div>
      </template>
    </template>

    <template v-else-if="entry.type === 'analysis'">
      <dl class="entry__parts">
        <div v-for="part in entry.parts" :key="part.key" class="entry__part">
          <dt>{{ ANALYSIS_PART_LABEL[part.key] }}</dt>
          <dd>{{ excerpt(part.text, 200) }}</dd>
        </div>
      </dl>
      <div class="entry__actions">
        <AppButton variant="ghost" :to="{ name: 'film', params: { filmId: entry.film.id }, query: { step: 'after' } }">
          Открыть разбор<span class="visually-hidden"> фильма «{{ entry.film.title }}»</span>
        </AppButton>
      </div>
    </template>
  </article>
</template>

<style scoped>
.entry {
  display: grid;
  gap: 0.35rem;
  padding: 1rem 1.1rem 0.5rem;
  border-left: 4px solid color-mix(in srgb, var(--tint-ink) 55%, var(--tint));
  border-radius: 0 var(--radius-m) var(--radius-m) 0;
  background: linear-gradient(100deg, color-mix(in srgb, var(--tint) 60%, var(--paper-raised)), var(--paper-raised) 45%);
  box-shadow: var(--shadow);
  min-width: 0;
}
.entry--analysis {
  border-left-color: var(--tint-ink);
}
.entry__kind {
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
.entry__title {
  font-size: 1.45rem;
  overflow-wrap: anywhere;
}
.entry__title a {
  color: inherit;
}
.entry__meta {
  font-size: 0.88rem;
  color: var(--ink-soft);
}
.entry__notice {
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-s);
  background: var(--accent-wash);
  font-size: 0.92rem;
}
.entry__text {
  margin-top: 0.25rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.entry__parts {
  display: grid;
  gap: 0.5rem;
  margin: 0.25rem 0 0;
}
.entry__part {
  display: grid;
  grid-template-columns: 9.5rem minmax(0, 1fr);
  gap: 0.75rem;
}
.entry__part dt {
  font-weight: 560;
  color: var(--ink-soft);
}
.entry__part dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.entry__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-left: -0.5rem;
}

@media (max-width: 30rem) {
  .entry__part {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.1rem;
  }
}
</style>
