export { buildCalendar, type CalendarEntry, type CalendarFeed } from './ics.js';

const DEFAULT_BASE_URL = 'https://api.cal.com';

export interface CalComOptions {
  /** A Cal.com API key (`cal_live_…`) or OAuth access token with read access to calendars. */
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface ConnectedCalendar {
  credentialId: number;
  externalId: string;
  name?: string;
  integration?: string;
  /** Cal.com uses selected calendars for conflict checking. */
  isSelected: boolean;
  readOnly?: boolean;
  primary?: boolean;
}

export interface BusyInterval {
  start: string;
  end: string;
  /** Cal.com's label for the source calendar, when it provides one. Titles are never returned. */
  source?: string | null;
}

export interface Conflict {
  start: string;
  end: string;
  overlapMinutes: number;
}

export class CalComError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'CalComError';
  }
}

/**
 * Read-only Cal.com v2 client for availability. It lists the calendars connected
 * to a Cal.com account (for example iCloud via CalDAV) and returns busy
 * intervals across them. It does not create, change or cancel anything.
 */
export class CalComAvailabilityClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: CalComOptions) {
    if (!options.apiKey) throw new CalComError('A Cal.com API key is required.');
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async listCalendars(): Promise<ConnectedCalendar[]> {
    const body = await this.get<unknown>('/v2/calendars');
    return parseConnectedCalendars(body);
  }

  /**
   * Busy intervals between two dates (inclusive calendar days, in `timeZone`).
   * Uses the calendars Cal.com has selected for conflict checking, or all
   * connected calendars when none are selected.
   */
  async busyTimes(input: { from: Date; to: Date; timeZone?: string; calendars?: ConnectedCalendar[] }): Promise<BusyInterval[]> {
    const connected = input.calendars ?? await this.listCalendars();
    const selected = connected.filter((calendar) => calendar.isSelected);
    const targets = selected.length ? selected : connected;
    if (!targets.length) throw new CalComError('No calendars are connected to this Cal.com account.');
    const timeZone = input.timeZone ?? 'UTC';
    const params = new URLSearchParams();
    params.set('dateFrom', localDate(input.from, timeZone));
    params.set('dateTo', localDate(input.to, timeZone));
    params.set('timeZone', timeZone);
    for (const calendar of targets) params.append('calendar', `${calendar.credentialId},${calendar.externalId}`);
    const body = await this.get<{ status?: string; data?: Array<{ start?: string; end?: string; source?: string | null }> }>(`/v2/calendars/busy-times?${params}`);
    if (body.status && body.status !== 'success') throw new CalComError('Cal.com returned an error for busy times.');
    const from = input.from.getTime();
    const to = input.to.getTime();
    return (body.data ?? [])
      .filter((item): item is { start: string; end: string; source?: string | null } => typeof item.start === 'string' && typeof item.end === 'string')
      .map((item) => ({ start: new Date(item.start).toISOString(), end: new Date(item.end).toISOString(), source: item.source ?? null }))
      .filter((item) => Date.parse(item.end) > from && Date.parse(item.start) < to)
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  private async get<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        headers: { authorization: `Bearer ${this.apiKey}`, accept: 'application/json' },
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) throw new CalComError('Cal.com rejected the API key.', response.status);
      if (response.status === 429) throw new CalComError('Cal.com rate limited the request.', 429);
      if (!response.ok) throw new CalComError(`Cal.com request failed with HTTP ${response.status}.`, response.status);
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof CalComError) throw error;
      if (error instanceof Error && error.name === 'AbortError') throw new CalComError('Cal.com request timed out.');
      throw new CalComError('Cal.com request failed.');
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Accepts the documented `/v2/calendars` response and tolerates minor shape changes. */
export function parseConnectedCalendars(body: unknown): ConnectedCalendar[] {
  const data = (body as { data?: unknown })?.data ?? body;
  const groups = (data as { connectedCalendars?: unknown[] })?.connectedCalendars ?? (Array.isArray(data) ? data : []);
  const result: ConnectedCalendar[] = [];
  for (const group of groups as Array<Record<string, unknown>>) {
    const integration = (group.integration as { slug?: string; type?: string; name?: string } | undefined);
    const groupCredential = typeof group.credentialId === 'number' ? group.credentialId : undefined;
    const calendars = Array.isArray(group.calendars) ? group.calendars as Array<Record<string, unknown>> : [];
    for (const calendar of calendars) {
      const credentialId = typeof calendar.credentialId === 'number' ? calendar.credentialId : groupCredential;
      const externalId = typeof calendar.externalId === 'string' ? calendar.externalId : undefined;
      if (credentialId === undefined || !externalId) continue;
      result.push({
        credentialId,
        externalId,
        name: typeof calendar.name === 'string' ? calendar.name : undefined,
        integration: integration?.slug ?? integration?.type ?? integration?.name,
        isSelected: calendar.isSelected === true,
        readOnly: typeof calendar.readOnly === 'boolean' ? calendar.readOnly : undefined,
        primary: calendar.primary === true,
      });
    }
  }
  return result;
}

/** Busy intervals that overlap a proposed block, with overlap minutes. */
export function findConflicts(busy: BusyInterval[], start: Date, end: Date): Conflict[] {
  const from = start.getTime();
  const to = end.getTime();
  return busy
    .map((interval) => {
      const overlap = Math.min(to, Date.parse(interval.end)) - Math.max(from, Date.parse(interval.start));
      return { start: interval.start, end: interval.end, overlapMinutes: Math.round(overlap / 60_000) };
    })
    .filter((conflict) => conflict.overlapMinutes > 0);
}

function localDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  return parts;
}
