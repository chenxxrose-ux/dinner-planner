import { describe, expect, it } from 'vitest'
import { baseSteps, routineDay, shiftOf, stateFor, todaySteps, toDay } from './routine'

const t = (s: string) => {
  const [h, m] = s.split(':').map(Number)
  return toDay(h * 60 + m)
}
const at = (list: ReturnType<typeof todaySteps>, key: string) => list.find((i) => i.key === key)!.m

describe('作息', () => {
  it('平常的一天：照時間排，凌晨的排在最後', () => {
    const l = todaySteps(baseSteps(), {}, 30)
    expect(l.map((i) => i.key).slice(-3)).toEqual(['seat', 'sbath', 'sleep'])
    expect(l.every((i) => !i.moved)).toBe(true)
    expect(at(l, 'sleep')).toBe(t('01:15'))
  })

  it('草莓運動晚 30 分：她後面的事和一起睡都往後', () => {
    const l = todaySteps(baseSteps(), { ride: t('00:30') }, 30)
    expect(at(l, 'home')).toBe(t('00:40'))
    expect(at(l, 'sbath')).toBe(t('01:10'))
    expect(at(l, 'sleep')).toBe(t('01:45'))
    expect(shiftOf(l, 's', t('22:00'))).toBe(30)
    // 阿寶不受影響
    expect(at(l, 'abath')).toBe(t('21:15'))
  })

  it('阿寶晚下班：晚餐還來得及就不動，一起睡也不動', () => {
    const l = todaySteps(baseSteps(), { aoff: t('20:15') }, 0)
    expect(at(l, 'aeat')).toBe(t('20:30'))
    expect(at(l, 'sleep')).toBe(t('01:15'))
  })

  it('阿寶很晚下班：晚餐往後（到家後留 15 分鐘煮），後面跟著挪', () => {
    const l = todaySteps(baseSteps(), { aoff: t('20:30') }, 30)
    expect(at(l, 'aeat')).toBe(t('21:15'))
    expect(at(l, 'abath')).toBe(t('22:00'))
    expect(at(l, 'sleep')).toBe(t('01:15'))
  })

  it('改平常的時間', () => {
    const b = baseSteps({ up: t('07:30'), sleep: t('00:50') })
    expect(b[0].at).toBe(t('07:30'))
    // 一起睡改早了，但草莓還沒忙完就等她
    expect(at(todaySteps(b), 'sleep')).toBe(t('01:15'))
  })

  it('現在在做什麼', () => {
    const l = todaySteps(baseSteps())
    const s = stateFor(l, 's', t('22:30'))
    expect(s.cur?.key).toBe('gym')
    expect(s.next?.key).toBe('ride')
    expect(stateFor(l, 'a', t('07:00')).cur).toBeNull()
  })

  it('凌晨 5 點前還算昨天', () => {
    expect(routineDay(new Date('2026-10-14T00:30:00+08:00'))).toBe('2026-10-13')
    expect(routineDay(new Date('2026-10-14T05:30:00+08:00'))).toBe('2026-10-14')
  })
})
