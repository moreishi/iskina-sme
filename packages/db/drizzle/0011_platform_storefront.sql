-- Public storefront reads for the HATOD channel.
--
-- Discovery must see across tenants, but the app role is tenant-scoped by RLS.
-- These SECURITY DEFINER functions expose only the public storefront columns
-- (plus tenant_id for the server, never returned to the client). They are the
-- one controlled cross-tenant read path.

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
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.tenant_id, b.name, b.slug, b.vertical::text, b.lat, b.lng, b.timezone
  from businesses b
  join tenants t on t.id = b.tenant_id
  where b.status = 'active' and t.status = 'active'
  order by b.name
  limit greatest(1, least(200, coalesce(p_limit, 50)))
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
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.tenant_id, b.name, b.slug, b.vertical::text, b.lat, b.lng, b.timezone
  from businesses b
  join tenants t on t.id = b.tenant_id
  where b.slug = p_slug and b.status = 'active' and t.status = 'active'
  limit 1
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
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.tenant_id, b.name, b.slug, b.vertical::text, b.lat, b.lng, b.timezone
  from businesses b
  join tenants t on t.id = b.tenant_id
  where b.id = p_id and b.status = 'active' and t.status = 'active'
  limit 1
$$;

grant execute on function public.storefront_directory(integer) to iskina_app;
grant execute on function public.storefront_by_slug(text) to iskina_app;
grant execute on function public.storefront_by_id(uuid) to iskina_app;
