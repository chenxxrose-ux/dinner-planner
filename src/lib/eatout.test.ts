import { describe, expect, it } from 'vitest'
import { OUT_FOODS, mapUrl, outChoices, pickOut } from './eatout'

const base = { light: false, no: [], avoid: [], mine: [] }
describe('吃外面', () => {
  it('下班和半夜都有得抽，減重時只抽輕盈的', () => {
    expect(outChoices({ ...base, when: 'dinner' }).length).toBeGreaterThan(8)
    const late = outChoices({ ...base, when: 'late', light: true })
    expect(late.length).toBeGreaterThan(3)
    expect(late.every((x) => x.light && x.when.includes('late'))).toBe(true)
  })
  it('同一個種子抽到一樣的（兩支手機一樣），避開的不抽', () => {
    const o = { ...base, when: 'dinner' as const }
    expect(pickOut(o, 'x')?.name).toBe(pickOut(o, 'x')?.name)
    const all = outChoices(o).map((x) => x.name)
    const keep = all[0]
    expect(pickOut({ ...o, avoid: all.slice(1) }, 'y')?.name).toBe(keep)
  })
  it('不想吃的不會抽到；全部都不想吃就沒得抽', () => {
    const all = OUT_FOODS.map((x) => x.name)
    expect(pickOut({ ...base, when: 'late', no: all }, 'z')).toBeNull()
  })
  it('自己加的店會一起抽', () => {
    const mine = [{ name: '巷口鍋燒', when: 'late' as const }]
    expect(outChoices({ ...base, when: 'late', mine }).some((x) => x.name === '巷口鍋燒')).toBe(true)
    expect(outChoices({ ...base, when: 'dinner', mine }).some((x) => x.name === '巷口鍋燒')).toBe(false)
  })
  it('地圖搜尋五甲附近', () => {
    expect(decodeURIComponent(mapUrl(OUT_FOODS[0]))).toContain('鳳山五甲 自助餐')
  })
})
