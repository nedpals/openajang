import { candidates } from './time-zone.ts';

export type TemporalState = { date: string; time: string; offset: string };
export type TemporalControl = 'date' | 'time' | 'offset' | 'zone';

/** Resolve an explicitly edited wall time; untouched imported values bypass this. */
export function resolveTemporal(state: TemporalState, zone: string, timestampOnly = false, required = false) {
  const { date, time, offset } = state;
  const failure = (message: string, control: TemporalControl) => ({ value: date, choices: [] as ReturnType<typeof candidates>, message, control });
  if (!date && (time || required)) return failure(time ? 'Choose a date for this time.' : 'Choose a date for this earlier start.', 'date');
  if (!date && !time) return { value: '', choices: [], message: '', control: 'date' as const };
  if (!time) return timestampOnly ? failure('Choose a time for this date.', 'time') : { value: date, choices: [], message: '', control: 'date' as const };
  if (!zone) return failure('Choose the event time zone before entering a time.', 'zone');
  try {
    const choices = candidates(date, time, zone);
    if (!choices.length) return failure('This local time does not exist in that time zone. Choose another time.', 'time');
    const choice = choices.length === 1 ? choices[0] : choices.find(choice => choice.offset === offset);
    if (!choice) return { value: date, choices, message: 'This time occurs twice due to a clock change. Choose an offset.', control: 'offset' as const };
    return { value: choice.value, choices, message: '', control: 'time' as const };
  } catch {
    return failure('Choose a valid IANA time zone, such as Asia/Manila.', 'zone');
  }
}
