alter table public.diagnostic_orders add column collector_id text;
alter table public.diagnostic_orders add column payment_updated_at timestamptz;
