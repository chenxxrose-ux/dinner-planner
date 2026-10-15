import { test, expect } from '@playwright/test'
import { addDays, taipeiToday } from '../src/lib/meal'

// 剩菜變新菜：昨天煮過的菜會出現在清單，勾了馬上給做法
const today = taipeiToday()
const OUT = 'test-results/screens'
const sql = (q: string, params: unknown[] = []) => fetch('http://localhost:54321/__test/sql', { method: 'POST', body: JSON.stringify({ sql: q, params }) })

test('剩菜變新菜：勾昨天的菜和白飯，馬上出現做法', async ({ browser }) => {
  const y = addDays(today, -1)
  await sql('delete from public.dp_days where day = $1', [y])
  await sql(`insert into public.dp_days (day, dishes, people, cooked) values ($1, $2, 3, true)`, [y, ['紅燒肉', '炒高麗菜', '番茄蛋花湯']])
  await sql('update public.dp_days set off_at = null, avail_min = null, cooked = false, dishes = null, people = null, eat_out = null where day = $1', [today])
  const ctx = await browser.newContext()
  const p = await ctx.newPage()
  await p.clock.install({ time: new Date(`${today}T12:30:00+08:00`) })
  await p.goto('/')
  await p.getByLabel('Email').fill('mom@test.local')
  await p.getByLabel('密碼').fill('test-password')
  await p.getByRole('button', { name: '登入' }).click()
  await p.getByRole('button', { name: /冰箱有剩菜剩飯/ }).click()
  await expect(p.getByRole('heading', { name: '剩菜變新菜' })).toBeVisible()
  await expect(p.locator('.blank')).toContainText('勾上面剩的菜')
  await p.getByRole('button', { name: /紅燒肉/ }).click()
  await p.getByRole('button', { name: /炒高麗菜/ }).click()
  await p.getByRole('button', { name: '白飯' }).click()
  const first = p.locator('.lo-card').first()
  await expect(first.locator('.lo-n')).toHaveText('用到 3 樣')
  await expect(first.locator('.steps li').first()).toBeVisible()
  await expect(p.locator('.lo-card .lo-name b')).toContainText(['剩菜炒飯'])
  // 自己加一樣
  await p.getByLabel('其他剩的').fill('炸雞')
  await p.getByRole('button', { name: '加', exact: true }).click()
  await expect(p.getByRole('button', { name: /炸雞/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(first.locator('.lo-use')).toContainText('炸雞')
  await p.screenshot({ path: `${OUT}/5-剩菜.png`, fullPage: true })
  const w = await p.evaluate(() => document.documentElement.scrollWidth)
  expect(w).toBeLessThanOrEqual(393)
  await p.getByRole('button', { name: '回今晚' }).click()
  await expect(p.getByText('下班了嗎？')).toBeVisible()
  await sql('delete from public.dp_days where day = $1', [y])
  await ctx.close()
})
