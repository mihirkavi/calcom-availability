import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildCalendar, CalComAvailabilityClient, findConflicts, parseConnectedCalendars } from '../src/index.js';

const calendarsBody = {
  status: 'success',
  data: {
    connectedCalendars: [
      {
        integration: { slug: 'apple_calendar' },
        credentialId: 42,
        calendars: [
          { externalId: 'https://caldav.icloud.com/1/calendars/home/', name: 'Home', isSelected: true, readOnly: false },
          { externalId: 'https://caldav.icloud.com/1/calendars/holidays/', name: 'Holidays', isSelected: false, readOnly: true },
        ],
      },
    ],
  },
};

test('parses connected calendars', () => {
  const calendars = parseConnectedCalendars(calendarsBody);
  assert.equal(calendars.length, 2);
  assert.equal(calendars[0]?.credentialId, 42);
  assert.equal(calendars[0]?.integration, 'apple_calendar');
  assert.equal(calendars[1]?.isSelected, false);
});

test('busyTimes queries selected calendars and filters the window', async () => {
  let requested = '';
  const fetchStub = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = String(input);
    assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer cal_test');
    if (url.endsWith('/v2/calendars')) return Response.json(calendarsBody);
    requested = url;
    return Response.json({ status: 'success', data: [
      { start: '2026-10-16T01:00:00Z', end: '2026-10-16T02:00:00Z', source: 'apple' },
      { start: '2026-10-20T01:00:00Z', end: '2026-10-20T02:00:00Z' },
    ] });
  }) as typeof fetch;
  const client = new CalComAvailabilityClient({ apiKey: 'cal_test', fetch: fetchStub });
  const busy = await client.busyTimes({ from: new Date('2026-10-15T00:00:00Z'), to: new Date('2026-10-17T00:00:00Z'), timeZone: 'America/Los_Angeles' });
  const params = new URL(requested).searchParams;
  assert.deepEqual(params.getAll('calendar'), ['42,https://caldav.icloud.com/1/calendars/home/']);
  assert.equal(params.get('dateFrom'), '2026-10-14');
  assert.equal(busy.length, 1);
  assert.deepEqual(findConflicts(busy, new Date('2026-10-16T01:30:00Z'), new Date('2026-10-16T03:00:00Z')), [
    { start: '2026-10-16T01:00:00.000Z', end: '2026-10-16T02:00:00.000Z', overlapMinutes: 30 },
  ]);
});

test('rejected keys raise a clear error', async () => {
  const client = new CalComAvailabilityClient({ apiKey: 'bad', fetch: (async () => new Response('', { status: 401 })) as typeof fetch });
  await assert.rejects(client.listCalendars(), /rejected the API key/);
});

test('builds a folded, escaped calendar feed', () => {
  const ics = buildCalendar({
    name: 'Plans',
    entries: [{
      uid: 'plan-1@example',
      title: 'Hold: Founders dinner, Palo Alto; bring cards',
      start: new Date('2026-10-16T02:00:00Z'),
      end: new Date('2026-10-16T04:00:00Z'),
      status: 'TENTATIVE',
      location: '1 University Ave, Palo Alto',
      description: 'Not registered yet.\n'.repeat(10),
      url: 'https://lu.ma/x',
      alarmMinutes: 60,
    }],
  });
  const unfolded = ics.replace(/\r\n /g, '');
  assert.ok(unfolded.includes(String.raw`SUMMARY:Hold: Founders dinner\, Palo Alto\; bring cards`));
  assert.match(ics, /STATUS:TENTATIVE/);
  assert.match(ics, /DTSTART:20261016T020000Z/);
  assert.match(ics, /TRIGGER:-PT60M/);
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
});
