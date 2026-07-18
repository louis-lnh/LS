create extension if not exists pgcrypto;

create type account_status as enum ('active', 'limited', 'suspended', 'deleted');
create type user_role_name as enum ('owner', 'admin', 'mod', 'dev', 'staff', 'member');
create type event_status as enum ('draft', 'published', 'archived', 'cancelled');
create type publish_target_type as enum ('portal', 'website', 'discord_bot', 'minecraft_server', 'api_feed');
create type submission_type as enum ('application', 'appeal', 'player_report', 'general_support');
create type submission_status as enum ('submitted', 'under_review', 'waiting_user', 'accepted', 'denied', 'resolved', 'closed', 'archived');
create type submission_priority as enum ('low', 'normal', 'high', 'urgent');
create type review_action as enum ('claimed', 'accepted', 'denied', 'acknowledged', 'closed', 'reopened');
create type chat_type as enum ('dm', 'submission', 'announcement', 'notification', 'staff');
create type chat_member_role as enum ('owner', 'member', 'staff', 'viewer');
create type chat_sender_type as enum ('user', 'staff', 'system', 'discord_bot');
create type anti_cheat_action as enum ('alert', 'block_join', 'kick', 'temp_ban', 'ban');
create type severity_level as enum ('info', 'warning', 'critical');
create type anti_cheat_resolution_status as enum ('open', 'approved', 'denied', 'resolved');
create type system_category as enum ('vps', 'discord_bot', 'backend', 'website', 'minecraft_server', 'agent');
create type runtime_environment as enum ('production', 'staging', 'development');
create type system_status as enum ('healthy', 'warning', 'critical', 'paused', 'unknown');
create type system_action_status as enum ('pending', 'running', 'success', 'failed', 'skipped');

create table users (
  id uuid primary key default gen_random_uuid(),
  shd_id text not null unique,
  username text unique,
  display_name text not null,
  avatar_url text,
  bio text,
  status account_status not null default 'active',
  public_profile boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_shd_id_format check (shd_id ~ '^SHD[0-9]{4,}$')
);

create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  role user_role_name not null,
  scope text not null default 'global',
  granted_by uuid references users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, role, scope, revoked_at)
);

create table linked_discord_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  discord_id text not null unique,
  username text not null,
  display_name text,
  guild_id text,
  linked_at timestamptz not null default now(),
  last_seen_at timestamptz,
  primary_account boolean not null default true
);

create table linked_minecraft_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  minecraft_uuid text not null unique,
  minecraft_name text not null,
  linked_at timestamptz not null default now(),
  last_seen_at timestamptz,
  primary_account boolean not null default true,
  public_stats_opt_in boolean not null default false,
  constraint minecraft_uuid_normalized check (minecraft_uuid ~ '^[0-9a-fA-F-]{32,36}$')
);

create table identity_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  source text not null check (source in ('discord', 'minecraft')),
  external_id text not null,
  value text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (source, external_id, value)
);

create table events (
  id uuid primary key default gen_random_uuid(),
  event_code text not null unique,
  parent_event_id uuid references events(id) on delete set null,
  workspace text not null default 'global',
  title text not null,
  slug text not null unique,
  category text not null,
  status event_status not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text not null default 'Europe/Berlin',
  summary text not null default '',
  description text not null default '',
  public_url text,
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_code_format check (event_code ~ '^EVT-[0-9]{4,}$')
);

create table event_schedule_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  title text not null,
  type text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  reward text,
  objective text,
  summary text,
  priority integer not null default 10,
  public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table event_publish_targets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  target_type publish_target_type not null,
  target_key text not null,
  enabled boolean not null default true,
  last_synced_at timestamptz,
  last_error text,
  unique (event_id, target_type, target_key)
);

create table support_submissions (
  id uuid primary key default gen_random_uuid(),
  submission_code text not null unique,
  type submission_type not null,
  workspace text not null default 'lifesteal',
  event_id uuid references events(id) on delete set null,
  user_id uuid not null references users(id) on delete cascade,
  status submission_status not null default 'submitted',
  priority submission_priority not null default 'normal',
  assigned_to uuid references users(id) on delete set null,
  claimed_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table support_submission_fields (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references support_submissions(id) on delete cascade,
  key text not null,
  label text not null,
  value jsonb not null default 'null'::jsonb,
  visibility text not null default 'staff' check (visibility in ('staff', 'user', 'system')),
  unique (submission_id, key)
);

create table submission_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references support_submissions(id) on delete cascade,
  action review_action not null,
  staff_user_id uuid not null references users(id) on delete restrict,
  reason text,
  created_at timestamptz not null default now()
);

create table chats (
  id uuid primary key default gen_random_uuid(),
  chat_code text unique,
  type chat_type not null,
  title text not null,
  submission_id uuid references support_submissions(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table chat_members (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role chat_member_role not null default 'member',
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  unique (chat_id, user_id)
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats(id) on delete cascade,
  sender_user_id uuid references users(id) on delete set null,
  sender_type chat_sender_type not null,
  body text not null,
  attachments jsonb not null default '[]'::jsonb,
  discord_message_id text,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  target_url text,
  seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table anti_cheat_records (
  id uuid primary key default gen_random_uuid(),
  evidence_id text not null unique,
  appeal_id text unique,
  user_id uuid references users(id) on delete set null,
  minecraft_account_id uuid references linked_minecraft_accounts(id) on delete set null,
  shd_id text,
  action anti_cheat_action not null,
  category text not null,
  severity severity_level not null,
  reason_code text not null,
  public_reason text not null,
  detected_mods jsonb not null default '[]'::jsonb,
  context jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  expires_at timestamptz,
  resolution_status anti_cheat_resolution_status,
  resolved_at timestamptz,
  resolved_by uuid references users(id) on delete set null
);

create table systems (
  id uuid primary key default gen_random_uuid(),
  system_key text not null unique,
  name text not null,
  category system_category not null,
  environment runtime_environment not null default 'production',
  status system_status not null default 'unknown',
  owner_team text,
  public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table system_heartbeats (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references systems(id) on delete cascade,
  source text not null,
  status system_status not null default 'unknown',
  metrics jsonb not null default '{}'::jsonb,
  issues jsonb not null default '[]'::jsonb,
  received_at timestamptz not null default now(),
  sent_at timestamptz
);

create table system_actions (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references systems(id) on delete cascade,
  action_type text not null,
  status system_action_status not null default 'pending',
  requested_by uuid references users(id) on delete set null,
  result jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id) on delete set null,
  actor_external_id text,
  type text not null,
  target_type text,
  target_id text,
  data jsonb not null default '{}'::jsonb,
  previous_hash text,
  event_hash text,
  created_at timestamptz not null default now()
);

create index idx_users_shd_id on users (shd_id);
create index idx_discord_accounts_discord_id on linked_discord_accounts (discord_id);
create index idx_minecraft_accounts_uuid on linked_minecraft_accounts (minecraft_uuid);
create index idx_events_status_workspace on events (status, workspace);
create index idx_events_parent on events (parent_event_id);
create index idx_event_schedule_event_time on event_schedule_entries (event_id, starts_at);
create index idx_support_submissions_status_type on support_submissions (status, type);
create index idx_support_submissions_user on support_submissions (user_id);
create index idx_chats_submission on chats (submission_id);
create index idx_chat_messages_chat_time on chat_messages (chat_id, created_at);
create index idx_notifications_user_seen on notifications (user_id, seen_at, created_at);
create index idx_anti_cheat_appeal_id on anti_cheat_records (appeal_id);
create index idx_anti_cheat_shd_id on anti_cheat_records (shd_id);
create index idx_anti_cheat_minecraft_account on anti_cheat_records (minecraft_account_id);
create index idx_systems_category_status on systems (category, status);
create index idx_system_heartbeats_system_time on system_heartbeats (system_id, received_at desc);
create index idx_audit_events_target on audit_events (target_type, target_id, created_at desc);
