export type EventStatus =
  | 'scheduled'
  | 'postponed'
  | 'rescheduled'
  | 'cancelled'
  | 'completed';

export type AttendanceMode = 'physical' | 'virtual' | 'hybrid';

export type PhysicalVenueStatus = 'confirmed' | 'tentative' | 'to_be_announced';

export type RegistrationStatus =
  | 'not_yet_open'
  | 'open'
  | 'closed'
  | 'waitlist'
  | 'unknown';

export type TicketAvailability =
  | 'available'
  | 'limited'
  | 'sold_out'
  | 'unavailable'
  | 'unknown';

export interface Party {
  name: string;
  id?: string;
  url?: string;
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface Address {
  street?: string;
  locality?: string;
  region?: string;
  postal_code?: string;
  country?: string;
  [key: string]: unknown;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
  [key: string]: unknown;
}

export interface PhysicalLocation {
  status?: PhysicalVenueStatus;
  name?: string;
  id?: string;
  url?: string;
  address?: Address;
  coordinates?: Coordinates;
  instructions?: string;
  [key: string]: unknown;
}

export interface VirtualLocation {
  url: string;
  platform?: string;
  instructions?: string;
  [key: string]: unknown;
}

export interface EventLocation {
  type: AttendanceMode;
  physical?: PhysicalLocation;
  virtual?: VirtualLocation;
  [key: string]: unknown;
}

export interface Registration {
  required: boolean;
  url?: string;
  status?: RegistrationStatus;
  opens_at?: string;
  closes_at?: string;
  instructions?: string;
  [key: string]: unknown;
}

export interface Price {
  amount: string;
  currency: string;
  [key: string]: unknown;
}

export interface Ticket {
  id: string;
  name: string;
  description?: string;
  url?: string;
  seller?: Party;
  price?: Price;
  availability?: TicketAvailability;
  sales_start?: string;
  sales_end?: string;
  [key: string]: unknown;
}

export interface EventImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

export interface Series {
  id: string;
  title?: string;
  url?: string;
  [key: string]: unknown;
}

export interface OpenAjangEvent {
  $schema: string;
  type: 'event';
  id?: string;
  url: string;
  title: string;
  summary?: string;
  description?: string;
  language?: string;
  status: EventStatus;
  status_note?: string;
  starts_at: string;
  ends_at?: string;
  time_zone?: string;
  previous_starts_at?: string[];
  location: EventLocation;
  organizer: Party;
  publisher?: Party;
  registration?: Registration;
  tickets?: Ticket[];
  image?: EventImage;
  tags?: string[];
  series?: Series;
  same_as?: string[];
  updated_at: string;
  extensions?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ActionDescriptor {
  label: 'Register' | 'Join waitlist' | 'View registration';
  url: string;
}

export interface Diagnostic {
  code: string;
  path: string;
  message: string;
  params?: Record<string, unknown>;
}

export interface ValidationResult<T = OpenAjangEvent> {
  valid: boolean;
  event?: T;
  errors: Diagnostic[];
}
