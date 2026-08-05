-- =============================================================================
-- BazarHQ CURRENT MIGRATION 0004
-- Advanced themes, merchant storefront customization and shop policies
-- =============================================================================
-- Super Admin theme writes are expected through service-role Edge Functions.
-- Public/merchant clients may read active themes; merchants apply a theme through
-- apply_store_theme(), which verifies store ownership.
-- =============================================================================

create extension if not exists pgcrypto;

alter table public.stores add column if not exists theme_id text default 'emerald';
alter table public.stores add column if not exists theme_name text;
alter table public.stores add column if not exists brand_color text default '#10b981';
alter table public.stores add column if not exists theme_config jsonb default '{}'::jsonb;
alter table public.stores add column if not exists theme_updated_at timestamptz;

create table if not exists public.platform_themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  primary_color text default '#635bff',
  secondary_color text default '#312e81',
  accent_color text default '#8b5cf6',
  is_active boolean default true,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.platform_themes add column if not exists description text;
alter table public.platform_themes add column if not exists primary_color text default '#635bff';
alter table public.platform_themes add column if not exists secondary_color text default '#312e81';
alter table public.platform_themes add column if not exists accent_color text default '#8b5cf6';
alter table public.platform_themes add column if not exists surface_color text default '#ffffff';
alter table public.platform_themes add column if not exists background_color text default '#f8fafc';
alter table public.platform_themes add column if not exists text_color text default '#0f172a';
alter table public.platform_themes add column if not exists layout_preset text default 'modern-brand';
alter table public.platform_themes add column if not exists font_family text default 'inter';
alter table public.platform_themes add column if not exists nav_style text default 'glass';
alter table public.platform_themes add column if not exists hero_style text default 'banner-right';
alter table public.platform_themes add column if not exists card_style text default 'soft';
alter table public.platform_themes add column if not exists button_style text default 'pill';
alter table public.platform_themes add column if not exists corner_radius text default 'extra';
alter table public.platform_themes add column if not exists density text default 'comfortable';
alter table public.platform_themes add column if not exists background_style text default 'gradient';
alter table public.platform_themes add column if not exists animation_style text default 'smooth';
alter table public.platform_themes add column if not exists product_grid text default 'three';
alter table public.platform_themes add column if not exists config jsonb default '{}'::jsonb;
alter table public.platform_themes add column if not exists is_active boolean default true;
alter table public.platform_themes add column if not exists is_default boolean default false;
alter table public.platform_themes add column if not exists created_at timestamptz default now();
alter table public.platform_themes add column if not exists updated_at timestamptz default now();

create or replace function public.platform_theme_config(
  p_slug text,
  p_name text,
  p_description text,
  p_primary text,
  p_secondary text,
  p_accent text,
  p_surface text,
  p_background text,
  p_text text,
  p_layout text,
  p_font text,
  p_nav text,
  p_hero text,
  p_card text,
  p_button text,
  p_radius text,
  p_density text,
  p_bg_style text,
  p_animation text,
  p_grid text,
  p_default boolean
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'slug', p_slug,
    'name', p_name,
    'description', coalesce(p_description, ''),
    'primary_color', p_primary,
    'secondary_color', p_secondary,
    'accent_color', p_accent,
    'surface_color', p_surface,
    'background_color', p_background,
    'text_color', p_text,
    'layout_preset', p_layout,
    'font_family', p_font,
    'nav_style', p_nav,
    'hero_style', p_hero,
    'card_style', p_card,
    'button_style', p_button,
    'corner_radius', p_radius,
    'density', p_density,
    'background_style', p_bg_style,
    'animation_style', p_animation,
    'product_grid', p_grid,
    'is_default', coalesce(p_default, false)
  );
$$;

insert into public.platform_themes (
  name, slug, description, primary_color, secondary_color, accent_color,
  surface_color, background_color, text_color, layout_preset, font_family, nav_style,
  hero_style, card_style, button_style, corner_radius, density, background_style,
  animation_style, product_grid, is_active, is_default, config
)
values
  ('Emerald Commerce', 'emerald', 'Clean green theme for modern Bangladeshi commerce stores.', '#10b981', '#064e3b', '#22c55e', '#ffffff', '#f8fafc', '#0f172a', 'modern-brand', 'inter', 'glass', 'banner-right', 'soft', 'pill', 'extra', 'comfortable', 'gradient', 'smooth', 'three', true, true, public.platform_theme_config('emerald','Emerald Commerce','Clean green theme for modern Bangladeshi commerce stores.','#10b981','#064e3b','#22c55e','#ffffff','#f8fafc','#0f172a','modern-brand','inter','glass','banner-right','soft','pill','extra','comfortable','gradient','smooth','three',true)),
  ('Indigo Premium', 'indigo', 'Premium blue-violet storefront theme.', '#635bff', '#312e81', '#8b5cf6', '#ffffff', '#f8fafc', '#0f172a', 'modern-brand', 'plus-jakarta', 'glass', 'split', 'shadow', 'pill', 'extra', 'comfortable', 'gradient', 'premium', 'three', true, false, public.platform_theme_config('indigo','Indigo Premium','Premium blue-violet storefront theme.','#635bff','#312e81','#8b5cf6','#ffffff','#f8fafc','#0f172a','modern-brand','plus-jakarta','glass','split','shadow','pill','extra','comfortable','gradient','premium','three',false)),
  ('Rose Boutique', 'rose-boutique', 'Editorial boutique theme for fashion and beauty shops.', '#e11d48', '#881337', '#fb7185', '#ffffff', '#fff1f2', '#111827', 'boutique', 'playfair', 'minimal', 'editorial', 'glass', 'soft', 'extra', 'spacious', 'clean', 'smooth', 'two', true, false, public.platform_theme_config('rose-boutique','Rose Boutique','Editorial boutique theme for fashion and beauty shops.','#e11d48','#881337','#fb7185','#ffffff','#fff1f2','#111827','boutique','playfair','minimal','editorial','glass','soft','extra','spacious','clean','smooth','two',false)),
  ('Amber Marketplace', 'amber-marketplace', 'Dense warm marketplace theme for broad product catalogs.', '#f59e0b', '#7c2d12', '#fb923c', '#ffffff', '#fffbeb', '#0f172a', 'marketplace', 'inter', 'solid', 'compact', 'bordered', 'rounded', 'large', 'compact', 'clean', 'minimal', 'four', true, false, public.platform_theme_config('amber-marketplace','Amber Marketplace','Dense warm marketplace theme for broad product catalogs.','#f59e0b','#7c2d12','#fb923c','#ffffff','#fffbeb','#0f172a','marketplace','inter','solid','compact','bordered','rounded','large','compact','clean','minimal','four',false)),
  ('Tech Edge', 'tech-edge', 'Dark high-contrast theme for electronics stores.', '#2563eb', '#020617', '#06b6d4', '#0f172a', '#020617', '#e2e8f0', 'tech', 'manrope', 'dark', 'split', 'bordered', 'sharp', 'medium', 'comfortable', 'dark', 'smooth', 'three', true, false, public.platform_theme_config('tech-edge','Tech Edge','Dark high-contrast theme for electronics stores.','#2563eb','#020617','#06b6d4','#0f172a','#020617','#e2e8f0','tech','manrope','dark','split','bordered','sharp','medium','comfortable','dark','smooth','three',false))
on conflict (slug) do update set
  description = excluded.description,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color,
  accent_color = excluded.accent_color,
  surface_color = excluded.surface_color,
  background_color = excluded.background_color,
  text_color = excluded.text_color,
  layout_preset = excluded.layout_preset,
  font_family = excluded.font_family,
  nav_style = excluded.nav_style,
  hero_style = excluded.hero_style,
  card_style = excluded.card_style,
  button_style = excluded.button_style,
  corner_radius = excluded.corner_radius,
  density = excluded.density,
  background_style = excluded.background_style,
  animation_style = excluded.animation_style,
  product_grid = excluded.product_grid,
  config = excluded.config,
  is_active = true,
  updated_at = now();

-- Backfill platform theme config for existing custom themes.
update public.platform_themes
set config = public.platform_theme_config(
  slug,
  name,
  description,
  coalesce(primary_color, '#635bff'),
  coalesce(secondary_color, '#312e81'),
  coalesce(accent_color, '#8b5cf6'),
  coalesce(surface_color, '#ffffff'),
  coalesce(background_color, '#f8fafc'),
  coalesce(text_color, '#0f172a'),
  coalesce(layout_preset, 'modern-brand'),
  coalesce(font_family, 'inter'),
  coalesce(nav_style, 'glass'),
  coalesce(hero_style, 'banner-right'),
  coalesce(card_style, 'soft'),
  coalesce(button_style, 'pill'),
  coalesce(corner_radius, 'extra'),
  coalesce(density, 'comfortable'),
  coalesce(background_style, 'gradient'),
  coalesce(animation_style, 'smooth'),
  coalesce(product_grid, 'three'),
  coalesce(is_default, false)
)
where config is null or config = '{}'::jsonb;

-- Apply a default full config to old stores that only had theme_id/color.
update public.stores s
set
  theme_name = coalesce(nullif(s.theme_name, ''), pt.name, 'Emerald Commerce'),
  theme_config = public.platform_theme_config(
    coalesce(nullif(s.theme_id, ''), pt.slug, 'emerald'),
    coalesce(nullif(s.theme_name, ''), pt.name, 'Emerald Commerce'),
    coalesce(pt.description, ''),
    coalesce(nullif(s.brand_color, ''), pt.primary_color, '#10b981'),
    coalesce(pt.secondary_color, '#064e3b'),
    coalesce(pt.accent_color, '#22c55e'),
    coalesce(pt.surface_color, '#ffffff'),
    coalesce(pt.background_color, '#f8fafc'),
    coalesce(pt.text_color, '#0f172a'),
    coalesce(pt.layout_preset, 'modern-brand'),
    coalesce(pt.font_family, 'inter'),
    coalesce(pt.nav_style, 'glass'),
    coalesce(pt.hero_style, 'banner-right'),
    coalesce(pt.card_style, 'soft'),
    coalesce(pt.button_style, 'pill'),
    coalesce(pt.corner_radius, 'extra'),
    coalesce(pt.density, 'comfortable'),
    coalesce(pt.background_style, 'gradient'),
    coalesce(pt.animation_style, 'smooth'),
    coalesce(pt.product_grid, 'three'),
    coalesce(pt.is_default, false)
  ),
  theme_updated_at = coalesce(s.theme_updated_at, now())
from public.platform_themes pt
where pt.slug = coalesce(nullif(s.theme_id, ''), 'emerald')
  and (s.theme_config is null or s.theme_config = '{}'::jsonb);


-- Storefront content and policy columns used by Merchant Settings / Checkout.
alter table public.stores
  add column if not exists font_id text default 'inter',
  add column if not exists show_hero boolean default true,
  add column if not exists show_featured boolean default true,
  add column if not exists show_about boolean default false,
  add column if not exists about_text text,
  add column if not exists hero_title text,
  add column if not exists hero_subtitle text,
  add column if not exists hero_banner_urls jsonb default '[]'::jsonb,
  add column if not exists about_title text,
  add column if not exists about_image_url text,
  add column if not exists about_mission text,
  add column if not exists offer_enabled boolean default true,
  add column if not exists offer_badge text,
  add column if not exists offer_title text,
  add column if not exists offer_subtitle text,
  add column if not exists offer_button_text text,
  add column if not exists offer_image_url text,
  add column if not exists return_policy text,
  add column if not exists shipping_policy text,
  add column if not exists payment_policy text,
  add column if not exists notification_prefs jsonb default '{}'::jsonb;

update public.stores
set
  hero_banner_urls=case
    when (hero_banner_urls is null or hero_banner_urls='[]'::jsonb)
      and coalesce(banner_url,'')<>'' then jsonb_build_array(banner_url)
    else coalesce(hero_banner_urls,'[]'::jsonb)
  end,
  return_policy=coalesce(
    return_policy,
    'Return or exchange requests must be discussed with the merchant within 3 days of delivery. Items should be unused and in original condition unless they arrived damaged or incorrect.'
  ),
  shipping_policy=coalesce(
    shipping_policy,
    'Delivery time and charge depend on destination, courier availability, and product type. Customers will see the final delivery charge before placing the order.'
  ),
  payment_policy=coalesce(
    payment_policy,
    'Cash on Delivery remains pending until collection. Mobile banking payments require a valid transaction ID and remain pending until merchant verification.'
  );

comment on column public.stores.return_policy is
  'Merchant-managed return/exchange policy displayed to customers.';
comment on column public.stores.shipping_policy is
  'Merchant-managed shipping/delivery policy displayed to customers.';
comment on column public.stores.payment_policy is
  'Merchant-managed payment policy displayed to customers.';

-- Exactly one platform theme may be marked as the default.
update public.platform_themes
set is_default=(slug='emerald')
where is_default=true or slug='emerald';

create unique index if not exists platform_themes_one_default_idx
  on public.platform_themes(is_default)
  where is_default=true;

alter table public.platform_themes enable row level security;

drop policy if exists "Public can read active platform themes"
  on public.platform_themes;
drop policy if exists "Prototype superadmin can manage themes"
  on public.platform_themes;
drop policy if exists platform_themes_authenticated_all
  on public.platform_themes;

create policy "Public can read active platform themes"
on public.platform_themes
for select
to anon,authenticated
using (is_active=true);

grant select on public.platform_themes to anon,authenticated;
revoke insert,update,delete on public.platform_themes from anon,authenticated;

create or replace function public.apply_store_theme(
  p_store_id uuid,
  p_theme_slug text,
  p_primary_color text default null,
  p_secondary_color text default null,
  p_accent_color text default null
)
returns public.stores
language plpgsql
security definer
set search_path=public
as $$
declare
  v_store public.stores;
  v_theme public.platform_themes;
  v_primary text;
  v_secondary text;
  v_accent text;
  v_config jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_store
  from public.stores
  where id=p_store_id
    and owner_id=auth.uid()
    and coalesce(account_status,'active')<>'deleted'
  for update;

  if not found then
    raise exception 'Store not found or not allowed';
  end if;

  select * into v_theme
  from public.platform_themes
  where slug=lower(trim(p_theme_slug))
    and is_active=true;

  if not found then
    raise exception 'Theme not found or inactive';
  end if;

  v_primary:=case
    when coalesce(p_primary_color,'')~'^#[0-9A-Fa-f]{6}$'
      then p_primary_color
    else v_theme.primary_color
  end;
  v_secondary:=case
    when coalesce(p_secondary_color,'')~'^#[0-9A-Fa-f]{6}$'
      then p_secondary_color
    else v_theme.secondary_color
  end;
  v_accent:=case
    when coalesce(p_accent_color,'')~'^#[0-9A-Fa-f]{6}$'
      then p_accent_color
    else v_theme.accent_color
  end;

  v_config:=coalesce(v_theme.config,'{}'::jsonb)
    || jsonb_build_object(
      'slug',v_theme.slug,
      'name',v_theme.name,
      'description',coalesce(v_theme.description,''),
      'primary_color',v_primary,
      'secondary_color',v_secondary,
      'accent_color',v_accent,
      'is_default',coalesce(v_theme.is_default,false),
      'applied_at',now()
    );

  update public.stores
  set
    theme_id=v_theme.slug,
    theme_name=v_theme.name,
    brand_color=v_primary,
    theme_config=v_config,
    theme_updated_at=now(),
    updated_at=now()
  where id=p_store_id
    and owner_id=auth.uid()
  returning * into v_store;

  return v_store;
end $$;

revoke all on function public.apply_store_theme(uuid,text,text,text,text)
  from public;
grant execute on function public.apply_store_theme(uuid,text,text,text,text)
  to authenticated;

-- Existing owner policy remains the main store update protection.
-- This compatibility policy is safe because ownership is checked.
drop policy if exists "Store owners can update own theme"
  on public.stores;
drop policy if exists "Store owners can update theme fields"
  on public.stores;
create policy "Store owners can update own theme"
on public.stores
for update to authenticated
using (owner_id=auth.uid())
with check (owner_id=auth.uid());

notify pgrst,'reload schema';
