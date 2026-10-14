import './globals.css'
import { store } from '../features/data/store'
import {
  AISLE_NAMES, KIND, SIZES, TOOL, addDays, cookWindow, dailySeed, daysAgo, drawMeal, fmtClock, fmtQty, fmtSauce, isLight, limitOf, mealName,
  parseClock, taipeiMinutes, DAY_CUTOFF, nightDay,
  parseIngInput, rng, roundQty, sauceAmt, sizeLabel, slotsFor, taipeiToday, totals, typeOf, weekday, type Meal, type Pool, type Slot,
} from '../lib/meal'
import { stepsOf } from '../lib/steps'
import { findOut, mapUrl, pickOut, type When } from '../lib/eatout'
import type { Day, Dish, People } from '../lib/types'

const WD = ['日', '一', '二', '三', '四', '五', '六']
const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const dateLabel = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}（${WD[weekday(iso)]}）`

// 這支手機自己的畫面狀態（不需要同步）
type Tab = 'tonight' | 'week' | 'lib' | 'shop'
const ui = {
  tab: 'tonight' as Tab,
  locks: {} as Partial<Record<Slot, boolean>>,
  libKind: 'main' as Dish['type'],
  libQ: '',
  /** 菜單庫裡展開做法的菜，重畫畫面時保持打開 */
  open: new Set<string>(),
  /** 加菜表單打到一半的內容：另一支手機改了東西、畫面重畫時不會被清掉 */
  draft: {} as Record<string, string>,
  /** 下班前預覽：要買什麼有沒有打開 */
  pvOpen: false,
  /** 吃外面：常吃的店有沒有打開 */
  eoOpen: false,
}
type Person = 'a' | 's'
const NAME: Record<Person, string> = { a: '阿寶', s: '草莓' }
const draftVal = (id: string, dflt = '') => esc(ui.draft[id] ?? dflt)

const app = document.getElementById('app')!
const tabs = document.getElementById('tabs')!
const toastEl = document.getElementById('toast')!

// ───── 資料整理 ─────
function pool(): Pool {
  const d = store.data
  const today = taipeiToday()
  const lastEaten: Record<string, string> = {}
  for (const day of Object.values(d.days)) {
    if (!day.dishes || day.day > today || (day.day === today && !day.cooked)) continue
    for (const n of day.dishes) if (!lastEaten[n] || lastEaten[n] < day.day) lastEaten[n] = day.day
  }
  return { dishes: store.dishes, marks: d.marks, lastEaten, today, diet: d.settings.diet }
}
const byName = (name: string) => store.dishes.find((d) => d.name === name)

// 抽菜的條件：按了「我下班了」就用算出來的可以煮幾分鐘，在家就用平常的時間設定
function drawOpts(row = store.data.days[taipeiToday()]) {
  const s = store.data.settings
  const maxMin = row?.offAt && row.avail !== null && row.avail !== undefined ? limitOf(row.avail) : s.maxMin
  return { maxMin, noHot: s.noHot, diet: s.diet }
}
/** 今天還沒按下班（也還沒決定煮什麼）：先不排菜 */
const waitingOff = () => {
  // 半夜（草莓剛回家）不問下班
  if (taipeiMinutes() < DAY_CUTOFF) return false
  const row = store.data.days[taipeiToday()]
  return !row?.offAt && !row?.cooked && !row?.eatOut
}

// 今晚的菜：存在 dp_days，兩支手機看到同一組
function tonight(): { meal: Meal; saved: boolean } {
  const d = store.data
  const today = taipeiToday()
  const s = d.settings
  const slots = slotsFor(s.people, s.diet)
  const row = d.days[today]
  if (row?.dishes && row.people === s.people && row.dishes.length === slots.length) {
    const meal: Meal = {}
    slots.forEach((slot, i) => (meal[slot] = row.dishes![i]))
    return { meal, saved: true }
  }
  const p = pool()
  // 今天還沒排：用日期當種子抽，兩支手機會一樣
  const o = drawOpts(row)
  const meal = drawMeal(p, s.people, rng(dailySeed(today, s.people, o, row?.reroll ?? 0)), {}, o)
  return { meal, saved: false }
}
function saveTonight(meal: Meal, extra: Record<string, unknown> = {}) {
  const s = store.data.settings
  const dishes = slotsFor(s.people, s.diet).map((slot) => meal[slot]).filter(Boolean)
  if (!dishes.length) return
  store.run('dp_days', { day: taipeiToday(), dishes, people: s.people, ...extra })
}
function redraw(extraSeed = '') {
  const today = taipeiToday()
  const s = store.data.settings
  const { meal } = tonight()
  const fixed: Meal = {}
  for (const slot of slotsFor(s.people, s.diet)) if (ui.locks[slot] && meal[slot]) fixed[slot] = meal[slot]
  const reroll = (store.data.days[today]?.reroll ?? 0) + (extraSeed ? 0 : 1)
  const o = drawOpts()
  const next = drawMeal(pool(), s.people, rng(dailySeed(today, s.people, o, reroll, extraSeed)), fixed, o)
  saveTonight(next, extraSeed ? { cooked: false } : { reroll, cooked: false })
}

// ───── 共用小元件 ─────
let undoFn: (() => void) | null = null
let toastTimer: ReturnType<typeof setTimeout> | undefined
function toast(msg: string, undo?: () => void) {
  undoFn = undo ?? null
  toastEl.innerHTML = esc(msg) + (undo ? ' <button class="undo" data-act="undo">復原</button>' : '')
  toastEl.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastEl.hidden = true
    undoFn = null
  }, undo ? 5000 : 2200)
}

const ICONS: Record<Tab, string> = {
  tonight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 13h16a8 8 0 0 1-16 0Z"/><path d="M12 5v3M8.5 6.5 9.5 8.5M15.5 6.5l-1 2"/></svg>',
  week: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  lib: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 4h11a1 1 0 0 1 1 1v15H7a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1Z"/><path d="M5 18a2 2 0 0 1 2-2h11M9 8h6M9 11h4"/></svg>',
  shop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 8h14l-1.2 11a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9Z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>',
}
const TABS: [Tab, string][] = [['tonight', '今晚'], ['week', '這週'], ['lib', '菜單庫'], ['shop', '買菜']]

function banners() {
  const out: string[] = []
  if (!store.online) out.push(`<div class="banner off" role="status">沒有網路。改的東西先存在這支手機，連上網路會自動同步。</div>`)
  else if (store.pending) out.push(`<div class="banner off" role="status">同步中…</div>`)
  if (store.problem) out.push(`<div class="banner bad" role="alert"><span>${esc(store.problem)}</span><button data-act="dismiss">知道了</button></div>`)
  if (store.loadError) out.push(`<div class="banner bad" role="alert"><span>讀不到最新資料：${esc(store.loadError)}</span><button data-act="retry">再試一次</button></div>`)
  return out.join('')
}

function qtyList(food: ReturnType<typeof totals>['food']) {
  return `<ul class="qty">${food.map((f) => `<li><span>${esc(f.name)}<span class="who">${esc(f.who.join('、'))}</span></span><span class="n">${fmtQty(f.q, f.unit)}</span></li>`).join('')}</ul>`
}

// ───── 今晚 ─────
function viewTonight() {
  const d = store.data
  const s = d.settings
  const today = taipeiToday()
  const n = s.people
  if (store.data.days[nightDay()]?.eatOut) return viewEatOut()
  if (waitingOff()) return viewOffGate()
  const slots = slotsFor(n, s.diet)
  const { meal } = tonight()
  const ds = slots.map((sl) => meal[sl] && byName(meal[sl]!)).filter(Boolean) as Dish[]
  const maxMin = ds.length ? Math.max(...ds.map((x) => x.min)) : 0
  const t = totals(ds.map((x) => ({ d: x, n })), s.diet)
  const row = d.days[today]
  const tools: Record<string, number> = {}
  ds.forEach((x) => (tools[x.tool] = (tools[x.tool] ?? 0) + 1))
  return `
  <header><h1>今晚煮什麼</h1><span class="date">${dateLabel(today)}</span></header>
  ${banners()}
  ${peopleRow()}
  ${offInfo(row)}
  <section class="filters" aria-label="條件">
    ${row?.offAt && row.avail !== null ? '' : `<div class="frow"><span class="flabel">時間</span><div class="chips">
      ${([[20, '20 分內'], [30, '30 分內'], [0, '不限']] as const).map(([v, l]) => `<button class="chip" data-time="${v}" aria-pressed="${s.maxMin === v}">${l}</button>`).join('')}</div>
    </div>`}
    <div class="frow"><span class="flabel">口味</span><div class="chips">
      <button class="chip" data-nohot aria-pressed="${s.noHot}">不要辣</button><button class="chip" data-diet aria-pressed="${s.diet}">草莓減重中</button></div>
    </div>
  </section>
  <section class="meal" aria-label="今晚的菜">
    <div class="meal-head"><b>${n} 人・${mealName(n, s.diet)}</b><span>約 ${maxMin} 分鐘上桌</span></div>
    ${slots.map((slot) => {
      const x = meal[slot] ? byName(meal[slot]!) : undefined
      const k = typeOf(slot)
      return `<div class="dish"><div class="kind k-${k}">${KIND[k]}</div>
        <div class="dname">${x
          ? `<strong>${esc(x.name)}${d.marks[x.name]?.fav ? '<span class="tag">愛吃</span>' : ''}</strong><small>${TOOL[x.tool]}・${x.min} 分・<button class="rec" data-how="${esc(x.name)}">做法 ↓</button></small>`
          : '<span class="empty-dish">沒有符合條件的菜，放寬時間試試</span>'}</div>
        <div class="acts">${x ? `<button class="lock" data-swap="${slot}" aria-label="換掉${esc(x.name)}，只換這道">換一道</button><button class="nope" data-nope="${slot}" aria-label="不敢吃${esc(x.name)}，以後不要這道">不敢吃</button>` : ''}</div></div>`
    }).join('')}
    <p class="tools">${Object.entries(tools).map(([k, v]) => `${TOOL[k as Dish['tool']]} ${v}`).join('・')}，可以同時開工</p>
  </section>
  ${row?.cooked
    ? `<div class="cooked">✓ 今晚就煮這個，已加進買菜清單</div>`
    : `<div class="daily"><span>${row?.reroll ? `今天換過 ${row.reroll} 次` : '每天自動抽一組，同一餐不會撞食材'}</span><button class="link" data-act="eatout">今天不煮，吃外面</button></div>`}
  ${s.diet ? `<section class="plate" aria-label="草莓的盤子">
    <div class="plate-fig" aria-hidden="true"><span class="q veg">菜</span><span class="q veg">菜</span><span class="q pro">主菜</span><span class="q carb">飯</span></div>
    <div class="plate-txt"><b>草莓的盤子：211 餐盤</b>
      <p>半盤青菜、四分之一主菜、四分之一澱粉。飯用電子鍋煮糙米或五穀米，一餐約半碗。</p>
      <p>先吃主菜，再吃菜，最後吃飯。下面的味霸、鹽、醬油、糖都已經減半，每道菜用 1 小匙油。味霸本身就很鹹，用了就不要再加鹽。</p>
    </div>
  </section>` : ''}
  <div class="actions">
    <button class="btn btn-ghost" data-act="shuffle">換一組</button>
    <button class="btn btn-main" data-act="cook" ${row?.cooked ? 'disabled' : ''}>${row?.cooked ? '已決定' : '就煮這個'}</button>
  </div>
  ${ds.length ? `<section class="prep" aria-label="今晚要準備">
    <h3>到全聯要買<small>${n} 人份</small></h3>
    ${qtyList(t.food)}
    <h3>配料<small>${s.diet ? '已減半・' : ''}家裡沒有再買</small></h3>
    <div class="sauces">${t.sauce.map((x) => `<span class="sauce">${esc(x.name)} ${esc(fmtSauce(x.amt))}</span>`).join('')}</div>
  </section>` : ''}
  ${ds.length ? howSection(ds, n, s.diet) : ''}
  <div class="foot"><span>${store.syncedAt ? `兩支手機同步・${new Date(store.syncedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })} 更新` : ''}</span><button data-act="signout">登出</button></div>`
}

// 做法：花最久的先開工；每道菜自己的份量（換人數、減重都已算好）
function howSteps(x: Dish) {
  const steps = stepsOf(x.name)
  return steps.length
    ? `<ol class="steps">${steps.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>`
    : '<p class="sub">自己加的菜，還沒寫做法。</p>'
}
function howSection(ds: Dish[], n: People, diet: boolean) {
  const order = [...ds].sort((a, b) => b.min - a.min)
  return `<section class="how" aria-label="做法">
    <h3>做法<small>花最久的先開工</small></h3>
    <p class="how-tip">先洗米放電子鍋按下去${diet ? '（糙米或五穀米）' : ''}，再照下面的順序做。${diet ? '每道菜的油都只用 1 小匙，下面的調味已經減半。' : ''}</p>
    ${order.map((x) => `<article class="how-dish" id="how-${esc(x.name)}">
      <div class="how-head"><span class="kind k-${x.type}">${KIND[x.type]}</span><b>${esc(x.name)}</b><small>${TOOL[x.tool]}・${x.min} 分</small></div>
      <p class="how-ing">${x.ing.map(([nm, q, u]) => `${esc(nm)} ${fmtQty(roundQty((q * n) / 3, u), u)}`).join('、')}${x.sauce.length ? `<br><span>${x.sauce.map(([nm, a]) => `${esc(nm)} ${esc(fmtSauce([sauceAmt(nm, a, n, diet)]))}`).join('、')}</span>` : ''}</p>
      ${howSteps(x)}
    </article>`).join('')}
  </section>`
}

// ───── 下班 ─────
const COMMUTES = [0, 10, 15, 20, 30, 40, 45, 60, 90]
function peopleRow() {
  const s = store.data.settings
  return `<div class="people" role="group" aria-label="幾個人吃">
    ${SIZES.map((k) => `<button data-people="${k}" aria-pressed="${s.people === k}"><b>${k} 人</b><small>${sizeLabel(k, s.diet)}</small></button>`).join('')}
  </div>`
}
function viewOffGate() {
  const s = store.data.settings
  const now = taipeiMinutes()
  const w = cookWindow(now, s.commute, s.dinnerMin)
  return `
 <header><h1>今晚煮什麼</h1><span class="date">${dateLabel(taipeiToday())}</span></header>
  ${banners()}
  ${previewBlock()}
  <section class="offwork" aria-label="下班">
    <b class="ow-title">下班了嗎？</b>
    <p class="ow-sub">按下去，照你到家的時間排今晚的菜。</p>
    <div class="ow-set">
      <label for="commute">通勤<select id="commute">${COMMUTES.map((m) => `<option value="${m}" ${m === s.commute ? 'selected' : ''}>${m ? m + ' 分鐘' : '不用通勤'}</option>`).join('')}</select></label>
      <label for="dinnerAt">想幾點吃<input id="dinnerAt" type="time" value="${fmtClock(s.dinnerMin)}"></label>
    </div>
    <div class="ow-calc" role="status">
      <span>現在 ${fmtClock(now)} 下班，${fmtClock(w.home)} 到家</span>
      <b>${w.rushed ? `來不及 ${fmtClock(s.dinnerMin)} 吃，挑 ${w.limit} 分鐘內的菜` : `可以煮 ${w.avail} 分鐘`}</b>
    </div>
    <button class="btn btn-main ow-go" data-act="off">我下班了</button>
    <button class="btn btn-ghost ow-out" data-act="eatout">今天吃外面</button>
    <button class="link ow-home" data-act="home">今天在家，直接排</button>
  </section>
  ${peopleRow()}
  <div class="foot"><span></span><button data-act="signout">登出</button></div>`
}
// 還沒下班先看今晚的菜：要先買菜就按「就煮這組」，下班後菜不會再換
function previewBlock() {
  const s = store.data.settings
  const { meal } = tonight()
  const rows = slotsFor(s.people, s.diet).map((sl) => [sl, meal[sl] && byName(meal[sl]!)] as const).filter((r) => r[1]) as [Slot, Dish][]
  const ds = rows.map((r) => r[1])
  if (!ds.length) return ''
  const t = totals(ds.map((x) => ({ d: x, n: s.people })), s.diet)
  return `<section class="pv" aria-label="今晚預覽">
    <div class="pv-head"><b>先看今晚的菜</b><span>${s.people} 人・約 ${Math.max(...ds.map((x) => x.min))} 分鐘</span></div>
    <ul class="pv-list">${rows.map(([sl, x]) => `<li><span class="kind k-${x.type}">${KIND[x.type]}</span><span class="pv-name"><strong>${esc(x.name)}</strong><small>${TOOL[x.tool]}・${x.min} 分</small></span><span class="pv-acts"><button class="lock" data-swap="${sl}" aria-label="換掉${esc(x.name)}，只換這道">換一道</button><button class="nope" data-nope="${sl}" aria-label="不敢吃${esc(x.name)}，以後不要這道">不敢吃</button></span></li>`).join('')}</ul>
    <details class="pv-buy" ${ui.pvOpen ? 'open' : ''}><summary>到全聯要買（${t.food.length} 樣）</summary>${qtyList(t.food)}</details>
    <p class="pv-tip">要先去買菜就按「就煮這組」，下班後菜就不會換。</p>
    <div class="actions"><button class="btn btn-ghost" data-act="shuffle">換一組</button><button class="btn btn-main" data-act="cook">就煮這組</button></div>
  </section>`
}
// 按了下班之後，在今晚的菜上面說明時間怎麼算的
function offInfo(row: Day | undefined) {
  if (!row?.offAt) return ''
  if (row.avail === null) return `<div class="ow-done"><span>今天在家，照平常的時間排</span><button class="ow-undo" data-act="reoff">按錯了</button></div>`
  const s = store.data.settings
  const off = taipeiMinutes(new Date(row.offAt))
  const limit = limitOf(row.avail)
  return `<div class="ow-done"><div><span>${fmtClock(off)} 下班・${fmtClock(off + s.commute)} 到家・${fmtClock(s.dinnerMin)} 開飯</span>
    <b>${row.avail < limit ? `時間很趕，只排 ${limit} 分鐘內的菜` : `可以煮 ${limit} 分鐘`}</b>
    ${limit < 40 ? '<small>電子鍋煮飯要 40 分鐘左右：早上出門前先預約，或用冷凍白飯。</small>' : ''}</div>
    <button class="ow-undo" data-act="reoff">按錯了</button></div>`
}

// ───── 吃外面 ─────
// 阿寶下班先吃、草莓運動完去買；同一天兩個人不抽一樣的，最近三天吃過的先避開
function outRecent(day: string) {
  const out: string[] = []
  for (let i = 1; i <= 3; i++) {
    const e = store.data.days[addDays(day, -i)]?.eatOut
    if (e) out.push(e.a, e.s)
  }
  return out
}
function outOpts(p: Person, avoid: string[]) {
  const s = store.data.settings
  const when: When = p === 'a' ? 'dinner' : 'late'
  return { when, light: p === 's' && s.diet, no: s.out.no, avoid, mine: s.out.mine }
}
function drawOut(day: string, salt: string, cur?: { a: string; s: string }) {
  const recent = outRecent(day)
  const a = cur?.a ?? pickOut(outOpts('a', recent), `${day}|out|a${salt}`)?.name ?? ''
  const sv = cur?.s ?? pickOut(outOpts('s', [...recent, a]), `${day}|out|s${salt}`)?.name ?? ''
  return { a, s: sv }
}
function startEatOut() {
  const day = nightDay()
  store.run('dp_days', { day, eat_out: drawOut(day, '') })
  toast('今天吃外面，幫你們各抽了一個')
  window.scrollTo(0, 0)
}
function eoCard(p: Person, name: string, when: string) {
  const x = findOut(name, store.data.settings.out.mine)
  return `<div class="eo-card"><div class="eo-who"><span class="eo-av eo-${p}">${NAME[p]}</span><span>${when}</span></div>
    ${x ? `<strong class="eo-name">${esc(x.name)}</strong><p class="eo-tip">${esc(x.tip)}</p>
    <div class="eo-btns"><a class="btn btn-main eo-map" href="${mapUrl(x)}" target="_blank" rel="noopener">附近的店 ↗</a>
      <button class="btn btn-ghost" data-eo="re" data-p="${p}">換一個</button>
      <button class="nope" data-eo="no" data-p="${p}" aria-label="不想吃${esc(x.name)}，以後不要抽到">不想吃</button></div>`
    : `<p class="eo-tip">沒有可以抽的了，到下面「不想吃的」恢復幾個。</p>`}</div>`
}
function viewEatOut() {
  const day = nightDay()
  const row = store.data.days[day]!
  const e = row.eatOut!
  const s = store.data.settings
  const whenOpt = (v: string, l: string) => `<option value="${v}" ${(ui.draft.eoWhen ?? 'both') === v ? 'selected' : ''}>${l}</option>`
  return `
  <header><h1>今晚吃外面</h1><span class="date">${dateLabel(day)}</span></header>
  ${banners()}
  <section class="eo" aria-label="今天吃外面">
    ${eoCard('a', e.a, `下班先吃`)}
    ${eoCard('s', e.s, `運動完去買${s.diet ? '・減重點法' : ''}`)}
    <p class="eo-note">按「附近的店」會打開地圖搜尋${esc('鳳山五甲')}附近，看標「營業中」的那幾家。半夜不是每家都開。</p>
  </section>
  <details class="eo-mine" ${ui.eoOpen ? 'open' : ''}><summary>我們常吃的店${s.out.mine.length ? `（${s.out.mine.length}）` : ''}</summary>
    <p class="eo-tip">加進來的店會一起抽，而且比較常抽到。</p>
    ${s.out.mine.length ? `<ul class="eo-list">${s.out.mine.map((m, i) => `<li><span>${esc(m.name)}<small>${m.when === 'dinner' ? '下班吃' : m.when === 'late' ? '半夜買' : '都可以'}</small></span><button class="link" data-eo="del" data-i="${i}">刪掉</button></li>`).join('')}</ul>` : ''}
    <form id="eoForm" class="eo-form">
      <input id="eoName" placeholder="店名，例如：五甲路的鍋燒意麵" maxlength="30" value="${draftVal('eoName')}" aria-label="店名">
      <select id="eoWhen" aria-label="什麼時候吃">${whenOpt('both', '都可以')}${whenOpt('dinner', '下班吃')}${whenOpt('late', '半夜買')}</select>
      <button class="btn btn-main">加入</button>
    </form>
    ${s.out.no.length ? `<p class="eo-tip">不想吃的：${s.out.no.map((n) => `<button class="eo-chip" data-eo="unno" data-n="${esc(n)}">${esc(n)} 恢復</button>`).join('')}</p>` : ''}
  </details>
  <button class="link ow-home eo-cook" data-act="cookin">今天還是自己煮</button>
  <div class="foot"><span></span><button data-act="signout">登出</button></div>`
}
function eoClick(ds: DOMStringMap) {
  const day = nightDay()
  const row = store.data.days[day]
  const s = store.data.settings
  const p = ds.p as Person
  const setOut = (prefs: Partial<typeof s.out>) => store.run('dp_settings', { id: 1, out_prefs: { ...s.out, ...prefs } })
  switch (ds.eo) {
    case 're':
    case 'no': {
      if (!row?.eatOut) return
      const prev = row.eatOut
      const other = p === 'a' ? prev.s : prev.a
      if (ds.eo === 'no') setOut({ no: [...s.out.no, prev[p]] })
      const salt = `|${ds.eo}|${prev[p]}|${Date.now()}`
      const o = outOpts(p, [...outRecent(day), other, prev[p]])
      if (ds.eo === 'no') o.no = [...s.out.no, prev[p]]
      const next = pickOut(o, `${day}|out|${p}${salt}`)?.name ?? ''
      store.run('dp_days', { day, eat_out: { ...prev, [p]: next } })
      if (ds.eo === 'no')
        return toast(`以後不會抽到「${prev[p]}」`, () => {
          setOut({ no: s.out.no })
          store.run('dp_days', { day, eat_out: prev })
        })
      return
    }
    case 'del': {
      const i = Number(ds.i)
      const m = s.out.mine[i]
      if (!m) return
      setOut({ mine: s.out.mine.filter((_, k) => k !== i) })
      return toast(`刪掉「${m.name}」`, () => setOut({ mine: s.out.mine }))
    }
    case 'unno':
      setOut({ no: s.out.no.filter((n) => n !== ds.n) })
      return toast(`「${ds.n}」恢復了`)
  }
}

// ───── 這週 ─────
const weekDays = () => Array.from({ length: 7 }, (_, i) => addDays(taipeiToday(), i))
function viewWeek() {
  const d = store.data
  const today = taipeiToday()
  return `
  <header><h1>這週晚餐</h1><span class="date">${dateLabel(today)} 起</span></header>
  ${banners()}
  <div class="sec-title"><h2>接下來 7 天</h2><button class="link" data-act="autofill">空的幫我排（${d.settings.people} 人）</button></div>
  <section class="week">
    ${weekDays().map((k, i) => {
      const p = d.days[k]
      const names = p?.dishes ? p.dishes.map((x) => '<i>' + esc(x) + '</i>').join('、') : ''
      return `<div class="day ${i === 0 ? 'today' : ''}"><div class="d"><b>${Number(k.slice(8))}</b><span>${i === 0 ? '今天' : '週' + WD[weekday(k)]}</span></div>
        <div class="m ${names ? '' : 'none'}">${names ? names + `<small>${p!.people ?? d.settings.people} 人份${i === 0 && !p!.cooked ? '・今晚建議' : ''}</small>` : '還沒決定'}</div>
        ${names && i > 0 ? `<button class="x" data-clear="${k}" aria-label="清掉${Number(k.slice(8))}號">清掉</button>` : '<span></span>'}</div>`
    }).join('')}
  </section>
  <p class="note">一週內同一道菜不會出現兩次，同一餐不撞食材。家人要來那天，先到「今晚」切成 8 人再排。</p>`
}
function autofill() {
  const d = store.data
  const s = d.settings
  const used = new Set<string>()
  for (const k of weekDays()) d.days[k]?.dishes?.forEach((x) => used.add(x))
  const { meal, saved } = tonight()
  if (!saved) {
    saveTonight(meal)
    Object.values(meal).forEach((x) => used.add(x!))
  }
  const r = rng('week|' + crypto.randomUUID())
  let c = 0
  for (const k of weekDays().slice(1)) {
    if (d.days[k]?.dishes) continue
    const m = drawMeal(pool(), s.people, r, {}, { maxMin: 0, noHot: s.noHot, exclude: used })
    const dishes = slotsFor(s.people, s.diet).map((sl) => m[sl]).filter(Boolean) as string[]
    if (!dishes.length) continue
    dishes.forEach((x) => used.add(x))
    store.run('dp_days', { day: k, dishes, people: s.people })
    c++
  }
  toast(c ? `排好 ${c} 天` : '這週都排好了')
}

// ───── 菜單庫 ─────
function viewLib() {
  const d = store.data
  const q = ui.libQ.trim()
  const p = pool()
  const all = store.dishes
  const list = all
    .filter((x) => x.type === ui.libKind && (!q || x.name.includes(q) || x.ing.some((i) => i[0].includes(q))))
    .sort((a, b) => Number(!!d.marks[a.name]?.banned) - Number(!!d.marks[b.name]?.banned) || Number(!!d.marks[b.name]?.fav) - Number(!!d.marks[a.name]?.fav) || a.tool.localeCompare(b.tool) || a.min - b.min)
  const banned = all.filter((x) => d.marks[x.name]?.banned).length
  return `
  <header><h1>菜單庫</h1><span class="date">${all.length} 道</span></header>
  ${banners()}
  <label class="search" for="libQ"><input id="libQ" type="search" placeholder="找菜名或食材，例如：雞腿" value="${esc(ui.libQ)}"></label>
  <div class="seg" role="group" aria-label="種類">
    ${(Object.entries(KIND) as [Dish['type'], string][]).map(([k, l]) => `<button data-kind="${k}" aria-pressed="${ui.libKind === k}">${l} ${all.filter((x) => x.type === k).length}</button>`).join('')}
  </div>
  <p class="sub">按 ♡ 標「愛吃」，抽到的機會變 3 倍。按「不敢吃」以後就不會再抽到，放在最下面，可以恢復。${banned ? `目前 ${banned} 道不吃。` : ''}</p>
  <section class="list">
    ${list.length ? list.map((x) => {
      const m = d.marks[x.name]
      const a = daysAgo(p, x.name)
      return `<div class="row ${m?.banned ? 'banned' : ''}"><div class="t"><b>${esc(x.name)}</b>${m?.banned ? '<span class="tag">不吃</span>' : ''}${x.hot ? '<span class="tag">辣</span>' : ''}${isLight(x) ? '<span class="tag lite">輕盈</span>' : ''}<small>${TOOL[x.tool]}・${x.min} 分・${a === null ? '還沒煮過' : a === 0 ? '今天煮過' : a + ' 天前煮過'}</small></div>
      <div class="acts">${m?.banned
        ? `<button class="nope back" data-unban="${esc(x.name)}">恢復</button>`
        : `<button class="heart" data-fav="${esc(x.name)}" aria-pressed="${!!m?.fav}" aria-label="${m?.fav ? '取消愛吃' : '標成愛吃'}">${m?.fav ? '♥' : '♡'}</button><button class="nope" data-ban="${esc(x.name)}" aria-label="不敢吃${esc(x.name)}">不敢吃</button>`}</div>
      <details class="lib-how"${ui.open.has(x.name) ? ' open' : ''} data-name="${esc(x.name)}"><summary>做法</summary>${howSteps(x)}</details></div>`
    }).join('') : '<div class="blank">找不到，換個字試試，或從下面加一道</div>'}
  </section>
  <form class="add" id="addForm">
    <b>加一道我們家的菜</b>
    <label for="fName">菜名<input id="fName" required maxlength="20" placeholder="例如：洋蔥牛肉丼" value="${draftVal('fName')}"></label>
    <div class="two">
      <label for="fType">種類<select id="fType">${(Object.entries(KIND) as [string, string][]).map(([k, l]) => `<option value="${k}" ${k === (ui.draft.fType ?? ui.libKind) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label for="fTool">用什麼煮<select id="fTool">${Object.entries(TOOL).map(([k, l]) => `<option value="${k}" ${k === ui.draft.fTool ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    <label for="fMin">要幾分鐘<input id="fMin" type="number" inputmode="numeric" min="1" max="240" value="${draftVal('fMin', '20')}"></label>
    <label for="fIng">全聯要買的（3 人份）<input id="fIng" placeholder="牛肉片 300g 洋蔥 1顆" value="${draftVal('fIng')}"></label>
    <label for="fSauce">配料<input id="fSauce" placeholder="醬油 米酒 味霸" value="${draftVal('fSauce')}"></label>
    <button class="btn btn-main" type="submit">加入</button>
  </form>`
}

// ───── 買菜 ─────
function viewShop() {
  const d = store.data
  const entries: { d: Dish; n: number }[] = []
  for (const k of weekDays()) {
    const p = d.days[k]
    if (!p?.dishes) continue
    for (const name of p.dishes) {
      const x = byName(name)
      if (x) entries.push({ d: x, n: p.people ?? d.settings.people })
    }
  }
  const head = `<header><h1>買菜清單</h1><span class="date">${entries.length ? `${entries.length} 道菜的量` : '這週排的菜'}</span></header>${banners()}`
  if (!entries.length) return `${head}<div class="blank">這週還沒排菜。<br>到「這週」按「空的幫我排」，清單會自己算好份量。</div>`
  const t = totals(entries, d.settings.diet)
  const row = (key: string, label: string, who: string, n: string) => {
    const done = !!d.shop[key]
    return `<label class="${done ? 'done' : ''}"><input type="checkbox" data-shop="${esc(key)}" ${done ? 'checked' : ''}><span>${esc(label)}<small>${esc(who)}</small></span><span class="n">${n}</span></label>`
  }
  return `${head}
  ${AISLE_NAMES.map(([a, g]) => {
    const fs = t.food.filter((f) => f.aisle === a)
    return fs.length ? `<div class="grp">${g}</div><section class="shop">${fs.map((f) => row(`f:${f.name}|${f.unit}`, f.name, f.who.join('、'), fmtQty(f.q, f.unit))).join('')}</section>` : ''
  }).join('')}
  <div class="grp">配料・家裡有就勾掉</div>
  <section class="shop">${t.sauce.map((x) => row('s:' + x.name, x.name, x.who.join('、'), '')).join('')}</section>
  <p class="note">照全聯逛的順序排。份量是今天起 7 天排的菜加總，肉類挑最接近的盒裝重量就好。兩支手機的勾勾會同步。</p>`
}

// ───── 登入與其他狀態 ─────
function viewLogin(err = '') {
  return `<form class="login" id="loginForm">
    <div><h1>今晚煮什麼</h1><div class="note" style="margin-top:8px">用「今日事」或「叫蛋記帳」的帳號登入，登入一次這支手機就會記得。</div></div>
    ${store.loadError ? `<div class="banner bad">${esc(store.loadError)}</div>` : ''}
    <div class="field"><label for="email">Email</label><input class="input" id="email" type="email" autocomplete="username" inputmode="email"></div>
    <div class="field"><label for="pw">密碼</label><input class="input" id="pw" type="password" autocomplete="current-password"></div>
    <div class="err" role="alert" id="loginErr">${esc(err)}</div>
    <button class="btn btn-main" id="loginBtn">登入</button>
  </form>`
}

function render() {
  // 重畫前記住正在打字的欄位，重畫後游標放回原處
  const act = document.activeElement
  const focusId = act instanceof HTMLInputElement && act.id ? act.id : null
  const keepFocus = focusId ? (act as HTMLInputElement).selectionStart : null
  if (store.phase === 'loading') {
    tabs.hidden = true
    app.innerHTML = `<header><h1>今晚煮什麼</h1></header><div class="blank" role="status">載入中…</div>`
    return
  }
  if (store.phase === 'login') {
    tabs.hidden = true
    if (!document.getElementById('loginForm')) app.innerHTML = viewLogin()
    return
  }
  if (store.phase === 'not-member') {
    tabs.hidden = true
    app.innerHTML = `<header><h1>今晚煮什麼</h1></header><div class="blank">這個帳號還沒開通，請跟家裡的大人說。</div><div class="foot"><span></span><button data-act="signout">換帳號登入</button></div>`
    return
  }
  tabs.hidden = false
  app.innerHTML = { tonight: viewTonight, week: viewWeek, lib: viewLib, shop: viewShop }[ui.tab]()
  tabs.innerHTML = TABS.map(([k, l]) => `<button data-tab="${k}" ${ui.tab === k ? 'aria-current="page"' : ''}>${ICONS[k]}<span>${l}</span></button>`).join('')
  if (focusId) {
    const i = document.getElementById(focusId) as HTMLInputElement | null
    i?.focus()
    try {
      if (keepFocus !== null) i?.setSelectionRange(keepFocus, keepFocus)
    } catch {
      /* 數字欄位不能設游標位置 */
    }
  }
}

// ───── 操作 ─────
// 按「我下班了」：算出可以煮幾分鐘，照這個時間排今晚的菜（兩支手機一起看到）
function offWork(home: boolean) {
  const today = taipeiToday()
  const d = store.data
  const s = d.settings
  const row = d.days[today]
  const avail = home ? null : cookWindow(taipeiMinutes(), s.commute, s.dinnerMin).avail
  const o = { maxMin: avail === null ? s.maxMin : limitOf(avail), noHot: s.noHot, diet: s.diet }
  const slots = slotsFor(s.people, s.diet)
  // 這週已經排好的菜來得及就照排，來不及才重抽
  // 下班前預覽看到的那組（還沒存）也算排好的
  const shown = slots.map((sl) => tonight().meal[sl]).filter(Boolean) as string[]
  const planned = row?.dishes && row.people === s.people && row.dishes.length === slots.length ? row.dishes : shown.length === slots.length ? shown : null
  const fits = planned && planned.every((n) => (byName(n)?.min ?? 999) <= (o.maxMin || 999))
  let dishes = fits ? planned : null
  if (!dishes) {
    const meal = drawMeal(pool(), s.people, rng(dailySeed(today, s.people, o, row?.reroll ?? 0, '|off')), {}, o)
    dishes = slots.map((sl) => meal[sl]).filter(Boolean) as string[]
  }
  ui.locks = {}
  store.run('dp_days', { day: today, off_at: new Date().toISOString(), avail_min: avail, dishes, people: s.people, cooked: false })
  toast(home ? '今天在家，排好了' : `可以煮 ${o.maxMin} 分鐘，排好了`)
  window.scrollTo(0, 0)
}

function setSetting(row: Record<string, unknown>) {
  store.run('dp_settings', { id: 1, ...row })
  ui.locks = {}
  // 條件改了，今晚的菜照新條件重抽（已經決定煮的就不動）
  if (!store.data.days[taipeiToday()]?.cooked && !waitingOff()) {
    const { meal } = tonight()
    saveTonight(meal)
  }
}

document.addEventListener('toggle', (e) => {
  const el = e.target as HTMLDetailsElement
  if (el.classList?.contains('pv-buy')) {
    ui.pvOpen = el.open
    return
  }
  if (el.classList?.contains('eo-mine')) {
    ui.eoOpen = el.open
    return
  }
  if (!el.classList?.contains('lib-how')) return
  const name = el.dataset.name!
  if (el.open) ui.open.add(name)
  else ui.open.delete(name)
}, true)

document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button')
  if (!b) return
  const ds = b.dataset
  const data = store.data
  if (ds.tab) {
    ui.tab = ds.tab as Tab
    render()
    window.scrollTo(0, 0)
    return
  }
  if (ds.act === 'undo') {
    const f = undoFn
    undoFn = null
    toastEl.hidden = true
    f?.()
    return
  }
  if (ds.how) {
    document.getElementById('how-' + ds.how)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }
  if (ds.eo) return eoClick(ds)
  if (ds.act === 'eatout') return startEatOut()
  if (ds.act === 'cookin') {
    const day = nightDay()
    const prev = store.data.days[day]?.eatOut ?? null
    store.run('dp_days', { day, eat_out: null })
    window.scrollTo(0, 0)
    return toast('今天自己煮', () => store.run('dp_days', { day, eat_out: prev }))
  }
  if (ds.act === 'off' || ds.act === 'home') return offWork(ds.act === 'home')
  if (ds.act === 'reoff') {
    // 重按：回到還沒下班的樣子，按了再重新排
    store.run('dp_days', { day: taipeiToday(), off_at: null, avail_min: null, cooked: false })
    toast('回到還沒下班，真的下班再按一次')
    return
  }
  if (ds.people) return setSetting({ people: Number(ds.people) as People })
  if (ds.time !== undefined) return setSetting({ max_min: Number(ds.time) })
  if ('nohot' in ds) return setSetting({ no_hot: !data.settings.noHot })
  if ('diet' in ds) {
    setSetting({ diet: !data.settings.diet })
    return toast(store.data.settings.diet ? '減重模式：只抽少油少鹽的菜' : '已關掉減重模式')
  }
  if (ds.swap) {
    // 換一道：只換這一道，其他不動；這道以後還是會出現
    const slot = ds.swap as Slot
    const { meal } = tonight()
    const name = meal[slot]
    if (!name) return
    const prev = { ...meal }
    const fixed: Meal = { ...meal }
    delete fixed[slot]
    const s = store.data.settings
    const o = { ...drawOpts(), exclude: new Set([name]) }
    const next = drawMeal(pool(), s.people, rng(`${taipeiToday()}|swap|${name}|${Date.now()}`), fixed, o)
    if (!next[slot] || next[slot] === name) return toast('沒有別道可以換了，放寬時間試試')
    saveTonight(next, { cooked: false })
    toast(`「${name}」換成「${next[slot]}」`, () => saveTonight(prev))
    return
  }
  if (ds.lock) {
    const slot = ds.lock as Slot
    ui.locks[slot] = !ui.locks[slot]
    // 固定的菜要存起來，另一支手機才看得到同一組
    if (!tonight().saved) saveTonight(tonight().meal)
    return render()
  }
  if (ds.nope) {
    const slot = ds.nope as Slot
    const { meal } = tonight()
    const name = meal[slot]
    if (!name) return
    const prev = { ...meal }
    ui.locks[slot] = false
    store.run('dp_marks', { dish: name, banned: true })
    const fixed: Meal = { ...meal }
    delete fixed[slot]
    const s = store.data.settings
    const next = drawMeal(pool(), s.people, rng(taipeiToday() + '|nope|' + name), fixed, drawOpts())
    saveTonight(next, { cooked: false })
    toast(`以後不會再出現「${name}」`, () => {
      store.run('dp_marks', { dish: name, banned: false })
      saveTonight(prev)
    })
    return
  }
  if (ds.ban) {
    const name = ds.ban
    store.run('dp_marks', { dish: name, banned: true, fav: false })
    if (Object.values(tonight().meal).includes(name) && !data.days[taipeiToday()]?.cooked) redraw('|ban|' + name)
    return toast(`以後不會再出現「${name}」`, () => store.run('dp_marks', { dish: name, banned: false }))
  }
  if (ds.unban) {
    store.run('dp_marks', { dish: ds.unban, banned: false })
    return toast(`「${ds.unban}」恢復了`)
  }
  if (ds.fav) return store.run('dp_marks', { dish: ds.fav, fav: !data.marks[ds.fav]?.fav })
  if (ds.kind) {
    ui.libKind = ds.kind as Dish['type']
    return render()
  }
  if (ds.clear) return store.run('dp_days', { day: ds.clear, dishes: null, people: null })
  switch (ds.act) {
    case 'shuffle':
      return redraw()
    case 'cook': {
      const { meal } = tonight()
      saveTonight(meal, { cooked: true })
      return toast('記下來了，已加進今天和買菜清單')
    }
    case 'autofill':
      return autofill()
    case 'dismiss':
      return store.dismissProblem()
    case 'retry':
      return void store.refresh()
    case 'signout':
      return void store.signOut()
  }
})

document.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement
  if (t.id === 'libQ') {
    ui.libQ = t.value
    render()
  } else if (t.closest?.('#addForm') || t.closest?.('#eoForm')) ui.draft[t.id] = t.value
})

document.addEventListener('change', (e) => {
  const t = e.target as HTMLInputElement
  if (t.closest?.('#addForm') || t.closest?.('#eoForm')) ui.draft[t.id] = t.value
  if (t.id === 'commute') store.run('dp_settings', { id: 1, commute_min: Number(t.value) })
  if (t.id === 'dinnerAt') {
    const m = parseClock(t.value)
    if (m !== null) store.run('dp_settings', { id: 1, dinner_min: m })
  }
  if (t.dataset.shop !== undefined) store.run('dp_shop', { week: store.data.week, item: t.dataset.shop, done: t.checked })
})

document.addEventListener('submit', async (e) => {
  const f = e.target as HTMLFormElement
  e.preventDefault()
  if (f.id === 'loginForm') {
    const email = (document.getElementById('email') as HTMLInputElement).value.trim()
    const pw = (document.getElementById('pw') as HTMLInputElement).value
    const errEl = document.getElementById('loginErr')!
    const btn = document.getElementById('loginBtn') as HTMLButtonElement
    if (!email || !pw) return void (errEl.textContent = '請填 Email 和密碼')
    if (!navigator.onLine) return void (errEl.textContent = '現在沒有網路，第一次登入需要網路')
    btn.disabled = true
    btn.textContent = '登入中…'
    const err = await store.signIn(email, pw)
    btn.disabled = false
    btn.textContent = '登入'
    errEl.textContent = err
    return
  }
  if (f.id === 'eoForm') {
    const s = store.data.settings
    const name = (document.getElementById('eoName') as HTMLInputElement).value.trim()
    const when = (document.getElementById('eoWhen') as HTMLSelectElement).value as 'dinner' | 'late' | 'both'
    if (!name) return
    if (s.out.mine.some((m) => m.name === name)) return toast(`「${name}」已經加過了`)
    store.run('dp_settings', { id: 1, out_prefs: { ...s.out, mine: [...s.out.mine, { name, when }] } })
    delete ui.draft.eoName
    return toast(`加入「${name}」，下次會一起抽`)
  }
  if (f.id === 'addForm') {
    const val = (id: string) => (document.getElementById(id) as HTMLInputElement).value.trim()
    const name = val('fName')
    if (!name) return
    if (store.dishes.some((x) => x.name === name)) return toast(`「${name}」已經在菜單庫裡了`)
    const type = val('fType') as Dish['type']
    store.run('dp_dishes', {
      name,
      type,
      tool: val('fTool'),
      minutes: Math.max(1, Math.min(240, parseInt(val('fMin')) || 20)),
      ing: parseIngInput(val('fIng')),
      sauce: val('fSauce').split(/[\s、,，]+/).filter(Boolean).map((x) => [x, '適量']),
    })
    ui.libKind = type
    ui.libQ = ''
    ui.draft = {}
    toast(`加入「${name}」`)
  }
})

store.subscribe(render)
// 「今晚」每 30 秒更新：還沒下班時可以煮幾分鐘（正在選時間時不打斷）
setInterval(() => {
  const busy = document.activeElement && ['INPUT', 'SELECT'].includes(document.activeElement.tagName)
  if (store.phase === 'ready' && ui.tab === 'tonight' && !busy) render()
}, 30_000)
render()
void store.start()

// 網頁存在手機裡，沒有網路也打得開
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
}
