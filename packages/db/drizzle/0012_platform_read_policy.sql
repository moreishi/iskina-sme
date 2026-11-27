-- SECURITY DEFINER runs as the (non-superuser) owner, so FORCE RLS still
-- applies. Platform discovery therefore needs a narrow read policy unlocked by
-- a transaction-local GUC that only the definer functions set.

create policy "businesses_platform_read" on "businesses"
  for select
  using (nullif(current_setting('app.platform', true), '') = 'on');

create policy "tenants_platform_read" on "tenants"
  for select
  using (nullif(current_setting('app.platform', true), '') = 'on');

create or replace function public.storefront_directory(p_limit integer default 50)
returns table (
  id uuid,
  tenant_id uuid,
  name text,
  slug text,
  vertical text,
  lat double precision,
  lng double precision,
  timezone text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform set_config('app.platform', 'on', true);
  return query
    select b.id, b.tenant_id, b.name, b.slug, b.vertical::text, b.lat, b.lng, b.timezone
    from businesses b
    join tenants t on t.id = b.tenant_id
    where b.status = 'active' and t.status = 'active'
    order by b.name
    limit greatest(1, least(200, coalesce(p_limit, 50)));
end;
$$;

create or replace function public.storefront_by_slug(p_slug text)
returns table (
  id uuid,
  tenant_id uuid,
  name text,
  slug text,
  vertical text,
  lat double precision,
  lng double precision,
  timezone text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform set_config('app.platform', 'on', true);
  return query
    select b.id, b.tenant_id, b.name, b.slug, b.vertical::text, b.lat, b.lng, b.timezone
    from businesses b
    join tenants t on t.id = b.tenant_id
    where b.slug = p_slug and b.status = 'active' and t.status = 'active'
    limit 1;
end;
$$;

create or replace function public.storefront_by_id(p_id uuid)
returns table (
  id uuid,
  tenant_id uuid,
  name text,
  slug text,
  vertical text,
  lat double precision,
  lng double precision,
  timezone text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform set_config('app.platform', 'on', true);
  return query
    select b.id, b.tenant_id, b.name, b.slug, b.vertical::text, b.lat, b.lng, b.timezone
    from businesses b
    join tenants t on t.id = b.tenant_id
    where b.id = p_id and b.status = 'active' and t.status = 'active'
    limit 1;
end;
$$;
