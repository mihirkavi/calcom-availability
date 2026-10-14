/**
 * Builds a subscribable iCalendar (RFC 5545) feed. Calendar apps such as Apple
 * Calendar can subscribe to the published URL, so planned events appear without
 * giving any app write access to the user's calendar.
 */
export interface CalendarEntry {
  /** Stable id; reused across feed refreshes so apps update rather than duplicate. */
  uid: string;
  title: string;
  start: Date;
  end: Date;
  /** TENTATIVE for holds, CONFIRMED for verified registrations, CANCELLED to retract. */
  status: 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED';
  location?: string;
  description?: string;
  url?: string;
  /** Monotonic revision so clients notice changes. */
  sequence?: number;
  updatedAt?: Date;
  /** Minutes before start for an alert; omitted means no alert. */
  alarmMinutes?: number;
  /** OPAQUE blocks time; TRANSPARENT shows without blocking. Defaults to OPAQUE. */
  transparency?: 'OPAQUE' | 'TRANSPARENT';
}

export interface CalendarFeed {
  name: string;
  description?: string;
  /** Suggested refresh interval in minutes. Defaults to 30. */
  refreshMinutes?: number;
  productId?: string;
  entries: CalendarEntry[];
}

export function buildCalendar(feed: CalendarFeed): string {
  const refresh = Math.max(5, Math.round(feed.refreshMinutes ?? 30));
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${feed.productId ?? '-//calcom-availability//Calendar Feed//EN'}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(feed.name)}`,
    ...(feed.description ? [`X-WR-CALDESC:${escapeText(feed.description)}`] : []),
    `REFRESH-INTERVAL;VALUE=DURATION:PT${refresh}M`,
    `X-PUBLISHED-TTL:PT${refresh}M`,
  ];
  const stamp = formatUtc(new Date());
  for (const entry of feed.entries) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeText(entry.uid)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatUtc(entry.start)}`,
      `DTEND:${formatUtc(entry.end)}`,
      `SUMMARY:${escapeText(entry.title)}`,
      `STATUS:${entry.status}`,
      `TRANSP:${entry.transparency ?? 'OPAQUE'}`,
      `SEQUENCE:${Math.max(0, Math.floor(entry.sequence ?? 0))}`,
    );
    if (entry.updatedAt) lines.push(`LAST-MODIFIED:${formatUtc(entry.updatedAt)}`);
    if (entry.location) lines.push(`LOCATION:${escapeText(entry.location)}`);
    if (entry.description) lines.push(`DESCRIPTION:${escapeText(entry.description)}`);
    if (entry.url && /^https?:\/\//i.test(entry.url)) lines.push(`URL:${entry.url.replace(/[\r\n]/g, '')}`);
    if (entry.alarmMinutes !== undefined && entry.status !== 'CANCELLED') {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(entry.title)}`, `TRIGGER:-PT${Math.max(0, Math.round(entry.alarmMinutes))}M`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

function formatUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds lines at 75 octets without splitting UTF-8 characters. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const charSize = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (size + charSize > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += charSize;
  }
  parts.push(current);
  return parts.join('\r\n ');
}
