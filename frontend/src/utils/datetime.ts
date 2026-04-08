const TZ = "America/Chicago";

/** Returns current date-time in CST as YYYY-MM-DDTHH:MM for datetime-local inputs */
export function nowCST(): string {
  return new Date()
    .toLocaleString("sv-SE", { timeZone: TZ, hour12: false })
    .replace(" ", "T")
    .slice(0, 16);
}

/** Formats an ISO string to YYYY-MM-DDTHH:MM in CST for datetime-local inputs */
export function toLocalInput(iso: string): string {
  if (!iso) return "";
  return new Date(iso)
    .toLocaleString("sv-SE", { timeZone: TZ, hour12: false })
    .replace(" ", "T")
    .slice(0, 16);
}

/** Converts a datetime-local value (assumed CST) to an ISO string */
export function cstToISO(localValue: string): string {
  if (!localValue) return "";
  // Build a Date interpreting the value as America/Chicago
  // datetime-local gives "YYYY-MM-DDTHH:MM"
  // We append the CST offset by creating a formatter to find the current offset
  const parts = localValue.split("T");
  if (parts.length !== 2) return new Date(localValue).toISOString();

  const [datePart, timePart] = parts;
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  // Create a date in UTC, then adjust by CST offset
  // Use Intl to find the actual offset for that date (handles DST)
  const rough = new Date(year, month - 1, day, hour, minute);
  const utcStr = rough.toLocaleString("en-US", { timeZone: "UTC" });
  const cstStr = rough.toLocaleString("en-US", { timeZone: TZ });
  const utcDate = new Date(utcStr);
  const cstDate = new Date(cstStr);
  const offsetMs = utcDate.getTime() - cstDate.getTime();

  return new Date(rough.getTime() + offsetMs).toISOString();
}

/** Formats an ISO string for display in CST (e.g. "Mar 28, 2:30 PM") */
export function formatCST(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Today's date in CST as YYYY-MM-DD */
export function todayCST(): string {
  return nowCST().slice(0, 10);
}
