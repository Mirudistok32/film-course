<script setup lang="ts">
/**
 * Оболочка всех страниц: ссылка «к содержанию», шапка с навигацией
 * (на узком экране — выпадающее меню), индикатор сохранения, ранг
 * (на телефоне опыт — в меню), переключатель темы, баннеры хранилища,
 * уведомления и подвал.
 *
 * Шапка не липкая: на телефоне она не съедает место над полем ответа
 * и не перекрывает содержание (ТЗ §35).
 */
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { RouterLink, START_LOCATION, useRoute, useRouter } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import { rankFor } from '@/domain/rewards/rewards.engine'
import { useEffectiveTheme } from '@/composables/useAppearance'
import GnarledTree from '@/illustrations/GnarledTree.vue'
import SaveIndicator from './SaveIndicator.vue'
import StorageBanner from './StorageBanner.vue'
import ToastStack from './ToastStack.vue'

const store = useProgressStore()
const route = useRoute()
const router = useRouter()
const { theme, toggle } = useEffectiveTheme()

const NAV = [
  { name: 'course', label: 'Курс' },
  { name: 'journal', label: 'Журнал' },
  { name: 'glossary', label: 'Словарь' },
  { name: 'achievements', label: 'Достижения' },
  { name: 'data', label: 'Данные' },
] as const

/** Раздел «Курс» подсвечивается и на страницах уровней и фильмов. */
const SECTION_OF: Record<string, string> = { level: 'course', film: 'course', graduation: 'course' }
const section = computed(() => {
  const name = String(route.name ?? '')
  return SECTION_OF[name] ?? name
})

const rank = computed(() => rankFor(store.progress.xp).rank)
const version = __APP_VERSION__

const menuOpen = ref(false)
const main = ref<HTMLElement | null>(null)
const menuButton = ref<HTMLButtonElement | null>(null)

function focusMain() {
  main.value?.focus()
}

function onMenuKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && menuOpen.value) {
    menuOpen.value = false
    menuButton.value?.focus()
  }
}

// После перехода — закрыть меню и перенести фокус в начало содержимого,
// чтобы клавиатура и скринридер не оставались в шапке. Смена одних параметров
// (?step=, фильтры журнала) — та же страница: фокус остаётся на нажатом.
// Первая навигация (открытие сайта) фокус не трогает.
watch(
  () => route.fullPath,
  () => (menuOpen.value = false),
)
const stopFocus = router.afterEach(async (to, from, failure) => {
  if (failure || from === START_LOCATION || to.path === from.path) return
  await nextTick()
  main.value?.focus({ preventScroll: true })
})
onUnmounted(stopFocus)
</script>

<template>
  <a class="skip-link" href="#main" @click.prevent="focusMain">Перейти к содержанию</a>

  <header class="shell-header" @keydown="onMenuKey">
    <div class="shell-header__inner container">
      <RouterLink :to="{ name: 'home' }" class="brand">
        <GnarledTree class="brand__tree" seed="brand-mark" :depth="4" />
        <span class="brand__title">Кино как способ мышления</span>
      </RouterLink>

      <div class="shell-header__tools">
        <SaveIndicator />
        <RouterLink
          v-if="store.settings.showGamification"
          :to="{ name: 'achievements' }"
          class="rank-chip"
          :title="`Ранг: ${rank.title}`"
        >
          <span class="rank-chip__title">{{ rank.title }}</span>
          <span class="rank-chip__xp">{{ store.progress.xp }}&nbsp;XP</span>
        </RouterLink>
        <button
          type="button"
          class="icon-btn"
          :aria-label="theme === 'dark' ? 'Включить светлую тему «пергамент»' : 'Включить тёмную тему «кинозал»'"
          @click="toggle"
        >
          <svg v-if="theme === 'dark'" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="4.5" />
            <path
              d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"
            />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />
          </svg>
        </button>
        <button
          ref="menuButton"
          type="button"
          class="icon-btn menu-btn"
          :aria-expanded="menuOpen"
          aria-controls="site-nav"
          @click="menuOpen = !menuOpen"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path v-if="menuOpen" d="M6 6l12 12M18 6L6 18" />
            <path v-else d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          <span class="visually-hidden">Меню</span>
        </button>
      </div>

      <nav id="site-nav" class="site-nav" :class="{ 'site-nav--open': menuOpen }" aria-label="Разделы сайта">
        <ul>
          <li v-for="item in NAV" :key="item.name">
            <RouterLink
              :to="{ name: item.name }"
              class="site-nav__link"
              :class="{ 'site-nav__link--active': section === item.name }"
              :aria-current="section === item.name ? 'page' : undefined"
            >
              {{ item.label }}
              <span v-if="item.name === 'achievements' && store.settings.showGamification" class="site-nav__xp">
                {{ store.progress.xp }}&nbsp;XP
              </span>
            </RouterLink>
          </li>
        </ul>
      </nav>
    </div>
  </header>

  <StorageBanner />

  <main id="main" ref="main" tabindex="-1" class="shell-main">
    <slot />
  </main>

  <footer class="shell-footer">
    <div class="container shell-footer__inner">
      <p>
        Прогресс хранится только в этом браузере. Резервная копия —
        <RouterLink :to="{ name: 'data' }">в разделе «Данные»</RouterLink>.
      </p>
      <p class="muted">Учебные тексты — редакционный черновик. Версия {{ version }}.</p>
    </div>
  </footer>

  <ToastStack />
</template>

<style scoped>
.skip-link {
  position: absolute;
  left: 1rem;
  top: -10rem;
  z-index: 100;
  padding: 0.6rem 1rem;
  background: var(--ink);
  color: var(--paper);
  border-radius: var(--radius-s);
}
.skip-link:focus {
  top: 1rem;
}

.shell-header {
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--paper-raised) 70%, transparent);
}
.shell-header__inner {
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-areas: 'brand nav tools';
  align-items: center;
  gap: 0.5rem 1.5rem;
  min-height: var(--header-h);
}

.brand {
  grid-area: brand;
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  text-decoration: none;
  color: var(--ink);
}
.brand__tree {
  width: 2.4rem;
  height: 2.4rem;
}
.brand__title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.35rem;
  line-height: 1.05;
}

.site-nav {
  grid-area: nav;
}
.site-nav ul {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.site-nav__link {
  display: inline-block;
  padding: 0.4rem 0.1rem;
  text-decoration: none;
  border-bottom: 2px solid transparent;
}
.site-nav__link--active {
  border-bottom-color: var(--accent);
  font-weight: 600;
}
/* Опыт в пункте «Достижения» — только в меню телефона, где его нет в шапке. */
.site-nav__xp {
  display: none;
}

.shell-header__tools {
  grid-area: tools;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.rank-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
  padding: 0.2rem 0.65rem;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  font-size: 0.85rem;
  text-decoration: none;
  white-space: nowrap;
}
.rank-chip__title {
  /* Длинные ранги («Кинематографический мыслитель») не должны выталкивать меню на вторую строку. */
  max-width: 7.5em;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--font-accent);
  font-weight: 500;
  font-size: 0.85rem;
}
.rank-chip__xp {
  color: var(--gold);
  font-weight: 600;
}

.icon-btn {
  display: inline-grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-s);
  background: transparent;
  cursor: pointer;
}
.icon-btn:hover {
  border-color: var(--line-strong);
  background: var(--paper-sunken);
}
.icon-btn svg {
  width: 1.3rem;
  height: 1.3rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.menu-btn {
  display: none;
}

.shell-main {
  display: block;
  flex: 1;
  padding-bottom: 4rem;
}
.shell-main:focus {
  outline: none;
}

.shell-footer {
  border-top: 1px solid var(--line);
  padding: 1.5rem 0 2.5rem;
  font-size: 0.9rem;
}
.shell-footer__inner {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem 2rem;
}

/* Ноутбук: название сайта в две строки, чтобы меню и ранг уместились в одну. */
@media (max-width: 90rem) {
  .brand__title {
    max-width: 9.5em;
  }
}

/* Средняя ширина: навигация уходит на вторую строку. */
@media (max-width: 68rem) {
  .shell-header__inner {
    grid-template-columns: 1fr auto;
    grid-template-areas:
      'brand tools'
      'nav nav';
    padding-bottom: 0.25rem;
  }
}

/* Узкий экран: навигация — выпадающее меню. */
@media (max-width: 44rem) {
  .brand__tree {
    width: 1.9rem;
    height: 1.9rem;
  }
  .brand__title {
    font-size: 1.05rem;
  }
  .shell-header__tools {
    gap: 0.4rem;
  }
  .rank-chip__title {
    display: none;
  }
  .menu-btn {
    display: inline-grid;
  }
  .site-nav {
    display: none;
  }
  .site-nav--open {
    display: block;
  }
  .site-nav ul {
    flex-direction: column;
    gap: 0;
    padding: 0.25rem 0 0.75rem;
  }
  .site-nav__link {
    display: block;
    padding: 0.8rem 0.25rem;
    border-bottom: 1px solid var(--line);
  }
  .site-nav__link--active {
    border-bottom-color: var(--line);
    color: var(--accent);
  }
}

/* Телефон: шапка в одну строку — опыт уходит в меню (звание видно на главной
   и в достижениях), название сайта не переносится. */
@media (max-width: 30rem) {
  .rank-chip {
    display: none;
  }
  .site-nav__link {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
  }
  .site-nav__xp {
    display: inline;
    color: var(--gold);
    font-weight: 600;
  }
  .shell-header__inner {
    column-gap: 0.6rem;
  }
  /* Кегль названия подстраивается под место между краем и кнопками:
     строка «Кино как способ мышления» — около 13.8em. */
  .brand {
    container: brand / inline-size;
    min-width: 0;
    gap: 0.4rem;
  }
  .brand__tree {
    flex: none;
    width: 1.6rem;
    height: 1.6rem;
  }
  .brand__title {
    max-width: none;
    overflow: hidden;
    font-size: clamp(0.75rem, (100cqi - 2rem) / 13.8, 1.05rem);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .shell-header__tools {
    gap: 0.3rem;
  }
  /* Статус сохранения — значком; текст остаётся для скринридера. */
  .shell-header__tools :deep(.save span[role='status']) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
}

/* Совсем узкий телефон: дерево уступает место названию. */
@container brand (max-width: 13.5rem) {
  .brand__tree {
    display: none;
  }
  .brand__title {
    font-size: clamp(0.75rem, 100cqi / 13.8, 1.05rem);
  }
}
</style>
