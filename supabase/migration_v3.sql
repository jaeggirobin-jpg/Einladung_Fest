-- Migration v3: Geschlossene Gästeliste mit Berechtigung pro Gast
-- Im Supabase SQL-Editor ausführen, NACHDEM migration_v2.sql gelaufen ist.

-- 1. Status-Constraint erweitern: 'offen' für noch nicht beantwortete Einladungen
alter table public.anmeldungen
  drop constraint if exists anmeldungen_status_check;
alter table public.anmeldungen
  add constraint anmeldungen_status_check
  check (status in ('offen', 'angemeldet', 'abgemeldet'));

-- 2. Default-Status ändert sich: neue Einträge sind initial 'offen' (eingeladen, noch keine Antwort)
alter table public.anmeldungen
  alter column status set default 'offen';

-- 3. Pro-Gast-Berechtigung: maximal erlaubte Begleitpersonen (0 = keine Begleitperson)
alter table public.anmeldungen
  add column if not exists max_begleitpersonen smallint not null default 0;

-- 4. Sicherstellen: anzahl_begleitpersonen darf max_begleitpersonen nicht übersteigen
alter table public.anmeldungen
  drop constraint if exists anmeldungen_begleit_check;
alter table public.anmeldungen
  add constraint anmeldungen_begleit_check
  check (anzahl_begleitpersonen <= max_begleitpersonen);
