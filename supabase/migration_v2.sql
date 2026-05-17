-- Migration v2: Anmelden/Abmelden + Admin-Übersicht
-- Im Supabase SQL-Editor ausführen, NACHDEM migration.sql gelaufen ist.

-- 1. Bestehende E-Mails normalisieren (sicherheitshalber, falls Testdaten existieren)
update public.anmeldungen set email = lower(email) where email != lower(email);

-- 2. Unique-Index direkt auf email-Spalte (statt lower(email)),
--    damit Supabase upsert mit onConflict: 'email' funktioniert.
--    Alle E-Mails werden in der Function ohnehin lowercase normalisiert.
drop index if exists anmeldungen_email_idx;
create unique index anmeldungen_email_idx on public.anmeldungen (email);

-- 3. updated_at-Spalte hinzufügen
alter table public.anmeldungen
  add column if not exists updated_at timestamptz not null default now();

-- 4. Trigger-Funktion für automatisches Update von updated_at
create or replace function public.set_anmeldungen_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 5. Trigger anlegen (idempotent)
drop trigger if exists anmeldungen_updated_at on public.anmeldungen;
create trigger anmeldungen_updated_at
  before update on public.anmeldungen
  for each row execute function public.set_anmeldungen_updated_at();

-- 6. Status-Constraint: nur 'angemeldet' oder 'abgemeldet'
alter table public.anmeldungen
  drop constraint if exists anmeldungen_status_check;
alter table public.anmeldungen
  add constraint anmeldungen_status_check
  check (status in ('angemeldet', 'abgemeldet'));
