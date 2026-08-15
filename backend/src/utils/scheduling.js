export function timeToMinutes(time) {
  const [hours, minutes] = String(time).slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function dayOfWeek(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function hospitalNow(timeZone, instant = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const value = (type) => parts.find((part) => part.type === type).value;
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minutes: Number(value("hour")) * 60 + Number(value("minute")),
  };
}

function overlaps(start, end, otherStart, otherEnd) {
  return start < otherEnd && end > otherStart;
}

export function calculateAvailableSlots({
  date,
  durationMinutes,
  operatingPeriods,
  blockedPeriods,
  appointments,
  now,
}) {
  if (date < now.date) return [];
  const blocked = blockedPeriods.map((period) => period.startsAt === null
    ? null
    : [timeToMinutes(period.startsAt), timeToMinutes(period.endsAt)]);
  if (blocked.some((period) => period === null)) return [];
  const booked = appointments.map((appointment) => {
    const start = timeToMinutes(appointment.appointmentTime);
    return [start, start + appointment.durationMinutes];
  });
  const slots = new Set();

  for (const period of operatingPeriods) {
    const opensAt = timeToMinutes(period.opensAt);
    const parsedClose = timeToMinutes(period.closesAt);
    const closesAt = opensAt === 0 && parsedClose === 0 ? 24 * 60 : parsedClose;
    for (let start = opensAt; start + durationMinutes <= closesAt; start += durationMinutes) {
      const end = start + durationMinutes;
      if (date === now.date && start <= now.minutes) continue;
      if (blocked.some(([blockedStart, blockedEnd]) => overlaps(start, end, blockedStart, blockedEnd))) continue;
      if (booked.some(([bookedStart, bookedEnd]) => overlaps(start, end, bookedStart, bookedEnd))) continue;
      slots.add(minutesToTime(start));
    }
  }

  return [...slots].sort();
}
