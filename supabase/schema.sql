-- thenycexterminator analytics + leads schema
-- Run this in Supabase SQL editor on a new project.

create extension if not exists "uuid-ossp";

-- Sessions: one row per visitor session
create table if not exists sessions (
  id text primary key,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  referrer text,
  landing_path text,
  user_agent text,
  language text,
  screen_w int,
  screen_h int,
  device text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  gclid text,
  fbclid text,
  ip_hash text,
  country text,
  region text,
  city text
);

create index if not exists sessions_first_seen_idx on sessions (first_seen desc);

-- Page views
create table if not exists page_views (
  id uuid primary key default uuid_generate_v4(),
  session_id text not null references sessions(id) on delete cascade,
  path text not null,
  title text,
  referrer text,
  ts timestamptz not null default now()
);

create index if not exists page_views_session_idx on page_views (session_id);
create index if not exists page_views_ts_idx on page_views (ts desc);
create index if not exists page_views_path_idx on page_views (path);

-- Generic events (cta_click, outbound_click, scroll_depth, form_open, form_abandon, form_success, form_error)
create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  session_id text not null references sessions(id) on delete cascade,
  type text not null,
  name text,
  path text,
  meta jsonb,
  ts timestamptz not null default now()
);

create index if not exists events_session_idx on events (session_id);
create index if not exists events_type_idx on events (type);
create index if not exists events_ts_idx on events (ts desc);

-- Leads (form submissions: service-quote | general-inquiry | job-application)
create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  session_id text references sessions(id) on delete set null,
  form_type text not null,
  name text,
  email text,
  phone text,
  message text,
  meta jsonb,
  path text,
  user_agent text,
  ts timestamptz not null default now()
);

create index if not exists leads_ts_idx on leads (ts desc);
create index if not exists leads_form_type_idx on leads (form_type);
create index if not exists leads_session_idx on leads (session_id);

-- RLS: lock everything down. Service role bypasses RLS; anon key has no access.
alter table sessions enable row level security;
alter table page_views enable row level security;
alter table events enable row level security;
alter table leads enable row level security;
