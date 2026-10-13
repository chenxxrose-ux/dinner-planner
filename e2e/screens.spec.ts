import { test, expect } from '@playwright/test'

// 截圖：每個畫面在 iPhone 尺寸的樣子，用來檢查排版（不會失敗，只存圖）
const OUT = 'test-results/screens'

test('每個畫面', async ({ browser }) => {
  // 從「還沒下班」開始截圖
  await fetch('http://localhost:54321/__test/sql', { method: 'POST', body: JSON.stringify({ sql: 'update public.dp_days set off_at = null, avail_min = null, cooked = false', params: [] }) })
  const ctx = await browser.newContext()
  const p = await ctx.newPage()
  await p.goto('/')
  await p.screenshot({ path: `${OUT}/0-登入.png` })
  await p.getByLabel('Email').fill('mom@test.local')
  await p.getByLabel('密碼').fill('test-password')
  await p.getByRole('button', { name: '登入' }).click()
  await expect(p.getByText('下班了嗎？')).toBeVisible()
  await p.screenshot({ path: `${OUT}/0b-下班.png`, fullPage: true })
  await p.getByRole('button', { name: '我下班了' }).click()
  await expect(p.locator('.meal .dish').first()).toBeVisible()
  await p.screenshot({ path: `${OUT}/1-今晚.png`, fullPage: true })
  // 按「做法 ↓」跳到那道菜的步驟
  await p.locator('.meal .dish').first().getByRole('button', { name: '做法 ↓' }).click()
  const first = (await p.locator('.meal .dname strong').first().textContent())!.replace('愛吃', '')
  await expect(p.locator(`[id="how-${first}"] .steps li`).first()).toBeInViewport()
  await p.screenshot({ path: `${OUT}/1b-做法.png` })
  for (const [tab, name] of [['這週', '2-這週'], ['菜單庫', '3-菜單庫'], ['買菜', '4-買菜']]) {
    await p.getByRole('button', { name: tab, exact: true }).click()
    if (tab === '菜單庫') {
      await p.locator('.lib-how summary').first().click()
      await expect(p.locator('.lib-how .steps').first()).toBeVisible()
    }
    await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
  }
  const w = await p.evaluate(() => document.documentElement.scrollWidth)
  expect(w).toBeLessThanOrEqual(393)
  await ctx.close()
})
