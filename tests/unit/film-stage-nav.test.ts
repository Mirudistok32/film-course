import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { pickCurrentSection } from '@/composables/useSectionSpy'
import FilmStageNav, { FILM_SECTIONS } from '@/components/film/FilmStageNav.vue'

describe('текущий раздел страницы', () => {
  it('из пересекающих линию побеждает вложенный (последний по списку)', () => {
    expect(pickCurrentSection(FILM_SECTIONS, new Set(['lesson', 'exercise'] as const), null)).toBe('exercise')
    expect(pickCurrentSection(FILM_SECTIONS, new Set(['notes'] as const), 'exercise')).toBe('notes')
  })

  it('между разделами отметка остаётся прежней', () => {
    expect(pickCurrentSection(FILM_SECTIONS, new Set(), 'notes')).toBe('notes')
    expect(pickCurrentSection(FILM_SECTIONS, new Set(), null)).toBeNull()
  })
})

describe('полоса шагов урока', () => {
  const props = { stage: 'during', current: null, jumps: ['exercise', 'notes', 'completion'] } as const

  it('выбранный шаг — вкладка с полной подписью и отметкой «вы здесь»', () => {
    const w = mount(FilmStageNav, { props })
    const tabs = w.findAll('[role="tab"]')
    expect(tabs.map((t) => t.text())).toEqual(['1Перед просмотром', '2Во время', '3После просмотра'])
    expect(tabs[1]!.attributes('aria-selected')).toBe('true')
    expect(tabs[1]!.attributes('aria-current')).toBe('step')
    expect(tabs[1]!.attributes('tabindex')).toBe('0')
    expect(tabs[0]!.attributes('tabindex')).toBe('-1')
  })

  it('когда читают заметки, «вы здесь» — у перехода, а шаг остаётся выбранным', () => {
    const w = mount(FilmStageNav, { props: { ...props, current: 'notes' } })
    expect(w.get('[role="tab"][aria-selected="true"]').attributes('aria-current')).toBeUndefined()
    const current = w.findAll('nav button').filter((b) => b.attributes('aria-current') === 'step')
    expect(current.map((b) => b.text())).toEqual(['Заметки'])
  })

  it('стрелки и Home/End выбирают шаг, переходы сообщают раздел', async () => {
    const w = mount(FilmStageNav, { props, attachTo: document.body })
    const tabs = w.findAll('[role="tab"]')
    await tabs[1]!.trigger('keydown', { key: 'ArrowRight' })
    await tabs[0]!.trigger('keydown', { key: 'ArrowLeft' })
    await tabs[1]!.trigger('keydown', { key: 'Home' })
    await tabs[1]!.trigger('keydown', { key: 'Tab' })
    expect(w.emitted('select')).toEqual([['after'], ['after'], ['before']])
    expect(document.activeElement).toBe(tabs[0]!.element)
    await w.findAll('nav button')[0]!.trigger('click')
    expect(w.emitted('jump')).toEqual([['exercise']])
    w.unmount()
  })
})
