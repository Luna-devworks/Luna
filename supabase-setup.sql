-- Luna + Supabase: run this ONCE in Supabase -> SQL Editor -> New query -> Run.
-- Luna stores every account, game, item and inventory as a JSON row in this one table.

create table if not exists public.luna_kv (
  key        text primary key,
  value      jsonb       not null,
  updated_at timestamptz not null default now()
);

-- Lock the table: nobody on the internet can read it with the public (anon) key.
-- Only your Luna server can, because it uses the secret / service_role key, which bypasses these rules.
alter table public.luna_kv enable row level security;
