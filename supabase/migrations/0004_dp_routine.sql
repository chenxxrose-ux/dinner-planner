-- 作息：阿寶和草莓平日的一天，放在「今晚」最上面
-- routine：平常的時間，{ 項目: 分鐘 }（凌晨的時間 +1440，例如 01:15 = 1515）；沒寫的項目用程式裡的預設
alter table public.dp_settings
  add column routine jsonb not null default '{}'::jsonb
    check (jsonb_typeof(routine) = 'object' and pg_column_size(routine) < 2000);

-- plan：今天臨時改的時間（同樣格式），隔天自動用平常的
-- plan_by：誰改的（a = 阿寶、s = 草莓）；boxed_at：草莓那份裝好放冰箱；snack_at：草莓運動前吃了
alter table public.dp_days
  add column plan jsonb check (plan is null or (jsonb_typeof(plan) = 'object' and pg_column_size(plan) < 2000)),
  add column plan_by text check (plan_by is null or plan_by in ('a', 's')),
  add column boxed_at timestamptz,
  add column snack_at timestamptz;

