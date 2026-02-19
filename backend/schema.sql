-- Convometrics database schema

create extension if not exists "pgcrypto";

create table if not exists customers (
    id uuid primary key default gen_random_uuid(),
    api_key text unique not null,
    name text not null,
    created_at timestamptz not null default now()
);

create table if not exists conversations (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references customers(id),
    conversation_id text not null,
    user_id text,
    messages jsonb not null,
    metadata jsonb,
    intent text,
    quality_score integer,
    completion_status text,
    abandon_point integer,        -- index of last user message; set when status is abandoned/failed
    created_at timestamptz not null default now()
);

-- Migration for existing databases:
-- alter table conversations add column if not exists abandon_point integer;

create index if not exists idx_conversations_customer_id on conversations(customer_id);
create index if not exists idx_conversations_conversation_id on conversations(conversation_id);
create index if not exists idx_customers_api_key on customers(api_key);

create table if not exists failure_patterns (
    intent     text primary key,
    patterns   jsonb        not null,  -- [{label, pct, example}, ...]
    updated_at timestamptz  not null default now()
);
