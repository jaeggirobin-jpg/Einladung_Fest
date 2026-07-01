-- Migration v4: Namen der Begleitpersonen speichern
-- Im Supabase SQL-Editor ausführen, NACHDEM migration_v3.sql gelaufen ist.

-- JSONB-Array mit Objekten {vorname, nachname} pro Begleitperson
alter table public.anmeldungen
  add column if not exists begleitpersonen jsonb not null default '[]'::jsonb;
