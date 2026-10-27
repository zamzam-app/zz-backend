/**
 * India Standard Time helpers. The app follows IST only, and India has no
 * daylight saving, so IST is always UTC+05:30.
 */

export const IST_TIME_ZONE = 'Asia/Kolkata';

const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;
const DAY_MS = 24 * 60 * 60_000;

export interface IstDateParts {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
  /** 0 (Sunday) - 6 (Saturday) */
  weekday: number;
}

/** The calendar date, in IST, that the given instant falls on. */
export function getIstDateParts(date: Date): IstDateParts {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}

/** The instant at which the IST day containing `date` starts (00:00 IST). */
export function getIstDayStart(date: Date): Date {
  const { year, month, day } = getIstDateParts(date);
  return new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS);
}

/** The last millisecond of the IST day containing `date`. */
export function getIstDayEnd(date: Date): Date {
  return new Date(getIstDayStart(date).getTime() + DAY_MS - 1);
}

/** Whether the IST day containing `date` is the last day of its month. */
export function isIstLastDayOfMonth(date: Date): boolean {
  const { year, month, day } = getIstDateParts(date);
  return day === new Date(Date.UTC(year, month, 0)).getUTCDate();
}
