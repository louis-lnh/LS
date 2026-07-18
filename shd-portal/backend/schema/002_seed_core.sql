insert into events (
  event_code,
  workspace,
  title,
  slug,
  category,
  status,
  starts_at,
  timezone,
  summary,
  description,
  public_url,
  published_at
) values (
  'EVT-2001',
  'lifesteal',
  'SHD Lifesteal Beta Season',
  'shd-lifesteal-beta-season',
  'minecraft',
  'published',
  '2026-07-23T18:00:00+02:00',
  'Europe/Berlin',
  'The active Lifesteal beta season.',
  'The active Lifesteal beta season with applications, anti-cheat review, custom rules, and account-linked support workflows.',
  'https://lifesteal.shd-esports.com',
  now()
) on conflict (event_code) do nothing;

insert into event_schedule_entries (
  event_id,
  title,
  type,
  starts_at,
  ends_at,
  reward,
  objective,
  summary,
  priority,
  public
)
select id, 'Event Start', 'Server Start', '2026-07-23T18:00:00+02:00', null, 'Season begins',
  'The server opens for the first public beta session.',
  'The countdown to the Lifesteal beta opening.',
  0,
  true
from events
where event_code = 'EVT-2001'
on conflict do nothing;

insert into event_schedule_entries (
  event_id,
  title,
  type,
  starts_at,
  ends_at,
  reward,
  objective,
  summary,
  priority,
  public
)
select id, 'Grace Period', 'Protection Window', '2026-07-23T18:00:00+02:00', '2026-07-23T19:00:00+02:00', 'Safe first hour',
  'PvP, combat tags, lifesteal, heart loss, eliminations, and revivals stay disabled for the first hour.',
  'The first hour lets players spread out and prepare before combat turns on.',
  1,
  true
from events
where event_code = 'EVT-2001'
on conflict do nothing;

insert into event_publish_targets (event_id, target_type, target_key, enabled)
select id, 'portal', 'shd-portal', true from events where event_code = 'EVT-2001'
on conflict (event_id, target_type, target_key) do nothing;

insert into event_publish_targets (event_id, target_type, target_key, enabled)
select id, 'website', 'lifesteal-website', true from events where event_code = 'EVT-2001'
on conflict (event_id, target_type, target_key) do nothing;

insert into event_publish_targets (event_id, target_type, target_key, enabled)
select id, 'discord_bot', 'lifesteal-discord-bot', true from events where event_code = 'EVT-2001'
on conflict (event_id, target_type, target_key) do nothing;

insert into event_publish_targets (event_id, target_type, target_key, enabled)
select id, 'minecraft_server', 'lifesteal-minecraft-server', true from events where event_code = 'EVT-2001'
on conflict (event_id, target_type, target_key) do nothing;

insert into systems (system_key, name, category, environment, status, owner_team, public)
values
  ('lifesteal-bot-vps', 'VPS - Bot Backend', 'vps', 'production', 'unknown', 'infrastructure', false),
  ('public-gateway-vps', 'VPS - Public Gateway', 'vps', 'production', 'unknown', 'infrastructure', false),
  ('lifesteal-discord-bot', 'Lifesteal Bot', 'discord_bot', 'production', 'unknown', 'discord', false),
  ('main-discord-bot', 'Main SHD Bot', 'discord_bot', 'production', 'unknown', 'discord', false),
  ('support-api', 'Support API', 'backend', 'production', 'unknown', 'platform', false),
  ('identity-api', 'Identity API', 'backend', 'production', 'unknown', 'platform', false),
  ('anticheat-record-api', 'Anti-Cheat Record API', 'backend', 'production', 'unknown', 'platform', false),
  ('shd-portal', 'SHD Portal', 'website', 'production', 'unknown', 'platform', true),
  ('lifesteal-website', 'Lifesteal Website', 'website', 'production', 'unknown', 'lifesteal', true),
  ('admin-portal', 'Admin Portal', 'website', 'production', 'unknown', 'platform', false),
  ('lifesteal-minecraft-server', 'Lifesteal Minecraft Server', 'minecraft_server', 'production', 'unknown', 'lifesteal', false),
  ('shd-agent-lifesteal-g17', 'SHD Agent', 'agent', 'production', 'unknown', 'infrastructure', false)
on conflict (system_key) do nothing;
