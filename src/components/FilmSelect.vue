<script setup lang="ts">
/**
 * Выбор фильма курса, фильмы сгруппированы по уровням.
 * Пустая строка — «все фильмы» или «не выбран», NO_FILM — «без фильма».
 */
import { computed } from 'vue'
import { useProgressStore } from '@/stores/progress'
import { NO_FILM } from '@/domain/progress/progress.journal'
import SelectField from './SelectField.vue'

const props = withDefaults(
  defineProps<{
    label: string
    /** Подпись пустого значения (''), например «Все фильмы». Без неё пустого пункта нет. */
    emptyLabel?: string
    /** Подпись пункта NO_FILM, например «Без фильма». */
    noneLabel?: string
    /** Показать только фильмы этого уровня. */
    levelId?: string | null
    compact?: boolean
  }>(),
  { emptyLabel: '', noneLabel: '', levelId: null, compact: false },
)

const model = defineModel<string>({ default: '' })
const store = useProgressStore()

const groups = computed(() => store.course.levels.filter((l) => !props.levelId || l.id === props.levelId))
</script>

<template>
  <SelectField v-model="model" :label="label" :compact="compact">
    <option v-if="emptyLabel" value="">{{ emptyLabel }}</option>
    <option v-if="noneLabel" :value="NO_FILM">{{ noneLabel }}</option>
    <optgroup v-for="level in groups" :key="level.id" :label="`Уровень ${level.number}. ${level.title}`">
      <option v-for="film in level.films" :key="film.id" :value="film.id">{{ film.title }} ({{ film.year }})</option>
    </optgroup>
  </SelectField>
</template>
