-- Minimal schema for auth (used in features/Moon23/auth)
create table if not exists users (
  id bigserial primary key,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

