<script setup lang="ts">
/**
 * Основное упражнение фильма (ТЗ §12.5–12.6): задача, на что смотреть,
 * шаги, личный ответ, самопроверка и образец разбора. Образец раскрывается
 * только по действию пользователя; оценивается ход мысли, а не совпадение
 * с «правильной» трактовкой. Отметка «выполнено» ставит печать: с оттиском —
 * только сразу после нажатия.
 */
import { computed, ref, watch } from 'vue'
import { useProgressStore } from '@/stores/progress'
import {
  canCompleteExercise,
  completeExercise,
  markSampleOpened,
  setExerciseResponse,
  toggleChecklistItem,
} from '@/domain/progress/progress.actions'
import { selfCheckItems } from '@/domain/catalog/catalog'
import type { Exercise, SampleAnalysis } from '@/domain/catalog/catalog.types'
import { XP_RULES } from '@/domain/rewards/rewards.config'
import { formatDate } from '@/domain/shared/dates'
import { isMeaningful } from '@/domain/shared/text'
import AnswerField from '@/components/AnswerField.vue'
import AppButton from '@/components/AppButton.vue'
import DisclosurePanel from '@/components/DisclosurePanel.vue'
import HankoStamp from '@/illustrations/HankoStamp.vue'

const props = withDefaults(
  defineProps<{
    filmId: string
    exercise: Exercise
    samples: SampleAnalysis[]
    readonly?: boolean
  }>(),
  { readonly: false },
)

const store = useProgressStore()
const fp = computed(() => store.progress.films[props.filmId])
const checks = computed(() => selfCheckItems(props.exercise))
const checked = computed(() => new Set(fp.value?.exercise.checklist ?? []))
const completedAt = computed(() => fp.value?.exercise.completedAt ?? null)
const canComplete = computed(() => canCompleteExercise(fp.value))
const hasAttempt = computed(() => isMeaningful(fp.value?.exercise.response, 1))
const message = ref('')
/** Упражнение отмечено на глазах — печать проигрывает оттиск. */
const pressed = ref(false)

// Страница фильма не пересоздаётся при переходе к соседнему фильму.
watch(
  () => props.filmId,
  () => {
    message.value = ''
    pressed.value = false
  },
)

const response = computed({
  get: () => fp.value?.exercise.response ?? '',
  set: (text: string) => {
    if (!props.readonly) store.apply((q, now) => setExerciseResponse(q, props.filmId, text, now), 'debounced')
  },
})

function toggle(index: number) {
  if (!props.readonly) store.apply((q, now) => toggleChecklistItem(q, props.filmId, index, now))
}

function finish() {
  if (props.readonly || !canComplete.value) return
  store.apply((q, now) => completeExercise(q, props.filmId, now))
  if (!completedAt.value) return
  pressed.value = true
  message.value = 'Упражнение отмечено выполненным. Ответ можно дополнять и дальше.'
}

function onSampleOpen() {
  if (!props.readonly) store.apply((q, now) => markSampleOpened(q, props.filmId, now))
}

const sampleSummary = (s: SampleAnalysis) =>
  props.samples.length > 1 ? `Посмотреть пример разбора: ${s.title}` : 'Посмотреть пример разбора'
</script>

<template>
  <section class="exercise card" aria-labelledby="exercise-title">
    <p class="eyebrow">Основное упражнение</p>
    <h3 id="exercise-title" class="exercise__title">{{ exercise.title }}</h3>
    <p class="exercise__task">{{ exercise.task }}</p>
    <p class="exercise__look"><strong>На что смотреть:</strong> {{ exercise.lookAt }}</p>

    <h4 class="exercise__subtitle">Шаги</h4>
    <ol class="exercise__steps">
      <li v-for="s in exercise.steps" :key="s">{{ s }}</li>
    </ol>

    <AnswerField
      v-model="response"
      label="Ваш ответ"
      hint="Несколько фраз по шагам выше. Сохраняется автоматически."
      :rows="5"
      :readonly="readonly"
    />

    <fieldset class="checks">
      <legend class="exercise__subtitle">Самопроверка</legend>
      <p class="checks__lead">Отметьте то, что уже есть в ответе. Это подсказка для вас, на прогресс не влияет.</p>
      <label v-for="(item, i) in checks" :key="item" class="check">
        <input type="checkbox" :checked="checked.has(i)" :disabled="readonly" @change="toggle(i)" />
        <span>{{ item }}</span>
      </label>
    </fieldset>

    <p v-if="exercise.advanced" class="exercise__advanced">
      <strong>Если хочется пойти дальше:</strong> {{ exercise.advanced }}
    </p>

    <div v-if="completedAt" class="exercise__done">
      <HankoStamp class="exercise__stamp" text="выполнено" :tilt="-4" :press="pressed" aria-hidden="true" />
      <span>Упражнение выполнено {{ formatDate(completedAt) }}</span>
    </div>
    <div v-else-if="!readonly" class="exercise__action">
      <AppButton variant="primary" :disabled="!canComplete" aria-describedby="exercise-hint" @click="finish">
        Упражнение выполнено
      </AppButton>
      <p id="exercise-hint" class="exercise__hint">
        <template v-if="canComplete">
          Ответ записан.<template v-if="store.settings.showGamification">
            За упражнение — {{ XP_RULES.exerciseCompleted }} XP.</template
          >
        </template>
        <template v-else>Кнопка станет доступна, когда в ответе будет хотя бы одна-две фразы.</template>
      </p>
    </div>
    <p class="exercise__message" role="status">{{ message }}</p>

    <div v-if="samples.length" class="samples">
      <h4 class="exercise__subtitle">Образец разбора</h4>
      <p class="samples__lead">
        Образец показывает ход рассуждения, а не единственно верный ответ.
        <template v-if="!hasAttempt">Сначала попробуйте ответить сами — так от него будет больше пользы.</template>
        <template v-if="samples.length > 1">Здесь два разбора, которые спорят друг с другом.</template>
      </p>
      <DisclosurePanel v-for="s in samples" :key="s.title" :summary="sampleSummary(s)" spoiler @open="onSampleOpen">
        <p class="prose">{{ s.text }}</p>
      </DisclosurePanel>
    </div>
  </section>
</template>

<style scoped>
.exercise {
  display: grid;
  gap: 0.9rem;
}
.exercise__title {
  font-size: 1.7rem;
}
.exercise__task {
  font-size: 1.08rem;
}
.exercise__look {
  color: var(--ink-soft);
}
.exercise__subtitle {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.3rem;
  line-height: 1.2;
}
.exercise__steps {
  display: grid;
  gap: 0.4rem;
  margin: -0.4rem 0 0.25rem;
  padding-left: 1.4rem;
}
.exercise__steps li::marker {
  font-family: var(--font-display);
  font-weight: 600;
  color: var(--ink-soft);
}

.checks {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  border: 0;
}
.checks__lead {
  margin-bottom: 0.25rem;
  font-size: 0.92rem;
  color: var(--ink-soft);
}
.check {
  display: grid;
  grid-template-columns: 1.25rem minmax(0, 1fr);
  gap: 0.65rem;
  align-items: start;
  min-height: 2.75rem;
  padding: 0.35rem 0;
  cursor: pointer;
}
.check input {
  width: 1.2rem;
  height: 1.2rem;
  margin: 0.2rem 0 0;
  accent-color: var(--moss);
  cursor: inherit;
}
.check:has(input:disabled) {
  cursor: default;
  color: var(--ink-soft);
}

.exercise__advanced {
  padding: 0.75rem 1rem;
  border-left: 3px solid var(--gold);
  background: var(--paper-sunken);
  border-radius: 0 var(--radius-s) var(--radius-s) 0;
  font-size: 0.95rem;
}

.exercise__action {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
}
.exercise__hint {
  font-size: 0.92rem;
  color: var(--ink-soft);
}
.exercise__done {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 560;
  color: var(--moss);
}
/* Промежуточная отметка — печать цвета мха, киноварь остаётся за итогом фильма. */
.exercise__done .exercise__stamp {
  --hanko-size: 3rem;
  color: var(--moss);
}
.exercise__message:empty {
  display: none;
}
.exercise__message {
  font-weight: 560;
  color: var(--moss);
}

.samples {
  display: grid;
  gap: 0.6rem;
  margin-top: 0.5rem;
}
.samples__lead {
  font-size: 0.95rem;
  color: var(--ink-soft);
}
</style>
