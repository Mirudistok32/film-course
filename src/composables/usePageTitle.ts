/**
 * Заголовок вкладки. Статичные страницы задают его в meta.title маршрута,
 * страницы уровня и фильма — через usePageTitle из своих данных.
 */
import { watchEffect } from 'vue'

export const COURSE_TITLE = 'Кино как способ мышления'

export function formatPageTitle(title?: string): string {
  return title ? `${title} — ${COURSE_TITLE}` : COURSE_TITLE
}

/** Наблюдатель срабатывает после router.afterEach, поэтому побеждает meta.title. */
export function usePageTitle(title: () => string | undefined) {
  watchEffect(() => {
    document.title = formatPageTitle(title())
  })
}
