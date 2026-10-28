/**
 * Маршруты через # (/#/film/nosferatu): так сайт открывается с диска
 * двойным кликом по dist/index.html и работает на любом хостинге без
 * правил перенаправления.
 *
 * Поэтому внутри страниц нельзя ставить якорные ссылки вида href="#id":
 * они подменят маршрут. Прокрутку к блоку делать через scrollIntoView.
 */
import { createRouter, createWebHashHistory } from 'vue-router'
import { formatPageTitle } from '@/composables/usePageTitle'
import AchievementsView from '@/views/AchievementsView.vue'
import CourseView from '@/views/CourseView.vue'
import DataSettingsView from '@/views/DataSettingsView.vue'
import FilmView from '@/views/FilmView.vue'
import GlossaryView from '@/views/GlossaryView.vue'
import GraduationView from '@/views/GraduationView.vue'
import HomeView from '@/views/HomeView.vue'
import JournalView from '@/views/JournalView.vue'
import LevelView from '@/views/LevelView.vue'
import NotFoundView from '@/views/NotFoundView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    /** Заголовок вкладки; страницы с динамическим заголовком задают его сами. */
    title?: string
  }
}

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/course', name: 'course', component: CourseView, meta: { title: 'Карта курса' } },
    { path: '/course/:levelId', name: 'level', component: LevelView, meta: { title: 'Уровень' } },
    { path: '/film/:filmId', name: 'film', component: FilmView, meta: { title: 'Фильм' } },
    { path: '/journal', name: 'journal', component: JournalView, meta: { title: 'Журнал' } },
    { path: '/glossary', name: 'glossary', component: GlossaryView, meta: { title: 'Словарь' } },
    { path: '/achievements', name: 'achievements', component: AchievementsView, meta: { title: 'Достижения' } },
    { path: '/settings/data', name: 'data', component: DataSettingsView, meta: { title: 'Данные и настройки' } },
    { path: '/graduation', name: 'graduation', component: GraduationView, meta: { title: 'Выпускная работа' } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView, meta: { title: 'Страница не найдена' } },
  ],
  // Смена только query (шаг урока ?step=) не прокручивает страницу.
  scrollBehavior: (to, from, saved) => saved ?? (to.path === from.path ? false : { top: 0 }),
})

router.afterEach((to) => {
  document.title = formatPageTitle(to.meta.title)
})
