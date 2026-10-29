<script setup lang="ts">
/**
 * Журнал (ТЗ §13): заметки и разборы всех фильмов в одной ленте, фильтры
 * по уровню, фильму и типу, поиск, свободная заметка, редактирование и
 * удаление с подтверждением. Вторая вкладка — «Мотивы».
 * Уровень, фильм и вкладка — в адресе (?level=, ?film=, ?tab=motifs):
 * со страницы фильма ведёт ссылка /journal?film=<id>.
 */
import { computed, nextTick, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import { addNote, deleteNote } from '@/domain/progress/progress.actions'
import {
  ALL_FILMS,
  filterJournal,
  journalEntries,
  NO_FILM,
  type JournalEntryType,
} from '@/domain/progress/progress.journal'
import type { Note, NoteKind } from '@/domain/progress/progress.types'
import { excerpt, plural } from '@/domain/shared/text'
import AppButton from '@/components/AppButton.vue'
import ChoiceChips from '@/components/ChoiceChips.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import FilmSelect from '@/components/FilmSelect.vue'
import SelectField from '@/components/SelectField.vue'
import TextField from '@/components/TextField.vue'
import JournalEntryCard from '@/components/journal/JournalEntryCard.vue'
import JournalMotifs from '@/components/journal/JournalMotifs.vue'
import NoteEditor from '@/components/journal/NoteEditor.vue'
import InkVignette from '@/illustrations/InkVignette.vue'

const route = useRoute()
const router = useRouter()
const store = useProgressStore()
const course = computed(() => store.course)

const records = (n: number) => plural(n, ['запись', 'записи', 'записей'])

/* ---------- Вкладки ---------- */

type Tab = 'entries' | 'motifs'
const TABS: { id: Tab; label: string }[] = [
  { id: 'entries', label: 'Записи' },
  { id: 'motifs', label: 'Мотивы' },
]
const tab = computed<Tab>(() => (route.query.tab === 'motifs' ? 'motifs' : 'entries'))
const tabEls = ref<HTMLElement[]>([])

async function selectTab(t: Tab, focusTab = false) {
  if (t !== tab.value) await router.replace({ query: { ...route.query, tab: t === 'motifs' ? 'motifs' : undefined } })
  if (focusTab) {
    await nextTick()
    tabEls.value[TABS.findIndex((x) => x.id === t)]?.focus()
  }
}

function onTabKey(event: KeyboardEvent, index: number) {
  const last = TABS.length - 1
  const target =
    event.key === 'ArrowRight'
      ? (index + 1) % (last + 1)
      : event.key === 'ArrowLeft'
        ? (index + last) % (last + 1)
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : -1
  const t = TABS[target]
  if (!t) return
  event.preventDefault()
  selectTab(t.id, true)
}

/* ---------- Фильтры ---------- */

function queryString(key: string): string {
  const v = route.query[key]
  return typeof v === 'string' ? v : ''
}

/** Уровень и фильм хранятся в адресе: переживают перезагрузку, ссылку можно открыть со страницы фильма. */
const levelId = computed({
  get: () => (course.value.levelById.has(queryString('level')) ? queryString('level') : ''),
  set: (id: string) => {
    const film = course.value.filmById.get(filmId.value)
    // Фильм другого уровня и «без фильма» не сочетаются с выбранным уровнем.
    const keepFilm = !id || film?.levelId === id
    router.replace({ query: { ...route.query, level: id || undefined, film: keepFilm ? route.query.film : undefined } })
  },
})

const filmId = computed({
  get: () => {
    const id = queryString('film')
    return id === NO_FILM || course.value.filmById.has(id) ? id : ALL_FILMS
  },
  set: (id: string) => router.replace({ query: { ...route.query, film: id || undefined } }),
})

const type = ref<JournalEntryType | 'all'>('all')
const TYPES: { value: JournalEntryType | 'all'; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'note', label: 'Заметки' },
  { value: 'analysis', label: 'Разборы' },
]
const query = ref('')

const filtersActive = computed(
  () => Boolean(levelId.value) || filmId.value !== ALL_FILMS || type.value !== 'all' || query.value.trim() !== '',
)

function resetFilters() {
  type.value = 'all'
  query.value = ''
  router.replace({ query: { ...route.query, level: undefined, film: undefined } })
}

const all = computed(() => journalEntries(course.value, store.progress))
const shown = computed(() =>
  filterJournal(all.value, {
    levelId: levelId.value || null,
    filmId: filmId.value,
    type: type.value,
    query: query.value,
  }),
)

const summary = computed(() =>
  filtersActive.value
    ? `Найдено ${shown.value.length} ${records(shown.value.length)} из ${all.value.length}`
    : `${all.value.length} ${records(all.value.length)}`,
)

/* ---------- Новая заметка ---------- */

const message = ref('')
const creating = ref(false)
const creator = ref<InstanceType<typeof NoteEditor> | null>(null)
/** Новая заметка по умолчанию привязана к фильму из фильтра. */
const newNoteFilm = computed(() => (filmId.value === ALL_FILMS || filmId.value === NO_FILM ? null : filmId.value))

async function openCreator() {
  creating.value = true
  await nextTick()
  creator.value?.focus()
}

function create(value: { text: string; kind: NoteKind; filmId: string | null }) {
  store.apply((q, now) => addNote(q, value, now))
  creator.value?.clear()
  creating.value = false
  message.value = 'Заметка сохранена.'
}

/* ---------- Удаление ---------- */

const pending = ref<Note | null>(null)

function confirmDelete() {
  const note = pending.value
  pending.value = null
  if (!note) return
  store.apply((q, now) => deleteNote(q, note.id, now))
  message.value = 'Заметка удалена.'
}
</script>

<template>
  <div class="journal container">
    <header class="journal__head">
      <p class="eyebrow">
        {{ all.length }} {{ records(all.length) }} · {{ store.progress.motifs.length }}
        {{ plural(store.progress.motifs.length, ['мотив', 'мотива', 'мотивов']) }}
      </p>
      <h1>Журнал</h1>
      <p class="journal__lead">
        Все ваши заметки и разборы фильмов в одном месте. Возвращайтесь к ним: через неделю в старой записи часто видно
        то, чего не было видно сразу.
      </p>
    </header>

    <div class="tabs" role="tablist" aria-label="Разделы журнала">
      <button
        v-for="(t, i) in TABS"
        :id="`journal-tab-${t.id}`"
        :key="t.id"
        ref="tabEls"
        type="button"
        role="tab"
        class="tab"
        :aria-selected="tab === t.id"
        :aria-controls="`journal-panel-${t.id}`"
        :tabindex="tab === t.id ? 0 : -1"
        @click="selectTab(t.id)"
        @keydown="onTabKey($event, i)"
      >
        {{ t.label }}
      </button>
    </div>

    <div
      v-if="tab === 'entries'"
      id="journal-panel-entries"
      class="panel"
      role="tabpanel"
      aria-labelledby="journal-tab-entries"
    >
      <div class="create">
        <AppButton v-if="!creating" variant="primary" @click="openCreator">Новая заметка</AppButton>
        <section v-else class="create__card card" aria-labelledby="create-title">
          <h2 id="create-title" class="create__title">Новая заметка</h2>
          <NoteEditor ref="creator" :film-id="newNoteFilm" cancellable @save="create" @cancel="creating = false" />
        </section>
      </div>
      <p class="journal__message" role="status">{{ message }}</p>

      <template v-if="all.length">
        <form class="filters" role="search" aria-label="Поиск и фильтры журнала" @submit.prevent>
          <TextField v-model="query" type="search" label="Поиск по записям" compact class="filters__search" />
          <SelectField v-model="levelId" label="Уровень" compact>
            <option value="">Все уровни</option>
            <option v-for="level in course.levels" :key="level.id" :value="level.id">
              {{ level.number }}. {{ level.title }}
            </option>
          </SelectField>
          <FilmSelect
            v-model="filmId"
            label="Фильм"
            empty-label="Все фильмы"
            :none-label="levelId ? '' : 'Без фильма (свободные)'"
            :level-id="levelId || null"
            compact
          />
          <ChoiceChips v-model="type" legend="Показывать" :options="TYPES" hidden-legend class="filters__types" />
        </form>

        <div class="results">
          <p class="results__count" role="status">{{ summary }}</p>
          <AppButton v-if="filtersActive" variant="ghost" @click="resetFilters">Сбросить фильтры</AppButton>
        </div>

        <ul v-if="shown.length" class="list">
          <li v-for="entry in shown" :key="entry.id">
            <JournalEntryCard
              :entry="entry"
              @delete="pending = $event"
              @saved="message = `Заметка «${$event}» сохранена.`"
            />
          </li>
        </ul>
        <p v-else class="journal__empty">Под эти условия записей нет. Попробуйте другое слово или сбросьте фильтры.</p>
      </template>

      <div v-else class="empty">
        <InkVignette name="notebook" class="empty__art" />
        <div>
          <h2 class="empty__title">Журнал пока пуст</h2>
          <p>
            Сюда попадут заметки к фильмам и ответы из разборов. Начните с любого урока на
            <RouterLink :to="{ name: 'course' }">карте курса</RouterLink> или запишите свободную мысль кнопкой выше.
          </p>
        </div>
      </div>
    </div>

    <div v-else id="journal-panel-motifs" class="panel" role="tabpanel" aria-labelledby="journal-tab-motifs">
      <JournalMotifs />
    </div>

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
  </div>
</template>

<style scoped>
.journal {
  display: grid;
  gap: 1.5rem;
  padding-top: clamp(1.5rem, 4vw, 2.5rem);
}
.journal__head {
  display: grid;
  gap: 0.9rem;
  max-width: 46rem;
}
.journal__lead {
  font-size: clamp(1.05rem, 1rem + 0.3vw, 1.2rem);
  color: var(--ink-soft);
}

.tabs {
  display: flex;
  border-bottom: 1.5px solid var(--line-strong);
}
.tab {
  min-height: 3.25rem;
  padding: 0.6rem 1.25rem;
  border: 0;
  border-bottom: 3px solid transparent;
  margin-bottom: -1.5px;
  background: none;
  color: var(--ink-soft);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.35rem;
  cursor: pointer;
}
.tab:hover {
  color: var(--ink);
}
.tab[aria-selected='true'] {
  border-bottom-color: var(--accent);
  color: var(--ink);
}
.tab:focus-visible {
  outline-offset: -3px;
}

.panel {
  display: grid;
  gap: 1.25rem;
  max-width: 52rem;
}

.create__card {
  display: grid;
  gap: 1rem;
}
.create__title {
  font-size: 1.7rem;
}
.journal__message:empty {
  display: none;
}
.journal__message {
  font-weight: 560;
  color: var(--moss);
}

.filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem 1rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--paper-sunken);
}
.filters__search,
.filters__types {
  grid-column: 1 / -1;
}

.results {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-height: 2.75rem;
}
.results__count {
  font-family: var(--font-accent);
  font-size: 0.95rem;
  color: var(--ink-soft);
}

.list {
  display: grid;
  gap: 0.9rem;
  padding: 0;
  list-style: none;
}
.journal__empty {
  color: var(--ink-faint);
}

.empty {
  display: grid;
  grid-template-columns: 8rem minmax(0, 1fr);
  align-items: center;
  gap: 1.25rem;
  max-width: 40rem;
  color: var(--ink-soft);
}
.empty__title {
  margin-bottom: 0.4rem;
  font-size: 1.6rem;
  color: var(--ink);
}

@media (max-width: 40rem) {
  .filters {
    grid-template-columns: minmax(0, 1fr);
  }
  .empty {
    grid-template-columns: minmax(0, 1fr);
  }
  .empty__art {
    width: 7rem;
  }
}
</style>
