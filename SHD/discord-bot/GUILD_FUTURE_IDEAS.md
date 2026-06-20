# SHD Guild Future Ideas

These are useful next improvements that were intentionally not included in the first guild-readiness slice.

## Panel Registry Refresh

Store enough panel metadata to refresh existing panel messages instead of posting duplicates. Add commands such as `/panel list` and `/panel refresh`.

## Ticket Type Routing

Move ticket type settings into configuration: parent channel, notify channel, staff roles, allowed code prefixes, and default priority per ticket type.

## Permission Preflight

Expand `/setup check` into a real permission audit that checks role hierarchy, create/private thread permissions, send/embed permissions, and channel visibility.

## Ticket Archive Metadata

Save a final archive summary for each ticket: opener, staff owner, attached code, status, close reason, timestamps, and later a transcript.

## Abuse Guardrails

Add cooldowns for ticket panel buttons, stronger one-open-ticket-per-user rules per workspace, and staff-only confirmation prompts for destructive actions.

## Backup And Export

Add a `scripts/backup-data.js` script plus `/data backup` and `/data export` staff commands, following the Lifesteal bot pattern.

## Staff Notes And Cases

Add `staff_notes` and `moderation_cases` collections with `/note add`, `/note list`, `/case open`, and `/case close` once SHD moderation workflows are clearer.

## Public Project Routes

Add planned public routes for SHD websites: `/api/v1/public/projects`, `/api/v1/public/events`, and `/api/v1/public/links`.

## Announcement Helpers

Add staff announcement tooling after the guild channel layout and approval flow are decided.

## Privacy Process

Write a short SHD privacy/support disclosure before collecting more sensitive ticket, report, application, or staff-note data.
