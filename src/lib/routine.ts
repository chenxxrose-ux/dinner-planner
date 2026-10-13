// 作息：阿寶和草莓平日的一天。一天從早上開始，凌晨的時間算在同一天（+1440 分鐘）。
import { MIN_COOK, addDays, taipeiMinutes, taipeiToday } from './meal'

export type Who = 'a' | 's' | 'both'
export type Person = 'a' | 's'
export interface Step {
  key: string
  who: Who
  what: string
  /** 平常幾點，從當天午夜算起的分鐘（凌晨的 +1440） */
  at: number
}
export interface TodayStep extends Step {
  /** 今天實際幾點 */
  m: number
  /** 跟平常不一樣 */
  moved: boolean
}

export const NAME: Record<Who, string> = { a: '阿寶', s: '草莓', both: '兩人' }
/** 凌晨 5 點前算前一天 */
export const DAY_CUTOFF = 5 * 60
export const toDay = (min: number) => (min < DAY_CUTOFF ? min + 1440 : min)

const c = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return toDay(h * 60 + m)
}
export const STEPS: Step[] = [
  { key: 'up', who: 'both', what: '起床', at: c('08:00') },
  { key: 'work', who: 'both', what: '上班', at: c('08:20') },
  { key: 'brunch', who: 'both', what: '早午餐', at: c('10:40') },
  { key: 'market', who: 'both', what: '黃昏市場上工', at: c('11:00') },
  { key: 'aoff', who: 'a', what: '下班', at: c('20:00') },
  { key: 'aeat', who: 'a', what: '吃晚餐', at: c('20:30') },
  { key: 'abath', who: 'a', what: '洗澡', at: c('21:15') },
  { key: 'soff', who: 's', what: '下班，先吃一點', at: c('21:30') },
  { key: 'gym', who: 's', what: '運動', at: c('21:40') },
  { key: 'afree', who: 'a', what: '自己的時間', at: c('21:45') },
  { key: 'ride', who: 's', what: '騎車回家', at: c('00:00') },
  { key: 'home', who: 's', what: '到家', at: c('00:10') },
  { key: 'seat', who: 's', what: '吃晚餐', at: c('00:15') },
  { key: 'sbath', who: 's', what: '洗澡', at: c('00:40') },
  { key: 'sleep', who: 'both', what: '一起睡', at: c('01:15') },
]
/** 「做完了」按鍵在這幾件事上的說法 */
export const DONE: Record<string, string> = { market: '下班了', gym: '運動完了', aeat: '吃完了', seat: '吃完了' }
/** 可以選的時間：05:00 到隔天 04:55，每 5 分鐘 */
export const OPTS = Array.from({ length: 24 * 12 }, (_, k) => DAY_CUTOFF + k * 5)
/** 一起睡：兩個人最後一件事開始後，至少隔這麼久 */
export const WIND_DOWN = 35

const valid = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 2880

/** 平常的時間：程式預設，加上家裡改過的 */
export function baseSteps(routine: Record<string, unknown> = {}): Step[] {
  return STEPS.map((s) => (valid(routine[s.key]) ? { ...s, at: routine[s.key] as number } : s)).sort((x, y) => x.at - y.at)
}

/**
 * 今天的時間。改了一件，同一個人後面的事一起挪；兩人一起的事跟著晚的那個人。
 * 一起睡要等兩個人都忙完（「自己的時間」可以縮短，不算）。
 * 阿寶的晚餐是固定的開飯時間（跟「我下班了」算可以煮多久用同一個），晚下班只有來不及時才往後：
 * 至少到家後留 15 分鐘煮。
 */
export function todaySteps(base: Step[], plan: Record<string, unknown> = {}, commute = 0): TodayStep[] {
  const delta = { a: 0, s: 0 }
  const last: Record<Person, number | null> = { a: null, s: null }
  const out = base.map((i) => {
    let m: number
    const o = plan[i.key]
    if (i.key === 'aeat' && !valid(o)) {
      m = delta.a > 0 && last.a !== null ? Math.max(i.at, last.a + commute + MIN_COOK) : i.at + Math.min(0, delta.a)
      delta.a = m - i.at
    } else if (i.key === 'sleep' && !valid(o)) {
      m = Math.max(i.at, ...(['a', 's'] as const).map((p) => (last[p] === null ? 0 : last[p]! + WIND_DOWN)))
    } else if (valid(o)) {
      m = o
      const d = m - i.at
      if (i.who === 'both') delta.a = delta.s = d
      else delta[i.who] = d
    } else {
      m = i.at + (i.who === 'both' ? Math.max(delta.a, delta.s) : delta[i.who])
    }
    if (i.who !== 'both' && i.key !== 'afree') last[i.who] = m
    return { ...i, m, moved: m !== i.at }
  })
  return out.sort((x, y) => x.m - y.m)
}

/** 某個人現在在做什麼、下一件是什麼 */
export function stateFor(list: TodayStep[], p: Person, now: number) {
  let cur: TodayStep | null = null
  let next: TodayStep | null = null
  for (const i of list) {
    if (i.who !== p && i.who !== 'both') continue
    if (i.m <= now) cur = i
    else {
      next = i
      break
    }
  }
  return { cur, next }
}

/** 某個人今天後面的事比平常晚（正）或早（負）幾分鐘 */
export function shiftOf(list: TodayStep[], p: Person, now: number) {
  const x = list.find((i) => i.who === p && i.m > now && i.moved)
  return x ? x.m - x.at : 0
}

/** 作息的「今天」：凌晨 5 點前還算昨天 */
export function routineDay(now = new Date()) {
  const t = taipeiToday(now)
  return taipeiMinutes(now) < DAY_CUTOFF ? addDays(t, -1) : t
}
/** 現在幾分（作息的算法，凌晨 +1440） */
export const routineNow = (now = new Date()) => toDay(taipeiMinutes(now))
/** 某個時間點換成作息的分鐘 */
export const routineMinOf = (iso: string) => toDay(taipeiMinutes(new Date(iso)))
