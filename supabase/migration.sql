-- Tabelle der Anmeldungen
create table public.anmeldungen (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  vorname                 text not null,
  nachname                text not null,
  email                   text not null,
  anzahl_begleitpersonen  smallint not null default 0,
  bemerkung               text,
  status                  text not null default 'angemeldet',
  bestaetigung_gesendet   boolean not null default false
);

-- Doppelanmeldungen pro E-Mail verhindern
create unique index anmeldungen_email_idx
  on public.anmeldungen (lower(email));

-- RLS aktivieren, KEINE öffentlichen Policies anlegen.
-- Ohne Policy hat weder anon noch authenticated Zugriff.
-- Nur der Service-Role-Key (in der Netlify Function) umgeht RLS.
alter table public.anmeldungen enable row level security;
