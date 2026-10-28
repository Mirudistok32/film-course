<script setup lang="ts">
/**
 * Данные и настройки (ТЗ §21–27): честно о том, где хранится прогресс,
 * резервная копия и импорт с предпросмотром (объединить или заменить,
 * отменить импорт), сброс с подтверждением и настройки интерфейса.
 *
 * Ничего не перезаписывается тихо: импорт сначала только читает файл,
 * замена и сброс подтверждаются и оставляют снимок в браузере.
 */
import { computed, nextTick, ref } from 'vue'
import { useProgressStore } from '@/stores/progress'
import { updateSettings } from '@/domain/progress/progress.actions'
import { exportFileName } from '@/domain/progress/progress.export'
import { parseImportFile, summarizeProgress, type ProgressSummary } from '@/domain/progress/progress.import'
import { mergeReportLines } from '@/domain/progress/progress.merge'
import { backupReminder } from '@/domain/progress/progress.selectors'
import { STORAGE_KEY } from '@/domain/progress/progress.storage'
import { CURRENT_SCHEMA_VERSION, PROGRESS_FORMAT, type Settings, type UserProgress } from '@/domain/progress/progress.types'
import type { DocumentError, DocumentInfo } from '@/domain/progress/progress.document'
import { formatDateTime } from '@/domain/shared/dates'
import { plural } from '@/domain/shared/text'
import { useScrollTo } from '@/composables/useScrollTo'
import AppButton from '@/components/AppButton.vue'
import ChoiceChips from '@/components/ChoiceChips.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import DisclosurePanel from '@/components/DisclosurePanel.vue'
import ToggleField from '@/components/ToggleField.vue'
import InkDivider from '@/illustrations/InkDivider.vue'

const store = useProgressStore()
const p = computed(() => store.progress)
const blocked = computed(() => store.persistenceBlocked)
const current = computed(() => summarizeProgress(p.value, store.course))
const reminder = computed(() => backupReminder(p.value, store.now()))
const appVersion = __APP_VERSION__

const films = (n: number) => plural(n, ['фильм', 'фильма', 'фильмов'])
const notes = (n: number) => plural(n, ['заметка', 'заметки', 'заметок'])

/** Строки сравнения «сейчас в браузере» и «в файле». */
function summaryRows(s: ProgressSummary) {
  const rows: { label: string; value: number }[] = [
    { label: 'Фильмов с прогрессом', value: s.filmsWithProgress },
    { label: 'Просмотрено', value: s.filmsWatched },
    { label: 'Пройдено фильмов', value: s.filmsCompleted },
    { label: 'Пройдено уровней', value: s.levelsCompleted },
    { label: 'Ответов в разборах', value: s.answers },
    { label: 'Заметок', value: s.notes },
  ]
  if (store.settings.showGamification) {
    rows.push({ label: 'Достижений', value: s.achievements }, { label: 'Опыт, XP', value: s.xp })
  }
  return rows
}

const message = ref('')

/* ---------- Резервная копия ---------- */

function exportNow() {
  if (store.exportBackup()) message.value = `Копия скачана: ${exportFileName(store.now())}. Храните её отдельно от браузера.`
  else store.notify('error', 'Не удалось скачать копию', 'Браузер запретил скачивание файла.')
}

function downloadRaw() {
  if (store.downloadRawIssue()) message.value = 'Сохранённые данные скачаны как есть.'
  else store.notify('error', 'Не удалось скачать файл', 'Браузер запретил скачивание.')
}

/* ---------- Импорт ---------- */

type ImportView =
  | { kind: 'reading'; name: string }
  | { kind: 'error'; name: string; error: DocumentError }
  | {
      kind: 'preview'
      name: string
      progress: UserProgress
      info: DocumentInfo
      summary: ProgressSummary
      migratedFrom: number | null
      warnings: string[]
    }
  | { kind: 'done'; title: string; lines: string[]; saved: boolean }

const fileInput = ref<HTMLInputElement | null>(null)
const importBox = ref<HTMLElement | null>(null)
const importTitle = ref<HTMLElement | null>(null)
const importButton = ref<HTMLElement | null>(null)
const importView = ref<ImportView | null>(null)
const confirmReplace = ref(false)
const confirmUndoImport = ref(false)
const exportedBeforeReplace = ref(false)
const scrollTo = useScrollTo()

function chooseFile() {
  fileInput.value?.click()
}

async function showImport(view: ImportView) {
  importView.value = view
  await nextTick()
  scrollTo(importBox.value, importTitle.value)
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Сбросить выбор, чтобы тот же файл можно было выбрать ещё раз.
  input.value = ''
  if (!file) return
  message.value = ''
  importView.value = { kind: 'reading', name: file.name }
  const result = await parseImportFile(file, store.course)
  if (!result.ok) await showImport({ kind: 'error', name: file.name, error: result.error })
  else await showImport({ kind: 'preview', name: file.name, ...result })
}

function cancelImport() {
  importView.value = null
  importButton.value?.querySelector('button')?.focus()
}

function savedNote(saved: boolean) {
  return saved ? [] : ['Браузер не сохранил данные: скачайте резервную копию, прежде чем закрывать вкладку.']
}

function merge() {
  const view = importView.value
  if (view?.kind !== 'preview') return
  const { saved, report } = store.mergeWith(view.progress)
  const lines = mergeReportLines(report)
  void showImport({
    kind: 'done',
    title: 'Прогресс объединён',
    lines: [...(lines.length ? lines : ['Нового в файле не нашлось — всё это уже было в браузере.']), ...savedNote(saved)],
    saved,
  })
}

function askReplace() {
  if (importView.value?.kind !== 'preview') return
  // Терять нечего — подтверждать нечего.
  if (!store.started && !blocked.value) return replace()
  exportedBeforeReplace.value = false
  confirmReplace.value = true
}

function exportBeforeReplace() {
  if (store.exportBackup()) exportedBeforeReplace.value = true
  else store.notify('error', 'Не удалось скачать копию', 'Браузер запретил скачивание файла.')
}

function replace() {
  confirmReplace.value = false
  const view = importView.value
  if (view?.kind !== 'preview') return
  const { saved } = store.replaceWith(view.progress)
  void showImport({
    kind: 'done',
    title: 'Прогресс заменён данными из файла',
    lines: [
      `Теперь в браузере: ${view.summary.filmsWithProgress} ${films(view.summary.filmsWithProgress)} с прогрессом, ${view.summary.notes} ${notes(view.summary.notes)}.`,
      ...savedNote(saved),
    ],
    saved,
  })
}

function undoImport() {
  confirmUndoImport.value = false
  const ok = store.undoImport()
  importView.value = null
  message.value = ok
    ? 'Импорт отменён: вернулись данные, которые были до него.'
    : 'Не удалось отменить импорт: копия данных до импорта не найдена или не читается.'
}

/* ---------- Сброс ---------- */

const confirmReset = ref(false)
const confirmUndoReset = ref(false)
const exportedBeforeReset = ref(false)

function askReset() {
  exportedBeforeReset.value = false
  confirmReset.value = true
}

function exportBeforeReset() {
  if (store.exportBackup()) exportedBeforeReset.value = true
  else store.notify('error', 'Не удалось скачать копию', 'Браузер запретил скачивание файла.')
}

function reset() {
  confirmReset.value = false
  importView.value = null
  message.value = store.resetProgress(true)
    ? 'Прогресс сброшен, настройки сохранены. Курс начинается с чистого листа.'
    : 'Прогресс сброшен только на этой странице: браузер не сохранил изменение.'
}

function undoReset() {
  confirmUndoReset.value = false
  message.value = store.undoReset()
    ? 'Данные, которые были до сброса, возвращены.'
    : 'Не удалось вернуть данные: копия до сброса не найдена или не читается.'
}

/* ---------- Настройки ---------- */

function setting<K extends keyof Settings>(key: K) {
  return computed({
    get: () => store.settings[key],
    set: (value: Settings[K]) => store.apply((q) => updateSettings(q, { [key]: value })),
  })
}

const theme = setting('theme')
const textScale = setting('textScale')
const reducedMotion = setting('reducedMotion')
const sequentialMode = setting('sequentialMode')
const lightMode = setting('lightMode')
const showGamification = setting('showGamification')
const weeklyGoal = setting('weeklyGoal')

const THEMES = [
  { value: 'system', label: 'Как в системе' },
  { value: 'light', label: 'Пергамент — светлая' },
  { value: 'dark', label: 'Кинозал — тёмная' },
] as const
const TEXT_SCALES = [
  { value: 'small', label: 'Мельче' },
  { value: 'normal', label: 'Обычный' },
  { value: 'large', label: 'Крупнее' },
] as const
</script>

<template>
  <div class="data container">
    <header class="data__head">
      <p class="eyebrow">Резервная копия · импорт · настройки</p>
      <h1>Данные и настройки</h1>
      <p class="data__lead">
        У сайта нет сервера и аккаунтов: прогресс хранится только в этом браузере на этом устройстве. Он не появится
        сам на другом компьютере и пропадёт, если очистить данные сайта. Чтобы перенести прогресс или подстраховаться,
        скачайте резервную копию — обычный JSON-файл.
      </p>
    </header>

    <p class="data__message" role="status">{{ message }}</p>

    <section class="backup" aria-labelledby="backup-title">
      <div class="card backup__card" data-tint="peach">
        <h2 id="backup-title" class="card__title">Резервная копия</h2>

        <template v-if="blocked">
          <p>
            Сохранённые данные не прочитаны — подробности в сообщении вверху страницы. Скачайте их как есть или
            импортируйте резервную копию: она заменит их, а нечитаемые данные останутся в браузере отдельной копией.
          </p>
        </template>
        <template v-else>
          <dl class="facts">
            <div>
              <dt>Последняя копия</dt>
              <dd>{{ p.backup.lastExportAt ? formatDateTime(p.backup.lastExportAt) : 'ещё не скачивали' }}</dd>
            </div>
            <div>
              <dt>Последний импорт</dt>
              <dd>{{ p.backup.lastImportAt ? formatDateTime(p.backup.lastImportAt) : 'не было' }}</dd>
            </div>
            <div>
              <dt>Сейчас в браузере</dt>
              <dd>
                {{ current.filmsWithProgress }} {{ films(current.filmsWithProgress) }} с прогрессом,
                {{ current.notes }} {{ notes(current.notes) }}
              </dd>
            </div>
          </dl>
          <p v-if="reminder.show" class="backup__reminder">{{ reminder.message }} Самое время скачать копию.</p>
          <p v-if="store.loadState === 'unavailable'" class="backup__reminder">
            Браузер не разрешает сохранять данные: всё записанное пропадёт после закрытия вкладки.
          </p>
        </template>

        <div class="backup__actions">
          <AppButton v-if="blocked" variant="primary" @click="downloadRaw">Скачать данные как есть</AppButton>
          <AppButton v-else variant="primary" @click="exportNow">Скачать резервную копию</AppButton>
          <span ref="importButton">
            <AppButton @click="chooseFile">Импортировать резервную копию</AppButton>
          </span>
          <input
            ref="fileInput"
            class="visually-hidden"
            type="file"
            accept=".json,application/json"
            tabindex="-1"
            aria-hidden="true"
            @change="onFile"
          />
        </div>
        <p class="backup__hint">
          Файл можно открыть в текстовом редакторе: это читаемый JSON без пароля и личных данных — только прогресс,
          заметки и настройки курса.
        </p>
      </div>

      <section
        v-if="importView"
        ref="importBox"
        class="card import"
        data-tint="sky"
        :class="`import--${importView.kind === 'done' && !importView.saved ? 'error' : importView.kind}`"
        aria-labelledby="import-title"
      >
        <template v-if="importView.kind === 'reading'">
          <h3 id="import-title" ref="importTitle" tabindex="-1">Читаю файл «{{ importView.name }}»…</h3>
        </template>

        <div v-else-if="importView.kind === 'error'" role="alert" class="import__body">
          <h3 id="import-title" ref="importTitle" tabindex="-1">Файл «{{ importView.name }}» не подошёл</h3>
          <p>{{ importView.error.message }}</p>
          <p><strong>Текущий прогресс не изменён.</strong></p>
          <DisclosurePanel v-if="importView.error.details.length" summary="Подробности для проверки файла">
            <ul class="import__details">
              <li v-for="d in importView.error.details" :key="d">{{ d }}</li>
            </ul>
          </DisclosurePanel>
          <div class="import__actions">
            <AppButton @click="chooseFile">Выбрать другой файл</AppButton>
            <AppButton variant="ghost" @click="cancelImport">Закрыть</AppButton>
          </div>
        </div>

        <template v-else-if="importView.kind === 'preview'">
          <h3 id="import-title" ref="importTitle" tabindex="-1">Что в файле «{{ importView.name }}»</h3>
          <p class="import__meta">
            Копия от {{ importView.info.exportedAt ? formatDateTime(importView.info.exportedAt) : 'неизвестной даты' }}
            · формат версии {{ importView.info.schemaVersion }}<template v-if="importView.info.appVersion">
              · сайт {{ importView.info.appVersion }}</template>
          </p>
          <p v-if="importView.migratedFrom !== null" class="import__note">
            Файл старого формата — при загрузке он обновится до версии {{ CURRENT_SCHEMA_VERSION }}, данные не теряются.
          </p>

          <table class="compare">
            <thead>
              <tr>
                <th scope="col"><span class="visually-hidden">Что</span></th>
                <th scope="col">Сейчас в браузере</th>
                <th scope="col">В файле</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in summaryRows(importView.summary)" :key="row.label">
                <th scope="row">{{ row.label }}</th>
                <td>{{ blocked ? '—' : summaryRows(current)[i]?.value }}</td>
                <td>{{ row.value }}</td>
              </tr>
            </tbody>
          </table>

          <p v-if="importView.summary.unknownFilmIds.length" class="import__note">
            В файле есть фильмы, которых нет в курсе ({{ importView.summary.unknownFilmIds.join(', ') }}). Их данные
            сохранятся, но показываться не будут.
          </p>
          <DisclosurePanel
            v-if="importView.warnings.length"
            :summary="`Что исправлено при чтении (${importView.warnings.length})`"
          >
            <ul class="import__details">
              <li v-for="w in importView.warnings" :key="w">{{ w }}</li>
            </ul>
          </DisclosurePanel>

          <div class="choices">
            <div v-if="!blocked" class="choice">
              <AppButton variant="primary" @click="merge">Объединить с текущим</AppButton>
              <p>
                Ничего не теряется: берутся более продвинутые статусы и ранние даты, а если ответ записан по-разному,
                сохраняются обе версии.
              </p>
            </div>
            <div class="choice">
              <AppButton variant="danger" @click="askReplace">Заменить текущий прогресс</AppButton>
              <p>
                В браузере останутся только данные из файла, включая настройки. Перед заменой копия текущих данных
                сохранится, и импорт можно будет отменить.
              </p>
            </div>
          </div>
          <AppButton variant="ghost" @click="cancelImport">Отмена — ничего не менять</AppButton>
        </template>

        <div v-else class="import__body" role="status">
          <h3 id="import-title" ref="importTitle" tabindex="-1">{{ importView.title }}</h3>
          <ul class="import__details">
            <li v-for="line in importView.lines" :key="line">{{ line }}</li>
          </ul>
        </div>
      </section>

      <div v-if="store.undoImportAvailable && !blocked" class="undo">
        <p>Последний импорт можно отменить — вернутся данные, которые были в браузере до него.</p>
        <AppButton variant="ghost" @click="confirmUndoImport = true">Отменить импорт</AppButton>
      </div>
    </section>

    <InkDivider />

    <section class="settings" aria-labelledby="settings-title">
      <h2 id="settings-title">Настройки</h2>
      <p v-if="blocked" class="muted prose">
        Пока сохранённые данные не прочитаны, изменения настроек действуют только до закрытия вкладки.
      </p>
      <p v-else class="muted prose">Сохраняются сразу, вместе с прогрессом, и попадают в резервную копию.</p>

      <div class="settings__grid">
        <section class="settings__group" aria-labelledby="look-title">
          <h3 id="look-title">Внешний вид</h3>
          <ChoiceChips v-model="theme" legend="Тема" :options="THEMES" />
          <ChoiceChips v-model="textScale" legend="Размер текста" :options="TEXT_SCALES" />
          <ToggleField
            v-model="reducedMotion"
            label="Меньше движения"
            hint="Без плавной прокрутки и переходов. Системная настройка «уменьшить движение» учитывается всегда."
          />
        </section>

        <section class="settings__group" aria-labelledby="study-title">
          <h3 id="study-title">Порядок занятий</h3>
          <ToggleField
            v-model="sequentialMode"
            label="Строгий порядок уровней"
            hint="Задания уровня открываются после завершения предыдущего. Закрытые уровни всё равно можно читать."
          />
          <ToggleField
            v-model="lightMode"
            label="Облегчённый режим"
            hint="Для завершения фильма хватит просмотра и короткого наблюдения вместо полного упражнения."
          />
        </section>

        <section class="settings__group" aria-labelledby="game-title">
          <h3 id="game-title">Игровые элементы</h3>
          <ToggleField
            v-model="showGamification"
            label="Показывать ранги, опыт и достижения"
            hint="Если выключить, награды продолжат считаться в фоне и вернутся при включении."
          />
          <ToggleField
            v-model="weeklyGoal"
            label="Личная цель «один фильм в неделю»"
            hint="Мягкий ориентир на странице достижений: без напоминаний и наказаний за перерывы."
          />
        </section>
      </div>
    </section>

    <InkDivider />

    <section class="card reset" aria-labelledby="reset-title">
      <h2 id="reset-title" class="card__title">Сброс прогресса</h2>
      <template v-if="blocked">
        <p class="muted">
          Пока сохранённые данные не прочитаны, сбрасывать нечего: решите, что с ними делать, в сообщении вверху
          страницы.
        </p>
      </template>
      <template v-else>
        <p>
          Удаляет из браузера статусы фильмов, ответы, заметки, мотивы, выпускную работу, опыт и достижения.
          Настройки остаются. Перед сбросом лучше скачать резервную копию.
        </p>
        <div class="reset__actions">
          <AppButton variant="danger" :disabled="!store.started" @click="askReset">Сбросить прогресс</AppButton>
          <AppButton v-if="store.undoResetAvailable" variant="ghost" @click="confirmUndoReset = true">
            Вернуть данные до сброса
          </AppButton>
        </div>
        <p v-if="!store.started" class="muted reset__note">Прогресса пока нет — сбрасывать нечего.</p>
      </template>
    </section>

    <DisclosurePanel summary="О формате файла" class="about">
      <p>
        Резервная копия — JSON с полями <code>format</code> («{{ PROGRESS_FORMAT }}»), <code>schemaVersion</code>
        (сейчас {{ CURRENT_SCHEMA_VERSION }}), <code>exportedAt</code>, <code>appVersion</code> и
        <code>progress</code>. Даты хранятся в ISO 8601 (UTC), учебные дни — как локальные даты ГГГГ-ММ-ДД.
      </p>
      <p>
        Файлы старых версий формата обновляются при импорте. Файл более новой версии сайта не импортируется — текущие
        данные при этом не меняются.
      </p>
      <p class="muted">Версия сайта: {{ appVersion }} · ключ в хранилище браузера: <code>{{ STORAGE_KEY }}</code></p>
    </DisclosurePanel>

    <ConfirmDialog
      :open="confirmReplace"
      title="Заменить текущий прогресс?"
      confirm-label="Заменить"
      danger
      @confirm="replace"
      @cancel="confirmReplace = false"
    >
      <p v-if="blocked">Нечитаемые данные останутся в браузере отдельной копией, а прогресс загрузится из файла.</p>
      <template v-else>
        <p>
          Сейчас в браузере {{ current.filmsWithProgress }} {{ films(current.filmsWithProgress) }} с прогрессом и
          {{ current.notes }} {{ notes(current.notes) }}. После замены останутся только данные из файла.
        </p>
        <p>Копия текущих данных сохранится в браузере — импорт можно отменить. Надёжнее скачать её и файлом.</p>
        <p class="dialog-export">
          <AppButton :disabled="exportedBeforeReplace" @click="exportBeforeReplace">
            {{ exportedBeforeReplace ? 'Копия скачана' : 'Скачать текущую копию' }}
          </AppButton>
        </p>
      </template>
    </ConfirmDialog>

    <ConfirmDialog
      :open="confirmUndoImport"
      title="Отменить импорт?"
      confirm-label="Отменить импорт"
      cancel-label="Оставить как есть"
      @confirm="undoImport"
      @cancel="confirmUndoImport = false"
    >
      <p>Вернутся данные, которые были в браузере до последнего импорта. Всё, что записано после импорта, пропадёт.</p>
    </ConfirmDialog>

    <ConfirmDialog
      :open="confirmReset"
      title="Сбросить весь прогресс?"
      confirm-label="Сбросить"
      danger
      @confirm="reset"
      @cancel="confirmReset = false"
    >
      <p>
        Будут удалены {{ current.filmsWithProgress }} {{ films(current.filmsWithProgress) }} с прогрессом,
        {{ current.notes }} {{ notes(current.notes) }}, ответы, выпускная работа, опыт и достижения. Настройки останутся.
      </p>
      <p>Скачайте резервную копию, чтобы при желании вернуть всё импортом.</p>
      <p class="dialog-export">
        <AppButton :disabled="exportedBeforeReset" @click="exportBeforeReset">
          {{ exportedBeforeReset ? 'Копия скачана' : 'Скачать резервную копию' }}
        </AppButton>
      </p>
    </ConfirmDialog>

    <ConfirmDialog
      :open="confirmUndoReset"
      title="Вернуть данные до сброса?"
      confirm-label="Вернуть"
      cancel-label="Оставить как есть"
      @confirm="undoReset"
      @cancel="confirmUndoReset = false"
    >
      <p>Прогресс вернётся к состоянию перед последним сбросом. Всё, что записано после сброса, пропадёт.</p>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.data {
  display: grid;
  gap: 2rem;
  padding-top: clamp(1.5rem, 4vw, 2.5rem);
}
.data__head {
  display: grid;
  gap: 0.6rem;
  max-width: var(--measure);
}
.data__lead {
  font-size: 1.1rem;
  color: var(--ink-soft);
}
.data__message:empty {
  display: none;
}
.data__message {
  max-width: var(--measure);
  padding: 0.75rem 1rem;
  border-left: 3px solid var(--moss);
  background: var(--moss-wash);
  font-weight: 560;
}
.card__title {
  font-size: 1.6rem;
}

/* ---------- Резервная копия и импорт ---------- */
.backup {
  display: grid;
  gap: 1.25rem;
  max-width: 48rem;
}
.backup__card {
  display: grid;
  gap: 1rem;
}
.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  gap: 0.75rem 1.5rem;
  margin: 0;
}
.facts dt {
  font-size: 0.85rem;
  color: var(--ink-soft);
}
.facts dd {
  margin: 0;
  font-weight: 560;
}
.backup__reminder {
  padding: 0.6rem 0.9rem;
  border-left: 3px solid var(--gold);
  background: var(--paper-sunken);
}
.backup__actions,
.import__actions,
.reset__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
.backup__hint {
  font-size: 0.92rem;
  color: var(--ink-soft);
}

.import {
  display: grid;
  gap: 1rem;
  border-color: var(--line-strong);
}
.import h3 {
  font-size: 1.45rem;
  overflow-wrap: anywhere;
}
.import h3:focus {
  outline: none;
}
.import h3:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
}
.import--error {
  border-left: 4px solid var(--accent);
}
.import--done {
  border-left: 4px solid var(--moss);
}
.import__body {
  display: grid;
  gap: 0.75rem;
}
.import__meta {
  color: var(--ink-soft);
  font-size: 0.95rem;
}
.import__note {
  font-size: 0.95rem;
  padding: 0.5rem 0.8rem;
  background: var(--paper-sunken);
  border-radius: var(--radius-s);
}
.import__details {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  padding-left: 1.2rem;
  font-size: 0.95rem;
  overflow-wrap: anywhere;
}

.compare {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.97rem;
}
.compare th,
.compare td {
  padding: 0.45rem 0.75rem 0.45rem 0;
  border-bottom: 1px solid var(--line);
  text-align: left;
}
.compare thead th {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink-soft);
  border-bottom-color: var(--line-strong);
}
.compare tbody th {
  font-weight: 400;
}
.compare td {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.choices {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
  gap: 1rem;
}
.choice {
  display: grid;
  gap: 0.5rem;
  align-content: start;
  justify-items: start;
  padding: 1rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--paper);
}
.choice p {
  font-size: 0.93rem;
  color: var(--ink-soft);
}

.undo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 1rem;
  font-size: 0.95rem;
  color: var(--ink-soft);
}

/* ---------- Настройки ---------- */
.settings {
  display: grid;
  gap: 1rem;
}
.settings__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  gap: 1.5rem 2.5rem;
  align-items: start;
}
.settings__group {
  display: grid;
  gap: 1rem;
}
.settings__group h3 {
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--line-strong);
}
.settings__group :deep(.chips__legend) {
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: 560;
}
.settings__group .toggle + .toggle {
  border-top: 1px solid var(--line);
}

/* ---------- Сброс ---------- */
.reset {
  display: grid;
  gap: 0.9rem;
  max-width: 48rem;
  border-color: var(--accent);
  border-left-width: 4px;
}
.reset__note {
  font-size: 0.92rem;
}

.about {
  max-width: 48rem;
}
.about p + p {
  margin-top: 0.6rem;
}
code {
  font-size: 0.9em;
  overflow-wrap: anywhere;
}
.dialog-export {
  margin-top: 0.9rem;
}

@media (max-width: 30rem) {
  .compare td {
    white-space: normal;
  }
}
</style>
