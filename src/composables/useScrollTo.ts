/**
 * Прокрутка к блоку страницы без якорной ссылки: hash-роутер принял бы её
 * за адрес. Плавно, если движение не отключено в настройках или системе
 * (instant — сразу, например при открытии страницы по ссылке на блок);
 * фокус переносится на блок, чтобы с клавиатуры продолжить с этого места.
 */
import { useProgressStore } from '@/stores/progress'

export function useScrollTo() {
  const store = useProgressStore()
  return (
    target: HTMLElement | null | undefined,
    focusTarget: HTMLElement | null | undefined = target,
    instant = false,
  ) => {
    const reduce =
      instant || store.settings.reducedMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    target?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    focusTarget?.focus({ preventScroll: true })
  }
}
