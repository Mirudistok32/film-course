# Формат сохранения

Прогресс хранится только в браузере (`localStorage`) и переносится JSON-файлом. Каталог курса и учебные тексты в файл не входят: в нём только то, что сделал пользователь. Типы — [src/domain/progress/progress.types.ts](../src/domain/progress/progress.types.ts).

## Файл резервной копии

```json
{
  "format": "kino-kak-sposob-myshleniya-progress",
  "schemaVersion": 2,
  "exportedAt": "2026-10-28T17:00:00.000Z",
  "appVersion": "0.1.0",
  "progress": { "…": "UserProgress" }
}
```

- Имя файла: `kino-kak-sposob-myshleniya-progress-ГГГГ-ММ-ДД.json`; JSON с отступами, его можно открыть в текстовом редакторе.
- Даты событий — ISO 8601 в UTC (`2026-10-28T16:30:00.000Z`), календарные дни (`lastActiveDate`, `activityDays`, `reminderSnoozedUntil`) — локальная дата `ГГГГ-ММ-ДД`.
- В браузере хранится та же обёртка под ключом `kino-kak-sposob-myshleniya:progress`, только вместо `exportedAt` — `savedAt`.

## `progress` (схема 2)

| Поле | Что хранит |
|---|---|
| `createdAt`, `lastActiveDate` | Когда начат курс; последний день занятий |
| `currentLevelId`, `currentFilmId` | Где пользователь остановился (кнопка «Продолжить») |
| `films[filmId]` | Прогресс по фильму, см. ниже. Только фильмы, которые трогали |
| `levels[levelId]` | `completedAt`, итоговая заметка уровня `reflection`, `reflectionUpdatedAt` |
| `notes[]` | Все заметки: `id`, `text`, `kind` (`free`, `observation`, `hypothesis`, `question`, `merge-copy`), `filmId` (`null` — свободная заметка), `createdAt`, `updatedAt`, `tags` |
| `motifs[]` | Мотивы: `id`, `title`, `description`, `filmIds`, даты |
| `graduation` | Выпускная работа: `subject`, `filmId`, `mainQuestion`, `decisions[]` (`observation`, `effect`), `connections`, `interpretation`, `completedAt`, `updatedAt` |
| `achievements[]` | Открытые достижения: `id`, `unlockedAt` |
| `xpLedger[]` | Уникальные события опыта: `id`, `amount`, `at` |
| `xp` | Сумма `xpLedger`; хранится для читаемости и при загрузке пересчитывается |
| `activityDays[]` | Дни, в которые были занятия (для блока «Активность», без стриков) |
| `settings` | `showGamification`, `reducedMotion`, `textScale` (`small` / `normal` / `large`), `theme` (`system` / `light` / `dark`), `sequentialMode`, `lightMode`, `weeklyGoal` |
| `backup` | `lastExportAt`, `lastImportAt`, `reminderSnoozedUntil` |

**Фильм** (`films[filmId]`):

| Поле | Значения |
|---|---|
| `watchStatus` | `not-watched`, `started`, `watched` |
| `analysisStatus` | `not-started`, `in-progress`, `completed` |
| `startedAt`, `watchedAt`, `completedAt`, `updatedAt` | Даты; `completedAt` — пользователь отметил фильм пройденным |
| `answers` | Цепочка ответа: `observation` → `feeling` → `hypothesis` → `evidence`, необязательные `altHypothesis` и `openQuestion` |
| `exercise` | `response` (текст), `checklist` (индексы отмеченных пунктов самопроверки: сначала 3 общих, затем пункты урока), `completedAt`, `sampleOpenedAt` |
| `isFavorite`, `revisitLater`, `reviewing` | Избранное, «вернуться позже», «разбираю повторно» |

Почему XP — журнал событий, а не число: id события (например, `watched:nosferatu`) не даёт начислить опыт дважды — ни при повторном действии, ни при повторном импорте того же файла.

## Проверка при загрузке и импорте

[progress.document.ts](../src/domain/progress/progress.document.ts) и [progress.validate.ts](../src/domain/progress/progress.validate.ts):

1. Файл не больше 5 МБ, не пустой, это JSON.
2. `format` совпадает, `schemaVersion` — целое число от 1 до текущей. Файл из более новой версии сайта не принимается с понятным объяснением.
3. Старые версии мигрируют до текущей (см. ниже).
4. Валидация:
   - неверный тип обязательного поля или неизвестный статус — ошибка, файл не принимается, текущий прогресс не меняется;
   - отсутствующее необязательное поле получает значение по умолчанию;
   - неизвестные поля игнорируются;
   - ссылки на фильмы, которых нет в каталоге, сохраняются (каталог мог измениться), о них сообщается предупреждением;
   - ограничения: текст поля до 50 000 символов, до 10 000 заметок, до 20 000 событий опыта.
5. Предупреждения показываются человеческим языком, без путей к полям.

Если данные в самом браузере не читаются или записаны более новой версией сайта, сайт не перезаписывает их молча: запись приостановлена, пользователю предлагают скачать данные как есть, заменить их импортом или начать заново. Когда данные в браузере мигрируют на новую схему, копия прежних сохраняется снимком.

## Импорт: замена и объединение

После проверки показывается предпросмотр «Сейчас в браузере / В файле», затем выбор:

- **Объединить** (основная кнопка, [progress.merge.ts](../src/domain/progress/progress.merge.ts)):
  - статусы берутся более продвинутые, даты завершения — самые ранние;
  - тексты не теряются: если поле заполнено по-разному, в поле остаётся текущая версия, а версия из файла сохраняется отдельной заметкой `kind: "merge-copy"` с меткой `merge-conflict`; повторный импорт того же файла копий не плодит (сравнение по тексту);
  - заметки и мотивы объединяются по `id`, достижения — по `id` с самой ранней датой, опыт — по `id` событий;
  - настройки остаются текущими.
- **Заменить** — с подтверждением и кнопкой «Скачать текущую копию». Если прогресса в браузере нет, подтверждение не нужно.

Перед заменой, объединением и сбросом текущее состояние сохраняется снимком в `localStorage` (`kino-kak-sposob-myshleniya:snapshot:before-import` / `…:before-reset`); кнопки «Отменить импорт» и «Вернуть данные до сброса» восстанавливают его.

## Миграции

[progress.migrations.ts](../src/domain/progress/progress.migrations.ts). Миграция `N → N+1` получает сырые данные и не бросает исключений на неожиданных типах — их ловит валидатор. Шаги, которым нужен уже проверенный прогресс и каталог, выполняются в `finalize`.

**v1 → v2** (v1 — пример из ТЗ, [tests/fixtures/progress-v1-example.json](../tests/fixtures/progress-v1-example.json)):

- `films[id].notes` переезжают в общий массив `notes` с `filmId`;
- `exerciseCompleted: true` → `exercise.completedAt` (дата — `updatedAt` фильма), `exercise.response` — пустая строка: в v1 текст ответа не хранился, поэтому после миграции упражнение может быть «выполнено» при пустом поле — это верно;
- `levels[id]` получают пустую итоговую заметку;
- добавляются `motifs`, `graduation`, `activityDays` (из `lastActiveDate`), `backup`;
- `xp` превращается в журнал: события выводятся из состояния, а если исходный `xp` был больше, разница сохраняется событием `legacy:v1-balance` — опыт после миграции не уменьшается.

**Как добавить версию:** поднять `CURRENT_SCHEMA_VERSION`, добавить миграцию в `MIGRATIONS`, обновить валидатор и значения по умолчанию, написать тест миграции на файле-примере предыдущей версии.
