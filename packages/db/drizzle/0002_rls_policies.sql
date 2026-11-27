-- Tenant isolation: the second wall.
--
-- The application connects as a non-superuser role (`iskina_app`) so these
-- policies are enforced. The repository layer still filters by tenant id; RLS
-- is defence in depth, not the only check.
--
-- Context is set per transaction:
--   select set_config('app.tenant_id', <uuid>, true)
--   select set_config('app.user_id', <uuid>, true)
--   select set_config('app.api_key_hash', <sha256>, true)

alter table "tenants" enable row level security;
alter table "tenants" force row level security;
alter table "businesses" enable row level security;
alter table "businesses" force row level security;
alter table "memberships" enable row level security;
alter table "memberships" force row level security;
alter table "api_keys" enable row level security;
alter table "api_keys" force row level security;
alter table "audit_logs" enable row level security;
alter table "audit_logs" force row level security;

-- Tenants -------------------------------------------------------------------
-- A user may see a tenant they belong to; writes require that tenant's context.
create policy "tenants_select" on "tenants"
  for select
  using (
    id = nullif(current_setting('app.tenant_id', true), '')::uuid
    or exists (
      select 1
      from "memberships" m
      where m.tenant_id = tenants.id
        and m.user_id = nullif(current_setting('app.user_id', true), '')::uuid
    )
  );
create policy "tenants_insert" on "tenants"
  for insert
  with check (id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy "tenants_update" on "tenants"
  for update
  using (id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy "tenants_delete" on "tenants"
  for delete
  using (id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- Businesses ----------------------------------------------------------------
create policy "businesses_tenant" on "businesses"
  for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- Memberships ---------------------------------------------------------------
-- Session bootstrap needs to read the signed-in user's memberships before a
-- tenant is known; every write still requires the tenant context.
create policy "memberships_select" on "memberships"
  for select
  using (
    user_id = nullif(current_setting('app.user_id', true), '')::uuid
    or tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
  );
create policy "memberships_insert" on "memberships"
  for insert
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy "memberships_update" on "memberships"
  for update
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy "memberships_delete" on "memberships"
  for delete
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- API keys ------------------------------------------------------------------
-- Channel auth resolves exactly the presented hash before a tenant is known.
create policy "api_keys_select" on "api_keys"
  for select
  using (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    or key_hash = nullif(current_setting('app.api_key_hash', true), '')
  );
create policy "api_keys_insert" on "api_keys"
  for insert
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy "api_keys_update" on "api_keys"
  for update
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy "api_keys_delete" on "api_keys"
  for delete
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- Audit log -----------------------------------------------------------------
-- Platform events carry no tenant and are invisible to tenant reads.
create policy "audit_logs_select" on "audit_logs"
  for select
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy "audit_logs_insert" on "audit_logs"
  for insert
  with check (
    tenant_id is null
    or tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
  );
create policy "audit_logs_update" on "audit_logs"
  for update
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy "audit_logs_delete" on "audit_logs"
  for delete
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
