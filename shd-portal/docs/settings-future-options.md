# Settings Future Options

These settings were requested for the SHD Portal, but should stay documented until the backend/login model supports them cleanly.

## Account

- Profile picture upload: currently Discord avatar only.
- Username changes: depends on whether SHD-native accounts become editable.
- Bio persistence: needs profile storage.

## Security

- Change password: only applies after SHD-native login exists.
- Two-factor authentication: needs native account credentials and recovery flow.
- Active sessions: needs backend session inventory.
- Trusted devices: needs device fingerprint/registration model.
- Login history: needs audit/event storage.
- Logout all devices: needs server-side session revocation.

## Notifications

- Email notifications: needs verified email addresses and mail provider.
- Push notifications: needs mobile/web push registration.
- Notification category persistence: currently UI-only.

## Appearance

- Light theme: reserved for later.
- Accent color persistence: needs user preference storage.
- Reduce motion persistence: should eventually sync to account preferences.

## Connected Services

- Steam, GitHub, Riot and future services: need OAuth/linking flows before they should be interactive.

## Devices

- Linked devices: needs account/device registry.
- Mobile app: placeholder until an SHD app exists.
- Web sessions: needs backend session storage.

## API Tokens

- API token creation, rotation, scopes and revocation are intentionally not exposed yet.
- Add this only after there is a clear public API and audit logging.

## Privacy

- Friend requests: future social feature.
- Public profile visibility: should be wired when the profile page exists.

## Data

- Download my data: needs export worker or endpoint.
- Delete account: only valid once SHD-native account ownership and recovery flows are defined.
- Export settings: can be implemented earlier as a local/preferences export.

## My Account Future Items

- Achievements: needs achievement/event model.
- Account timeline: needs account audit/event history.
- API access: needs token creation, scopes, rotation and audit logs.
- Devices and sessions: should share the same native session backend as Security settings.
- Public profile: depends on the profile page and privacy controls.
- Minecraft accounts: should eventually show verified usernames, UUIDs, SHD IDs and linked servers.
- Organization membership: should eventually show roles per organization/workspace, not only workspace names.

## Dashboard Future Items

- Overview
- Notifications
- Recent Activity
- Support
- Applications
- Appeals
- Reports
- Messages
- Chats
- Events
- Announcements
- Quick Actions
- Server Status
- Personal Statistics
- Recent Logins
- Pinned Items
- Upcoming Events
- Tasks
- Bookmarks / Favorites
