-- 沒登入的人不需要呼叫這個函式
revoke execute on function public.dp_is_member() from public, anon;
