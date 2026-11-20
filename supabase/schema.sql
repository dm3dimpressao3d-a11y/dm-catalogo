-- =====================================================================
--  DM Impressão 3D — Catálogo
--  Cole este arquivo inteiro no Supabase: SQL Editor > New query > Run
--  Pode rodar de novo sem medo (ele não apaga dados).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) QUEM PODE EDITAR O CATÁLOGO
--    >>> TROQUE o e-mail abaixo pelo e-mail que você vai usar para entrar
--    >>> no painel. Para dar acesso a mais gente, adicione mais linhas.
-- ---------------------------------------------------------------------
create table if not exists public.admin_emails (
  email text primary key
);

insert into public.admin_emails (email) values
  ('seu-email@exemplo.com')
on conflict (email) do nothing;

-- Ninguém de fora enxerga a lista de admins
alter table public.admin_emails enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------------------------------------------------------------------
-- 1) CONFIGURAÇÕES DA LOJA (sempre 1 linha só)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  id               int primary key default 1 check (id = 1),
  store_name       text not null default 'DM Impressão 3D',
  tagline          text default 'Ideias ganham forma',
  whatsapp         text default '',
  whatsapp_message text default 'Olá! Tenho interesse no produto *{produto}* ({preco}). Pode me ajudar? {link}',
  logo_url         text,
  updated_at       timestamptz not null default now()
);

insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2) CATEGORIAS
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3) PRODUTOS (até 3 fotos por produto)
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  price       numeric(10,2),                      -- vazio = "Consulte o valor"
  category_id uuid references public.categories(id) on delete set null,
  images      text[] not null default '{}',
  active      boolean not null default true,      -- visível para os clientes?
  sold_out    boolean not null default false,
  featured    boolean not null default false,     -- aparece primeiro
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint products_max_3_images check (coalesce(array_length(images, 1), 0) <= 3)
);

create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_active_idx   on public.products (active, featured desc, created_at desc);

-- ---------------------------------------------------------------------
-- 4) SEGURANÇA (RLS)
--    Clientes (anônimos): só LEEM o que está visível.
--    Admin (e-mail na lista acima + logado): lê e edita tudo.
-- ---------------------------------------------------------------------
alter table public.settings   enable row level security;
alter table public.categories enable row level security;
alter table public.products   enable row level security;

-- settings
drop policy if exists "settings: todos leem"   on public.settings;
drop policy if exists "settings: admin edita"  on public.settings;
create policy "settings: todos leem"  on public.settings for select using (true);
create policy "settings: admin edita" on public.settings for all
  using (public.is_admin()) with check (public.is_admin());

-- categories
drop policy if exists "categories: todos leem"  on public.categories;
drop policy if exists "categories: admin edita" on public.categories;
create policy "categories: todos leem"  on public.categories for select using (true);
create policy "categories: admin edita" on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

-- products
drop policy if exists "products: todos leem visiveis" on public.products;
drop policy if exists "products: admin edita"         on public.products;
create policy "products: todos leem visiveis" on public.products for select
  using (active = true or public.is_admin());
create policy "products: admin edita" on public.products for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 4b) PERMISSÕES DE ACESSO ÀS TABELAS
--     Projetos novos do Supabase não liberam as tabelas automaticamente.
--     Aqui liberamos o "acesso", e as regras (RLS) acima decidem quem pode o quê.
--     admin_emails fica fechada para todo mundo (só a função is_admin() lê).
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.settings, public.categories, public.products to anon;
grant select, insert, update, delete
  on public.settings, public.categories, public.products to authenticated;

revoke all on public.admin_emails from anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5) ARMAZENAMENTO DAS FOTOS (bucket público "produtos")
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "produtos: admin envia"   on storage.objects;
drop policy if exists "produtos: admin troca"   on storage.objects;
drop policy if exists "produtos: admin apaga"   on storage.objects;

create policy "produtos: admin envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'produtos' and public.is_admin());
create policy "produtos: admin troca" on storage.objects for update to authenticated
  using (bucket_id = 'produtos' and public.is_admin())
  with check (bucket_id = 'produtos' and public.is_admin());
create policy "produtos: admin apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'produtos' and public.is_admin());

-- (as fotos são lidas pela URL pública do bucket, não precisa de policy de leitura)
