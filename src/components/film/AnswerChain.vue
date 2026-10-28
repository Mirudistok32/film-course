<script setup lang="ts">
/**
 * Цепочка ответа после просмотра (ТЗ §12.4): наблюдение → эффект →
 * гипотеза → довод. Вопросы урока трёх типов служат подсказками к полям,
 * у каждого поля есть пример формы ответа. Текст сохраняется сам.
 */
import { computed } from 'vue'
import { useProgressStore } from '@/stores/progress'
import { setAnswer } from '@/domain/progress/progress.actions'
import type { FilmLesson } from '@/domain/catalog/catalog.types'
import type { AnswerKey } from '@/domain/progress/progress.types'
import { isMeaningful } from '@/domain/shared/text'
import AnswerField from '@/components/AnswerField.vue'
import DisclosurePanel from '@/components/DisclosurePanel.vue'

const props = withDefaults(
  defineProps<{
    filmId: string
    questions?: FilmLesson['afterQuestions'] | null
    readonly?: boolean
  }>(),
  { questions: null, readonly: false },
)

const store = useProgressStore()
const answers = computed(() => store.progress.films[props.filmId]?.answers ?? {})

interface Step {
  key: AnswerKey
  label: string
  /** Тип вопроса: наблюдение, эффект, интерпретация, довод. */
  kind: string
  question: string
  /** Пример формы ответа — не про этот фильм, чтобы не подсказывать трактовку. */
  example: string
}

const steps = computed<Step[]>(() => [
  {
    key: 'observation',
    label: 'Я заметил…',
    kind: 'Наблюдение',
    question: props.questions?.observation ?? 'Что конкретно было видно или слышно?',
    example: 'героиню почти всё время снимают через дверной проём или окно.',
  },
  {
    key: 'feeling',
    label: 'Это заставило меня почувствовать или ожидать…',
    kind: 'Эффект',
    question: props.questions?.effect ?? 'Какое чувство или ожидание создавал этот приём?',
    example: 'тесноту: казалось, что она заперта, хотя двери открыты.',
  },
  {
    key: 'hypothesis',
    label: 'Возможно, это означает…',
    kind: 'Интерпретация',
    question: props.questions?.interpretation ?? 'Какую идею или вопрос помогает сформулировать приём?',
    example: 'что фильм говорит о несвободе, которую героиня сама не замечает.',
  },
  {
    key: 'evidence',
    label: 'На это указывает…',
    kind: 'Довод',
    question: 'Какая ещё деталь или повтор поддерживает гипотезу?',
    example: 'рамки дверей повторяются в начале и в конце, а в последней сцене кадр впервые открыт.',
  },
])

const extras = [
  {
    key: 'altHypothesis' as const,
    label: 'Другое прочтение',
    hint: 'Какая ещё гипотеза объясняет ту же деталь? Две трактовки могут жить рядом.',
  },
  {
    key: 'openQuestion' as const,
    label: 'Открытый вопрос',
    hint: 'Что в фильме вы решили не закрывать одной трактовкой?',
  },
]
const extrasFilled = computed(() => extras.some((e) => isMeaningful(answers.value[e.key], 1)))

function save(key: AnswerKey, text: string) {
  if (props.readonly) return
  store.apply((q, now) => setAnswer(q, props.filmId, key, text, now), 'debounced')
}
</script>

<template>
  <div class="chain">
    <ol class="chain__steps">
      <li v-for="(step, i) in steps" :key="step.key" class="step">
        <span class="step__num" aria-hidden="true">{{ i + 1 }}</span>
        <div class="step__body">
          <p class="step__kind">{{ step.kind }}</p>
          <AnswerField
            :model-value="answers[step.key] ?? ''"
            :label="step.label"
            :hint="`${step.question} Например: «…${step.example}»`"
            :rows="2"
            :readonly="readonly"
            @update:model-value="save(step.key, $event)"
          />
        </div>
      </li>
    </ol>

    <DisclosurePanel summary="Пойти дальше: другое прочтение и открытый вопрос" :open="extrasFilled">
      <p class="chain__extra-lead">Необязательно. Сильный разбор часто держит две гипотезы сразу.</p>
      <div class="chain__extras">
        <AnswerField
          v-for="e in extras"
          :key="e.key"
          :model-value="answers[e.key] ?? ''"
          :label="e.label"
          :hint="e.hint"
          :rows="2"
          :readonly="readonly"
          @update:model-value="save(e.key, $event)"
        />
      </div>
    </DisclosurePanel>
  </div>
</template>

<style scoped>
.chain {
  display: grid;
  gap: 1.25rem;
}
.chain__steps {
  display: grid;
  gap: 1.25rem;
  padding: 0;
  list-style: none;
}
.step {
  position: relative;
  display: grid;
  grid-template-columns: 2.25rem minmax(0, 1fr);
  gap: 0.9rem;
}
/* Нить цепочки: от номера к следующему шагу. */
.step:not(:last-child)::before {
  content: '';
  position: absolute;
  left: calc(1.125rem - 0.75px);
  top: 2.5rem;
  bottom: -1.1rem;
  border-left: 1.5px dashed var(--line-strong);
}
.step__num {
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  border: 1.5px solid var(--line-strong);
  border-radius: 50%;
  background: var(--paper);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.2rem;
  color: var(--ink-soft);
}
.step__body {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}
.step__kind {
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
.chain__extra-lead {
  margin-bottom: 1rem;
  color: var(--ink-soft);
  font-size: 0.95rem;
}
.chain__extras {
  display: grid;
  gap: 1.25rem;
}

@media (max-width: 30rem) {
  .step {
    grid-template-columns: 1.9rem minmax(0, 1fr);
    gap: 0.6rem;
  }
  .step:not(:last-child)::before {
    left: calc(0.95rem - 0.75px);
    top: 2.15rem;
  }
  .step__num {
    width: 1.9rem;
    height: 1.9rem;
    font-size: 1.05rem;
  }
}
</style>
