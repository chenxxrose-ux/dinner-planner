import { test, expect } from '@playwright/test'

// 截圖：每個畫面在 iPhone 尺寸的樣子，用來檢查排版（不會失敗，只存圖）
const OUT = 'test-results/screens'

test('每個畫面', async ({ browser }) => {
  const ctx = await browser.newContext()
  const p = await ctx.newPage()
  await p.goto('/')
  await p.screenshot({ path: `${OUT}/0-登入.png` })
  await p.getByLabel('Email').fill('mom@test.local')
  await p.getByLabel('密碼').fill('test-password')
  await p.getByRole('button', { name: '登入' }).click()
  await expect(p.locator('.meal .dish').first()).toBeVisible()
  await p.screenshot({ path: `${OUT}/1-今晚.png`, fullPage: true })
  for (const [tab, name] of [['這週', '2-這週'], ['菜單庫', '3-菜單庫'], ['買菜', '4-買菜']]) {
    await p.getByRole('button', { name: tab, exact: true }).click()
    await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
  }
  const w = await p.evaluate(() => document.documentElement.scrollWidth)
  expect(w).toBeLessThanOrEqual(393)
  await ctx.close()
})
