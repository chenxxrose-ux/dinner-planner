import type { Session } from '@supabase/supabase-js'
import { supabase, configured } from './supabase'
import { MENU } from '../../lib/menu'
import { addDays, taipeiToday, weekStart } from '../../lib/meal'
import type { Day, Dish, Mark, People, Settings } from '../../lib/types'

// 兩支手機共用的資料：先存在手機（離線也能用），改的東西排隊，連上網路就送出；
// 任何一支手機改了，另一支透過即時同步馬上重抓。

export interface Data {
  settings: Settings
  marks: Record<string, Mark>
  custom: Dish[]
  days: Record<string, Day>
  /** 本週買菜清單的勾選 */
  shop: Record<string, boolean>
  week: string
}

type Table = 'dp_settings' | 'dp_marks' | 'dp_dishes' | 'dp_days' | 'dp_shop'
const KEYS: Record<Table, string> = { dp_settings: 'id', dp_marks: 'dish', dp_dishes: 'name', dp_days: 'day', dp_shop: 'week,item' }
export interface Op {
  table: Table
  row: Record<string, unknown>
  qid?: string
}

export type Phase = 'loading' | 'login' | 'not-member' | 'ready'

const CACHE = 'dinner-cache-v1'
const QUEUE = 'dinner-queue-v1'

const read = <T>(k: string): T | null => {
  try {
    const v = localStorage.getItem(k)
    return v ? (JSON.parse(v) as T) : null
  } catch {
    return null
  }
}
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* 手機空間滿了或私密瀏覽：照常運作，只是不存 */
  }
}

export const emptyData = (): Data => ({
  settings: { people: 3, diet: true, noHot: true, maxMin: 30, commute: 30, dinnerMin: 19 * 60, routine: {}, out: { mine: [], no: [] } },
  marks: {},
  custom: [],
  days: {},
  shop: {},
  week: weekStart(taipeiToday()),
})

// 把一個動作套到資料上（送出前先顯示，畫面不用等網路）
function apply(d: Data, op: Op): Data {
  const r = op.row
  switch (op.table) {
    case 'dp_settings': {
      const s = { ...d.settings }
      if ('people' in r) s.people = r.people as People
      if ('diet' in r) s.diet = r.diet as boolean
      if ('no_hot' in r) s.noHot = r.no_hot as boolean
      if ('max_min' in r) s.maxMin = r.max_min as Settings['maxMin']
      if ('commute_min' in r) s.commute = r.commute_min as number
      if ('dinner_min' in r) s.dinnerMin = r.dinner_min as number
      if ('routine' in r) s.routine = r.routine as Record<string, number>
      if ('out_prefs' in r) s.out = r.out_prefs as Settings['out']
      return { ...d, settings: s }
    }
    case 'dp_marks': {
      const name = r.dish as string
      const m: Mark = d.marks[name] ? { ...d.marks[name] } : { fav: false, banned: false }
      if ('fav' in r) m.fav = r.fav as boolean
      if ('banned' in r) m.banned = r.banned as boolean
      return { ...d, marks: { ...d.marks, [name]: m } }
    }
    case 'dp_dishes':
      if (d.custom.some((x) => x.name === r.name)) return d
      return { ...d, custom: [...d.custom, rowToDish(r)] }
    case 'dp_days': {
      const day = r.day as string
      const cur: Day = d.days[day] ?? { day, reroll: 0, dishes: null, people: null, cooked: false, offAt: null, avail: null, plan: null, planBy: null, boxedAt: null, snackAt: null, eatOut: null }
      const next = { ...cur }
      if ('reroll' in r) next.reroll = r.reroll as number
      if ('dishes' in r) next.dishes = r.dishes as string[] | null
      if ('people' in r) next.people = r.people as People | null
      if ('cooked' in r) next.cooked = r.cooked as boolean
      if ('off_at' in r) next.offAt = r.off_at as string | null
      if ('avail_min' in r) next.avail = r.avail_min as number | null
      if ('plan' in r) next.plan = r.plan as Day['plan']
      if ('plan_by' in r) next.planBy = r.plan_by as Day['planBy']
      if ('boxed_at' in r) next.boxedAt = r.boxed_at as string | null
      if ('snack_at' in r) next.snackAt = r.snack_at as string | null
      if ('eat_out' in r) next.eatOut = r.eat_out as Day['eatOut']
      return { ...d, days: { ...d.days, [day]: next } }
    }
    case 'dp_shop':
      if (r.week !== d.week) return d
      return { ...d, shop: { ...d.shop, [r.item as string]: r.done as boolean } }
  }
}

function rowToDish(r: Record<string, unknown>): Dish {
  return {
    type: r.type as Dish['type'],
    name: r.name as string,
    min: Number(r.minutes),
    tool: r.tool as Dish['tool'],
    hot: false,
    ing: (r.ing as Dish['ing']) ?? [],
    sauce: (r.sauce as Dish['sauce']) ?? [],
    custom: true,
  }
}

type DayRow = Omit<Day, 'offAt' | 'avail' | 'plan' | 'planBy' | 'boxedAt' | 'snackAt' | 'eatOut'> & {
  off_at: string | null
  avail_min: number | null
  plan: Day['plan']
  plan_by: Day['planBy']
  boxed_at: string | null
  snack_at: string | null
  eat_out: Day['eatOut']
}

async function fetchAll(): Promise<Data> {
  const today = taipeiToday()
  const week = weekStart(today)
  const r = await Promise.all([
    supabase.from('dp_settings').select('people,diet,no_hot,max_min,commute_min,dinner_min,routine,out_prefs').eq('id', 1).maybeSingle(),
    supabase.from('dp_marks').select('dish,fav,banned'),
    supabase.from('dp_dishes').select('name,type,minutes,tool,ing,sauce').order('created_at'),
    supabase.from('dp_days').select('day,reroll,dishes,people,cooked,off_at,avail_min,plan,plan_by,boxed_at,snack_at,eat_out').gte('day', addDays(today, -60)),
    supabase.from('dp_shop').select('item,done').eq('week', week),
  ])
  for (const x of r) if (x.error) throw x.error
  const [s, marks, dishes, days, shop] = r
  const st = s.data as { people: People; diet: boolean; no_hot: boolean; max_min: Settings['maxMin']; commute_min: number; dinner_min: number; routine: Record<string, number> | null; out_prefs: Settings['out'] | null } | null
  return {
    settings: st
      ? { people: st.people, diet: st.diet, noHot: st.no_hot, maxMin: st.max_min, commute: st.commute_min ?? 30, dinnerMin: st.dinner_min ?? 19 * 60, routine: st.routine ?? {}, out: { mine: st.out_prefs?.mine ?? [], no: st.out_prefs?.no ?? [] } }
      : emptyData().settings,
    marks: Object.fromEntries(((marks.data ?? []) as { dish: string; fav: boolean; banned: boolean }[]).map((m) => [m.dish, { fav: m.fav, banned: m.banned }])),
    custom: ((dishes.data ?? []) as Record<string, unknown>[]).map(rowToDish),
    days: Object.fromEntries(
      ((days.data ?? []) as DayRow[]).map(({ off_at, avail_min, plan, plan_by, boxed_at, snack_at, eat_out, ...x }) => [
        x.day,
        { ...x, people: x.people ?? null, offAt: off_at ?? null, avail: avail_min ?? null, plan: plan ?? null, planBy: plan_by ?? null, boxedAt: boxed_at ?? null, snackAt: snack_at ?? null, eatOut: eat_out ?? null },
      ]),
    ),
    shop: Object.fromEntries(((shop.data ?? []) as { item: string; done: boolean }[]).map((x) => [x.item, x.done])),
    week,
  }
}

type Err = { message: string; code?: string }
const isNetwork = (e: Err) => !e.code || /fetch|network|load failed|timeout/i.test(e.message)
function reason(e: Err) {
  if (e.code === '42501') return '沒有權限'
  if (e.code === '23514' || e.code === '22001') return '內容不符合規則'
  if (e.code === 'PGRST301' || e.code === 'PGRST303') return '登入過期，請重新登入'
  return e.message
}

class Store {
  phase: Phase = 'loading'
  server: Data
  queue: Op[]
  online = navigator.onLine
  loadError = ''
  problem = ''
  syncedAt: string | null = null
  private uid: string | null = null
  private listeners = new Set<() => void>()
  private flushing = false
  private channel: ReturnType<typeof supabase.channel> | null = null

  constructor() {
    const c = read<{ userId: string; data: Data; syncedAt: string }>(CACHE)
    // 舊版存的資料沒有新設定（例如通勤時間），用預設值補上
    this.server = c?.data ? { ...c.data, settings: { ...emptyData().settings, ...c.data.settings } } : emptyData()
    this.syncedAt = c?.syncedAt ?? null
    this.uid = c?.userId ?? null
    this.queue = read<Op[]>(QUEUE) ?? []
  }

  get data(): Data {
    return this.queue.reduce(apply, this.server)
  }
  get dishes(): Dish[] {
    return [...MENU, ...this.data.custom]
  }
  get pending() {
    return this.queue.length
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  private emit() {
    this.listeners.forEach((f) => f())
  }

  async start() {
    if (!configured) {
      this.phase = 'login'
      this.loadError = '網站還沒設定好資料庫'
      return this.emit()
    }
    const { data } = await supabase.auth.getSession()
    await this.onSession(data.session)
    supabase.auth.onAuthStateChange((_e, s) => void this.onSession(s))
    const up = () => {
      this.online = navigator.onLine
      this.emit()
      if (navigator.onLine) void this.flush().then(() => this.refresh())
    }
    window.addEventListener('online', up)
    window.addEventListener('offline', up)
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && up())
    setInterval(() => this.queue.length && void this.flush(), 30_000)
  }

  private async onSession(s: Session | null) {
    // 離線打開：沿用手機裡記得的人
    const uid = s?.user.id ?? (!navigator.onLine ? this.uid : null)
    if (!uid) {
      this.phase = 'login'
      this.stopRealtime()
      return this.emit()
    }
    if (this.uid && this.uid !== uid) {
      // 換人登入：不能看到上一個人留在手機裡的資料
      this.server = emptyData()
      this.queue = []
      write(QUEUE, [])
    }
    const first = this.uid !== uid || this.phase !== 'ready'
    this.uid = uid
    if (first) {
      if (this.syncedAt) this.phase = 'ready'
      this.emit()
      if (navigator.onLine && s) {
        const { data, error } = await supabase.from('dp_members').select('user_id').eq('user_id', uid).maybeSingle()
        if (!error && !data) {
          this.phase = 'not-member'
          return this.emit()
        }
      }
      this.phase = 'ready'
      await this.refresh()
      await this.flush()
      this.startRealtime()
    }
  }

  private startRealtime() {
    if (this.channel) return
    let t: ReturnType<typeof setTimeout> | undefined
    const later = () => {
      clearTimeout(t)
      t = setTimeout(() => void this.refresh(), 250)
    }
    const ch = supabase.channel('dinner-planner')
    for (const table of Object.keys(KEYS)) ch.on('postgres_changes', { event: '*', schema: 'public', table }, later)
    ch.subscribe()
    this.channel = ch
  }
  private stopRealtime() {
    if (this.channel) void supabase.removeChannel(this.channel)
    this.channel = null
  }

  async refresh() {
    if (!this.uid || !navigator.onLine) return this.emit()
    try {
      this.server = await fetchAll()
      this.syncedAt = new Date().toISOString()
      this.loadError = ''
      write(CACHE, { userId: this.uid, data: this.server, syncedAt: this.syncedAt })
    } catch (e) {
      const err = e as Err
      if (!isNetwork(err)) this.loadError = reason(err)
    }
    this.emit()
  }

  run(table: Table, row: Record<string, unknown>) {
    this.queue = [...this.queue, { table, row, qid: crypto.randomUUID() }]
    write(QUEUE, this.queue)
    this.emit()
    void this.flush()
  }

  async flush() {
    if (this.flushing || !navigator.onLine || !this.uid) return
    this.flushing = true
    let rejected = false
    try {
      while (this.queue.length) {
        const op = this.queue[0]
        const { error } = await supabase.from(op.table).upsert(op.row, { onConflict: KEYS[op.table] })
        if (error && isNetwork(error)) break
        if (error) {
          // 資料庫拒絕：不會成功，丟掉這個動作並告訴使用者，畫面回到資料庫的樣子
          this.problem = `有一個改動沒存成功：${reason(error)}`
          rejected = true
        } else {
          // 先套到手機裡的資料，畫面不會閃回去；即時同步再拿最新的
          this.server = apply(this.server, op)
        }
        this.queue = this.queue.slice(1)
        write(QUEUE, this.queue)
      }
    } finally {
      this.flushing = false
      this.emit()
    }
    if (rejected) await this.refresh()
  }

  async signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) return ''
    return /invalid/i.test(error.message) ? 'Email 或密碼不對' : `登入失敗：${error.message}`
  }

  async signOut() {
    await supabase.auth.signOut()
    localStorage.removeItem(CACHE)
    this.queue = []
    write(QUEUE, [])
    this.server = emptyData()
    this.uid = null
    this.syncedAt = null
    this.phase = 'login'
    this.emit()
  }

  dismissProblem() {
    this.problem = ''
    this.emit()
  }
}

export const store = new Store()
