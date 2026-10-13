-- 今晚煮什麼：家裡的晚餐決定器
-- 跟「叫蛋記帳」「今日事」共用同一個 Supabase 專案，所以每張表都用 dp_ 開頭，權限也完全分開。
-- 只有 dp_members 裡的人（兩位媽媽）看得到、改得到。

create table public.dp_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create function public.dp_is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.dp_members where user_id = auth.uid())
$$;

-- 全家共用的設定（只有一列）
create table public.dp_settings (
  id smallint primary key default 1 check (id = 1),
  people smallint not null default 3 check (people in (2, 3, 8)),
  diet boolean not null default true,
  no_hot boolean not null default true,
  max_min smallint not null default 30 check (max_min in (0, 20, 30)),
  updated_at timestamptz not null default now()
);
insert into public.dp_settings (id) values (1);

-- 每道菜的標記：愛吃、不敢吃（以菜名當 key）
create table public.dp_marks (
  dish text primary key check (length(btrim(dish)) between 1 and 40),
  fav boolean not null default false,
  banned boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 自己加的菜（內建的菜寫在程式裡）
create table public.dp_dishes (
  name text primary key check (length(btrim(name)) between 1 and 20),
  type text not null check (type in ('main', 'veg', 'soup')),
  minutes smallint not null check (minutes between 1 and 240),
  tool text not null check (tool in ('爐', '氣', '蒸', '免')),
  ing jsonb not null default '[]'::jsonb check (jsonb_typeof(ing) = 'array' and jsonb_array_length(ing) <= 20),
  sauce jsonb not null default '[]'::jsonb check (jsonb_typeof(sauce) = 'array' and jsonb_array_length(sauce) <= 20),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

-- 每一天：今天換了幾次、排了哪些菜、幾個人、有沒有真的煮
create table public.dp_days (
  day date primary key,
  reroll integer not null default 0 check (reroll between 0 and 1000),
  dishes text[] check (dishes is null or cardinality(dishes) between 1 and 6),
  people smallint check (people is null or people in (2, 3, 8)),
  cooked boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 買菜清單打勾（以週一為一週）
create table public.dp_shop (
  week date not null,
  item text not null check (length(btrim(item)) between 1 and 60),
  done boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (week, item)
);

-- 權限：成員可以看、新增、修改；沒有刪除（清掉一天是把 dishes 設成 null）
do $$
declare t text;
begin
  foreach t in array array['dp_settings', 'dp_marks', 'dp_dishes', 'dp_days', 'dp_shop'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.dp_is_member())', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.dp_is_member())', t || '_add', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.dp_is_member()) with check (public.dp_is_member())', t || '_edit', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end $$;

alter table public.dp_members enable row level security;
create policy dp_members_self on public.dp_members for select to authenticated using (user_id = auth.uid());
grant select on public.dp_members to authenticated;
grant execute on function public.dp_is_member() to authenticated;

-- 修改時間由資料庫記
create function public.dp_touch() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger dp_settings_touch before update on public.dp_settings for each row execute function public.dp_touch();
create trigger dp_marks_touch before update on public.dp_marks for each row execute function public.dp_touch();
create trigger dp_days_touch before update on public.dp_days for each row execute function public.dp_touch();
create trigger dp_shop_touch before update on public.dp_shop for each row execute function public.dp_touch();

-- 兩支手機即時同步
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.dp_settings, public.dp_marks, public.dp_dishes, public.dp_days, public.dp_shop;
  end if;
end $$;
