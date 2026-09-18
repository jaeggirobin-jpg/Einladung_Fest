-- Migration v7: Eigene Bilder fürs Fotoalbum
-- Im Supabase SQL-Editor ausführen, NACHDEM migration_v6.sql gelaufen ist.
--
-- Diese Bilder kommen nicht von den Gästen, sondern werden in der
-- Album-Werkstatt hochgeladen. Im Album erscheinen sie nach den Grüssen,
-- in der Reihenfolge der Spalte "position".

create table if not exists public.album_bilder (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  position   integer not null default 0,
  titel      text,
  foto_path  text not null,
  thumb_path text
);

-- Sortierung ist der häufigste Zugriff
create index if not exists album_bilder_position_idx
  on public.album_bilder (position, created_at);

alter table public.album_bilder enable row level security;
-- Keine Policies: Zugriff nur über die Netlify Functions (Service-Role).
