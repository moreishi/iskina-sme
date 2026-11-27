-- Published theme versions are tenant data.

alter table "theme_versions" enable row level security;
alter table "theme_versions" force row level security;

create policy "theme_versions_tenant" on "theme_versions"
  for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
