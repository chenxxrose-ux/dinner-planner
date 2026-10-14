import { describe, expect, it } from 'vitest'
import { MENU } from './menu'
import {
  addDays, aisleOf, cookWindow, fmtClock, forgotSwap, parseClock, taipeiMinutes, dailySeed, drawMeal, fmtQty, fmtSauce, isLight, keysOf, parseIngInput, rng, roundQty,
  sauceAmt, slotsFor, taipeiToday, totals, weekStart, type Meal, type Pool,
} from './meal'
import type { People } from './types'
import { STEPS, stepsOf } from './steps'

const pool = (over: Partial<Pool> = {}): Pool => ({ dishes: MENU, marks: {}, lastEaten: {}, today: '2026-10-13', diet: false, ...over })

describe('菜單', () => {
  it('每道菜都有材料、名字不重複', () => {
    expect(MENU.length).toBeGreaterThanOrEqual(100)
    expect(new Set(MENU.map((d) => d.name)).size).toBe(MENU.length)
    for (const d of MENU) {
      expect(d.ing.length).toBeGreaterThan(0)
      expect(['爐', '氣', '蒸', '免']).toContain(d.tool)
    }
  })
  it('不用味精，湯用味霸', () => {
    expect(MENU.some((d) => d.sauce.some(([n]) => n === '味精'))).toBe(false)
    expect(MENU.filter((d) => d.type === 'soup' && d.sauce.some(([n]) => n === '味霸')).length).toBeGreaterThan(10)
  })
  it('減重模式三種菜都夠抽', () => {
    for (const t of ['main', 'veg', 'soup'] as const) expect(MENU.filter((d) => d.type === t && isLight(d)).length).toBeGreaterThanOrEqual(10)
  })
})

describe('抽一餐', () => {
  const check = (p: Pool, n: People, seed: string) => {
    const m = drawMeal(p, n, rng(seed), {}, { maxMin: 30, noHot: true })
    const names = Object.values(m) as string[]
    expect(names.length).toBe(slotsFor(n, p.diet).length)
    const ds = names.map((x) => MENU.find((d) => d.name === x)!)
    const seen = new Set<string>()
    for (const d of ds) for (const k of keysOf(d)) {
      expect(seen.has(k), `${names.join('、')} 撞到 ${k}`).toBe(false)
      seen.add(k)
    }
    expect(ds.filter((d) => d.tool === '氣').length).toBeLessThanOrEqual(1)
    expect(ds.some((d) => d.hot)).toBe(false)
    return ds
  }
  it('同一餐不撞食材、氣炸烤箱一次一道、不辣', () => {
    for (const n of [2, 3, 8] as People[]) for (let i = 0; i < 200; i++) check(pool(), n, `t${n}-${i}`)
  })
  it('減重模式只抽輕盈的菜，一主菜兩青菜一湯', () => {
    for (let i = 0; i < 200; i++) {
      const ds = check(pool({ diet: true }), 3, `d${i}`)
      expect(ds.every(isLight)).toBe(true)
      expect(ds.map((d) => d.type)).toEqual(['main', 'veg', 'veg', 'soup'])
    }
  })
  it('8 人是四菜一湯', () => {
    expect(slotsFor(8, false)).toEqual(['main', 'main2', 'veg', 'veg2', 'soup'])
  })
  it('不敢吃的菜不會出現', () => {
    const marks = Object.fromEntries(MENU.filter((d) => d.type === 'soup').slice(0, 15).map((d) => [d.name, { fav: false, banned: true }]))
    for (let i = 0; i < 100; i++) {
      const m = drawMeal(pool({ marks }), 3, rng(`b${i}`), {}, { maxMin: 0, noHot: false })
      expect(marks[m.soup!]).toBeUndefined()
    }
  })
  it('同一天同樣條件抽到一樣的菜（兩支手機一致）', () => {
    const s = { maxMin: 30, noHot: true, diet: true }
    const a = drawMeal(pool({ diet: true }), 3, rng(dailySeed('2026-10-13', 3, s, 0)), {}, s)
    const b = drawMeal(pool({ diet: true }), 3, rng(dailySeed('2026-10-13', 3, s, 0)), {}, s)
    const c = drawMeal(pool({ diet: true }), 3, rng(dailySeed('2026-10-13', 3, s, 1)), {}, s)
    expect(a).toEqual(b)
    expect(c).not.toEqual(a)
  })
  it('固定的菜留著', () => {
    const m = drawMeal(pool(), 3, rng('x'), { main: '三杯雞' }, { maxMin: 30, noHot: true })
    expect(m.main).toBe('三杯雞')
  })
  it('5 天內吃過的先不抽', () => {
    const lastEaten = Object.fromEntries(MENU.filter((d) => d.type === 'main').slice(0, 20).map((d) => [d.name, '2026-10-12']))
    for (let i = 0; i < 100; i++) {
      const m = drawMeal(pool({ lastEaten }), 3, rng(`r${i}`), {}, { maxMin: 0, noHot: false })
      expect(lastEaten[m.main!]).toBeUndefined()
    }
  })
})

describe('份量', () => {
  it('換算人數並取全聯買得到的單位', () => {
    expect(roundQty((450 * 8) / 3, 'g')).toBe(1200)
    expect(roundQty((4 * 8) / 3, '顆')).toBe(11)
    expect(roundQty((0.5 * 2) / 3, '顆')).toBe(0.5)
    expect(roundQty((1 * 8) / 3, '盒')).toBe(3)
    expect(fmtQty(1200, 'g')).toBe('1.2 公斤')
    expect(fmtQty(0.5, '顆')).toBe('半顆')
  })
  it('減重模式醬料減半、油 1 小匙', () => {
    expect(fmtSauce([sauceAmt('醬油', '2 大匙', 3, true)])).toBe('1 大匙')
    expect(fmtSauce([sauceAmt('味霸', '1 小匙', 3, true)])).toBe('半小匙')
    expect(fmtSauce([sauceAmt('麻油', '2 大匙', 3, true)])).toBe('半大匙')
    expect(fmtSauce([sauceAmt('醬油', '2 大匙', 3, false)])).toBe('2 大匙')
    expect(fmtSauce([sauceAmt('鹽', '少許', 3, true), sauceAmt('鹽', '少許', 3, true)])).toBe('少許')
  })
  it('加總同樣的食材', () => {
    const egg = MENU.filter((d) => ['番茄炒蛋', '紫菜蛋花湯'].includes(d.name))
    const t = totals(egg.map((d) => ({ d, n: 3 })), false)
    expect(t.food.find((f) => f.name === '雞蛋')!.q).toBe(6)
  })
  it('照全聯逛的順序分區', () => {
    expect(aisleOf('去骨雞腿肉')).toBe(0)
    expect(aisleOf('冷凍蝦仁')).toBe(1)
    expect(aisleOf('高麗菜')).toBe(2)
    expect(aisleOf('雞蛋')).toBe(3)
    expect(aisleOf('玉米粒罐頭')).toBe(4)
    expect(aisleOf('魚丸')).toBe(4)
  })
})

describe('日期與輸入', () => {
  it('台灣時間', () => {
    expect(taipeiToday(new Date('2026-10-12T16:30:00Z'))).toBe('2026-10-13')
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(weekStart('2026-10-18')).toBe('2026-10-12')
    expect(weekStart('2026-10-12')).toBe('2026-10-12')
  })
  it('下班後可以煮多久', () => {
    expect(taipeiMinutes(new Date('2026-10-13T09:40:00Z'))).toBe(17 * 60 + 40)
    expect(cookWindow(17 * 60 + 40, 30, 19 * 60)).toEqual({ home: 18 * 60 + 10, avail: 50, limit: 50, rushed: false })
    expect(cookWindow(18 * 60 + 40, 30, 19 * 60)).toMatchObject({ avail: -10, limit: 15, rushed: true })
    expect(fmtClock(18 * 60 + 5)).toBe('18:05')
    expect(parseClock('07:30')).toBe(450)
  })
  it('自己加菜的材料', () => {
    expect(parseIngInput('牛肉片 300g 洋蔥 1顆')).toEqual([['牛肉片', 300, 'g'], ['洋蔥', 1, '顆']])
    expect(parseIngInput('雞腿2支、蔥')).toEqual([['雞腿', 2, '支'], ['蔥', 1, '份']])
  })
})

describe('做法', () => {
  it('每道內建菜都有做法，而且不寫死份量', () => {
    for (const d of MENU) {
      const s = stepsOf(d.name)
      expect(s.length, d.name).toBeGreaterThanOrEqual(2)
      for (const t of s) expect(t, d.name).not.toMatch(/味精/)
    }
    expect(Object.keys(STEPS).filter((k) => !MENU.some((d) => d.name === k))).toEqual([])
  })
})

describe('沒買到', () => {
  const p: Pool = { dishes: MENU, marks: {}, lastEaten: {}, today: '2026-10-14', diet: true }
  const meal: Meal = { main: '蒜蓉蒸蝦', veg: '蒜炒白花椰', veg2: '蒜炒地瓜葉', soup: '減脂蔬菜湯' }
  it('只換用到那樣材料的菜，換上的菜不用它', () => {
    const { meal: out, changed } = forgotSwap(p, 3, meal, '板豆腐', { maxMin: 30, noHot: true }, rng('x'))
    expect(changed.map((c) => c[0])).toEqual(['減脂蔬菜湯'])
    expect(out.main).toBe('蒜蓉蒸蝦')
    expect(out.veg).toBe('蒜炒白花椰')
    const soup = MENU.find((d) => d.name === out.soup)!
    expect(soup.type).toBe('soup')
    expect(soup.ing.some(([n]) => n === '板豆腐')).toBe(false)
    expect(isLight(soup)).toBe(true)
  })
  it('優先挑用已經買的材料就能做的', () => {
    // 番茄買了：沒買到雞蛋時，番茄炒蛋要換；換上的主菜最好不用再買新東西
    const m: Meal = { main: '番茄炒蛋', veg: '炒高麗菜', veg2: '蒜炒菠菜', soup: '紫菜蛋花湯' }
    const { meal: out, changed } = forgotSwap(p, 3, m, '雞蛋', { maxMin: 0, noHot: true }, rng('y'))
    expect(changed.map((c) => c[0]).sort()).toEqual(['番茄炒蛋', '紫菜蛋花湯'].sort())
    for (const s of ['main', 'soup'] as const) expect(MENU.find((d) => d.name === out[s])!.ing.some(([n]) => n === '雞蛋')).toBe(false)
  })
})
