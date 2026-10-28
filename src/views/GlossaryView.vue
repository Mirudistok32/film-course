<script setup lang="ts">
/**
 * Словарь (ТЗ §14): статьи по темам — простое и профессиональное значение,
 * вопрос, который помогает заметить приём, пример из фильма курса и уроки,
 * где термин встречается. Поиск по всей статье, фильтр по уровню.
 * ?term=<id> — прокрутить к статье и выделить её, ?level=<id> — термины уровня.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import { useScrollTo } from '@/composables/useScrollTo'
import { GLOSSARY_GROUPS, glossarySections, termLessons } from '@/domain/catalog/glossary'
import type { Film, GlossaryGroupId } from '@/domain/catalog/catalog.types'
import { plural } from '@/domain/shared/text'
import { TINTS } from '@/domain/shared/tint'
import AppButton from '@/components/AppButton.vue'
import DisclosurePanel from '@/components/DisclosurePanel.vue'
import SelectField from '@/components/SelectField.vue'
import TextField from '@/components/TextField.vue'
import InkDivider from '@/illustrations/InkDivider.vue'
import InkVignette from '@/illustrations/InkVignette.vue'

const route = useRoute()
const router = useRouter()
const store = useProgressStore()
const course = computed(() => store.course)
const scrollTo = useScrollTo()

const termsWord = (n: number) => plural(n, ['термин', 'термина', 'терминов'])

/* ---------- Фильтры ---------- */

const query = ref('')

/** Уровень в адресе: со страницы уровня ведёт ссылка /glossary?level=<id>. */
const levelId = computed({
  get: () => {
    const id = route.query.level
    return typeof id === 'string' && course.value.levelById.has(id) ? id : ''
  },
  set: (id: string) => router.replace({ query: { ...route.query, level: id || undefined } }),
})
const level = computed(() => course.value.levelById.get(levelId.value) ?? null)

const sections = computed(() => glossarySections(course.value, { query: query.value, levelId: levelId.value || null }))
/** Цвет темы — по её месту в оглавлении, чтобы не менялся при фильтрах. */
function tintOf(groupId: string) {
  return TINTS[GLOSSARY_GROUPS.findIndex((g) => g.id === groupId) % TINTS.length]
}
const shownCount = computed(() => sections.value.reduce((n, s) => n + s.terms.length, 0))
const total = computed(() => course.value.glossary.length)
const filtersActive = computed(() => Boolean(levelId.value) || query.value.trim() !== '')

/** Без фильтров счётчик не нужен: общее число терминов — в подписи над заголовком. */
const summary = computed(() =>
  filtersActive.value ? `Найдено ${shownCount.value} ${termsWord(shownCount.value)} из ${total.value}` : '',
)

function resetFilters() {
  query.value = ''
  levelId.value = ''
}

/* ---------- Уроки с термином ---------- */

/** Сколько уроков видно сразу; остальные — по кнопке. */
const LESSONS_SHOWN = 5
const expanded = ref(new Set<string>())

const lessons = computed(() => {
  const map = new Map<string, { all: Film[]; shown: Film[]; hidden: number }>()
  for (const t of course.value.glossary) {
    const all = termLessons(course.value, t.id, levelId.value || null)
    const shown = expanded.value.has(t.id) ? all : all.slice(0, LESSONS_SHOWN)
    map.set(t.id, { all, shown, hidden: all.length - shown.length })
  }
  return map
})

/** Кнопка «Ещё» исчезает — фокус переходит на первый открывшийся урок. */
async function expand(termId: string) {
  expanded.value = new Set(expanded.value).add(termId)
  await nextTick()
  document.querySelectorAll<HTMLElement>(`#term-${termId} .lesson`)[LESSONS_SHOWN]?.focus()
}

/* ---------- Переходы по странице ---------- */

const current = computed(() => {
  const id = route.query.term
  return typeof id === 'string' && course.value.termById.has(id) ? id : null
})

function goToSection(id: GlossaryGroupId) {
  const heading = document.getElementById(`group-${id}`)
  scrollTo(heading, heading)
}

/** Статья из ?term= — сразу, без анимации, и после отрисовки, чтобы прокрутка роутера наверх не перебила её. */
watch(
  current,
  async (id) => {
    if (!id) return
    await nextTick()
    requestAnimationFrame(() => {
      const article = document.getElementById(`term-${id}`)
      scrollTo(article, article, true)
    })
  },
  { immediate: true },
)
</script>

<template>
  <div class="glossary container">
    <header class="glossary__head">
      <div class="glossary__intro">
        <p class="eyebrow">{{ total }} {{ termsWord(total) }} · {{ GLOSSARY_GROUPS.length }} тем</p>
        <h1>Словарь</h1>
        <p class="glossary__lead">
          Слова, которыми удобно называть увиденное. У каждого термина — простое объяснение, точное значение,
          вопрос, с которым его легче заметить, и уроки, где он пригодится.
        </p>
      </div>
      <InkVignette name="reel" class="glossary__art" />
    </header>

    <form class="filters" role="search" aria-label="Поиск и фильтр словаря" @submit.prevent>
      <TextField v-model="query" type="search" label="Поиск по словарю" compact class="filters__search" />
      <SelectField v-model="levelId" label="Уровень" compact>
        <option value="">Все уровни</option>
        <option v-for="l in course.levels" :key="l.id" :value="l.id">{{ l.number }}. {{ l.title }}</option>
      </SelectField>
    </form>

    <div class="results">
      <p class="results__count" role="status">{{ summary }}</p>
      <AppButton v-if="filtersActive" variant="ghost" @click="resetFilters">Сбросить фильтры</AppButton>
    </div>
    <p v-if="level" class="glossary__level">
      Термины из уроков уровня {{ level.number }} «{{ level.title }}».
      <RouterLink :to="{ name: 'level', params: { levelId: level.id } }">Вернуться к уровню</RouterLink>
    </p>

    <nav v-if="sections.length > 1" class="toc" aria-label="Темы словаря">
      <ul class="toc__list">
        <li v-for="s in sections" :key="s.id" :data-tint="tintOf(s.id)">
          <button type="button" class="toc__item" @click="goToSection(s.id)">
            {{ s.title }} <span class="toc__count">{{ s.terms.length }}</span>
          </button>
        </li>
      </ul>
    </nav>

    <section v-for="s in sections" :key="s.id" class="group" :data-tint="tintOf(s.id)" :aria-labelledby="`group-${s.id}`">
      <InkDivider />
      <h2 :id="`group-${s.id}`" class="group__title" tabindex="-1">{{ s.title }}</h2>
      <ul class="group__list">
        <li v-for="t in s.terms" :key="t.id">
          <article
            :id="`term-${t.id}`"
            class="entry"
            :class="{ 'entry--current': t.id === current }"
            tabindex="-1"
            :aria-labelledby="`term-${t.id}-title`"
          >
            <header class="entry__head">
              <h3 :id="`term-${t.id}-title`" class="entry__term">{{ t.term }}</h3>
              <p v-if="t.aka" class="entry__aka">также: {{ t.aka }}</p>
            </header>
            <p class="entry__simple">{{ t.simple }}</p>

            <dl class="entry__parts">
              <div class="entry__part">
                <dt>Точное значение</dt>
                <dd>{{ t.professional }}</dd>
              </div>
              <div class="entry__part entry__part--question">
                <dt>Как заметить</dt>
                <dd>{{ t.noticeQuestion }}</dd>
              </div>
              <div v-if="course.filmById.get(t.example.filmId)" class="entry__part">
                <dt>
                  Пример —
                  <RouterLink :to="{ name: 'film', params: { filmId: t.example.filmId } }">
                    {{ course.filmById.get(t.example.filmId)?.title }}
                  </RouterLink>
                </dt>
                <dd>
                  <DisclosurePanel v-if="t.example.spoiler" summary="Пример касается финала" spoiler class="entry__spoiler">
                    <p>{{ t.example.text }}</p>
                  </DisclosurePanel>
                  <template v-else>{{ t.example.text }}</template>
                </dd>
              </div>
              <div v-if="lessons.get(t.id)?.all.length" class="entry__part">
                <dt>
                  В уроках <span class="entry__count">({{ lessons.get(t.id)?.all.length }})</span>
                </dt>
                <dd>
                  <ul class="lessons">
                    <li v-for="film in lessons.get(t.id)?.shown" :key="film.id">
                      <RouterLink :to="{ name: 'film', params: { filmId: film.id } }" class="lesson">
                        <span class="lesson__level">ур. {{ film.levelNumber }}</span>
                        {{ film.title }}
                      </RouterLink>
                    </li>
                    <li v-if="lessons.get(t.id)?.hidden">
                      <button type="button" class="lesson lesson--more" @click="expand(t.id)">
                        Ещё {{ lessons.get(t.id)?.hidden }}
                      </button>
                    </li>
                  </ul>
                </dd>
              </div>
            </dl>
          </article>
        </li>
      </ul>
    </section>

    <div v-if="!sections.length" class="empty">
      <InkVignette name="signpost" class="empty__art" />
      <div>
        <h2 class="empty__title">Ничего не нашлось</h2>
        <p>Попробуйте другое слово — поиск идёт по всей статье и по названию фильма из примера.</p>
        <AppButton variant="secondary" class="empty__reset" @click="resetFilters">Сбросить фильтры</AppButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.glossary {
  display: grid;
  gap: 1.25rem;
  padding-top: clamp(1.5rem, 4vw, 2.5rem);
}
.glossary__head {
  display: grid;
  grid-template-columns: minmax(0, 46rem) 8rem;
  justify-content: space-between;
  align-items: end;
  gap: 1.5rem;
}
.glossary__intro {
  display: grid;
  gap: 0.9rem;
}
.glossary__lead {
  font-size: clamp(1.05rem, 1rem + 0.3vw, 1.2rem);
  color: var(--ink-soft);
}
.glossary__level {
  max-width: var(--measure);
  color: var(--ink-soft);
}

.filters {
  display: grid;
  /* Названия уровней длинные («3. Кадр, композиция и мизансцена») — список не уже поиска. */
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.9rem 1rem;
  max-width: 52rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--paper-sunken);
}

.results {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  max-width: 52rem;
  min-height: 2.75rem;
}
.results:has(> .results__count:empty) {
  display: none;
}
.results__count {
  font-family: var(--font-accent);
  font-size: 0.95rem;
  color: var(--ink-soft);
}

/* ---------- Оглавление тем ---------- */

.toc__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0;
  list-style: none;
}
.toc__item {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.75rem;
  padding: 0.3rem 0.95rem;
  border: 1px solid color-mix(in srgb, var(--tint-ink) 35%, transparent);
  border-radius: 999px;
  background: var(--tint);
  color: var(--ink);
  font: inherit;
  cursor: pointer;
}
.toc__item:hover {
  border-color: var(--tint-ink);
  color: var(--tint-ink);
}
.toc__count {
  font-family: var(--font-accent);
  font-size: 0.85rem;
  color: var(--ink-faint);
}

/* ---------- Темы и статьи ---------- */

.group {
  display: grid;
  gap: 1rem;
}
.group__title {
  font-size: clamp(1.5rem, 1.25rem + 0.9vw, 1.95rem);
  color: var(--tint-ink);
}
.group__title:focus-visible {
  outline-offset: 6px;
}
.group__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 30rem), 1fr));
  gap: 1rem;
  padding: 0;
  list-style: none;
}
.group__list > li {
  display: grid;
}

.entry {
  display: grid;
  align-content: start;
  gap: 0.85rem;
  padding: clamp(1rem, 3vw, 1.4rem);
  border: 1px solid color-mix(in srgb, var(--tint-ink) 18%, var(--line));
  border-top: 4px solid color-mix(in srgb, var(--tint-ink) 45%, var(--tint));
  border-radius: var(--radius-m);
  background: linear-gradient(180deg, color-mix(in srgb, var(--tint) 70%, var(--paper-raised)), var(--paper-raised) 9rem);
  box-shadow: var(--shadow);
  scroll-margin-top: 1rem;
}
/* Статья, к которой пришли по ссылке из урока или уровня. */
.entry--current {
  border-color: var(--accent);
  border-top-color: var(--accent);
  background: linear-gradient(var(--accent-wash), var(--accent-wash)), var(--paper-raised);
}
.entry:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
}
.entry:focus:not(:focus-visible),
.entry--current:focus {
  outline: none;
}
.entry__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.75rem;
}
.entry__term {
  font-size: 1.75rem;
}
.entry__aka {
  font-family: var(--font-accent);
  font-size: 0.88rem;
  color: var(--ink-soft);
}
.entry__simple {
  font-size: 1.05rem;
}
.entry__parts {
  display: grid;
  gap: 0.75rem;
  margin: 0;
}
.entry__part {
  display: grid;
  gap: 0.2rem;
}
.entry__part dt {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.15rem;
  color: var(--ink-soft);
}
.entry__part dd {
  margin: 0;
  font-size: 0.97rem;
}
.entry__part--question dd {
  padding-left: 0.8rem;
  border-left: 2px solid var(--accent);
}
.entry__count {
  font-weight: 400;
  color: var(--ink-faint);
}
.entry__spoiler {
  margin-top: 0.15rem;
}

.lessons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.25rem;
  padding: 0;
  list-style: none;
}
.lesson {
  display: inline-flex;
  align-items: baseline;
  gap: 0.35rem;
  min-height: 2.5rem;
  padding: 0.45rem 0.8rem;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: var(--paper);
  color: var(--ink);
  font: inherit;
  font-size: 0.93rem;
  line-height: 1.3;
  text-decoration: none;
}
.lesson:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.lesson__level {
  flex: none;
  white-space: nowrap;
  font-family: var(--font-accent);
  font-size: 0.85rem;
  color: var(--ink-faint);
}
.lesson--more {
  border-style: dashed;
  color: var(--ink-soft);
  cursor: pointer;
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
.empty__reset {
  margin-top: 0.75rem;
}

@media (max-width: 40rem) {
  .glossary__head {
    grid-template-columns: minmax(0, 1fr);
  }
  .glossary__art {
    display: none;
  }
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
