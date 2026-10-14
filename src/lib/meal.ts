import type { Dish, Mark, People, Tool } from './types'

export const KIND = { main: '主菜', veg: '青菜', soup: '湯' } as const
export const TOOL: Record<Tool, string> = { 爐: '瓦斯爐', 氣: '氣炸烤箱', 蒸: '蒸箱', 免: '免開火' }
export const SIZES: People[] = [2, 3, 8]

// ───── 一餐的組成 ─────
// 2、3 人平常吃兩菜一湯；8 人是家人來，四菜一湯。
// 減重模式照「211 餐盤」：半盤蔬菜，所以平常是一主菜兩青菜一湯。
export type Slot = 'main' | 'main2' | 'veg' | 'veg2' | 'soup'
export function slotsFor(n: People, diet: boolean): Slot[] {
  if (n >= 8) return ['main', 'main2', 'veg', 'veg2', 'soup']
  return diet ? ['main', 'veg', 'veg2', 'soup'] : ['main', 'veg', 'soup']
}
export const typeOf = (slot: Slot) => slot.replace(/2$/, '') as Dish['type']
export function mealName(n: People, diet: boolean) {
  if (n >= 8) return '四菜一湯'
  return diet ? '一主菜兩青菜一湯' : '兩菜一湯'
}
export function sizeLabel(n: People, diet: boolean) {
  if (n >= 8) return '家人來・四菜一湯'
  return diet ? '一主兩菜一湯' : '兩菜一湯'
}
// 瓦斯爐同時最多幾道
const stoveMax = (slots: number) => (slots >= 4 ? 3 : 2)

// ───── 減重 ─────
// 油炸、裹粉、肥肉、重糖重鹽的菜，減重模式不會抽到
export const HEAVY = new Set([
  '滷肉', '糖醋排骨', '回鍋肉', '螞蟻上樹', '紅燒獅子頭', '宮保雞丁', '三杯雞', '三杯中卷', '三杯杏鮑菇', '鹽酥雞',
  '蜜汁叉燒', '氣炸豬排', '氣炸五花肉', '鳳梨蝦球', '瓜仔肉', '豉汁蒸排骨', '咖哩雞', '馬鈴薯燉肉', '菜脯蛋', '京醬肉絲',
  '韓式燒肉', '蒜泥白肉', '照燒雞腿', '氣炸雞翅', '麻婆豆腐', '奶油杏鮑菇', '奶油玉米', '玉米濃湯', '玉米排骨湯', '蘿蔔排骨湯',
  '冬瓜排骨湯', '貢丸湯', '魚丸湯', '餛飩湯', '酸辣湯', '皮蛋豆腐', '香菇雞湯', '蒜頭雞湯', '打拋豬', '沙茶牛肉', '黑胡椒牛柳', '香菇蒸肉餅',
  // 好吃的招牌菜：減重模式不抽
  '台式炸排骨', '蒜香奶油雞腿', '蔥燒排骨', '紅燒肉', '梅干扣肉', '東坡肉', '可樂雞翅', '啤酒燉雞', '麻油雞', '蒜泥白肉捲', '椒鹽排骨', '蒼蠅頭', '乾煸四季豆', '魚香茄子', '客家小炒', '鹹蛋苦瓜', '金沙蝦仁', '塔香茄子炒肉末', '醬爆雞丁', '左宗棠雞', '泰式檸檬魚', '紅燒魚', '糖醋魚片', '胡椒蝦', '奶油蒜香蛤蜊', '蔥爆中卷', '日式炸豬排', '起司焗烤雞腿', '日式牛丼', '台式滷雞腿', '培根炒高麗菜', '蝦醬空心菜', '三杯茄子', '皮蛋地瓜葉', '金沙南瓜', '乾煎杏鮑菇奶油', '麻油雞湯', '酸菜肉片湯', '蓮藕排骨湯', '鳳梨苦瓜雞湯',
])
export const isLight = (d: Dish) => !HEAVY.has(d.name)
// 減重時優先的蛋白質：豆、魚、蛋，再來才是肉（211 餐盤建議的順序）
const leanBonus = (d: Dish) => (/豆腐|毛豆|魚|鮭|鯛|鱸|虱目|蝦|蛤蜊|雞胸|雞蛋/.test(d.ing.map((i) => i[0]).join()) ? 1.5 : 1)

// ───── 同一餐不撞食材 ─────
// 同種肉、蛋、豆腐、海鮮算同一個「主角」；其他食材同名就算撞（蔥除外）
const PRO: [string, RegExp][] = [
  ['雞', /雞(?!蛋)|棒棒腿/],
  ['豬', /豬|排骨|五花|貢丸|餛飩/],
  ['牛', /牛肉/],
  ['魚', /魚|鮭|鯖|鱸|虱目|鯛/],
  ['蝦', /蝦/],
  ['蛋', /蛋/],
  ['豆腐', /豆腐/],
  ['貝', /蛤蜊|中卷/],
]
export function keysOf(d: Dish): Set<string> {
  const k = new Set<string>()
  for (const [name] of d.ing) {
    if (name !== '蔥') k.add('i:' + name)
    for (const [p, re] of PRO) if (re.test(name)) k.add('p:' + p)
  }
  return k
}

// ───── 每天固定的隨機 ─────
// 同一天、同樣條件，兩支手機抽到一樣的菜
export function rng(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

export interface Pool {
  dishes: Dish[]
  marks: Record<string, Mark>
  /** 每道菜最後一次吃的日期（YYYY-MM-DD） */
  lastEaten: Record<string, string>
  today: string
  diet: boolean
}
export interface DrawOpts {
  maxMin: number
  noHot: boolean
  /** 這些菜這次不要（例如這週已經排過） */
  exclude?: Set<string>
}
export type Meal = Partial<Record<Slot, string>>

export function daysAgo(pool: Pool, name: string): number | null {
  const last = pool.lastEaten[name]
  return last ? daysBetween(last, pool.today) : null
}

function pickWeighted(list: Dish[], r: () => number, pool: Pool) {
  if (!list.length) return null
  const w = list.map((d) => (pool.marks[d.name]?.fav ? 3 : 1) * (pool.diet ? leanBonus(d) : 1))
  let x = r() * w.reduce((a, b) => a + b, 0)
  for (let i = 0; i < list.length; i++) {
    x -= w[i]
    if (x <= 0) return list[i]
  }
  return list[list.length - 1]
}

// 抽一餐：食材不重複、瓦斯爐不超過上限、氣炸烤箱一次一道、5 天內吃過的先不要
export function drawMeal(pool: Pool, n: People, r: () => number, fixed: Meal, opts: DrawOpts): Meal {
  const slots = slotsFor(n, pool.diet)
  const byName = new Map(pool.dishes.map((d) => [d.name, d]))
  for (let attempt = 0; attempt < 60; attempt++) {
    const strict = attempt < 40
    const out: Meal = {}
    const keys = new Set<string>()
    const tools: Record<Tool, number> = { 爐: 0, 氣: 0, 蒸: 0, 免: 0 }
    const take = (slot: Slot, d: Dish) => {
      out[slot] = d.name
      keysOf(d).forEach((k) => keys.add(k))
      tools[d.tool]++
    }
    for (const s of slots) {
      const d = fixed[s] ? byName.get(fixed[s]!) : undefined
      if (d) take(s, d)
    }
    let ok = true
    for (const slot of slots) {
      if (out[slot]) continue
      const t = typeOf(slot)
      const used = new Set(Object.values(out))
      const fits = (d: Dish) => {
        if (d.type !== t || used.has(d.name) || opts.exclude?.has(d.name)) return false
        if (pool.marks[d.name]?.banned) return false
        if (opts.maxMin && d.min > opts.maxMin) return false
        if (opts.noHot && d.hot) return false
        if (pool.diet && !isLight(d)) return false
        for (const k of keysOf(d)) if (keys.has(k)) return false
        if (d.tool === '氣' && tools.氣 >= 1) return false
        if (strict && d.tool === '爐' && tools.爐 >= stoveMax(slots.length)) return false
        if (strict) {
          const a = daysAgo(pool, d.name)
          if (a !== null && a < 5) return false
        }
        return true
      }
      const d = pickWeighted(pool.dishes.filter(fits), r, pool)
      if (!d) {
        ok = false
        break
      }
      take(slot, d)
    }
    if (ok) return out
  }
  // 條件太嚴：放寬時間再抽；還是不行就交回抽到的部分
  if (opts.maxMin) return drawMeal(pool, n, r, fixed, { ...opts, maxMin: 0 })
  return fixed
}

// 沒買到某樣材料：用到它的菜換掉，優先換成「用已經買的材料就能做」的菜
export function forgotSwap(pool: Pool, n: People, meal: Meal, missing: string, opts: DrawOpts, r: () => number) {
  const slots = slotsFor(n, pool.diet)
  const byName = new Map(pool.dishes.map((d) => [d.name, d]))
  const uses = (d: Dish) => d.ing.some(([nm]) => nm === missing)
  const hit = slots.filter((s) => meal[s] && byName.get(meal[s]!) && uses(byName.get(meal[s]!)!))
  const bought = new Set<string>()
  for (const s of slots) for (const [nm] of byName.get(meal[s] ?? '')?.ing ?? []) if (nm !== missing) bought.add(nm)
  const out: Meal = { ...meal }
  const changed: [string, string][] = []
  for (const slot of hit) {
    const old = out[slot]!
    const keys = new Set<string>()
    for (const s of slots) {
      const other = s !== slot ? byName.get(out[s] ?? '') : undefined
      if (other) keysOf(other).forEach((k) => keys.add(k))
    }
    const used = new Set(Object.values(out))
    const ok = (d: Dish, maxMin: number) =>
      d.type === typeOf(slot) && !used.has(d.name) && !uses(d) && !pool.marks[d.name]?.banned && !opts.exclude?.has(d.name) &&
      !(maxMin && d.min > maxMin) && !(opts.noHot && d.hot) && !(pool.diet && !isLight(d)) && ![...keysOf(d)].some((k) => keys.has(k))
    let list = pool.dishes.filter((d) => ok(d, opts.maxMin))
    if (!list.length) list = pool.dishes.filter((d) => ok(d, 0))
    if (!list.length) continue
    // 要多買幾樣：越少越好，0 樣就是家裡現有的材料就能做
    const extra = (d: Dish) => d.ing.filter(([nm]) => !bought.has(nm)).length
    const best = Math.min(...list.map(extra))
    const d = pickWeighted(list.filter((x) => extra(x) === best), r, pool)!
    out[slot] = d.name
    changed.push([old, d.name])
  }
  return { meal: out, changed }
}

export function dailySeed(day: string, n: People, s: { maxMin: number; noHot: boolean; diet: boolean }, reroll: number, extra = '') {
  return `${day}|${n}|${s.maxMin}|${s.noHot}|${s.diet}|${reroll}${extra}`
}

// ───── 份量 ─────
// 依人數換算，換成在全聯買得到的單位
const WHOLE = new Set(['盒', '罐', '包', '小包', '把', '片', '塊', '瓶', '支', '份'])
export function roundQty(v: number, unit: string) {
  if (unit === 'g') return Math.max(100, Math.round(v / 50) * 50)
  if (WHOLE.has(unit)) return Math.max(1, Math.ceil(v - 0.05))
  if (v < 2) return Math.max(0.5, Math.round(v * 2) / 2)
  return Math.ceil(v - 0.05)
}
export function fmtQty(v: number, unit: string) {
  if (unit === 'g') return v >= 1000 ? `${String(+(v / 1000).toFixed(1))} 公斤` : `${v} 克`
  if (v === 0.5) return '半' + unit
  return `${Number.isInteger(v) ? v : v.toFixed(1)} ${unit}`
}

// 減重模式：鹹的、甜的醬料減半，油一道菜 1 小匙
const SALTY = /味霸|鹽|醬油|蠔油|味噌|豆瓣|沙茶|黑胡椒醬|番茄醬|魚露|甜麵醬|烤肉醬|糖|蜂蜜|味醂/
const OILY = /麻油|橄欖油|香油|辣油/
export type Amount = { v: number; unit: string } | { text: string }
export function sauceAmt(name: string, txt: string, n: number, diet: boolean): Amount {
  const m = txt.match(/^([\d.]+) (.+)$/)
  if (!m) return { text: txt }
  const unit = m[2]
  let v = (parseFloat(m[1]) * n) / 3
  if (diet && SALTY.test(name)) v /= 2
  if (diet && OILY.test(name)) v = Math.min(v, ((unit === '大匙' ? 1 / 3 : 1) * n) / 3)
  v = unit === '瓣' ? Math.max(1, Math.ceil(v)) : Math.max(0.5, Math.round(v * 2) / 2)
  return { v, unit }
}
export function fmtSauce(list: Amount[]) {
  const sum: Record<string, number> = {}
  const text = new Set<string>()
  for (const a of list) {
    if ('text' in a) text.add(a.text)
    else sum[a.unit] = (sum[a.unit] ?? 0) + a.v
  }
  const parts = Object.entries(sum).map(([u, v]) => (v === 0.5 ? '半' + u : `${v} ${u}`))
  if (!parts.length) text.forEach((t) => parts.push(t))
  return parts.join('＋')
}

// 全聯逛的順序：肉、海鮮、蔬果、蛋豆腐鮮奶、罐頭乾貨冷凍
const AISLE: [number, RegExp][] = [
  [0, /雞(?!蛋)|棒棒腿|豬|排骨|五花|牛肉/],
  [1, /魚|鮭|鯖|鱸|虱目|鯛|蝦(?!米)|蛤蜊|中卷/],
  [3, /蛋|豆腐|豆干|鮮奶|毛豆/],
  [4, /罐頭|乾|紫菜|蝦米|冬粉|花生|菜脯|木耳|貢丸|魚丸|餛飩/],
]
export const AISLE_NAMES: [number, string][] = [
  [0, '肉品'],
  [1, '海鮮'],
  [2, '蔬果'],
  [3, '蛋・豆腐・鮮奶'],
  [4, '罐頭・乾貨・冷凍'],
]
export function aisleOf(name: string) {
  // 罐頭、乾貨先判斷，避免「玉米粒罐頭」被當成蔬果、「魚丸」被當成海鮮
  if (AISLE[3][1].test(name)) return 4
  for (const [a, re] of AISLE.slice(0, 3)) if (re.test(name)) return a
  return 2
}

export interface FoodLine {
  name: string
  unit: string
  q: number
  aisle: number
  who: string[]
}
export interface SauceLine {
  name: string
  amt: Amount[]
  who: string[]
}
// 把幾道菜的材料加總（每道菜可以有自己的人數）
export function totals(entries: { d: Dish; n: number }[], diet: boolean) {
  const food = new Map<string, { name: string; unit: string; v: number; who: string[] }>()
  const sauce = new Map<string, SauceLine>()
  for (const { d, n } of entries) {
    for (const [name, q, unit] of d.ing) {
      const k = name + '|' + unit
      const f = food.get(k) ?? { name, unit, v: 0, who: [] }
      f.v += (q * n) / 3
      if (!f.who.includes(d.name)) f.who.push(d.name)
      food.set(k, f)
    }
    for (const [name, amt] of d.sauce) {
      const s = sauce.get(name) ?? { name, amt: [], who: [] }
      s.amt.push(sauceAmt(name, amt, n, diet))
      if (!s.who.includes(d.name)) s.who.push(d.name)
      sauce.set(name, s)
    }
  }
  const foodList: FoodLine[] = [...food.values()]
    .map((f) => ({ name: f.name, unit: f.unit, q: roundQty(f.v, f.unit), aisle: aisleOf(f.name), who: f.who }))
    .sort((a, b) => a.aisle - b.aisle)
  return { food: foodList, sauce: [...sauce.values()] }
}

// ───── 日期（台灣時間） ─────
export function taipeiToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
const toUtc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
/** 台灣時間的「幾點幾分」，從午夜算起的分鐘 */
export function taipeiMinutes(now = new Date()) {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(now)
    .split(':')
    .map(Number)
  return h * 60 + m
}
export const fmtClock = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
export const parseClock = (s: string) => {
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  return m ? Math.min(1439, Number(m[1]) * 60 + Number(m[2])) : null
}

// 下班後可以煮多久：想吃飯的時間 - 到家的時間。來不及也至少給 15 分鐘，挑最快的菜。
export const MIN_COOK = 15
export function cookWindow(offMin: number, commute: number, dinnerMin: number) {
  const home = offMin + commute
  const avail = dinnerMin - home
  return { home, avail, limit: Math.max(MIN_COOK, avail), rushed: avail < MIN_COOK }
}
export const limitOf = (avail: number) => Math.max(MIN_COOK, avail)

export function addDays(iso: string, n: number) {
  return new Date(toUtc(iso) + n * 864e5).toISOString().slice(0, 10)
}
export function daysBetween(a: string, b: string) {
  return Math.round((toUtc(b) - toUtc(a)) / 864e5)
}
export const weekday = (iso: string) => new Date(toUtc(iso)).getUTCDay()
export function weekStart(iso: string) {
  return addDays(iso, -((weekday(iso) + 6) % 7))
}

// ───── 自己加菜的輸入 ─────
const UNITS = 'g|克|顆|根|條|片|盒|包|罐|把|塊|支|瓶'
export function parseIngInput(txt: string): [string, number, string][] {
  const out: [string, number, string][] = []
  for (const tok of txt.split(/[\s、,，]+/).filter(Boolean)) {
    const lone = tok.match(new RegExp(`^([\\d.]+)\\s*(${UNITS})$`))
    if (lone && out.length) {
      const last = out[out.length - 1]
      last[1] = parseFloat(lone[1])
      last[2] = lone[2] === '克' ? 'g' : lone[2]
      continue
    }
    const joined = tok.match(new RegExp(`^(.+?)([\\d.]+)(${UNITS})$`))
    if (joined) out.push([joined[1], parseFloat(joined[2]), joined[3] === '克' ? 'g' : joined[3]])
    else out.push([tok, 1, '份'])
  }
  return out
}

/** 凌晨 5 點前還算前一天的晚上（草莓運動完半夜才吃） */
export const DAY_CUTOFF = 5 * 60
/** 晚餐的「今天」：凌晨 5 點前還算昨天 */
export function nightDay(now = new Date()) {
  const t = taipeiToday(now)
  return taipeiMinutes(now) < DAY_CUTOFF ? addDays(t, -1) : t
}
