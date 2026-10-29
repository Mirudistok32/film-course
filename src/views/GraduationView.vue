<script setup lang="ts">
/**
 * Выпускная работа (ТЗ §6, уровень 13): самостоятельный формальный анализ
 * фильма или 2–3 сцен. Главный вопрос → минимум три формальных решения
 * с эффектом → связь решений → итоговая интерпретация.
 *
 * Критерии завершения видны с самого начала и обновляются по мере записи.
 * В строгом порядке, пока закрыт уровень 13, работа доступна только для чтения.
 */
import { computed, nextTick, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import {
  addGraduationDecision,
  completeGraduation,
  removeGraduationDecision,
  setGraduationDecision,
  updateGraduation,
} from '@/domain/progress/progress.actions'
import { GRADUATION_MIN_DECISIONS } from '@/domain/progress/progress.defaults'
import {
  GRADUATION_STATUS_LABEL,
  graduationCriteria,
  graduationStatus,
  isLevelLocked,
  notesForFilm,
} from '@/domain/progress/progress.selectors'
import type { GraduationDecision, GraduationWork } from '@/domain/progress/progress.types'
import { XP_RULES } from '@/domain/rewards/rewards.config'
import { formatDate } from '@/domain/shared/dates'
import { isMeaningful, plural } from '@/domain/shared/text'
import AnswerField from '@/components/AnswerField.vue'
import AppButton from '@/components/AppButton.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import CriteriaList from '@/components/CriteriaList.vue'
import DisclosurePanel from '@/components/DisclosurePanel.vue'
import FilmSelect from '@/components/FilmSelect.vue'
import HankoStamp from '@/illustrations/HankoStamp.vue'

const store = useProgressStore()
const course = computed(() => store.course)
const p = computed(() => store.progress)
const g = computed(() => p.value.graduation)

const lastLevel = computed(() => course.value.levels[course.value.levels.length - 1])
const locked = computed(() => (lastLevel.value ? isLevelLocked(course.value, lastLevel.value, p.value) : false))
const criteria = computed(() => graduationCriteria(p.value))
const metCount = computed(() => criteria.value.filter((c) => c.met).length)
const canComplete = computed(() => metCount.value === criteria.value.length && !locked.value)
const status = computed(() => graduationStatus(p.value))

const film = computed(() => (g.value.filmId ? course.value.filmById.get(g.value.filmId) : undefined))
const filmNotes = computed(() => (film.value ? notesForFilm(p.value, film.value.id).length : 0))
const levelsLeft = computed(() => course.value.levels.filter((l) => !p.value.levels[l.id]?.completedAt).length)

type TextKey = 'subject' | 'mainQuestion' | 'connections' | 'interpretation'

function field(key: TextKey) {
  return computed({
    get: () => g.value[key],
    set: (text: string) => store.apply((q, now) => updateGraduation(q, { [key]: text }, now), 'debounced'),
  })
}

const subject = field('subject')
const mainQuestion = field('mainQuestion')
const connections = field('connections')
const interpretation = field('interpretation')

const filmId = computed({
  get: () => g.value.filmId ?? '',
  set: (id: string) => store.apply((q, now) => updateGraduation(q, { filmId: id || null }, now)),
})

function setDecision(index: number, key: keyof GraduationDecision, text: string) {
  store.apply((q, now) => setGraduationDecision(q, index, { [key]: text }, now), 'debounced')
}

/* ---------- Решения: добавить и убрать ---------- */

const decisionList = ref<HTMLElement | null>(null)

async function addDecision() {
  store.apply((q, now) => addGraduationDecision(q, now))
  await nextTick()
  const items = decisionList.value?.querySelectorAll('textarea')
  // Первое поле нового решения — предпоследнее в списке.
  items?.[items.length - 2]?.focus()
}

const pendingRemove = ref<number | null>(null)

function askRemove(index: number) {
  const d = g.value.decisions[index]
  if (d && (isMeaningful(d.observation, 1) || isMeaningful(d.effect, 1))) pendingRemove.value = index
  else removeDecision(index)
}

function removeDecision(index: number) {
  pendingRemove.value = null
  store.apply((q, now) => removeGraduationDecision(q, index, now))
  message.value = 'Решение убрано.'
}

/* ---------- Завершение ---------- */

const message = ref('')

function finish() {
  if (!canComplete.value) return
  store.apply((q, now) => completeGraduation(q, now))
  if (g.value.completedAt) {
    message.value =
      levelsLeft.value > 0
        ? `Выпускная работа завершена. Чтобы курс считался пройденным, осталось завершить ${levelsLeft.value} ${plural(levelsLeft.value, ['уровень', 'уровня', 'уровней'])}.`
        : 'Выпускная работа завершена — курс пройден. Её можно дополнять и дальше.'
  }
}

const DECISION_KINDS = 'кадр и композиция, монтаж, движение камеры, свет и цвет, звук или тишина, пространство, жест и тело, время'

const decisionLabel = (i: number) => `Решение ${i + 1}${i < GRADUATION_MIN_DECISIONS ? '' : ' (дополнительное)'}`
const filled = (d: GraduationWork['decisions'][number]) => isMeaningful(d.observation, 10) && isMeaningful(d.effect, 10)
</script>

<template>
  <div class="grad container">
    <header class="grad__head">
      <p class="grad__crumbs">
        <RouterLink :to="{ name: 'course' }">Карта курса</RouterLink>
        <template v-if="lastLevel">
          <span aria-hidden="true"> · </span>
          <RouterLink :to="{ name: 'level', params: { levelId: lastLevel.id } }">Уровень {{ lastLevel.number }}</RouterLink>
        </template>
      </p>
      <p class="eyebrow">Финал курса</p>
      <h1>Выпускная работа</h1>
      <p class="grad__lead">
        Самостоятельный формальный анализ фильма или двух-трёх его сцен. Здесь нет правильного ответа: важно, чтобы
        интерпретация вырастала из того, что видно и слышно на экране, а не из пересказа сюжета.
      </p>
      <p class="grad__status">Статус: <strong>{{ GRADUATION_STATUS_LABEL[status] }}</strong></p>
    </header>

    <p v-if="locked && lastLevel" class="grad__locked" role="note">
      Включён строгий порядок: работа откроется для записи, когда будет пройден уровень {{ lastLevel.number - 1 }}.
      Пока её можно прочитать и продумать.
      <RouterLink :to="{ name: 'data' }">Изменить в настройках</RouterLink>
    </p>

    <div class="grad__layout">
      <aside class="grad__aside" aria-labelledby="criteria-title">
        <div class="card criteria-card" data-tint="lavender">
          <h2 id="criteria-title" class="criteria-card__title">Что нужно для завершения</h2>
          <p class="criteria-card__count">Выполнено {{ metCount }} из {{ criteria.length }}</p>
          <CriteriaList :criteria="criteria" />
          <p class="criteria-card__note">
            Объём не важен — важна опора на конкретные кадры и звуки.<template v-if="store.settings.showGamification">
              За завершение — {{ XP_RULES.graduationCompleted }} XP и достижения «Аргумент, а не впечатление»,
              «Собственная мысль».</template>
          </p>
        </div>
      </aside>

      <div class="grad__work">
        <section class="part" aria-labelledby="part-subject">
          <h2 id="part-subject" class="part__title"><span class="part__num">1</span> Фильм и сцены</h2>
          <FilmSelect
            v-if="!locked"
            v-model="filmId"
            label="Фильм из курса"
            empty-label="Фильм не из курса или ещё не выбран"
          />
          <p v-if="film" class="part__film">
            <RouterLink :to="{ name: 'film', params: { filmId: film.id } }">Урок «{{ film.title }}»</RouterLink>
            <template v-if="filmNotes">
              ·
              <RouterLink :to="{ name: 'journal', query: { film: film.id } }">
                ваши записи о фильме: {{ filmNotes }}
              </RouterLink>
            </template>
          </p>
          <AnswerField
            v-model="subject"
            label="Что вы разбираете"
            hint="Название фильма и две-три сцены. Опишите их так, чтобы их можно было найти: где в фильме, что в кадре."
            :rows="3"
            :readonly="locked"
          />
        </section>

        <section class="part" aria-labelledby="part-question">
          <h2 id="part-question" class="part__title"><span class="part__num">2</span> Главный вопрос</h2>
          <AnswerField
            v-model="mainQuestion"
            label="Вопрос, на который отвечает анализ"
            hint="Не «о чём фильм», а «как фильм добивается…» или «почему мы чувствуем…». Один вопрос, который держит всю работу."
            :rows="2"
            :readonly="locked"
          />
        </section>

        <section class="part" aria-labelledby="part-decisions">
          <h2 id="part-decisions" class="part__title"><span class="part__num">3</span> Формальные решения</h2>
          <p class="part__lead">
            Минимум {{ GRADUATION_MIN_DECISIONS }} конкретных решения фильма: {{ DECISION_KINDS }}. Для каждого — что
            именно сделано и какой эффект это производит на зрителя.
          </p>
          <DisclosurePanel summary="Как может выглядеть одно решение">
            <p><strong>Что сделано:</strong> в сценах в доме героиню снимают через дверные проёмы, всегда на дальнем плане.</p>
            <p><strong>Эффект:</strong> кажется, что мы подглядываем, а она заперта в собственном доме.</p>
            <p class="muted">Пример формы ответа — не про конкретный фильм.</p>
          </DisclosurePanel>

          <ol ref="decisionList" class="decisions">
            <li v-for="(d, i) in g.decisions" :key="i" class="decision" :class="{ 'decision--filled': filled(d) }">
              <fieldset class="decision__set">
                <legend class="decision__legend">
                  {{ decisionLabel(i) }}
                  <span class="decision__state">— {{ filled(d) ? 'описано' : 'ещё нет' }}</span>
                </legend>
                <AnswerField
                  :model-value="d.observation"
                  label="Что сделано"
                  :rows="2"
                  :readonly="locked"
                  @update:model-value="setDecision(i, 'observation', $event)"
                />
                <AnswerField
                  :model-value="d.effect"
                  label="Какой эффект это производит"
                  :rows="2"
                  :readonly="locked"
                  @update:model-value="setDecision(i, 'effect', $event)"
                />
              </fieldset>
              <AppButton
                v-if="!locked && g.decisions.length > GRADUATION_MIN_DECISIONS"
                variant="ghost"
                class="decision__remove"
                @click="askRemove(i)"
              >
                Убрать решение {{ i + 1 }}
              </AppButton>
            </li>
          </ol>
          <AppButton v-if="!locked" @click="addDecision">Добавить решение</AppButton>
        </section>

        <section class="part" aria-labelledby="part-connections">
          <h2 id="part-connections" class="part__title"><span class="part__num">4</span> Связь решений</h2>
          <AnswerField
            v-model="connections"
            label="Как решения работают вместе"
            hint="Что общего у этих решений? Усиливают ли они друг друга, спорят ли? Без этого шага анализ остаётся списком наблюдений."
            :rows="4"
            :readonly="locked"
          />
        </section>

        <section class="part" aria-labelledby="part-interpretation">
          <h2 id="part-interpretation" class="part__title"><span class="part__num">5</span> Итоговая интерпретация</h2>
          <AnswerField
            v-model="interpretation"
            label="Ваш ответ на главный вопрос"
            hint="Опирайтесь на решения из шага 3 и называйте сцены. Можно оставить открытый вопрос — это честнее, чем натянутый вывод."
            :rows="7"
            :readonly="locked"
          />
        </section>

        <section class="card finish" data-tint="mint" aria-labelledby="finish-title">
          <h2 id="finish-title">Завершение</h2>
          <div v-if="g.completedAt" class="finish__done">
            <HankoStamp class="finish__stamp" text="работа завершена" :center="lastLevel ? String(lastLevel.number) : '✓'" />
            <p>
              <strong>Выпускная работа завершена</strong> ({{ formatDate(g.completedAt) }}). Завершение не отменяется:
              текст можно дополнять и переписывать.
            </p>
          </div>
          <template v-else-if="!locked">
            <div class="finish__action">
              <AppButton variant="primary" :disabled="!canComplete" aria-describedby="finish-hint" @click="finish">
                Завершить выпускную работу
              </AppButton>
              <p id="finish-hint" class="finish__hint">
                <template v-if="canComplete">Все условия выполнены.</template>
                <template v-else>
                  Кнопка станет доступна, когда будут выполнены все условия: сейчас {{ metCount }} из
                  {{ criteria.length }}.
                </template>
              </p>
            </div>
          </template>
          <p v-else class="muted">Завершить работу можно будет после уровня {{ (lastLevel?.number ?? 1) - 1 }}.</p>
          <p class="finish__message" role="status">{{ message }}</p>
        </section>
      </div>
    </div>

    <ConfirmDialog
      :open="pendingRemove !== null"
      :title="`Убрать решение ${(pendingRemove ?? 0) + 1}?`"
      confirm-label="Убрать"
      danger
      @confirm="pendingRemove !== null && removeDecision(pendingRemove)"
      @cancel="pendingRemove = null"
    >
      <p>Текст этого решения будет удалён. Остальные решения останутся.</p>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.grad {
  display: grid;
  gap: 2rem;
  padding-top: clamp(1.5rem, 4vw, 2.5rem);
}
.grad__head {
  display: grid;
  gap: 0.6rem;
  max-width: var(--measure);
}
.grad__crumbs {
  font-size: 0.93rem;
}
.grad__lead {
  font-size: 1.1rem;
  color: var(--ink-soft);
}
.grad__locked {
  max-width: var(--measure);
  padding: 0.75rem 1rem;
  border-left: 3px solid var(--gold);
  background: var(--paper-sunken);
}

.grad__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(16rem, 20rem);
  grid-template-areas: 'work aside';
  gap: 2rem 3rem;
  align-items: start;
}
.grad__work {
  grid-area: work;
  display: grid;
  gap: 2.25rem;
  max-width: 46rem;
}
.grad__aside {
  grid-area: aside;
  position: sticky;
  top: 1rem;
}

.criteria-card {
  display: grid;
  gap: 0.75rem;
}
.criteria-card__title {
  font-size: 1.35rem;
}
.criteria-card__count {
  font-weight: 600;
  color: var(--tint-ink);
}
.criteria-card__note {
  font-size: 0.9rem;
  color: var(--ink-soft);
}

.part {
  display: grid;
  gap: 1rem;
}
.part__title {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--line-strong);
}
.part__num {
  font-variant-numeric: lining-nums;
  font-family: var(--font-accent);
  color: var(--accent);
}
.part__lead {
  color: var(--ink-soft);
}
.part__film {
  font-size: 0.95rem;
}

.decisions {
  display: grid;
  gap: 1.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.decision {
  display: grid;
  gap: 0.5rem;
  justify-items: start;
  padding: 1rem;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-m);
}
.decision--filled {
  border-style: solid;
  border-color: var(--moss);
  background: var(--moss-wash);
}
.decision__set {
  display: grid;
  gap: 0.9rem;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
}
.decision__legend {
  padding: 0;
  margin-bottom: 0.4rem;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.45rem;
  font-variant-numeric: lining-nums;
}
.decision__state {
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: 400;
  color: var(--ink-soft);
}
.decision--filled .decision__state {
  color: var(--moss);
  font-weight: 600;
}
.decision :deep(.answer__label) {
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: 560;
}

.finish {
  display: grid;
  gap: 1rem;
}
.finish__action {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
}
.finish__hint {
  font-size: 0.92rem;
  color: var(--ink-soft);
}
.finish__done {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.finish__stamp {
  --hanko-size: 4.5rem;
  flex: none;
}
.finish__message:empty {
  display: none;
}
.finish__message {
  font-weight: 560;
  color: var(--moss);
}

@media (max-width: 56rem) {
  .grad__layout {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'aside' 'work';
  }
  .grad__aside {
    position: static;
  }
}
</style>
