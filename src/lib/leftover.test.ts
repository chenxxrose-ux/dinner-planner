import { describe, expect, it } from 'vitest'
import { leftIdeas, leftKinds, LEFT_IDEAS } from './leftover'

const rice = { name: '白飯', kinds: ['rice' as const] }
describe('剩菜變新菜', () => {
  it('看菜名分種類', () => {
    expect(leftKinds({ name: '滷肉', type: 'main' })).toEqual(['meat', 'sauce'])
    expect(leftKinds({ name: '蒜蓉蒸蝦', type: 'main' })).toEqual(['meat'])
    expect(leftKinds({ name: '炒高麗菜', type: 'veg' })).toEqual(['veg'])
    expect(leftKinds({ name: '減脂蔬菜湯', type: 'soup' })).toEqual(['soup'])
  })
  it('沒勾就沒有；只有飯可以炒飯、煮粥', () => {
    expect(leftIdeas([])).toEqual([])
    const names = leftIdeas([rice]).map((x) => x.idea.name)
    expect(names).toContain('剩菜炒飯')
    expect(names).toContain('剩菜鹹粥')
    expect(names).not.toContain('剩菜蓋飯')
  })
  it('用到最多樣剩菜的排第一，做法寫出剩菜的名字', () => {
    const r = leftIdeas([rice, { name: '滷肉', kinds: ['meat', 'sauce'] }, { name: '炒高麗菜', kinds: ['veg'] }])
    expect(r[0].used.length).toBe(3)
    expect(r[0].steps.join()).toContain('滷肉')
    expect(r.map((x) => x.idea.name)).toContain('滷汁拌麵')
  })
  it('減重時同分的輕盈菜排前面', () => {
    const r = leftIdeas([rice], true)
    expect(r[0].idea.light).toBe(true)
  })
  it('每個做法都至少兩步，不寫味精', () => {
    for (const i of LEFT_IDEAS) {
      const s = i.steps({ rice: ['白飯'], meat: ['滷肉'], sauce: ['滷肉'], veg: ['炒高麗菜'], soup: ['蘿蔔湯'] })
      expect(s.length).toBeGreaterThanOrEqual(2)
      expect(s.join()).not.toMatch(/味精|undefined/)
    }
  })
})
