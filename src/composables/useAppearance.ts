/**
 * Переносит настройки внешнего вида из прогресса на <html>:
 * тему, размер текста и уменьшение движения. CSS читает их
 * из data-атрибутов (src/styles/tokens.css, base.css).
 */
import { computed, onScopeDispose, ref, watchEffect } from 'vue'
import { useProgressStore } from '@/stores/progress'
import { updateSettings } from '@/domain/progress/progress.actions'

export function useAppearance() {
  const store = useProgressStore()
  watchEffect(() => {
    const s = store.settings
    const root = document.documentElement
    if (s.theme === 'system') delete root.dataset.theme
    else root.dataset.theme = s.theme
    root.dataset.textScale = s.textScale
    root.dataset.reducedMotion = String(s.reducedMotion)
  })
}

/** Какая тема на экране сейчас — с учётом системной, если выбрано «как в системе». */
export function useEffectiveTheme() {
  const store = useProgressStore()
  const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
  const systemDark = ref(media?.matches ?? false)
  const onChange = (e: MediaQueryListEvent) => (systemDark.value = e.matches)
  media?.addEventListener('change', onChange)
  onScopeDispose(() => media?.removeEventListener('change', onChange))

  const theme = computed<'light' | 'dark'>(() => {
    const pref = store.settings.theme
    if (pref === 'system') return systemDark.value ? 'dark' : 'light'
    return pref
  })

  function toggle() {
    const next = theme.value === 'dark' ? 'light' : 'dark'
    store.apply((p) => updateSettings(p, { theme: next }))
  }

  return { theme, toggle }
}
