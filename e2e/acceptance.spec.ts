import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { addDays, taipeiToday } from '../src/lib/meal'
import { MENU } from '../src/lib/menu'

// 驗收流程：兩位媽媽的手機同時開著，資料即時同步；其中一支離線再連線
const MOCK = 'http://localhost:54321'
const today = taipeiToday()

test.describe.configure({ mode: 'serial' })

let a: Page
let b: Page
let aCtx: BrowserContext
let bCtx: BrowserContext

async function sql<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
  const r = await fetch(`${MOCK}/__test/sql`, { method: 'POST', body: JSON.stringify({ sql: query, params }) })
  return r.json()
}

async function login(browser: Browser, email: string) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  // 下班時間固定在今天 17:40（台灣時間）
  await page.clock.setFixedTime(new Date(`${today}T17:40:00+08:00`))
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('密碼').fill('test-password')
  await page.getByRole('button', { name: '登入' }).click()
  return { ctx, page }
}

const dishNames = async (p: Page) => (await p.locator('.meal .dname strong').allTextContents()).map((x) => x.replace('愛吃', ''))
const minutesOf = (names: string[]) => names.map((n) => MENU.find((d) => d.name === n)!.min)

test.beforeAll(async ({ browser }) => {
  ;({ ctx: aCtx, page: a } = await login(browser, 'mom@test.local'))
  await expect(a.getByRole('heading', { name: '今晚煮什麼' })).toBeVisible()
  // 還沒按下班：先不排菜，告訴你算出來可以煮多久（預設通勤 30 分、19:00 吃）
  await expect(a.getByText('下班了嗎？')).toBeVisible()
  await expect(a.locator('.meal')).toHaveCount(0)
  await expect(a.locator('.ow-calc')).toContainText('現在 17:40 下班，18:10 到家')
  await expect(a.locator('.ow-calc')).toContainText('可以煮 50 分鐘')
  await a.getByRole('button', { name: '我下班了' }).click()
  await expect(a.locator('.meal .dish')).toHaveCount(4)
  await expect(a.locator('.ow-done')).toContainText('17:40 下班・18:10 到家・19:00 開飯')
  await expect(a.locator('.ow-done')).toContainText('可以煮 50 分鐘')
  expect(Math.max(...minutesOf(await dishNames(a)))).toBeLessThanOrEqual(50)
  ;({ ctx: bCtx, page: b } = await login(browser, 'mom2@test.local'))
  await expect(b.locator('.meal .dish')).toHaveCount(4)
  await expect(b.locator('.ow-done')).toContainText('可以煮 50 分鐘')
})

test.afterAll(async () => {
  await aCtx?.close()
  await bCtx?.close()
})

test('密碼錯誤、沒開通的帳號', async ({ browser }) => {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto('/')
  await page.getByLabel('Email').fill('mom@test.local')
  await page.getByLabel('密碼').fill('wrong')
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page.locator('#loginErr')).toHaveText('Email 或密碼不對')
  await expect(page.getByLabel('Email')).toHaveValue('mom@test.local') // 保留輸入
  await page.getByLabel('Email').fill('stranger@test.local')
  await page.getByLabel('密碼').fill('test-password')
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page.getByText('這個帳號還沒開通')).toBeVisible()
  await ctx.close()
})

test('兩支手機今晚看到同一組菜（減重模式一主菜兩青菜一湯）', async () => {
  await expect(a.locator('.meal-head b')).toHaveText('3 人・一主菜兩青菜一湯')
  expect(await dishNames(a)).toEqual(await dishNames(b))
  await expect(a.getByText('草莓的盤子：211 餐盤')).toBeVisible()
})

test('換一組會同步到另一支手機', async () => {
  const before = await dishNames(a)
  await a.getByRole('button', { name: '換一組' }).click()
  await expect.poll(() => dishNames(a)).not.toEqual(before)
  const after = await dishNames(a)
  await expect.poll(() => dishNames(b)).toEqual(after)
  await expect(a.getByText('今天換過 1 次')).toBeVisible()
})

test('不敢吃：換一道、以後不再出現、可以復原', async () => {
  const before = await dishNames(a)
  const veg = before[1]
  await a.locator('.meal .dish').nth(1).getByRole('button', { name: /^不敢吃/ }).click()
  await expect(a.getByText(`以後不會再出現「${veg}」`)).toBeVisible()
  const after = await dishNames(a)
  expect(after[1]).not.toBe(veg)
  expect([after[0], after[2], after[3]]).toEqual([before[0], before[2], before[3]]) // 其他菜不動
  await expect.poll(() => dishNames(b)).toEqual(after)
  const rows = await sql<{ banned: boolean }>(`select banned from public.dp_marks where dish = $1`, [veg])
  expect(rows[0].banned).toBe(true)
  // 菜單庫：另一支手機也看到「不吃」，可以恢復
  await b.getByRole('button', { name: '菜單庫' }).click()
  await b.getByRole('button', { name: /^青菜/ }).click()
  const row = b.locator('.row.banned', { hasText: veg })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: '恢復' }).click()
  await expect(b.locator('.row.banned', { hasText: veg })).toHaveCount(0)
  await expect.poll(async () => (await sql<{ banned: boolean }>(`select banned from public.dp_marks where dish = $1`, [veg]))[0].banned).toBe(false)
  await b.getByRole('button', { name: '今晚' }).click()
})

test('切 8 人、關減重：四菜一湯，份量變多', async () => {
  await a.getByRole('button', { name: /^8 人/ }).click()
  await expect(a.locator('.meal-head b')).toHaveText('8 人・四菜一湯')
  await expect(a.locator('.meal .dish')).toHaveCount(5)
  await expect(b.locator('.meal-head b')).toHaveText('8 人・四菜一湯')
  await a.getByRole('button', { name: '草莓減重中' }).click()
  await expect(a.getByText('草莓的盤子：211 餐盤')).toHaveCount(0)
  await expect(a.locator('.prep h3 small').first()).toHaveText('8 人份')
  await a.getByRole('button', { name: '草莓減重中' }).click()
  await a.getByRole('button', { name: /^3 人/ }).click()
  await expect(a.locator('.meal .dish')).toHaveCount(4)
})

test('就煮這個、排一週、買菜清單同步打勾', async () => {
  await a.getByRole('button', { name: '就煮這個' }).click()
  await expect(a.getByText('今晚就煮這個')).toBeVisible()
  await expect(b.getByText('今晚就煮這個')).toBeVisible()
  await a.getByRole('button', { name: '這週' }).click()
  await a.getByRole('button', { name: /空的幫我排/ }).click()
  await expect(a.locator('.week .day .m.none')).toHaveCount(0)
  const q = () => sql<{ day: string; dishes: string[] }>(`select day::text, dishes from public.dp_days where dishes is not null order by day`)
  await expect.poll(async () => (await q()).length).toBe(7)
  const planned = await q()
  expect(planned.map((x) => x.day)).toEqual(Array.from({ length: 7 }, (_, i) => addDays(today, i)))
  const all = planned.flatMap((x) => x.dishes)
  expect(new Set(all).size).toBe(all.length) // 一週不重複
  await a.getByRole('button', { name: '買菜' }).click()
  const n = await a.locator('.shop label').count()
  await b.getByRole('button', { name: '買菜' }).click()
  await expect(b.locator('.shop label')).toHaveCount(n) // 另一支手機也拿到排好的菜
  await b.locator('.shop label').first().locator('input').check()
  await expect(a.locator('.shop label').first().locator('input')).toBeChecked()
})

test('離線也能用，連上網路自動同步', async () => {
  await a.getByRole('button', { name: '菜單庫' }).click()
  await aCtx.setOffline(true)
  await a.evaluate(() => window.dispatchEvent(new Event('offline')))
  await expect(a.getByText('沒有網路。改的東西先存在這支手機')).toBeVisible()
  const row = a.locator('.row:not(.banned)').first()
  const name = (await row.locator('b').textContent())!
  await row.getByRole('button', { name: '標成愛吃' }).click()
  await expect(a.locator('.row', { hasText: name }).getByRole('button', { name: '取消愛吃' })).toBeVisible()
  expect(await sql(`select 1 from public.dp_marks where dish = $1 and fav`, [name])).toHaveLength(0)
  await aCtx.setOffline(false)
  await a.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect.poll(async () => (await sql(`select 1 from public.dp_marks where dish = $1 and fav`, [name])).length).toBe(1)
  await expect(a.getByText('沒有網路')).toHaveCount(0)
})

test('自己加一道菜', async () => {
  await b.getByRole('button', { name: '菜單庫' }).click()
  await b.getByLabel('菜名').fill('洋蔥牛肉丼')
  await b.locator('#fType').selectOption('main')
  await b.getByLabel('全聯要買的（3 人份）').fill('牛肉片 300g 洋蔥 1顆')
  // 打到一半，另一支手機改了東西：畫面重畫，打好的字不能不見
  const favs = () => sql(`select 1 from public.dp_marks where fav`)
  const before = (await favs()).length
  await a.getByRole('button', { name: /^湯/ }).click()
  await b.getByRole('button', { name: /^湯/ }).click()
  const soup = a.locator('.row:not(.banned)').nth(1)
  const soupName = (await soup.locator('b').textContent())!
  await soup.getByRole('button', { name: '標成愛吃' }).click()
  await expect.poll(async () => (await favs()).length).toBe(before + 1)
  await expect(b.locator('.row', { hasText: soupName }).getByRole('button', { name: '取消愛吃' })).toBeVisible()
  await expect(b.getByLabel('菜名')).toHaveValue('洋蔥牛肉丼')
  await expect(b.locator('#fType')).toHaveValue('main')
  await expect(b.getByLabel('全聯要買的（3 人份）')).toHaveValue('牛肉片 300g 洋蔥 1顆')
  await b.getByRole('button', { name: '加入' }).click()
  await expect(b.locator('.row', { hasText: '洋蔥牛肉丼' })).toBeVisible()
  await a.getByRole('button', { name: /^主菜/ }).click()
  await expect(a.locator('.row', { hasText: '洋蔥牛肉丼' })).toBeVisible()
  const r = await sql<{ ing: unknown }>(`select ing from public.dp_dishes where name = '洋蔥牛肉丼'`)
  expect(r[0].ing).toEqual([['牛肉片', 300, 'g'], ['洋蔥', 1, '顆']])
})

test('下班太晚：只排最快的菜；按錯了、今天在家', async () => {
  await a.getByRole('button', { name: '今晚' }).click()
  await b.getByRole('button', { name: '今晚' }).click()
  await a.locator('.ow-done').getByRole('button', { name: '按錯了' }).click()
  await expect(a.getByText('下班了嗎？')).toBeVisible()
  await expect(b.getByText('下班了嗎？')).toBeVisible() // 另一支手機也回到還沒下班
  await a.getByLabel('通勤').selectOption('60')
  await a.getByLabel('想幾點吃').fill('18:30')
  await expect(a.locator('.ow-calc')).toContainText('18:40 到家')
  await expect(a.locator('.ow-calc')).toContainText('來不及 18:30 吃，挑 15 分鐘內的菜')
  const row = await sql<{ commute_min: number; dinner_min: number }>(`select commute_min, dinner_min from public.dp_settings`)
  expect(row[0]).toEqual({ commute_min: 60, dinner_min: 18 * 60 + 30 })
  await a.getByRole('button', { name: '我下班了' }).click()
  await expect(a.locator('.ow-done')).toContainText('時間很趕，只排 15 分鐘內的菜')
  await expect(a.locator('.ow-done')).toContainText('早上出門前先預約')
  expect(Math.max(...minutesOf(await dishNames(a)))).toBeLessThanOrEqual(15)
  await expect.poll(() => dishNames(b)).toEqual(await dishNames(a))
  await a.locator('.ow-done').getByRole('button', { name: '按錯了' }).click()
  await a.getByRole('button', { name: '今天在家，直接排' }).click()
  await expect(a.locator('.ow-done')).toContainText('今天在家')
  await expect(a.getByRole('button', { name: '30 分內' })).toBeVisible() // 在家就用平常的時間設定
  await expect(a.locator('.meal .dish')).toHaveCount(4)
})
