import { describe, expect, it } from 'vitest'
import { MENU } from './menu'
import { costText, lineCost, mealCost } from './price'

describe('估算花多少錢', () => {
  it('每樣內建材料都有價錢', () => {
    const miss = new Set<string>()
    for (const d of MENU) for (const [n, q, u] of d.ing) if (lineCost(n, q, u) === null) miss.add(`${n} ${u}`)
    expect([...miss]).toEqual([])
  })
  it('肉用克算、其他用多少算多少', () => {
    expect(lineCost('牛肉火鍋片', 300, 'g')).toBe(120)
    expect(lineCost('高麗菜', 0.5, '顆')).toBe(35)
    expect(lineCost('乾香菇', 6, '朵')).toBe(48)
    expect(lineCost('不知道的東西', 1, '包')).toBeNull()
  })
  it('加總到 10 元，沒價錢的另外說', () => {
    expect(mealCost([{ name: '雞蛋', q: 4, unit: '顆' }, { name: '牛番茄', q: 3, unit: '顆' }]).total).toBe(80)
    expect(costText([{ name: '雞蛋', q: 4, unit: '顆' }, { name: '自己加的', q: 1, unit: '包' }])).toBe('約 $30（1 樣沒算）')
    expect(costText([])).toBe('')
  })
})
