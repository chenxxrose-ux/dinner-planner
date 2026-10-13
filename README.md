# 今晚煮什麼

每天晚上隨機排菜，菜和調味料都買得到在全聯。兩位媽媽的手機共用同一份資料、即時同步，沒有網路也能用。

- 2 人、3 人、8 人（家人來時四菜一湯）份量，自動換算成全聯買得到的單位
- 草莓減重中：211 餐盤（一主菜兩青菜一湯），少油少鹽，醬料減半、油 1 小匙
- 同一餐不撞主食材；氣炸烤箱一次一道、瓦斯爐不超過兩口；5 天內吃過的先不抽
- 每道菜旁邊「不敢吃」：記住，以後不再抽到（菜單庫可以恢復）
- 調味用味霸，不用味精
- 前端：TypeScript + Vite，部署在 **GitHub Pages**（推到 `main` 自動部署）
- 資料庫：**Supabase**，跟「叫蛋記帳」「今日事」共用同一個免費專案，資料表用 `dp_` 開頭、權限分開
- 不串接任何 AI API，也不需要付費服務

## 帳號

用「今日事／叫蛋記帳」同一組帳號登入。可以用的人記在 `dp_members`，權限由資料庫規則（RLS）把關。

## 資料表

| 表 | 內容 |
| --- | --- |
| `dp_settings` | 人數、減重模式、不吃辣、時間上限 |
| `dp_marks` | 每道菜的愛吃／不敢吃 |
| `dp_dishes` | 自己加的菜 |
| `dp_days` | 每天排定的菜、換過幾次、煮了沒 |
| `dp_shop` | 本週買菜清單打勾 |

只有新增和修改，沒有刪除權限。

## 離線

- 網頁本身由 `public/sw.js` 存在手機裡，沒網路也打得開。
- 離線時的動作先排隊存在手機（`localStorage`），連上網路依序送出（upsert，重送不會重複）。

## 菜單來源

菜色整理自 iCook 愛料理等常見家常菜，每道菜附 iCook 搜尋連結；材料和調味料都挑全聯買得到的。菜單在 `src/lib/menu.ts`。

## 指令

```
npm run typecheck
npm test            # 純函式 + 資料庫權限規則（PGlite 跑真的 migration）
npm run build
npm run test:e2e    # 兩支手機同時操作的驗收流程（本機 Supabase 替身）
npm run check:secrets
```

沒有 Playwright 自帶瀏覽器的環境：`PW_CHROMIUM_PATH=<chromium 路徑> npm run test:e2e`

## 機密資料

前端只有 Supabase 的 publishable key（本來就設計成公開）。資料庫密碼、secret / service_role 金鑰不放進 repo；`npm run check:secrets` 會在部署前檢查。
