import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export const parseDateDDMMYYYY = (input: string): Date | null => {
  const cleaned = input.trim();
  const parsed = dayjs(cleaned, "DD.MM.YYYY", true);
  return parsed.isValid() ? parsed.toDate() : null;
};

export const parseWeight = (input: string): number | null => {
  const normalized = input.replace(",", ".").replace(/[^\d.]/g, "").trim();
  const value = Number(normalized);
  if (Number.isNaN(value) || value <= 0 || value > 25) {
    return null;
  }
  return value;
};

export const parseTimeHHMM = (input: string): number | null => {
  const match = input.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

export const formatMinutesToHHMM = (minutesOfDay: number): string => {
  const hours = Math.floor(minutesOfDay / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (minutesOfDay % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};

export const getDayRangeByTimezone = (timezoneName: string, date = new Date()) => {
  const zoned = dayjs(date).tz(timezoneName);
  return {
    start: zoned.startOf("day").utc().toDate(),
    end: zoned.endOf("day").utc().toDate(),
  };
};

export const getWeekRangeByTimezone = (timezoneName: string, date = new Date()) => {
  const zoned = dayjs(date).tz(timezoneName);
  return {
    start: zoned.startOf("week").utc().toDate(),
    end: zoned.endOf("week").utc().toDate(),
  };
};

export const getLocalNow = (timezoneName: string, date = new Date()) => dayjs(date).tz(timezoneName);

export const getCurrentMinutesByTimezone = (timezoneName: string, date = new Date()) => {
  const zoned = getLocalNow(timezoneName, date);
  return zoned.hour() * 60 + zoned.minute();
};
