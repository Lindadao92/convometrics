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
    created_at timestamptz not null default now()
);

create index if not exists idx_conversations_customer_id on conversations(customer_id);
create index if not exists idx_conversations_conversation_id on conversations(conversation_id);
create index if not exists idx_customers_api_key on customers(api_key);
