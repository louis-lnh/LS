# SHD Esports Website and Backend Brief

## Context

KOVA was originally built as a larger VALORANT esports platform with Riot API and RSO access as a major dependency. Because the Riot application stayed in pending review for nearly two months without meaningful response or activity, KOVA should no longer be treated as an active product path.

Going forward, KOVA is best used as a reference project: source code, page ideas, backend patterns, UI inspiration, and implementation lessons can be reused where helpful, but SHD should not inherit KOVA's complexity or its dependency on Riot approval.

SHD Esports should be built as a smaller, focused, informative website for the SHD Premier VALORANT team.

## Core Direction

SHD is currently a community, but the website should represent the Premier VALORANT team specifically. The site does not need to support a large member ecosystem, public applications, complex user flows, or automated Riot data from day one.

The goal is simple:

- Show the team.
- Show the matches.
- Show VOD reviews.
- Show clips and highlights.
- Show Premier progress and manually curated stats.
- Keep the SHD style strong without overbuilding.

Manual content management is acceptable for the first version. For one team, manually adding matches, clips, roster data, and Premier stats is realistic and avoids another hard dependency on Riot approval.

Riot API access can be considered again later if the website grows, but it should be optional enhancement, not a foundation.

## Proposed Pages

### 1. Home

Purpose: give visitors an immediate sense of SHD's identity and current team status.

Possible content:

- SHD branding and team identity.
- Short team intro.
- Featured clip or highlight reel.
- Current Premier record or status.
- Next match or latest result.
- Quick links to roster, matches/VODs, and clips.

### 2. Roster

Purpose: present the current SHD Premier team, focused on the five main players.

Possible content:

- Five main players as the primary focus.
- Player cards with name, role, preferred agents, short bio, and socials.
- Optional subs/staff section later.
- Active/inactive status if needed.

### 3. Matches and VOD Reviews

Purpose: track recent and upcoming games, with review notes for team improvement and public showcase.

Possible content:

- Match date.
- Opponent.
- Map or map pool.
- Score.
- Win/loss result.
- VOD link.
- Short review notes.
- MVP or standout player.
- Key rounds or takeaways.

This can be fully manual at first.

### 4. Clips

Purpose: show SHD highlights and memorable plays.

Possible content:

- Embedded YouTube, Twitch, Medal, or other clip links.
- Clip title.
- Player.
- Map.
- Tags.
- Featured flag for homepage highlights.

Filtering by player or map can be added later if needed.

### 5. Stats

Purpose: show only the relevant Premier team stats, not a full Riot-powered player analytics system.

Possible content:

- Premier wins/losses.
- Maps played.
- Map win rate.
- Round difference.
- Most played maps.
- Agent usage.
- Manually selected player highlights.

These stats can be manual or derived from manually entered match data.

### 6. About / Contact

Purpose: explain what SHD is and give people a simple way to reach the team.

Possible content:

- Short explanation of SHD.
- Team goals.
- Social links.
- Discord link.
- Contact information.

## Legal Pages

Legal pages do not need to be linked prominently from the main SHD esports website for the initial version.

Legal and Terms of Service pages may later be needed for `event.shd-esports.com`, especially because Lifesteal players need to follow those ToS. That belongs to a later event/subdomain scope and should not block the main SHD team website.

## Backend Recommendation

The backend should be separate from the Discord bot.

Recommended structure:

- Website frontend reads public content from the backend.
- Backend/API owns the source of truth for roster, matches, VODs, clips, stats, and announcements.
- Database stores the manually managed SHD content.
- Discord bot acts as an automation and input surface.
- Webhooks or internal API endpoints connect the Discord bot and backend.

The Discord bot should not be the primary database or only source of truth. If the bot breaks, is rewritten, or Discord changes something, the website should continue to work.

## Backend Domains

### Roster

Stores player and team member information.

Possible fields:

- Display name.
- Riot name/tag if desired.
- Role.
- Preferred agents.
- Social links.
- Status: main, sub, staff, inactive.
- Bio.
- Avatar.

### Matches

Stores upcoming and completed matches.

Possible fields:

- Date and time.
- Opponent.
- Event type, such as Premier, scrim, tournament, or showmatch.
- Map or maps.
- Score.
- Result.
- VOD link.
- Review notes.
- MVP.
- Key takeaways.

### Clips

Stores highlights and showcase content.

Possible fields:

- Title.
- Player.
- Map.
- Source URL.
- Thumbnail.
- Tags.
- Featured flag.
- Date.

### Stats

Stores or derives the simple Premier stats shown on the site.

Possible fields:

- Wins.
- Losses.
- Maps played.
- Map win rate.
- Round difference.
- Agent usage.
- Player highlight stats.

Stats can be manually entered at first or derived from match entries later.

### Announcements

Stores lightweight news updates.

Possible examples:

- Match announcements.
- Match results.
- Roster updates.
- New clips.
- Site updates.

### Integrations

Handles external automation and publishing.

Possible integrations:

- Discord bot commands.
- Discord webhooks.
- YouTube/Twitch/Medal embeds.
- Future Riot API integration if approval becomes available.

## Discord Integration

The SHD Discord bot has already been started in:

`B:\LS\SHD\discord-bot`

The bot should be treated as a controller for the backend, not the backend itself.

Potential bot commands:

- `/match add`
- `/match result`
- `/vod add`
- `/clip add`
- `/roster update`
- `/premier record`
- `/announce`

Potential automations:

- Post new match results to Discord.
- Post new clips to Discord.
- Post match reminders.
- Submit VOD links from Discord.
- Allow trusted staff to update site data through commands.

The backend should authenticate bot requests with an internal token or similar simple server-to-server auth.

## Auth and Admin

The first version should avoid complex public authentication.

Recommended options:

- Small protected admin panel.
- Discord-based admin commands through the bot.
- Simple server-side authentication for trusted maintainers.

No public account system is needed for the SHD team site.

## Guiding Principle

KOVA was an esports platform that needed data access.

SHD should be an esports team website that can benefit from data access later, but does not need it to launch.

Build the controllable version first. Riot API access, if it ever happens, becomes an upgrade rather than a blocker.

