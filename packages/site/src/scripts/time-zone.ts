// Resolve local wall time against the zone, including gaps and repeated times.
export function candidates(
  date: string,
  time: string,
  timeZone: string,
): { value: string; offset: string }[] {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second = 0] = time.split(':').map(Number);
  const local = Date.UTC(year, month - 1, day, hour, minute, second);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const offsets = new Set<number>();
  for (let delta = -48; delta <= 48; delta += 6) {
    const instant = local + delta * 3600000;
    const parts = Object.fromEntries(fmt.formatToParts(instant).map((p) => [p.type, p.value]));
    offsets.add(
      Math.round(
        (Date.UTC(
          +parts.year,
          +parts.month - 1,
          +parts.day,
          +parts.hour,
          +parts.minute,
          +parts.second,
        ) -
          instant) /
          60000,
      ),
    );
  }
  return [...offsets]
    .flatMap((offset) => {
      const instant = local - offset * 60000;
      const p = Object.fromEntries(fmt.formatToParts(instant).map((v) => [v.type, v.value]));
      if (
        +p.year !== year ||
        +p.month !== month ||
        +p.day !== day ||
        +p.hour !== hour ||
        +p.minute !== minute ||
        +p.second !== second
      )
        return [];
      const sign = offset < 0 ? '-' : '+';
      const abs = Math.abs(offset);
      const label = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
      return [
        {
          offset: label,
          value: `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}${label}`,
        },
      ];
    })
    .sort((a, b) => a.value.localeCompare(b.value));
}
