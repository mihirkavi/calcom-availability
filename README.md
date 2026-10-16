# calcom-availability

Two small calendar building blocks for agents that plan things for a person:

1. **Availability from Cal.com.** A read-only Cal.com v2 client that lists the calendars connected to an account (for example iCloud over CalDAV) and returns **busy intervals** across them, plus a conflict check for a proposed time block.
2. **A subscribable plan calendar.** An RFC 5545 iCalendar builder for `TENTATIVE` holds, `CONFIRMED` plans and `CANCELLED` retractions, with stable UIDs, sequence numbers and alerts. Publish it at a secret URL and subscribe once in Apple Calendar (or Google or Outlook). Planned events then show up without giving any tool write access to your calendar.

## Why this exists

Cal.com is a scheduling product. Its official API and the assistant-side Cal.com connector manage *bookings of your own event types*. They don't create arbitrary events, like "hold Thursday 6–9 PM for a Meetup", on a connected iCloud calendar. Faking that with a booking would be wrong. This package keeps the two jobs separate:

- **Read** availability through Cal.com, which already has your iCloud connection.
- **Write** plans to a calendar you subscribe to, which you can delete or unsubscribe at any time.

The trade-off: subscribed calendars refresh on the calendar app's schedule (Apple Calendar lets you pick every 5 minutes up to weekly), so new holds are not instant.

Part of [Open Media Events](https://github.com/mihirkavi/open-media/tree/main/docs/events), but usable on its own.

## Use

```bash
npm install github:mihirkavi/calcom-availability
```

```ts
import { buildCalendar, CalComAvailabilityClient, findConflicts } from 'calcom-availability';

const cal = new CalComAvailabilityClient({ apiKey: process.env.CALCOM_API_KEY! });
const busy = await cal.busyTimes({ from, to, timeZone: 'America/Los_Angeles' });
const conflicts = findConflicts(busy, proposedStart, proposedEnd);

const ics = buildCalendar({
  name: 'My plans',
  entries: [{ uid: 'plan-123@example.com', title: 'Hold: Founders dinner', start, end, status: 'TENTATIVE', url, sequence: 1 }],
});
```

Create the API key in Cal.com → Settings → Developer → API Keys. Store it in a secret manager, never in source or prompts. Busy-time results contain only start, end and an optional source label. Event titles and attendees are never returned.

### MCP server

```bash
CALCOM_API_KEY=… npm run mcp   # stdio: calcom_list_calendars, calcom_busy_times
```

## Project structure

```text
src/index.ts   Cal.com v2 client (CalComAvailabilityClient), connected-calendar parsing, findConflicts; re-exports the ICS builder
src/ics.ts     RFC 5545 calendar builder (buildCalendar)
src/mcp.ts     stdio MCP server (calcom_list_calendars, calcom_busy_times)
test/          node:test unit tests
```

The package ships TypeScript sources directly (no build step). The MCP server needs the optional peer dependencies `@modelcontextprotocol/sdk` and `zod`.

## Develop

Requires Node.js 22.13 or later.

```bash
npm install
npm run typecheck
npm test
```

## Status

v0.1. Unit-tested against the documented `/v2/calendars` and `/v2/calendars/busy-times` response shapes. **It has not yet been verified against a live Cal.com account**, so check `calcom_list_calendars` first when you connect yours. The ICS builder folds lines at 75 octets, escapes text and emits `REFRESH-INTERVAL`/`X-PUBLISHED-TTL` hints.

## License

MIT
