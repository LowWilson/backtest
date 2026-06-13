-- Backtest Lab Supabase schema
-- Supabase SQL Editorでそのまま実行

create table if not exists public.trades (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  trade_date date,
  htf text not null,
  ltf text not null,
  direction text not null check (direction in ('Long','Short')),
  setups jsonb not null default '[]'::jsonb,
  fib text not null,
  result text not null check (result in ('Win','Loss','BE')),
  rr numeric not null default 0,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.symbols (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

alter table public.trades enable row level security;
alter table public.symbols enable row level security;

drop policy if exists "trades_select_own" on public.trades;
drop policy if exists "trades_insert_own" on public.trades;
drop policy if exists "trades_update_own" on public.trades;
drop policy if exists "trades_delete_own" on public.trades;

create policy "trades_select_own"
on public.trades for select
to authenticated
using (auth.uid() = user_id);

create policy "trades_insert_own"
on public.trades for insert
to authenticated
with check (auth.uid() = user_id);

create policy "trades_update_own"
on public.trades for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "trades_delete_own"
on public.trades for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "symbols_select_own" on public.symbols;
drop policy if exists "symbols_insert_own" on public.symbols;
drop policy if exists "symbols_update_own" on public.symbols;
drop policy if exists "symbols_delete_own" on public.symbols;

create policy "symbols_select_own"
on public.symbols for select
to authenticated
using (auth.uid() = user_id);

create policy "symbols_insert_own"
on public.symbols for insert
to authenticated
with check (auth.uid() = user_id);

create policy "symbols_update_own"
on public.symbols for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "symbols_delete_own"
on public.symbols for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.trades to authenticated;
grant select, insert, update, delete on public.symbols to authenticated;
