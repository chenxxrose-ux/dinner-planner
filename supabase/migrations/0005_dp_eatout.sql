-- 吃外面：今天不煮，阿寶下班先吃、草莓運動完去買
-- eat_out：今天吃外面抽到的 { a: 阿寶吃什麼, s: 草莓買什麼 }；null 代表自己煮
alter table public.dp_days
  add column eat_out jsonb check (eat_out is null or (jsonb_typeof(eat_out) = 'object' and pg_column_size(eat_out) < 1000));

-- out_prefs：{ mine: [{ name, when }] 我們常吃的店, no: [名稱] 不想吃的 }
alter table public.dp_settings
  add column out_prefs jsonb not null default '{"mine":[],"no":[]}'::jsonb
    check (jsonb_typeof(out_prefs) = 'object' and pg_column_size(out_prefs) < 8000);
