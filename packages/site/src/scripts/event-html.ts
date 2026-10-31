type RecordObject = Record<string, any>;
export function escape(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
function link(value: unknown, label: string): string {
  const url = safeUrl(value);
  return url ? `<a href="${escape(url)}" rel="noopener noreferrer">${escape(label)}</a>` : '';
}
export function render(event: RecordObject, showImage = true): string {
  const imageUrl = showImage ? safeUrl(event.image?.url) : null;
  const image = imageUrl
    ? `<img class="event-image" src="${escape(imageUrl)}" alt="${escape(event.image?.alt || '')}" referrerpolicy="no-referrer" loading="lazy">`
    : '';
  const ticketText =
    Array.isArray(event.tickets) && event.tickets.length
      ? `<h2>Tickets</h2><ul>${event.tickets.map((ticket: RecordObject) => `<li>${escape(ticket.name || 'Ticket')}${ticket.price ? `: ${escape(ticket.price.amount)} ${escape(ticket.price.currency)}` : ''}${ticket.availability ? ` · ${escape(String(ticket.availability).replaceAll('_', ' '))}` : ''}${link(ticket.url, 'Ticket details') ? ` · ${link(ticket.url, 'Ticket details')}` : ''}${ticket.description ? `<p style="white-space:pre-wrap">${escape(ticket.description)}</p>` : ''}</li>`).join('')}</ul>`
      : '';
  const location = event.location || {};
  const physical = location.physical || {};
  const virtual = location.virtual || {};
  const registration = event.registration;
  const venue = [
    physical.name,
    physical.address?.street,
    physical.address?.locality,
    physical.address?.region,
    physical.address?.postal_code,
    physical.address?.country,
  ]
    .filter(Boolean)
    .map(escape)
    .join(', ');
  const venueStatus =
    physical.status === 'tentative'
      ? ' (tentative)'
      : physical.status === 'to_be_announced' && venue
        ? ' (to be announced)'
        : '';
  const where = [
    location.type !== 'virtual' ? `${venue || 'Venue to be announced'}${venueStatus}` : '',
    location.type !== 'physical'
      ? link(virtual.url, virtual.platform || 'Online event') || 'Online details to be announced'
      : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const date = event.starts_at
    ? escape(event.starts_at) +
      (event.ends_at ? ` to ${escape(event.ends_at)}` : '') +
      (/^\d{4}-\d\d-\d\d$/.test(event.starts_at) ? ' (time not specified)' : '')
    : 'Date to be announced';
  const reg = registration
    ? `${registration.required === true ? 'Registration required' : registration.required === false ? 'Registration not required' : 'Registration details'}${registration.status ? ` · ${escape(String(registration.status).replaceAll('_', ' '))}` : ''}${registration.instructions ? `<br>${escape(registration.instructions)}` : ''}${link(registration.url, 'Registration details') ? `<br>${link(registration.url, 'Registration details')}` : ''}`
    : 'Registration details not specified';
  return `${image}<h1>${escape(event.title || 'Untitled event')}</h1>${event.summary ? `<p>${escape(event.summary)}</p>` : ''}${event.description ? `<p style="white-space:pre-wrap">${escape(event.description)}</p>` : ''}<p><strong>Status:</strong> ${escape(event.status || 'Not specified')}${event.status_note ? `: ${escape(event.status_note)}` : ''}</p><p><strong>When:</strong> ${date}${event.time_zone ? ` · ${escape(event.time_zone)}` : ''}</p><p><strong>Where:</strong> ${where || 'Location to be announced'}</p><p><strong>Organizer:</strong> ${escape(event.organizer?.name || 'Not specified')}</p><p><strong>Registration:</strong> ${reg}</p>${physical.instructions && location.type !== 'virtual' ? `<p>${escape(physical.instructions)}</p>` : ''}${virtual.instructions && location.type !== 'physical' ? `<p>${escape(virtual.instructions)}</p>` : ''}${ticketText}${link(event.url, 'Event website') ? `<p>${link(event.url, 'Event website')}</p>` : ''}`;
}
