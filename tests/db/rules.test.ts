import { beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { as, createDb, USERS } from './harness'

let db: PGlite
beforeEach(async () => {
  db = await createDb()
})

describe('只有家裡的人看得到、改得到', () => {
  it('成員可以讀設定、改設定', async () => {
    const s = await as<{ people: number; diet: boolean }>(db, USERS.mom, 'select people, diet from public.dp_settings')
    expect(s).toEqual([{ people: 3, diet: true }])
    await as(db, USERS.mom2, 'update public.dp_settings set people = 8 where id = 1')
    const s2 = await as<{ people: number }>(db, USERS.mom, 'select people from public.dp_settings')
    expect(s2[0].people).toBe(8)
  })
  it('外人看不到也改不了', async () => {
    expect(await as(db, USERS.stranger, 'select * from public.dp_settings')).toEqual([])
    expect(await as(db, USERS.kid, 'select * from public.dp_days')).toEqual([])
    await expect(as(db, USERS.stranger, `insert into public.dp_marks (dish, banned) values ('三杯雞', true)`)).rejects.toThrow()
    await as(db, USERS.stranger, 'update public.dp_settings set people = 2')
    const s = await as<{ people: number }>(db, USERS.mom, 'select people from public.dp_settings')
    expect(s[0].people).toBe(3)
  })
  it('不敢吃、愛吃可以記也可以恢復', async () => {
    await as(db, USERS.mom, `insert into public.dp_marks (dish, banned) values ('三杯雞', true) on conflict (dish) do update set banned = excluded.banned`)
    await as(db, USERS.mom2, `insert into public.dp_marks (dish, banned) values ('三杯雞', false) on conflict (dish) do update set banned = excluded.banned`)
    const m = await as<{ banned: boolean }>(db, USERS.mom, `select banned from public.dp_marks where dish = '三杯雞'`)
    expect(m[0].banned).toBe(false)
  })
  it('排菜、換一組、就煮這個', async () => {
    await as(db, USERS.mom, `insert into public.dp_days (day, reroll) values ('2026-10-13', 1) on conflict (day) do update set reroll = excluded.reroll`)
    await as(db, USERS.mom2, `insert into public.dp_days (day, dishes, people, cooked) values ('2026-10-13', '{番茄燉豆腐,炒空心菜,蘿蔔清湯}', 3, true) on conflict (day) do update set dishes = excluded.dishes, people = excluded.people, cooked = excluded.cooked`)
    const d = await as<{ reroll: number; dishes: string[]; cooked: boolean }>(db, USERS.mom, `select reroll, dishes, cooked from public.dp_days`)
    expect(d[0]).toEqual({ reroll: 1, dishes: ['番茄燉豆腐', '炒空心菜', '蘿蔔清湯'], cooked: true })
  })
  it('資料不能刪', async () => {
    await as(db, USERS.mom, `insert into public.dp_shop (week, item, done) values ('2026-10-12', 'f:雞蛋', true)`)
    await expect(as(db, USERS.mom, `delete from public.dp_shop`)).rejects.toThrow()
  })
  it('檢查格式', async () => {
    await expect(as(db, USERS.mom, `update public.dp_settings set people = 5`)).rejects.toThrow()
    await expect(as(db, USERS.mom, `insert into public.dp_dishes (name, type, minutes, tool) values ('咖哩飯', 'dessert', 20, '爐')`)).rejects.toThrow()
    await as(db, USERS.mom, `insert into public.dp_dishes (name, type, minutes, tool, ing) values ('咖哩飯', 'main', 30, '爐', '[["雞腿",2,"支"]]')`)
  })
})
