/**
 * Какой раздел страницы сейчас читают — для отметки «вы здесь» в навигации.
 * Текущий — тот, что пересекает линию на трети высоты окна. Разделы бывают
 * вложены (упражнение внутри урока), поэтому из пересекающих побеждает
 * последний по списку; в промежутке между разделами отметка остаётся прежней.
 */
import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

export function pickCurrentSection<T extends string>(
  order: readonly T[],
  visible: ReadonlySet<T>,
  previous: T | null,
): T | null {
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]!
    if (visible.has(id)) return id
  }
  return previous
}

/** Узкая полоса на трети окна сверху: раздел «текущий», пока проходит через неё. */
const READING_LINE = '-33% 0px -66% 0px'

export function useSectionSpy<T extends string>(
  order: readonly T[],
  elements: () => Partial<Record<T, HTMLElement | null | undefined>>,
): Ref<T | null> {
  const current = ref<T | null>(null) as Ref<T | null>
  const visible = new Set<T>()
  const ids = new Map<Element, T>()
  let observer: IntersectionObserver | null = null

  function observe(map: Partial<Record<T, HTMLElement | null | undefined>>) {
    if (!observer) return
    observer.disconnect()
    ids.clear()
    visible.clear()
    for (const id of order) {
      const el = map[id]
      if (!el) continue
      ids.set(el, id)
      observer.observe(el)
    }
  }

  onMounted(() => {
    // Без IntersectionObserver (старый браузер, тесты) отметки просто нет.
    if (typeof IntersectionObserver === 'undefined') return
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = ids.get(entry.target)
          if (!id) continue
          if (entry.isIntersecting) visible.add(id)
          else visible.delete(id)
        }
        current.value = pickCurrentSection(order, visible, current.value)
      },
      { rootMargin: READING_LINE },
    )
    observe(elements())
  })

  // Разделы появляются и пропадают (урок без упражнения, переход к соседнему фильму).
  watch(elements, observe, { flush: 'post' })
  onBeforeUnmount(() => observer?.disconnect())

  return current
}
