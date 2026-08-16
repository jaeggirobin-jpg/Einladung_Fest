-- Migration v5: Digitales Gästebuch (Grüsse mit Selfie)
-- Im Supabase SQL-Editor ausführen.

-- 1. Tabelle für die Grüsse
create table if not exists public.gruesse (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  nachricht   text not null,
  wort1       text,
  wort2       text,
  foto_path   text not null
);

-- RLS aktivieren, KEINE Policies -> nur Service-Role (Netlify Functions) hat Zugriff
alter table public.gruesse enable row level security;

-- 2. Storage-Bucket für die Selfies (privat, nur via signierte URLs)
insert into storage.buckets (id, name, public)
values ('gruesse-fotos', 'gruesse-fotos', false)
on conflict (id) do nothing;

-- Keine Storage-Policies anlegen -> anon hat keinen Zugriff.
-- Upload läuft über signierte Upload-URLs (Service-Role in der Function),
-- Anzeige im Admin über signierte Download-URLs.
