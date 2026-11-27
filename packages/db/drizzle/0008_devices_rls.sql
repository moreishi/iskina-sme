-- Device tokens are tenant data; push fan-out already filters by business.

alter table "device_tokens" enable row level security;
alter table "device_tokens" force row level security;

create policy "device_tokens_tenant" on "device_tokens"
  for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
