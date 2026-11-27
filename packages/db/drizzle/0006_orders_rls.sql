-- Orders isolation. Same context GUC as the rest of the tenant tables.

alter table "customers" enable row level security;
alter table "customers" force row level security;
alter table "orders" enable row level security;
alter table "orders" force row level security;
alter table "order_lines" enable row level security;
alter table "order_lines" force row level security;
alter table "order_events" enable row level security;
alter table "order_events" force row level security;

create policy "customers_tenant" on "customers"
  for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

create policy "orders_tenant" on "orders"
  for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

create policy "order_lines_tenant" on "order_lines"
  for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

create policy "order_events_tenant" on "order_events"
  for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
