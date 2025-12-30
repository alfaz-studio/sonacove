/**
 * Calendar utility functions for generating calendar links and ICS files
 */

export interface CalendarEvent {
  title: string;
  description: string;
  location: string;
  startDate: Date;
  endDate: Date;
  guests?: string[];
}

/**
 * Formats a date to YYYYMMDDTHHmmssZ format for calendar APIs
 */
function formatCalendarDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Formats a date to YYYYMMDD format for Google Calendar
 */
function formatGoogleDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Formats a date to YYYYMMDDTHHmmss format for Google Calendar
 */
function formatGoogleDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

/**
 * Validates email address format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Parses comma-separated email addresses and validates them
 */
export function parseGuestEmails(emails: string): string[] {
  if (!emails || !emails.trim()) return [];
  
  return emails
    .split(',')
    .map(email => email.trim())
    .filter(email => email.length > 0 && isValidEmail(email));
}

/**
 * Generates a Google Calendar URL for adding an event
 */
export function generateGoogleCalendarLink(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatGoogleDateTime(event.startDate)}/${formatGoogleDateTime(event.endDate)}`,
    details: event.description,
    location: event.location,
  });

  // Add guests if provided
  if (event.guests && event.guests.length > 0) {
    params.append('add', event.guests.join(','));
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generates a Microsoft Calendar/Outlook URL for adding an event
 */
export function generateMicrosoftCalendarLink(event: CalendarEvent): string {
  const params = new URLSearchParams({
    subject: event.title,
    startdt: event.startDate.toISOString(),
    enddt: event.endDate.toISOString(),
    body: event.description,
    location: event.location,
  });

  // Add attendees if provided
  if (event.guests && event.guests.length > 0) {
    params.append('attendees', event.guests.join(';'));
  }

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Escapes text for ICS format
 */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generates an ICS file content for download
 */
export function generateICSFile(event: CalendarEvent): string {
  const startDate = formatCalendarDate(event.startDate);
  const endDate = formatCalendarDate(event.endDate);
  const uid = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}@sonacove.com`;
  
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sonacove//Meeting Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatCalendarDate(new Date())}`,
    `DTSTART:${startDate}`,
    `DTEND:${endDate}`,
    `SUMMARY:${escapeICS(event.title)}`,
    `DESCRIPTION:${escapeICS(event.description)}`,
    `LOCATION:${escapeICS(event.location)}`,
  ];

  // Add attendees
  if (event.guests && event.guests.length > 0) {
    event.guests.forEach(guest => {
      ics.push(`ATTENDEE;RSVP=TRUE;CN=${escapeICS(guest)}:mailto:${guest}`);
    });
  }

  ics.push(
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR'
  );

  return ics.join('\r\n');
}

/**
 * Downloads an ICS file
 */
export function downloadICSFile(event: CalendarEvent, filename?: string): void {
  const icsContent = generateICSFile(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `${event.title.replace(/[^a-z0-9]/gi, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

