import { test, expect } from '@playwright/test'
import { taipeiToday } from '../src/lib/meal'
import { MENU } from '../src/lib/menu'

// 回到家才發現少買一樣：按「沒買到」，用到它的菜換掉，其他不動
const today = taipeiToday()
const OUT = 'test-results/screens'
const sql = (q: string) => fetch('http://localhost:54321/__test/sql', { method: 'POST', body: JSON.stringify({ sql: q, params: [] }) })

test('沒買到：只換用到那樣材料的菜，可以復原', async ({ browser }) => {
  await sql('update public.dp_days set off_at = null, avail_min = null, cooked = false, dishes = null, people = null, eat_out = null')
  await sql('update public.dp_settings set dinner_min = 1260, commute_min = 30, max_min = 30, people = 3, diet = true')
  const ctx = await browser.newContext()
  const p = await ctx.newPage()
  await p.clock.install({ time: new Date(`${today}T20:05:00+08:00`) })
  await p.goto('/')
  await p.getByLabel('Email').fill('mom@test.local')
  await p.getByLabel('密碼').fill('test-password')
  await p.getByRole('button', { name: '登入' }).click()
  await p.getByRole('button', { name: '我下班了' }).click()
  const names = p.locator('.meal .dname strong')
  await expect(names).toHaveCount(4)
  const before = (await names.allTextContents()).map((t) => t.replace('愛吃', ''))
  const prep = p.locator('.prep')
  const item = (await prep.locator('.qty li').first().locator('span').first().textContent())!
  const name = MENU.map((d) => d.ing.map((i) => i[0])).flat().filter((n) => item.startsWith(n)).sort((a, b) => b.length - a.length)[0]
  const hit = before.filter((n) => MENU.find((d) => d.name === n)!.ing.some((i) => i[0] === name))
  expect(hit.length).toBeGreaterThan(0)
  await prep.getByRole('button', { name: `沒買到${name}，換掉用到它的菜` }).click()
  await expect(p.locator('.toast')).toContainText(`沒買到${name}`)
  await expect.poll(async () => (await names.allTextContents()).map((t) => t.replace('愛吃', ''))).not.toEqual(before)
  const after = (await names.allTextContents()).map((t) => t.replace('愛吃', ''))
  for (let i = 0; i < before.length; i++) {
    if (hit.includes(before[i])) expect(MENU.find((d) => d.name === after[i])!.ing.some((x) => x[0] === name)).toBe(false)
    else expect(after[i]).toBe(before[i])
  }
  await p.screenshot({ path: `${OUT}/1c-沒買到.png`, fullPage: true })
  const w = await p.evaluate(() => document.documentElement.scrollWidth)
  expect(w).toBeLessThanOrEqual(393)
  await p.locator('.toast').getByRole('button', { name: '復原' }).click()
  await expect.poll(async () => (await names.allTextContents()).map((t) => t.replace('愛吃', ''))).toEqual(before)
  await ctx.close()
})
