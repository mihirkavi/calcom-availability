#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { CalComAvailabilityClient, findConflicts } from './index.js';

const apiKey = process.env.CALCOM_API_KEY;
if (!apiKey) {
  console.error('Set CALCOM_API_KEY to a Cal.com API key before starting this server.');
  process.exit(1);
}
const client = new CalComAvailabilityClient({ apiKey, baseUrl: process.env.CALCOM_API_URL });
const server = new McpServer(
  { name: 'calcom-availability', version: '0.1.0' },
  { instructions: 'Read-only availability from calendars connected to Cal.com. Returns busy intervals only, never event titles or attendees.' },
);
const output = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }] });

server.registerTool(
  'calcom_list_calendars',
  {
    title: 'List calendars connected to Cal.com',
    description: 'Lists connected calendars and whether Cal.com checks them for conflicts.',
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async () => output(await client.listCalendars()),
);

server.registerTool(
  'calcom_busy_times',
  {
    title: 'Get busy times',
    description: 'Returns busy intervals across connected calendars, and conflicts with an optional proposed block.',
    inputSchema: {
      from: z.string().datetime({ offset: true }),
      to: z.string().datetime({ offset: true }),
      time_zone: z.string().default('America/Los_Angeles'),
      proposed_start: z.string().datetime({ offset: true }).optional(),
      proposed_end: z.string().datetime({ offset: true }).optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ from, to, time_zone, proposed_start, proposed_end }) => {
    const busy = await client.busyTimes({ from: new Date(from), to: new Date(to), timeZone: time_zone });
    const conflicts = proposed_start && proposed_end ? findConflicts(busy, new Date(proposed_start), new Date(proposed_end)) : undefined;
    return output({ busy, conflicts });
  },
);

await server.connect(new StdioServerTransport());
