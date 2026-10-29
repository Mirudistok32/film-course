import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { drawTree } from '@/illustrations/tree'
import { EMBLEMS } from '@/illustrations/emblems'
import AnswerField from '@/components/AnswerField.vue'
import DisclosurePanel from '@/components/DisclosurePanel.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import ProgressMeter from '@/components/ProgressMeter.vue'
import HankoStamp from '@/illustrations/HankoStamp.vue'

describe('иллюстрации', () => {
  it('дерево с одним сидом всегда одинаковое, с разными — разное', () => {
    const a = drawTree({ seed: 'nosferatu', x: 100, y: 190, height: 160 })
    const b = drawTree({ seed: 'nosferatu', x: 100, y: 190, height: 160 })
    const c = drawTree({ seed: 'metropolis', x: 100, y: 190, height: 160 })
    expect(a).toEqual(b)
    expect(a.limbs.join()).not.toBe(c.limbs.join())
    expect(a.limbs.length).toBeGreaterThan(10)
    expect(a.limbs.every((d) => !d.includes('NaN'))).toBe(true)
  })

  it('у каждого из 13 уровней есть эмблема', () => {
    for (let n = 1; n <= 13; n++) expect(EMBLEMS[n]?.main.length).toBeGreaterThan(0)
  })
})

describe('базовые компоненты', () => {
  it('поле ответа связано с видимой подписью и подсказкой', async () => {
    const w = mount(AnswerField, { props: { label: 'Я заметил…', hint: 'Опишите, что видно', modelValue: '' } })
    const textarea = w.get('textarea')
    expect(w.get('label').attributes('for')).toBe(textarea.attributes('id'))
    expect(w.get('.answer__hint').attributes('id')).toBe(textarea.attributes('aria-describedby'))
    await textarea.setValue('Тени нарисованы на стенах')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['Тени нарисованы на стенах'])
  })

  it('раскрывашка сообщает о первом открытии один раз', async () => {
    const w = mount(DisclosurePanel, {
      props: { summary: 'Образец разбора', spoiler: true },
      slots: { default: 'текст' },
    })
    const details = w.get('details').element as HTMLDetailsElement
    for (let i = 0; i < 2; i++) {
      details.open = true
      await w.get('details').trigger('toggle')
      details.open = false
      await w.get('details').trigger('toggle')
    }
    expect(w.emitted('open')).toHaveLength(1)
    expect(w.text()).toContain('спойлер')
  })

  it('статус передаётся текстом, а не только значком', () => {
    expect(mount(StatusBadge, { props: { film: 'completed' } }).text()).toBe('Пройден')
    expect(mount(StatusBadge, { props: { level: 'in-progress' } }).text()).toBe('В процессе')
  })

  it('прогресс показывает подпись и кадры по числу шагов', () => {
    const w = mount(ProgressMeter, { props: { value: 3, max: 7, label: '3 из 7 фильмов пройдены' } })
    expect(w.text()).toContain('3 из 7 фильмов пройдены')
    expect(w.findAll('.frame')).toHaveLength(7)
    expect(w.findAll('.frame--on')).toHaveLength(3)
  })

  it('полоса заливает только кадры, засвеченные после появления', async () => {
    const w = mount(ProgressMeter, { props: { value: 1, max: 3, label: 'Шаги фильма' } })
    expect(w.findAll('.frame--fresh')).toHaveLength(0)
    await w.setProps({ value: 3 })
    expect(w.findAll('.frame').map((f) => f.classes('frame--fresh'))).toEqual([false, true, true])
    await w.setProps({ value: 2 })
    expect(w.findAll('.frame--fresh')).toHaveLength(1)
  })

  it('шаги не по порядку засвечивают именно выполненные кадры', async () => {
    const w = mount(ProgressMeter, { props: { value: 1, max: 3, lit: [false, true, false], label: 'Шаги фильма' } })
    expect(w.findAll('.frame').map((f) => f.classes('frame--on'))).toEqual([false, true, false])
    await w.setProps({ value: 2, lit: [true, true, false] })
    expect(w.findAll('.frame').map((f) => f.classes('frame--fresh'))).toEqual([true, false, false])
  })

  it('печать проигрывает оттиск только по флагу press', () => {
    expect(mount(HankoStamp).classes()).not.toContain('hanko--press')
    const w = mount(HankoStamp, { props: { text: 'просмотрен', press: true } })
    expect(w.classes()).toContain('hanko--press')
    expect(w.attributes('aria-label')).toBe('Печать: просмотрен')
  })
})
