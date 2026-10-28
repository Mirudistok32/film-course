<script setup lang="ts">
/**
 * Вкладка «Мотивы» журнала: один повторяющийся образ в нескольких фильмах.
 * Создание, редактирование на месте, удаление с подтверждением.
 */
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import { addMotif, deleteMotif, updateMotif } from '@/domain/progress/progress.actions'
import type { MotifLink } from '@/domain/progress/progress.types'
import type { Film } from '@/domain/catalog/catalog.types'
import { formatDate } from '@/domain/shared/dates'
import { plural } from '@/domain/shared/text'
import AppButton from '@/components/AppButton.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import MotifEditor from './MotifEditor.vue'

const store = useProgressStore()
const motifs = computed(() =>
  [...store.progress.motifs]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((motif) => ({
      motif,
      films: motif.filmIds.map((id) => store.course.filmById.get(id)).filter((f): f is Film => Boolean(f)),
    })),
)

const message = ref('')
const creator = ref<InstanceType<typeof MotifEditor> | null>(null)
const editingId = ref<string | null>(null)
const pending = ref<MotifLink | null>(null)

function create(value: Pick<MotifLink, 'title' | 'description' | 'filmIds'>) {
  store.apply((q, now) => addMotif(q, value, now))
  creator.value?.clear()
  message.value = `Мотив «${value.title}» сохранён.`
}

function save(id: string, value: Pick<MotifLink, 'title' | 'description' | 'filmIds'>) {
  store.apply((q, now) => updateMotif(q, id, value, now))
  editingId.value = null
  message.value = `Мотив «${value.title}» обновлён.`
}

function confirmDelete() {
  const motif = pending.value
  pending.value = null
  if (!motif) return
  store.apply((q, now) => deleteMotif(q, motif.id, now))
  message.value = `Мотив «${motif.title}» удалён.`
}
</script>

<template>
  <div class="motifs">
    <p class="motifs__lead">
      Мотив — образ, который возвращается: окно, лестница, дождь, взгляд в камеру. Проследите, как один и тот же
      образ работает в разных фильмах — так видно язык кино, а не только отдельный сюжет.
    </p>

    <p class="motifs__message" role="status">{{ message }}</p>

    <ul v-if="motifs.length" class="motifs__list">
      <li v-for="{ motif, films } in motifs" :key="motif.id" class="motif card">
        <MotifEditor
          v-if="editingId === motif.id"
          :title="motif.title"
          :description="motif.description"
          :film-ids="motif.filmIds"
          submit-label="Сохранить изменения"
          cancellable
          @save="save(motif.id, $event)"
          @cancel="editingId = null"
        />
        <template v-else>
          <h3 class="motif__title">{{ motif.title }}</h3>
          <p class="motif__meta">
            {{ films.length }} {{ plural(films.length, ['фильм', 'фильма', 'фильмов']) }} · изменён
            {{ formatDate(motif.updatedAt) }}
          </p>
          <p v-if="motif.description" class="motif__text">{{ motif.description }}</p>
          <ul v-if="films.length" class="motif__films">
            <li v-for="film in films" :key="film.id">
              <RouterLink :to="{ name: 'film', params: { filmId: film.id } }">{{ film.title }}</RouterLink>
            </li>
          </ul>
          <div class="motif__actions">
            <AppButton variant="ghost" @click="editingId = motif.id">
              Изменить<span class="visually-hidden"> мотив «{{ motif.title }}»</span>
            </AppButton>
            <AppButton variant="ghost" @click="pending = motif">
              Удалить<span class="visually-hidden"> мотив «{{ motif.title }}»</span>
            </AppButton>
          </div>
        </template>
      </li>
    </ul>
    <p v-else class="motifs__empty">Мотивов пока нет. Начните с образа, который запомнился в двух фильмах.</p>

    <section class="motifs__new card" aria-labelledby="motif-new-title">
      <h3 id="motif-new-title" class="motifs__new-title">Новый мотив</h3>
      <MotifEditor ref="creator" @save="create" />
    </section>

    <ConfirmDialog
      :open="pending !== null"
      title="Удалить мотив?"
      confirm-label="Удалить"
      danger
      @confirm="confirmDelete"
      @cancel="pending = null"
    >
      <p>«{{ pending?.title }}» и его описание будут удалены. Заметки и разборы фильмов останутся.</p>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.motifs {
  display: grid;
  gap: 1.25rem;
  max-width: 48rem;
}
.motifs__lead {
  max-width: var(--measure);
  color: var(--ink-soft);
}
.motifs__message:empty {
  display: none;
}
.motifs__message {
  font-weight: 560;
  color: var(--moss);
}
.motifs__list {
  display: grid;
  gap: 1rem;
  padding: 0;
  list-style: none;
}
.motif {
  display: grid;
  gap: 0.5rem;
}
.motif__title {
  font-size: 1.6rem;
}
.motif__meta {
  font-size: 0.88rem;
  color: var(--ink-soft);
}
.motif__text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.motif__films {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1.25rem;
  padding: 0;
  list-style: none;
}
.motif__films li::before {
  content: '◆ ';
  color: var(--accent);
  font-size: 0.7em;
}
.motif__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-left: -0.5rem;
}
.motifs__empty {
  color: var(--ink-faint);
}
.motifs__new {
  display: grid;
  gap: 1rem;
}
.motifs__new-title {
  font-size: 1.7rem;
}
</style>
