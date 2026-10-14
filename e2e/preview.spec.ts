import { test, expect } from '@playwright/test'
import { taipeiToday } from '../src/lib/meal'

// 下班前先看今晚的菜：下午就知道要買什麼，下班後菜不會換
const today = taipeiToday()
const OUT = 'test-results/screens'
const sql = (q: string) => fetch('http://localhost:54321/__test/sql', { method: 'POST', body: JSON.stringify({ sql: q, params: [] }) })

test('下班前預覽今晚的菜，按「就煮這組」就固定', async ({ browser }) => {
  await sql('update public.dp_days set off_at = null, avail_min = null, cooked = false, dishes = null, people = null, eat_out = null')
  await sql('update public.dp_settings set dinner_min = 1260, commute_min = 30, max_min = 30, people = 3, diet = true')
  const ctx = await browser.newContext()
  const p = await ctx.newPage()
  await p.clock.install({ time: new Date(`${today}T14:40:00+08:00`) })
  await p.goto('/')
  await p.getByLabel('Email').fill('mom@test.local')
  await p.getByLabel('密碼').fill('test-password')
  await p.getByRole('button', { name: '登入' }).click()
  await expect(p.getByText('下班了嗎？')).toBeVisible()
  const pv = p.locator('.pv')
  await expect(pv.locator('.pv-list li')).toHaveCount(4)
  const first = await pv.locator('.pv-list strong').allTextContents()
  // 要買什麼：展開就看得到
  await pv.locator('.pv-buy summary').click()
  await expect(pv.locator('.qty li').first()).toBeVisible()
  await p.screenshot({ path: `${OUT}/0c-下班前預覽.png`, fullPage: true })
  const w = await p.evaluate(() => document.documentElement.scrollWidth)
  expect(w).toBeLessThanOrEqual(393)
  // 不敢吃：預覽裡也可以按，那道換掉
  const gone = first[0]
  await pv.locator('.pv-list li').first().getByRole('button', { name: /^不敢吃/ }).click()
  await expect(p.locator('.toast')).toContainText(`以後不會再出現「${gone}」`)
  await expect(pv.locator('.pv-list strong').first()).not.toHaveText(gone)
  await p.locator('.toast').getByRole('button', { name: '復原' }).click()
  await expect(pv.locator('.pv-list strong').first()).toHaveText(gone)
  // 換一組：預覽跟著換
  await pv.getByRole('button', { name: '換一組' }).click()
  await expect.poll(async () => (await pv.locator('.pv-list strong').allTextContents()).join()).not.toBe(first.join())
  const picked = await pv.locator('.pv-list strong').allTextContents()
  // 就煮這組：不用再按下班，直接看到今晚的菜和做法
  await pv.getByRole('button', { name: '就煮這組' }).click()
  await expect(p.getByText('下班了嗎？')).toHaveCount(0)
  expect((await p.locator('.meal .dname strong').allTextContents()).map((x) => x.replace('愛吃', ''))).toEqual(picked)
  await ctx.close()
})

test('只是看過預覽沒有按：下班時來得及，就煮預覽的那組', async ({ browser }) => {
  await sql('update public.dp_days set off_at = null, avail_min = null, cooked = false, dishes = null, people = null, reroll = 0')
  const ctx = await browser.newContext()
  const p = await ctx.newPage()
  await p.clock.install({ time: new Date(`${today}T17:00:00+08:00`) })
  await p.goto('/')
  await p.getByLabel('Email').fill('mom@test.local')
  await p.getByLabel('密碼').fill('test-password')
  await p.getByRole('button', { name: '登入' }).click()
  await expect(p.locator('.pv-list li')).toHaveCount(4)
  const shown = await p.locator('.pv-list strong').allTextContents()
  await p.getByRole('button', { name: '我下班了' }).click()
  await expect(p.locator('.meal .dish')).toHaveCount(4)
  expect((await p.locator('.meal .dname strong').allTextContents()).map((x) => x.replace('愛吃', ''))).toEqual(shown)
  await ctx.close()
})
