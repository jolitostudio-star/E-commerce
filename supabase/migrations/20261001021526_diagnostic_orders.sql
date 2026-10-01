create table public.diagnostic_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_key uuid not null,
  listing_ref text not null check (length(listing_ref) between 6 and 2000),
  amount_cents integer not null default 100 check (amount_cents = 100),
  currency text not null default 'BRL' check (currency = 'BRL'),
  status text not null default 'created' check (status in ('created','creating','pending','approved','rejected','cancelled','refunded','charged_back','checkout_error')),
  preference_id text unique,
  checkout_url text,
  payment_id text unique,
  report jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, request_key)
);
create index diagnostic_orders_owner_date on public.diagnostic_orders(user_id, created_at desc);
alter table public.diagnostic_orders enable row level security;
revoke all on public.diagnostic_orders from anon, authenticated;
grant select on public.diagnostic_orders to authenticated;
grant all on public.diagnostic_orders to service_role;
create policy diagnostic_orders_own_read on public.diagnostic_orders for select to authenticated
using ((select auth.uid()) = user_id and status = 'approved');

create table public.diagnostic_payment_events (
  event_key text primary key,
  payment_id text not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.diagnostic_payment_events enable row level security;
revoke all on public.diagnostic_payment_events from anon, authenticated;
grant all on public.diagnostic_payment_events to service_role;
