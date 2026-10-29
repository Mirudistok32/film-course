<script setup lang="ts">
/**
 * Достижения (ТЗ §15–20): ранг и путь к следующему, откуда набран опыт,
 * ачивки по группам и спокойная активность без стриков. Форма значка
 * подсказывает группу, статус всегда написан словами (§34).
 *
 * Если игровые элементы скрыты, ранги, XP и ачивки не показываются —
 * страница объясняет это и даёт включить их снова. Активность остаётся:
 * это учёт занятий, а не награда.
 */
import { computed } from 'vue'
import { useProgressStore } from '@/stores/progress'
import { updateSettings } from '@/domain/progress/progress.actions'
import { activityStats } from '@/domain/progress/progress.selectors'
import { ACHIEVEMENT_GROUPS, XP_RULE_LABELS } from '@/domain/rewards/rewards.config'
import { achievementBoard, rankFor, rankLadder, xpBreakdown, type RankState } from '@/domain/rewards/rewards.engine'
import { formatDate } from '@/domain/shared/dates'
import { plural } from '@/domain/shared/text'
import type { Tint } from '@/domain/shared/tint'
import AppButton from '@/components/AppButton.vue'
import ProgressMeter from '@/components/ProgressMeter.vue'
import AchievementSeal from '@/illustrations/AchievementSeal.vue'
import InkDivider from '@/illustrations/InkDivider.vue'

const store = useProgressStore()
const p = computed(() => store.progress)
const gamified = computed(() => store.settings.showGamification)

const rank = computed(() => rankFor(p.value.xp))
const ladder = computed(() => rankLadder(p.value.xp))
const xpRows = computed(() => xpBreakdown(p.value.xpLedger))
const board = computed(() => achievementBoard(p.value))
const activity = computed(() => activityStats(p.value, store.now()))

const RANK_STATE_LABEL: Record<RankState, string> = { passed: 'пройден', current: 'сейчас', ahead: 'впереди' }
const GROUP_LEGEND = Object.values(ACHIEVEMENT_GROUPS)
/** Пастель группы — украшение; группу различают форма значка и заголовок. */
const GROUP_TINT: Record<keyof typeof ACHIEVEMENT_GROUPS, Tint> = {
  'first-steps': 'rose',
  explorer: 'sky',
  course: 'mint',
  mastery: 'lavender',
}

const nextRankLabel = computed(() => {
  const { rank: r, next } = rank.value
  if (!next) return 'Это последний ранг курса. Опыт продолжает копиться, но ранг выше не нужен.'
  return `До ранга «${next.title}» — ${next.minXp - p.value.xp} XP (${p.value.xp - r.minXp} из ${next.minXp - r.minXp})`
})

const days = (n: number) => plural(n, ['день', 'дня', 'дней'])
const weeks = (n: number) => plural(n, ['неделя', 'недели', 'недель'])
const times = (n: number) => plural(n, ['раз', 'раза', 'раз'])
const films = (n: number) => plural(n, ['фильм', 'фильма', 'фильмов'])

function setGamification(on: boolean) {
  store.apply((prev) => updateSettings(prev, { showGamification: on }))
}

function setWeeklyGoal(on: boolean) {
  store.apply((prev) => updateSettings(prev, { weeklyGoal: on }))
}
</script>

<template>
  <div class="ach container">
    <header class="ach__head">
      <p class="eyebrow">Ранги · достижения · активность</p>
      <h1>Достижения</h1>
      <p class="ach__lead">
        Ранг — метафора накопленного опыта, а не оценка способностей. Опыт и открытые достижения не сгорают:
        перерывы ничего не отнимают, а повторные действия не начисляют очки второй раз.
      </p>
    </header>

    <section v-if="!gamified" class="card hidden-note" aria-labelledby="hidden-title">
      <h2 id="hidden-title" class="card__title">Игровые элементы скрыты</h2>
      <p class="muted">
        Вы выключили ранги, очки опыта и достижения. Они продолжают считаться в фоне — ваш прогресс не теряется,
        и при включении всё появится с настоящими датами открытия.
      </p>
      <div class="hidden-note__actions">
        <AppButton variant="primary" @click="setGamification(true)">Показать ранги и достижения</AppButton>
      </div>
    </section>

    <template v-else>
      <section class="rank" aria-labelledby="rank-title">
        <article class="card rank__now" data-tint="butter">
          <p class="eyebrow">Ваш ранг</p>
          <h2 id="rank-title" class="rank__title">{{ rank.rank.title }}</h2>
          <p class="rank__xp"><strong>{{ p.xp }}</strong> XP опыта</p>
          <ProgressMeter
            v-if="rank.next"
            :value="p.xp - rank.rank.minXp"
            :max="rank.next.minXp - rank.rank.minXp"
            :label="nextRankLabel"
          />
          <p v-else class="muted">{{ nextRankLabel }}</p>
        </article>

        <div class="rank__ladder">
          <h3>Семь рангов курса</h3>
          <ol class="ladder">
            <li v-for="{ rank: r, state } in ladder" :key="r.id" class="step" :class="`step--${state}`">
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <circle cx="8" cy="8" r="6" class="step__ring" />
                <circle v-if="state === 'current'" cx="8" cy="8" r="3" class="step__dot" />
                <path v-if="state === 'passed'" d="M5 8.2l2 2 4-4.2" class="step__check" />
              </svg>
              <span class="step__title">{{ r.title }}</span>
              <span class="step__meta">
                {{ RANK_STATE_LABEL[state] }}<template v-if="r.minXp > 0"> · от {{ r.minXp }} XP</template>
              </span>
            </li>
          </ol>
        </div>
      </section>

      <section class="xp" aria-labelledby="xp-title">
        <h2 id="xp-title">Как набирается опыт</h2>
        <p class="muted prose">
          Очки дают проверяемые шаги, а не клики: правка опечатки, повторное открытие урока или повторный импорт
          того же файла ничего не добавляют.
        </p>
        <table class="xp__table">
          <thead>
            <tr>
              <th scope="col">За что</th>
              <th scope="col">Очки</th>
              <th scope="col">У вас</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in xpRows" :key="row.rule">
              <th scope="row">{{ XP_RULE_LABELS[row.rule] }}</th>
              <td>+{{ row.amount }} XP</td>
              <td>
                <template v-if="row.count">
                  <span class="xp__part">{{ row.count }} {{ times(row.count) }} ·</span>
                  {{ ' ' }}<span class="xp__part">{{ row.total }} XP</span>
                </template>
                <span v-else class="muted">пока нет</span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <InkDivider />

      <section class="board" aria-labelledby="board-title">
        <div class="board__head">
          <h2 id="board-title">Достижения</h2>
          <ProgressMeter
            :value="board.unlocked"
            :max="board.total"
            :frame-limit="0"
            :label="`Открыто ${board.unlocked} из ${board.total}`"
          />
          <p class="board__legend">
            Форма значка подсказывает раздел. Открытый значок — оттиск с датой, закрытый — пунктирный контур
            с подсказкой, как его получить.
          </p>
          <ul class="legend">
            <li v-for="g in GROUP_LEGEND" :key="g.figure">
              <AchievementSeal :figure="g.figure" unlocked :tilt="0" class="legend__seal" />
              <span>{{ g.shape }} — {{ g.title.toLowerCase() }}</span>
            </li>
          </ul>
        </div>

        <section v-for="s in board.sections" :key="s.group" class="group" :data-tint="GROUP_TINT[s.group]" :aria-labelledby="`group-${s.group}`">
          <h3 :id="`group-${s.group}`" class="group__title">
            {{ s.title }}
            <span class="group__count">{{ s.unlocked }} из {{ s.cards.length }} · {{ s.shape }}</span>
          </h3>
          <ul class="group__list">
            <li
              v-for="{ achievement: a, unlockedAt } in s.cards"
              :key="a.id"
              class="ach-card"
              :class="{ 'ach-card--on': unlockedAt }"
            >
              <AchievementSeal :figure="s.figure" :unlocked="Boolean(unlockedAt)" />
              <div class="ach-card__body">
                <h4 class="ach-card__title">{{ a.title }}</h4>
                <p class="ach-card__state">
                  <template v-if="unlockedAt">Открыто {{ formatDate(unlockedAt) }}</template>
                  <template v-else>Ещё не открыто</template>
                </p>
                <p class="ach-card__text">
                  <template v-if="unlockedAt">{{ a.description }}</template>
                  <template v-else>Как получить: {{ a.hint }}</template>
                </p>
              </div>
            </li>
          </ul>
        </section>
      </section>
    </template>

    <InkDivider />

    <section class="activity" aria-labelledby="activity-title">
      <h2 id="activity-title">Активность</h2>
      <p class="muted prose">
        Здесь нет серий и штрафов: вдумчивый просмотр требует времени, и пропущенный день — не провал.
      </p>
      <dl class="activity__stats">
        <div class="stat">
          <dt>Учебных дней за всё время</dt>
          <dd>{{ activity.activeDays }} <span>{{ days(activity.activeDays) }}</span></dd>
        </div>
        <div class="stat">
          <dt>Недель, когда вы возвращались к курсу</dt>
          <dd>{{ activity.activeWeeks }} <span>{{ weeks(activity.activeWeeks) }}</span></dd>
        </div>
        <div class="stat">
          <dt>Просмотрено на этой неделе</dt>
          <dd>{{ activity.watchedThisWeek }} <span>{{ films(activity.watchedThisWeek) }}</span></dd>
        </div>
      </dl>

      <div class="card goal" data-tint="mint" :class="{ 'goal--met': store.settings.weeklyGoal && activity.watchedThisWeek > 0 }">
        <h3>Личная цель «один фильм в неделю»</h3>
        <template v-if="store.settings.weeklyGoal">
          <p v-if="activity.watchedThisWeek > 0" class="goal__state">
            Цель этой недели выполнена: просмотрено {{ activity.watchedThisWeek }} {{ films(activity.watchedThisWeek) }}.
          </p>
          <p v-else class="goal__state">
            На этой неделе фильм ещё не отмечен. Неделя не закончилась — а если и закончится, ничего не сгорит.
          </p>
          <AppButton variant="ghost" @click="setWeeklyGoal(false)">Убрать цель</AppButton>
        </template>
        <template v-else>
          <p class="muted">
            Мягкий ориентир для привычки: без напоминаний и наказаний за перерывы. Считаются фильмы, отмеченные
            просмотренными с понедельника.
          </p>
          <AppButton @click="setWeeklyGoal(true)">Поставить цель</AppButton>
        </template>
      </div>
    </section>

    <p v-if="gamified" class="ach__off">
      Ранги и достижения мешают?
      <button type="button" class="link-btn" @click="setGamification(false)">Скрыть игровые элементы</button>
      — прогресс курса не изменится.
    </p>
  </div>
</template>

<style scoped>
.ach {
  display: grid;
  gap: 2rem;
  padding-top: clamp(1.5rem, 4vw, 2.5rem);
}
.ach__head {
  display: grid;
  gap: 0.6rem;
  max-width: var(--measure);
}
.ach__lead {
  font-size: 1.1rem;
  color: var(--ink-soft);
}
.card__title {
  font-size: 1.6rem;
}

.hidden-note {
  display: grid;
  gap: 0.8rem;
  max-width: var(--measure);
}
.hidden-note__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

/* ---------- Ранг ---------- */
.rank {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 1.5rem 2.5rem;
  align-items: start;
}
.rank__now {
  display: grid;
  gap: 0.75rem;
}
.rank__title {
  font-size: clamp(1.8rem, 1.4rem + 1.4vw, 2.4rem);
  line-height: 1.05;
}
.rank__xp strong {
  font-family: var(--font-display);
  font-variant-numeric: lining-nums;
  font-size: 1.6rem;
  color: var(--gold);
}
.rank__ladder h3 {
  margin-bottom: 0.6rem;
}
.ladder {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}
.step {
  display: grid;
  grid-template-columns: 1.25rem minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 0.25rem 0.7rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--line);
}
.step svg {
  width: 1.25rem;
  height: 1.25rem;
  align-self: center;
}
.step__ring {
  fill: none;
  stroke: var(--line-strong);
  stroke-width: 1.5;
}
.step__dot {
  fill: var(--accent);
}
.step__check {
  fill: none;
  stroke: var(--moss);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.step--passed .step__ring {
  stroke: var(--moss);
  fill: var(--moss-wash);
}
.step--current .step__ring {
  stroke: var(--accent);
  stroke-width: 2;
}
.step__title {
  font-family: var(--font-display);
  font-size: 1.2rem;
}
.step--current .step__title {
  font-weight: 600;
}
.step--ahead .step__title {
  color: var(--ink-soft);
}
.step__meta {
  font-size: 0.88rem;
  color: var(--ink-soft);
  white-space: nowrap;
}
.step--current .step__meta {
  color: var(--accent);
  font-weight: 600;
}

/* ---------- Опыт ---------- */
.xp {
  display: grid;
  gap: 0.75rem;
}
.xp__table {
  width: 100%;
  max-width: 48rem;
  border-collapse: collapse;
  font-size: 0.97rem;
}
.xp__table th,
.xp__table td {
  padding: 0.55rem 0.75rem 0.55rem 0;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: baseline;
}
.xp__table thead th {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink-soft);
  border-bottom-color: var(--line-strong);
}
.xp__table tbody th {
  font-weight: 400;
}
.xp__table td {
  white-space: nowrap;
}
/* На телефоне «2 раза · 20 XP» переносится только целыми частями. */
.xp__part {
  white-space: nowrap;
}

/* ---------- Ачивки ---------- */
.board {
  display: grid;
  gap: 1.75rem;
}
.board__head {
  display: grid;
  gap: 0.75rem;
  max-width: 48rem;
}
.board__legend {
  font-size: 0.95rem;
  color: var(--ink-soft);
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.93rem;
}
.legend li {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.legend__seal {
  --seal-size: 1.5rem;
}
.group {
  display: grid;
  gap: 0.9rem;
}
.group__title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.75rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--line-strong);
}
.group__count {
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 400;
  color: var(--ink-soft);
}
.group__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.ach-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.9rem;
  align-items: start;
  padding: 1rem;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-m);
}
.ach-card--on {
  border-style: solid;
  border-color: color-mix(in srgb, var(--tint-ink) 25%, var(--line));
  background: linear-gradient(135deg, var(--tint), var(--paper-raised) 70%);
  box-shadow: var(--edge), var(--shadow);
}
.ach-card__body {
  display: grid;
  gap: 0.2rem;
}
.ach-card__title {
  font-size: 1.15rem;
}
.ach-card__state {
  font-size: 0.85rem;
  color: var(--ink-soft);
}
/* Цвет группы, а не киноварь: на подсвеченной заливке «кинозала» киноварь бледнеет до 3.7:1. */
.ach-card--on .ach-card__state {
  color: var(--tint-ink);
  font-weight: 600;
}
.ach-card__text {
  font-size: 0.93rem;
}
.ach-card:not(.ach-card--on) .ach-card__text {
  color: var(--ink-soft);
}

/* ---------- Активность ---------- */
.activity {
  display: grid;
  gap: 1rem;
}
.activity__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
  gap: 1rem;
  margin: 0;
}
.stat {
  display: flex;
  flex-direction: column-reverse;
  justify-content: flex-end;
  gap: 0.2rem;
  padding: 0.9rem 0 0.9rem;
  border-top: 2px solid var(--ink);
}
.stat dt {
  font-size: 0.93rem;
  color: var(--ink-soft);
}
.stat dd {
  margin: 0;
  font-family: var(--font-display);
  font-variant-numeric: lining-nums;
  font-size: 2.4rem;
  line-height: 1;
}
.stat dd span {
  font-size: 1.1rem;
  color: var(--ink-soft);
}
.goal {
  display: grid;
  gap: 0.6rem;
  justify-items: start;
  max-width: var(--measure);
}
.goal--met {
  border-color: var(--tint-mint-ink);
}
.goal__state {
  font-weight: 560;
}

.ach__off {
  font-size: 0.93rem;
  color: var(--ink-soft);
}
.link-btn {
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 0.15em;
  cursor: pointer;
}

@media (max-width: 52rem) {
  .rank {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 30rem) {
  .xp__table td:last-child {
    white-space: normal;
  }
  .step {
    grid-template-columns: 1.25rem minmax(0, 1fr);
  }
  .step__meta {
    grid-column: 2;
  }
}
</style>
