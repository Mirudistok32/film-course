<script setup lang="ts">
/**
 * Баннеры о состоянии хранилища (ТЗ §23, §26): повреждённые данные,
 * данные более новой версии, недоступное хранилище, миграция формата.
 * Повреждённые данные никогда не перезаписываются без явного решения.
 */
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import AppButton from './AppButton.vue'
import ConfirmDialog from './ConfirmDialog.vue'

const store = useProgressStore()
const confirmFresh = ref(false)
const dismissed = ref<Set<string>>(new Set())

const blocking = computed(() => {
  if (store.loadState === 'corrupted') {
    return {
      title: 'Сохранённые данные повреждены',
      text: 'Мы их не удаляли и ничего не перезаписываем, пока вы не решите, что делать. Скачайте их как есть — файл можно проверить и восстановить вручную.',
    }
  }
  if (store.loadState === 'newer') {
    return {
      title: 'Данные сохранены более новой версией сайта',
      text: `Формат данных — версия ${store.loadIssue?.version ?? '?'}, эта версия сайта его не знает. Чтобы ничего не потерять, сохранение здесь приостановлено.`,
    }
  }
  return null
})

const notices = computed(() => {
  const list: { id: string; text: string }[] = []
  if (store.migratedFrom !== null) {
    list.push({
      id: 'migrated',
      text: `Данные обновлены до нового формата (с версии ${store.migratedFrom}). Копия прежних данных сохранена в браузере.`,
    })
  }
  if (store.loadWarnings.length > 0) {
    list.push({ id: 'warnings', text: `При загрузке исправлено: ${store.loadWarnings.join('; ')}.` })
  }
  return list.filter((n) => !dismissed.value.has(n.id))
})

function dismiss(id: string) {
  dismissed.value = new Set([...dismissed.value, id])
}

function download() {
  if (!store.downloadRawIssue()) store.notify('error', 'Не удалось скачать файл', 'Браузер запретил скачивание.')
}

function exportNow() {
  if (!store.exportBackup()) store.notify('error', 'Не удалось скачать копию', 'Браузер запретил скачивание.')
}

function startFresh() {
  confirmFresh.value = false
  store.startFreshAfterIssue()
}
</script>

<template>
  <div class="banners">
    <section v-if="blocking" class="banner banner--alert container" role="alert">
      <h2 class="banner__title">{{ blocking.title }}</h2>
      <p>{{ blocking.text }}</p>
      <div class="banner__actions">
        <AppButton variant="primary" @click="download">Скачать данные как есть</AppButton>
        <AppButton :to="{ name: 'data' }">Импортировать резервную копию</AppButton>
        <AppButton variant="danger" @click="confirmFresh = true">Начать заново</AppButton>
      </div>
    </section>

    <section v-else-if="store.loadState === 'unavailable'" class="banner banner--alert container" role="alert">
      <h2 class="banner__title">Браузер не разрешает сохранять прогресс</h2>
      <p>
        Так бывает в приватном режиме или при запрете хранилища для сайтов. Всё, что вы запишете, пропадёт после
        закрытия вкладки — скачивайте резервную копию.
      </p>
      <div class="banner__actions">
        <AppButton variant="primary" @click="exportNow">Скачать копию (JSON)</AppButton>
        <RouterLink :to="{ name: 'data' }">Подробнее о данных</RouterLink>
      </div>
    </section>

    <section v-for="n in notices" :key="n.id" class="banner banner--note container" role="status">
      <p>{{ n.text }}</p>
      <AppButton variant="ghost" @click="dismiss(n.id)">Понятно</AppButton>
    </section>
  </div>

  <ConfirmDialog
    :open="confirmFresh"
    title="Начать заново?"
    confirm-label="Начать заново"
    danger
    @confirm="startFresh"
    @cancel="confirmFresh = false"
  >
    <p>Повреждённые данные останутся в браузере отдельной копией, а курс начнётся с чистого листа.</p>
    <p>Если вы ещё не скачали их, лучше сначала нажмите «Скачать данные как есть».</p>
  </ConfirmDialog>
</template>

<style scoped>
.banners {
  display: grid;
  gap: 0.75rem;
}
.banners:not(:empty) {
  margin-top: 1rem;
}
.banner {
  padding: 1rem 1.25rem;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-m);
  background: var(--paper-raised);
}
.banner--alert {
  border-color: var(--accent);
  border-left-width: 5px;
  background: color-mix(in srgb, var(--accent-wash) 100%, var(--paper-raised));
}
.banner--note {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  font-size: 0.95rem;
}
.banner__title {
  font-size: 1.45rem;
  margin-bottom: 0.35rem;
}
.banner__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1rem;
  margin-top: 0.9rem;
}
</style>
