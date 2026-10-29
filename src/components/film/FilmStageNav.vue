<script lang="ts">
/** Разделы страницы фильма, к которым ведёт полоса, кроме самого урока. */
export type FilmJump = 'exercise' | 'notes' | 'completion'
export type FilmSection = 'lesson' | FilmJump

export const FILM_SECTIONS: readonly FilmSection[] = ['lesson', 'exercise', 'notes', 'completion']
</script>

<script setup lang="ts">
/**
 * Липкая полоса урока: вкладки шагов «Перед / Во время / После
 * просмотра» и переходы к упражнению, заметкам и итогу. Одна полоса вместо
 * двух навигаций — подписи шагов те же, что в адресе (?step=). «Вы здесь» —
 * рамка снизу и aria-current="step" у раздела, который сейчас читают.
 * На планшете у шагов номера и подпись выбранного, на телефоне — только
 * номера (полная подпись остаётся для скринридера): иначе не помещаются переходы.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { FILM_STAGE_LABEL, FILM_STAGES, type FilmStage } from '@/domain/progress/progress.selectors'

const props = defineProps<{
  stage: FilmStage
  /** Раздел, который сейчас на экране; null — выше урока. */
  current: FilmSection | null
  jumps: readonly FilmJump[]
}>()

const emit = defineEmits<{ select: [stage: FilmStage]; jump: [section: FilmJump] }>()

/** Короткая подпись шага на узком экране; остаток остаётся для скринридера. */
const SHORT: Record<FilmStage, string> = { before: 'Перед', during: 'Во время', after: 'После' }
const JUMP_LABEL: Record<FilmJump, string> = { exercise: 'Упражнение', notes: 'Заметки', completion: 'Итог' }

const inLesson = computed(() => props.current === null || props.current === 'lesson')

const tabs = ref<HTMLElement[]>([])

function onTabKey(event: KeyboardEvent, index: number) {
  const last = FILM_STAGES.length - 1
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
  const s = FILM_STAGES[target]
  if (!s) return
  event.preventDefault()
  tabs.value[target]?.focus()
  emit('select', s)
}

/* Прилипла ли полоса: при top: -1px прилипшая обрезана на пиксель сверху. */
const bar = ref<HTMLElement | null>(null)
const stuck = ref(false)
let observer: IntersectionObserver | null = null

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined' || !bar.value) return
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry) stuck.value = entry.intersectionRatio < 1 && entry.boundingClientRect.top < 0
    },
    { threshold: [1] },
  )
  observer.observe(bar.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="bar" class="stage-nav" :class="{ 'stage-nav--stuck': stuck }">
    <div class="stage-nav__tabs" role="tablist" aria-label="Шаги урока">
      <button
        v-for="(s, i) in FILM_STAGES"
        :id="`tab-${s}`"
        :key="s"
        ref="tabs"
        type="button"
        role="tab"
        class="tab"
        :aria-selected="stage === s"
        :aria-controls="`panel-${s}`"
        :aria-current="stage === s && inLesson ? 'step' : undefined"
        :tabindex="stage === s ? 0 : -1"
        @click="emit('select', s)"
        @keydown="onTabKey($event, i)"
      >
        <span class="tab__num" aria-hidden="true">{{ i + 1 }}</span>
        <span class="tab__label">
          <span class="tab__short">{{ SHORT[s] }}</span
          ><span class="tab__rest">{{ FILM_STAGE_LABEL[s].slice(SHORT[s].length) }}</span>
        </span>
      </button>
    </div>

    <nav class="stage-nav__jumps" aria-label="Разделы страницы фильма">
      <button
        v-for="j in jumps"
        :key="j"
        type="button"
        class="jump"
        :aria-current="current === j ? 'step' : undefined"
        @click="emit('jump', j)"
      >
        {{ JUMP_LABEL[j] }}
      </button>
    </nav>
  </div>
</template>

<style scoped>
.stage-nav {
  position: sticky;
  top: -1px;
  z-index: 20;
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 0.25rem 1rem;
  min-width: 0;
  min-height: 3rem;
  max-height: 3rem;
  padding-top: 1px;
  border-bottom: 1.5px solid var(--line-strong);
  background: var(--paper);
}
/* Прилипшая полоса — во всю ширину окна: фон тенью, линия — border-image с выносом;
   ни то ни другое не влияет на прокрутку. */
.stage-nav--stuck {
  box-shadow: 0 0 0 100vmax var(--paper);
  clip-path: inset(0 -100vmax);
  border-image: linear-gradient(var(--line-strong) 0 0) 0 0 1 0 / 0 0 1.5px 0 / 0 100vmax;
}

.stage-nav__tabs,
.stage-nav__jumps {
  display: flex;
  align-items: stretch;
  min-width: 0;
}

.tab,
.jump {
  display: flex;
  align-items: center;
  min-height: 2.75rem;
  margin-bottom: -1.5px;
  border: 0;
  border-bottom: 3px solid transparent;
  background: none;
  color: var(--ink-soft);
  white-space: nowrap;
  cursor: pointer;
}
.tab:hover,
.jump:hover {
  color: var(--ink);
}
.tab:focus-visible,
.jump:focus-visible {
  outline-offset: -3px;
}
/* «Вы здесь» — рамка снизу цветом уровня. */
.tab[aria-current='step'],
.jump[aria-current='step'] {
  border-bottom-color: var(--tint-ink);
  color: var(--ink);
}

.tab {
  gap: 0.55rem;
  padding: 0.35rem 0.8rem 0.35rem 0.5rem;
  border-radius: var(--radius-s) var(--radius-s) 0 0;
  font-family: var(--font-display);
  font-weight: 500;
  font-size: 1.05rem;
  line-height: 1.1;
}
.tab[aria-selected='true'] {
  background: linear-gradient(180deg, transparent, var(--tint));
  color: var(--ink);
}
.tab__num {
  flex: none;
  width: 1.75rem;
  height: 1.75rem;
  display: grid;
  place-items: center;
  border: 1.5px solid currentColor;
  border-radius: 50%;
  font-family: var(--font-accent);
  font-size: 0.85rem;
}
.tab[aria-selected='true'] .tab__num {
  border-color: var(--tint-ink);
  background: var(--tint-ink);
  color: var(--paper-raised);
}

.jump {
  padding: 0.35rem 0.6rem;
  font-family: var(--font-accent);
  font-size: 0.85rem;
}

/* ---------- Узкий экран: номера шагов, подпись только у выбранного; на телефоне — без неё ---------- */

@media (max-width: 52rem) {
  .stage-nav {
    gap: 0.25rem 0.5rem;
  }
  .tab {
    justify-content: center;
    min-width: 2.75rem;
    padding: 0.35rem 0.45rem;
  }
  .tab__rest,
  .tab[aria-selected='false'] .tab__label {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  .tab[aria-selected='true'] {
    padding-right: 0.7rem;
  }
}

@media (max-width: 30rem) {
  .stage-nav {
    gap: 0.25rem;
  }
  .tab__label {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  .tab[aria-selected='true'] {
    padding-right: 0.45rem;
  }
  .jump {
    padding: 0.35rem 0.5rem;
    font-family: var(--font-body);
    font-size: 0.9rem;
  }
  /* Совсем узкий экран: переходы прокручиваются внутри полосы, страница — нет. */
  .stage-nav__jumps {
    overflow-x: auto;
    scrollbar-width: none;
  }
}
</style>
