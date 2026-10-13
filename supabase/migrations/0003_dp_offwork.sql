-- 下班按鍵：照下班時間、通勤和想吃飯的時間，算出今晚可以煮幾分鐘
alter table public.dp_settings
  add column commute_min smallint not null default 30 check (commute_min between 0 and 180),
  add column dinner_min smallint not null default 1140 check (dinner_min between 0 and 1439); -- 幾點吃飯，從午夜算起的分鐘（19:00）

-- off_at：按「我下班了」的時間；avail_min：算出來可以煮的分鐘（在家就是 null，用平常的時間設定）
alter table public.dp_days
  add column off_at timestamptz,
  add column avail_min smallint check (avail_min between -1440 and 1440);
