-- Catalog isolation. Same context GUCs as 0002: app.tenant_id.

alter table "catalog_categories" enable row level security;
alter table "catalog_categories" force row level security;
alter table "catalog_items" enable row level security;
alter table "catalog_items" force row level security;

create policy "catalog_categories_tenant" on "catalog_categories"
  for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

create policy "catalog_items_tenant" on "catalog_items"
  for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
