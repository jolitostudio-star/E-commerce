create table public.diagnostic_previews (
  lead_hash text primary key check (length(lead_hash)=64),
  listing_ref text not null,
  report jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index diagnostic_previews_created_idx on public.diagnostic_previews(created_at);
alter table public.diagnostic_previews enable row level security;
revoke all on public.diagnostic_previews from public, anon, authenticated;
grant select, insert, update, delete on public.diagnostic_previews to service_role;

create table public.diagnostic_source (
  id text primary key check (id='mercadolivre'),
  owner_id uuid not null references auth.users(id),
  credentials text not null,
  revision uuid not null,
  lease_until timestamptz
);
alter table public.diagnostic_source enable row level security;
revoke all on public.diagnostic_source from public, anon, authenticated;
grant select, insert, update, delete on public.diagnostic_source to service_role;
