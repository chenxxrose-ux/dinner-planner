import { defineConfig } from 'vitest/config'

// GitHub Pages 網址為 https://<帳號>.github.io/<repo>/，base 由部署流程帶入 repo 名稱
export default defineConfig({
  base: process.env.PAGES_BASE ?? '/',
  test: {
    include: ['src/**/*.test.ts', 'tests/db/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
  },
})
