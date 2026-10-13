import { test, expect, type Browser, type Page } from '@playwright/test'
import { addDays, taipeiToday } from '../src/lib/meal'

// 作息：兩支手機看到同一個「現在」，誰都可以幫對方改時間
const today = taipeiToday()
const tomorrow = addDays(today, 1)
const OUT = 'test-results/screens'

async function phone(browser: Browser, email: string, time: string, who: '阿寶' | '草莓', day = today) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.clock.install({ time: new Date(`${day}T${time}:00+08:00`) })
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('密碼').fill('test-password')
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page.getByText('這支手機是誰在用？')).toBeVisible()
  await page.locator('.rt-me').getByRole('button', { name: who }).click()
  await expect(page.locator('.rt-me')).toHaveCount(0)
  return { ctx, page }
}
const row = (p: Page, who: '阿寶' | '草莓') => p.locator('.rt-who').filter({ has: p.locator('.rt-av', { hasText: who }) })

test.describe.configure({ mode: 'serial' })

const reset = async () => {
  for (const sql of ['update public.dp_days set plan = null, plan_by = null, boxed_at = null, snack_at = null, off_at = null, avail_min = null', 'update public.dp_settings set dinner_min = 1230, commute_min = 0']) {
    await fetch('http://localhost:54321/__test/sql', { method: 'POST', body: JSON.stringify({ sql, params: [] }) })
  }
}

test('作息：按錯了可以改回來', async ({ browser }) => {
  await reset()
  const { ctx, page: a } = await phone(browser, 'mom@test.local', '19:44', '阿寶')
  await expect(row(a, '草莓')).toContainText('黃昏市場上工')
  // 阿寶不小心按到草莓那排的「下班了」
  await row(a, '草莓').getByRole('button', { name: '下班了' }).click()
  await expect(row(a, '草莓')).toContainText('草莓今天早')
  await a.locator('.toast').getByRole('button', { name: '復原' }).click()
  await expect(row(a, '草莓')).not.toContainText('草莓今天早')
  await expect(row(a, '草莓')).toContainText('黃昏市場上工')
  // 再按錯一次，過了幾秒才發現：用「按錯了」改回來
  await row(a, '草莓').getByRole('button', { name: '下班了' }).click()
  await row(a, '草莓').getByRole('button', { name: '好了，下一件' }).click()
  await expect(row(a, '草莓')).toContainText('草莓今天早')
  await a.screenshot({ path: `${OUT}/8-作息-按錯.png` })
  await row(a, '草莓').getByRole('button', { name: '按錯了，草莓改回平常' }).click()
  await expect(row(a, '草莓')).toContainText('黃昏市場上工')
  await expect(row(a, '草莓')).not.toContainText('今天早')
  const r = await (await fetch('http://localhost:54321/__test/sql', { method: 'POST', body: JSON.stringify({ sql: "select plan from public.dp_days where plan is not null", params: [] }) })).json()
  expect(r).toEqual([])
  await ctx.close()
})

test('作息：現在、運動晚一點、兩支手機同步、改時間', async ({ browser }) => {
  for (const sql of ['update public.dp_days set plan = null, plan_by = null, boxed_at = null, snack_at = null', 'update public.dp_settings set dinner_min = 1230, commute_min = 0']) {
    await fetch('http://localhost:54321/__test/sql', { method: 'POST', body: JSON.stringify({ sql, params: [] }) })
  }
  const { ctx: aCtx, page: a } = await phone(browser, 'mom@test.local', '20:35', '阿寶')
  await expect(a.locator('.rt-clock')).toHaveText('20:35')
  await expect(row(a, '阿寶')).toContainText('吃晚餐')
  await expect(row(a, '阿寶')).toContainText('下一件 21:15洗澡')
  await expect(row(a, '草莓')).toContainText('黃昏市場上工')
  // 煮飯時間：草莓那份裝好
  await a.getByRole('button', { name: '裝好放冰箱了' }).click()
  await expect(a.locator('.rt-box')).toContainText('✓ 20:35 裝好')
  await a.screenshot({ path: `${OUT}/5-作息-煮飯.png`, fullPage: true })

  // 22:30：草莓還在運動，阿寶幫她按「晚 15 分」
  await a.clock.setSystemTime(new Date(`${today}T22:30:00+08:00`))
  await a.clock.runFor(31_000)
  await a.locator('.rt-day summary').click()
  await expect(row(a, '草莓')).toContainText('運動')
  await row(a, '草莓').getByRole('button', { name: '晚 15 分' }).click()
  await expect(row(a, '草莓')).toContainText('下一件 00:15騎車回家')
  await expect(row(a, '草莓')).toContainText('草莓今天晚 15 分鐘・阿寶改的')
  await expect(a.locator('.rt-tl')).toContainText('01:30')
  await a.screenshot({ path: `${OUT}/6-作息-晚一點.png`, fullPage: true })

  // 草莓的手機：00:12 看到冰箱裡有晚餐，時間也是改過的
  const { ctx: bCtx, page: b } = await phone(browser, 'mom2@test.local', '00:12', '草莓', tomorrow)
  await expect(b.locator('.rt-clock')).toHaveText('00:12')
  await expect(row(b, '草莓')).toContainText('運動')
  await row(b, '草莓').getByRole('button', { name: '運動完了' }).click()
  await expect(row(b, '草莓')).toContainText('騎車回家')
  await expect(b.locator('.rt-nudge')).toContainText('冰箱有你的晚餐（20:35 裝好）')
  await expect(row(a, '草莓')).toContainText('草莓今天晚 12 分鐘・草莓改的')

  // 改平常的時間：起床改成 07:30，兩支手機同步
  await b.locator('.rt-day summary').click()
  await b.getByRole('button', { name: '改時間' }).click()
  await b.getByRole('button', { name: '改平常的時間' }).click()
  await b.screenshot({ path: `${OUT}/7-作息-改時間.png`, fullPage: true })
  await b.getByLabel('兩人起床的時間').selectOption({ label: '07:30' })
  await b.getByRole('button', { name: '改好了' }).click()
  await expect(a.locator('.rt-tl li').first()).toContainText('07:30')
  const w = await b.evaluate(() => document.documentElement.scrollWidth)
  expect(w).toBeLessThanOrEqual(393)
  await aCtx.close()
  await bCtx.close()
})
