import { test, expect, type Browser } from '@playwright/test'
import { addDays, taipeiToday } from '../src/lib/meal'
import { OUT_FOODS } from '../src/lib/eatout'

// 吃外面：阿寶下班先吃、草莓運動完去買
const today = taipeiToday()
const OUT = 'test-results/screens'
const sql = async (q: string) =>
  (await fetch('http://localhost:54321/__test/sql', { method: 'POST', body: JSON.stringify({ sql: q, params: [] }) })).json()
const reset = async () => {
  await sql('update public.dp_days set eat_out = null, off_at = null, avail_min = null, cooked = false')
  await sql(`update public.dp_settings set out_prefs = '{"mine":[],"no":[]}', dinner_min = 1230, commute_min = 0, diet = true`)
}

async function phone(browser: Browser, email: string, at: string) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.clock.install({ time: new Date(at) })
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('密碼').fill('test-password')
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page.locator('#app header')).toBeVisible()
  return { ctx, page }
}

test.describe.configure({ mode: 'serial' })
test.afterAll(reset)

test('吃外面：各抽一個、換一個、不想吃、加常吃的店、半夜草莓看得到要買什麼', async ({ browser }) => {
  await reset()
  const { ctx, page: a } = await phone(browser, 'mom@test.local', `${today}T20:05:00+08:00`)
  await expect(a.getByText('下班了嗎？')).toBeVisible()
  await a.getByRole('button', { name: '今天吃外面' }).click()
  await expect(a.getByRole('heading', { name: '今晚吃外面' })).toBeVisible()
  const cards = a.locator('.eo-card')
  await expect(cards).toHaveCount(2)
  await expect(cards.nth(0)).toContainText('下班先吃')
  await expect(cards.nth(1)).toContainText('運動完去買・減重點法')
  const aName = (await cards.nth(0).locator('.eo-name').textContent())!
  const sName = (await cards.nth(1).locator('.eo-name').textContent())!
  expect(aName).not.toBe(sName)
  // 減重中：草莓抽到的是輕盈、半夜買得到的
  const s = OUT_FOODS.find((x) => x.name === sName)!
  expect(s.light && s.when.includes('late')).toBe(true)
  // 地圖搜尋五甲附近
  expect(decodeURIComponent((await cards.nth(0).getByRole('link', { name: '附近的店 ↗' }).getAttribute('href'))!)).toContain(`鳳山五甲`)
  // 阿寶不想吃剛剛那個：換掉，而且記下來
  await a.screenshot({ path: `${OUT}/9-吃外面.png`, fullPage: true })
  await cards.nth(0).getByRole('button', { name: '換一個' }).click()
  await expect(cards.nth(0).locator('.eo-name')).not.toHaveText(aName)
  const a2 = (await cards.nth(0).locator('.eo-name').textContent())!
  await cards.nth(0).getByRole('button', { name: /^不想吃/ }).click()
  await expect(a.locator('.toast')).toContainText(`以後不會抽到「${a2}」`)
  await expect(cards.nth(0).locator('.eo-name')).not.toHaveText(a2)
  // 加一家常吃的店
  await a.locator('.eo-mine summary').click()
  await a.getByLabel('店名').fill('巷口鍋燒意麵')
  await a.getByLabel('什麼時候吃').selectOption({ label: '半夜買' })
  await a.getByRole('button', { name: '加入' }).click()
  await expect(a.locator('.eo-list')).toContainText('巷口鍋燒意麵')
  await expect(a.locator('.eo-mine')).toContainText(`${a2} 恢復`)
  await a.screenshot({ path: `${OUT}/9b-常吃的店.png`, fullPage: true })
  const w = await a.evaluate(() => document.documentElement.scrollWidth)
  expect(w).toBeLessThanOrEqual(393)
  const [row] = await sql(`select eat_out, (select out_prefs from public.dp_settings where id = 1) as prefs from public.dp_days where day = '${today}'`)
  expect(row.prefs.mine).toEqual([{ name: '巷口鍋燒意麵', when: 'late' }])
  expect(row.prefs.no).toEqual([a2])

  // 草莓的手機：半夜運動完，打開還是看得到要買什麼
  const { ctx: bCtx, page: b } = await phone(browser, 'mom2@test.local', `${addDays(today, 1)}T00:05:00+08:00`)
  await expect(b.locator('.eo-card').nth(1).locator('.eo-name')).toHaveText(row.eat_out.s)
  await expect(b.getByRole('heading', { name: '今晚吃外面' })).toBeVisible()
  await b.screenshot({ path: `${OUT}/9c-半夜去買.png`, fullPage: true })

  // 改成自己煮：回到下班的按鍵
  await a.getByRole('button', { name: '今天還是自己煮' }).click()
  await expect(a.getByText('下班了嗎？')).toBeVisible()
  await ctx.close()
  await bCtx.close()
})
