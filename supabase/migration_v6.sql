-- Migration v6: Freischaltung planen + Thumbnails für die Galerie
-- Im Supabase SQL-Editor ausführen, NACHDEM migration_v5.sql gelaufen ist.

-- 1. Kleines Vorschaubild pro Gruss (für die Galerie im Admin).
--    Das Original bleibt in voller Druckqualität erhalten.
alter table public.gruesse
  add column if not exists thumb_path text;

-- 2. Einstellungen für die Freischaltung der Selfie-Seite.
--    Genau eine Zeile (id = 1).
create table if not exists public.gruss_einstellungen (
  id             smallint primary key default 1,
  freigeschaltet boolean not null default false,
  freigabe_ab    timestamptz,
  updated_at     timestamptz not null default now(),
  constraint gruss_einstellungen_single_row check (id = 1)
);

insert into public.gruss_einstellungen (id, freigeschaltet, freigabe_ab)
values (1, false, null)
on conflict (id) do nothing;

alter table public.gruss_einstellungen enable row level security;
-- Keine Policies: Zugriff nur über die Netlify Functions (Service-Role).
