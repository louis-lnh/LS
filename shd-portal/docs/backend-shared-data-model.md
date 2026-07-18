# SHD Backend Shared Data Model

This document defines the first shared backend model for the redesigned SHD portal. The goal is to move toward one source of truth that can feed:

- the public/support portal
- the admin portal
- Discord bots for different guilds
- event websites such as Lifesteal
- Minecraft/server agents
- anti-cheat and appeal workflows

The Discord bots should stay useful bridges for now, but the long-term source of truth should live in the shared backend.

## Design Rules

- Every user gets one canonical SHD account and one stable SHD ID.
- Discord and Minecraft identities are linked services, not the account itself.
- Events are generic. Lifesteal beta, Valorant events, community events, and nested schedule entries use the same base model.
- Support submissions and chats are separate. A submission can create or link to a chat.
- Anti-cheat records must be queryable by SHD ID, Minecraft UUID, evidence ID, and appeal ID.
- System health is append-only where possible. The latest status is derived from recent heartbeats/checks.
- Staff/admin actions must write audit log entries.

## Core Entities

### users

Canonical SHD account.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Internal database ID |
| shd_id | string unique | Human ID, example `SHD0001` |
| username | string unique | Future SHD login username |
| display_name | string | Public display name |
| avatar_url | string nullable | Profile image |
| bio | text nullable | Public profile bio |
| status | enum | `active`, `limited`, `suspended`, `deleted` |
| public_profile | boolean | Whether profile can be shown publicly |
| created_at | datetime | Account creation |
| updated_at | datetime | Last profile/account update |

Current mapping:
- `linked_accounts.shd_id`
- `lifesteal_identities.id`
- hardcoded owner account becomes a seeded owner user.

### user_roles

Staff/member role assignments.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Internal ID |
| user_id | uuid | References `users.id` |
| role | enum | `owner`, `admin`, `mod`, `dev`, `staff`, `member` |
| scope | string | `global`, `lifesteal`, `valorant`, etc. |
| granted_by | uuid nullable | Staff user |
| granted_at | datetime | Assignment time |
| revoked_at | datetime nullable | Soft revoke |

Current mapping:
- `linked_accounts.role`
- `admin_staff_access.role`
- `admin_staff_access.workspaces`

### linked_discord_accounts

Discord identity linked to a user.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Internal ID |
| user_id | uuid | References `users.id` |
| discord_id | string unique | Discord snowflake |
| username | string | Latest Discord username |
| display_name | string nullable | Latest guild display name |
| guild_id | string nullable | For guild-specific links if needed |
| linked_at | datetime | First link time |
| last_seen_at | datetime nullable | Last bot/session sync |
| primary | boolean | Main Discord account |

Current mapping:
- `linked_accounts.discord_id`
- `linked_accounts.discord_username`
- `discord_name_history`

### linked_minecraft_accounts

Minecraft identity linked to a user.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Internal ID |
| user_id | uuid | References `users.id` |
| minecraft_uuid | string unique | Mojang UUID, normalized |
| minecraft_name | string | Latest username |
| linked_at | datetime | First link time |
| last_seen_at | datetime nullable | Last server/bot sync |
| primary | boolean | Main Minecraft account |
| public_stats_opt_in | boolean | Allows public event stats |

Current mapping:
- `linked_accounts.minecraft_uuid`
- `linked_accounts.minecraft_name`
- `minecraft_link_history`
- `minecraft_name_history`
- `lifesteal_identities.minecraft_uuid`

### identity_history

Name/account history for trust and staff review.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Internal ID |
| user_id | uuid nullable | References `users.id` if known |
| source | enum | `discord`, `minecraft` |
| external_id | string | Discord ID or Minecraft UUID |
| value | string | Username/display name |
| first_seen_at | datetime | First observed |
| last_seen_at | datetime | Last observed |

Current mapping:
- `discord_name_history`
- `minecraft_name_history`

## Events

### events

Generic event record. This can represent `SHD Lifesteal Beta Season`, a Valorant event, a community event, or a public announcement-driven event.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Internal ID |
| event_code | string unique | Human code, example `EVT-2001` |
| parent_event_id | uuid nullable | Allows events inside an event |
| workspace | string | `global`, `lifesteal`, `valorant`, etc. |
| title | string | Event title |
| slug | string unique | URL/API slug |
| category | string | `minecraft`, `community`, `valorant`, etc. |
| status | enum | `draft`, `published`, `archived`, `cancelled` |
| starts_at | datetime nullable | Main start time |
| ends_at | datetime nullable | Main end time |
| timezone | string | Example `Europe/Berlin` |
| summary | text | Short display text |
| description | text | Full display text |
| public_url | string nullable | External/public site |
| created_by | uuid | Staff user |
| updated_by | uuid | Staff user |
| published_at | datetime nullable | First/latest publish time |
| archived_at | datetime nullable | Archive time |
| created_at | datetime | Created time |
| updated_at | datetime | Updated time |

Rules:
- `archived` events are not served to public website feeds unless explicitly requested by admin endpoints.
- Discord notification messages may remain visible even after archive/revoke.
- `parent_event_id` is how Lifesteal beta can contain schedule entries or sub-events.

Current mapping:
- `lifesteal_events` can migrate into `events` where `workspace = lifesteal`.

### event_schedule_entries

Detailed schedule inside an event. These are useful for Lifesteal beta phases like Event Start, Grace Period, End Opening, etc.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Internal ID |
| event_id | uuid | Parent event |
| title | string | Entry title |
| type | string | Example `Server Start`, `Protection Window` |
| starts_at | datetime | Entry start |
| ends_at | datetime nullable | Entry end |
| reward | string nullable | Optional reward/display field |
| objective | text nullable | Objective text |
| summary | text nullable | Display summary |
| priority | integer | Sort order |
| public | boolean | Whether public feeds show it |
| created_at | datetime | Created time |
| updated_at | datetime | Updated time |

Current mapping:
- Current `lifesteal_events` rows can become schedule entries under `SHD Lifesteal Beta Season`.

### event_publish_targets

Defines where event data should go.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Internal ID |
| event_id | uuid | Parent event |
| target_type | enum | `portal`, `website`, `discord_bot`, `minecraft_server`, `api_feed` |
| target_key | string | Example `lifesteal-site`, `lifesteal-discord-bot` |
| enabled | boolean | Whether sync is active |
| last_synced_at | datetime nullable | Last sync |
| last_error | text nullable | Last sync error |

## Support And Submissions

### support_submissions

One submitted form/request.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Internal ID |
| submission_code | string unique | Example `APPLY-1234`, `APPEAL-1234`, `REPORT-1234`, `SUPPORT-1234` |
| type | enum | `application`, `appeal`, `player_report`, `general_support` |
| workspace | string | Example `lifesteal` |
| event_id | uuid nullable | Event-specific when needed |
| user_id | uuid | Submitter |
| status | enum | `submitted`, `under_review`, `waiting_user`, `accepted`, `denied`, `resolved`, `closed`, `archived` |
| priority | enum | `low`, `normal`, `high`, `urgent` |
| assigned_to | uuid nullable | Claimed staff |
| claimed_at | datetime nullable | Claim time |
| closed_at | datetime nullable | Close time |
| created_at | datetime | Submit time |
| updated_at | datetime | Last status/content change |

Current mapping:
- `support_applications`
- `support_submissions`
- `ticket_threads`

### support_submission_fields

Flexible form answers without making every form a separate table immediately.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Internal ID |
| submission_id | uuid | Parent submission |
| key | string | Example `minecraft_name`, `reported_player`, `ban_id` |
| label | string | Human display label |
| value | json/text | Stored answer |
| visibility | enum | `staff`, `user`, `system` |

### submission_reviews

Staff decisions and review state.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Internal ID |
| submission_id | uuid | Parent submission |
| action | enum | `claimed`, `accepted`, `denied`, `acknowledged`, `closed`, `reopened` |
| staff_user_id | uuid | Staff user |
| reason | text nullable | Required for denial where applicable |
| created_at | datetime | Action time |

## Chats And Notifications

### chats

One chat thread in portal. Can represent a DM, submission chat, notification channel, or announcement channel.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Internal ID |
| chat_code | string unique nullable | Human code when useful |
| type | enum | `dm`, `submission`, `announcement`, `notification`, `staff` |
| title | string | Display title |
| submission_id | uuid nullable | Linked support submission |
| created_by | uuid nullable | Creator |
| created_at | datetime | Created time |
| updated_at | datetime | Last message/update |
| archived_at | datetime nullable | Archive time |

### chat_members

Who can access a chat.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Internal ID |
| chat_id | uuid | Chat |
| user_id | uuid | Member |
| role | enum | `owner`, `member`, `staff`, `viewer` |
| last_read_at | datetime nullable | Read state |
| joined_at | datetime | Join time |

### chat_messages

Messages in portal chats.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Internal ID |
| chat_id | uuid | Chat |
| sender_user_id | uuid nullable | Null for system messages |
| sender_type | enum | `user`, `staff`, `system`, `discord_bot` |
| body | text | Message body |
| attachments | json | Future file links |
| discord_message_id | string nullable | Bridge reference |
| created_at | datetime | Sent time |
| edited_at | datetime nullable | Edit time |
| deleted_at | datetime nullable | Soft delete |

### notifications

User-facing notifications.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Internal ID |
| user_id | uuid | Receiver |
| type | string | Example `submission_claimed`, `event_published` |
| title | string | Notification title |
| message | text | Notification body |
| target_url | string nullable | Portal route |
| seen_at | datetime nullable | Seen state |
| created_at | datetime | Created time |

Current mapping:
- `notification_previews` can migrate later into announcement/notification publishing.

## Anti-Cheat And Appeals

### anti_cheat_records

Canonical anti-cheat record used by the mod, bot, and portal.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Internal ID |
| evidence_id | string unique | Example `EV-1234` |
| appeal_id | string unique nullable | Example `AP-1234` |
| user_id | uuid nullable | Linked SHD user if known |
| minecraft_account_id | uuid nullable | Linked Minecraft account |
| shd_id | string nullable | Snapshot for display |
| action | enum | `alert`, `block_join`, `kick`, `temp_ban`, `ban` |
| category | string | `client_integrity`, `combat`, `xray`, etc. |
| severity | enum | `info`, `warning`, `critical` |
| reason_code | string | Machine reason |
| public_reason | text | Player-facing reason |
| detected_mods | json | Blocked/suspicious mods, if applicable |
| context | json/text | Extra evidence |
| occurred_at | datetime | Detection time |
| expires_at | datetime nullable | Temp ban expiry |
| resolution_status | enum nullable | `open`, `approved`, `denied`, `resolved` |
| resolved_at | datetime nullable | Resolution time |
| resolved_by | uuid nullable | Staff user |

Current mapping:
- `anti_cheat_records`
- `appeals`

## Systems And Health

### systems

One monitored system.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Internal ID |
| system_key | string unique | Example `lifesteal-g17`, `lifesteal-bot-vps` |
| name | string | Display name |
| category | enum | `vps`, `discord_bot`, `backend`, `website`, `minecraft_server`, `agent` |
| environment | enum | `production`, `staging`, `development` |
| status | enum | `healthy`, `warning`, `critical`, `paused`, `unknown` |
| owner_team | string nullable | Responsible group |
| public | boolean | Whether public status can show it |
| created_at | datetime | Created time |
| updated_at | datetime | Last metadata update |

### system_heartbeats

Append-only health samples.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Internal ID |
| system_id | uuid | Parent system |
| source | string | `shd-agent`, `bot-heartbeat`, `uptime-check`, etc. |
| status | enum | `healthy`, `warning`, `critical`, `unknown` |
| metrics | json | CPU, RAM, disk, TPS, uptime, etc. |
| issues | json | Active issues |
| received_at | datetime | Backend receive time |
| sent_at | datetime nullable | Source send time |

Current mapping:
- `server_status.latest`
- `server_status.history`
- SHD Agent `POST /api/v1/server/heartbeat`

### system_actions

Future remote/admin actions.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Internal ID |
| system_id | uuid | Target system |
| action_type | string | Example `backup`, `deploy_mods`, `refresh_health` |
| status | enum | `pending`, `running`, `success`, `failed`, `skipped` |
| requested_by | uuid | Staff user |
| result | json nullable | Agent result |
| created_at | datetime | Requested time |
| finished_at | datetime nullable | Completion time |

Current mapping:
- `server_actions`

## Audit And Security

### audit_events

Immutable admin/security event log.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Internal ID |
| actor_user_id | uuid nullable | Staff/user actor |
| actor_external_id | string nullable | Discord ID or system actor |
| type | string | Example `event.publish`, `submission.accept`, `system.action.request` |
| target_type | string nullable | Example `event`, `submission`, `system` |
| target_id | string nullable | Target ID |
| data | json | Event details |
| previous_hash | string nullable | Optional tamper-evident chain |
| event_hash | string nullable | Optional tamper-evident chain |
| created_at | datetime | Event time |

Current mapping:
- `audit_events`
- `moderation_cases`
- `staff_notes`

## Migration Notes

The current Lifesteal bot JSON store already contains useful tables. The first backend migration should import data in this order:

1. Create `users` from `linked_accounts` and `lifesteal_identities`.
2. Create `linked_discord_accounts` and `linked_minecraft_accounts`.
3. Create `user_roles` from `linked_accounts.role` and `admin_staff_access`.
4. Convert `lifesteal_events` into `events` and `event_schedule_entries`.
5. Convert `ticket_threads`, `support_applications`, and `support_submissions` into `support_submissions`.
6. Convert `anti_cheat_records` into canonical `anti_cheat_records`.
7. Convert `server_status.history` into `system_heartbeats`.

## First Backend Slice Recommendation

Implement the database in this order:

1. `users`
2. `linked_discord_accounts`
3. `linked_minecraft_accounts`
4. `events`
5. `event_schedule_entries`
6. `event_publish_targets`
7. `audit_events`

This lets the admin event pages become real first, while preserving the identity model needed for support, anti-cheat, and system health.
