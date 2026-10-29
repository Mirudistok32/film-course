<script setup lang="ts">
/**
 * Форма мотива: повторяющийся образ (окно, лестница, дождь…), что он
 * делает, и фильмы, в которых встречается. Фильмы добавляются по одному
 * из списка — так выбор из ста фильмов остаётся удобным с клавиатуры.
 */
import { computed, ref } from 'vue'
import { useProgressStore } from '@/stores/progress'
import type { Film } from '@/domain/catalog/catalog.types'
import { normalizeText } from '@/domain/shared/text'
import AnswerField from '@/components/AnswerField.vue'
import AppButton from '@/components/AppButton.vue'
import FilmSelect from '@/components/FilmSelect.vue'
import TextField from '@/components/TextField.vue'

const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    filmIds?: string[]
    submitLabel?: string
    cancellable?: boolean
  }>(),
  { title: '', description: '', filmIds: () => [], submitLabel: 'Сохранить мотив', cancellable: false },
)

const emit = defineEmits<{
  save: [value: { title: string; description: string; filmIds: string[] }]
  cancel: []
}>()

const store = useProgressStore()
const title = ref(props.title)
const description = ref(props.description)
const filmIds = ref<string[]>([...props.filmIds])
const picked = ref('')
const message = ref('')

const films = computed(() =>
  filmIds.value.map((id) => store.course.filmById.get(id)).filter((f): f is Film => Boolean(f)),
)

function addFilm() {
  const film = store.course.filmById.get(picked.value)
  if (!film) return
  if (filmIds.value.includes(film.id)) {
    message.value = `«${film.title}» уже в списке.`
  } else {
    filmIds.value = [...filmIds.value, film.id]
    message.value = `Добавлен фильм «${film.title}».`
  }
  picked.value = ''
}

function removeFilm(film: Film) {
  filmIds.value = filmIds.value.filter((id) => id !== film.id)
  message.value = `Фильм «${film.title}» убран.`
}

function submit() {
  if (normalizeText(title.value) === '') return
  emit('save', { title: title.value.trim(), description: description.value, filmIds: filmIds.value })
}

function clear() {
  title.value = ''
  description.value = ''
  filmIds.value = []
  message.value = ''
}
defineExpose({ clear })
</script>

<template>
  <form class="editor" @submit.prevent="submit">
    <TextField
      v-model="title"
      label="Мотив"
      hint="Короткое имя образа: «окно», «лестница», «дождь», «взгляд в камеру»."
    />
    <AnswerField
      v-model="description"
      label="Что он делает"
      hint="Как образ меняется от фильма к фильму, что он подчёркивает. Можно дописать позже."
      :rows="3"
    />

    <fieldset class="films">
      <legend class="films__legend">Где встречается</legend>
      <p class="films__hint">Мотив интереснее всего, когда виден хотя бы в двух фильмах.</p>
      <div class="films__picker">
        <FilmSelect v-model="picked" label="Фильм" empty-label="Выберите фильм" compact />
        <AppButton :disabled="!picked" @click="addFilm">Добавить фильм</AppButton>
      </div>
      <ul v-if="films.length" class="films__list">
        <li v-for="film in films" :key="film.id" class="films__item">
          <span
            >{{ film.title }} <span class="films__year">· {{ film.year }}</span></span
          >
          <AppButton variant="ghost" @click="removeFilm(film)">
            Убрать<span class="visually-hidden"> «{{ film.title }}»</span>
          </AppButton>
        </li>
      </ul>
      <p v-else class="films__empty">Фильмы пока не выбраны.</p>
      <p class="films__message" role="status">{{ message }}</p>
    </fieldset>

    <div class="editor__actions">
      <AppButton type="submit" variant="primary" :disabled="normalizeText(title) === ''">{{ submitLabel }}</AppButton>
      <AppButton v-if="cancellable" variant="secondary" @click="emit('cancel')">Отмена</AppButton>
    </div>
  </form>
</template>

<style scoped>
.editor {
  display: grid;
  gap: 1rem;
}
.films {
  display: grid;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
.films__legend {
  margin-bottom: 0.35rem;
  padding: 0;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.3rem;
}
.films__hint,
.films__empty {
  font-size: 0.92rem;
  color: var(--ink-soft);
}
.films__picker {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 0.6rem;
}
.films__list {
  display: grid;
  gap: 0.25rem;
  padding: 0;
  list-style: none;
}
.films__item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem 0.75rem;
  padding: 0.25rem 0 0.25rem 0.9rem;
  border-left: 2px solid var(--line-strong);
}
.films__year {
  color: var(--ink-soft);
}
.films__message:empty {
  display: none;
}
.films__message {
  font-size: 0.92rem;
  color: var(--moss);
}
.editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

@media (max-width: 30rem) {
  .films__picker {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
