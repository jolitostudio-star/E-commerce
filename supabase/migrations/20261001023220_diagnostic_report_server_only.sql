-- The full report must always pass fresh payment validation in our API.
-- An old approved database status must not expose a refunded report via REST.
revoke select on public.diagnostic_orders from authenticated;
grant select (id, user_id, listing_ref, amount_cents, currency, status, created_at, updated_at)
  on public.diagnostic_orders to authenticated;
