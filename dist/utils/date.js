"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentMinutesByTimezone = exports.getLocalNow = exports.getWeekRangeByTimezone = exports.getDayRangeByTimezone = exports.formatMinutesToHHMM = exports.parseTimeHHMM = exports.parseWeight = exports.parseDateDDMMYYYY = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
const timezone_1 = __importDefault(require("dayjs/plugin/timezone"));
const customParseFormat_1 = __importDefault(require("dayjs/plugin/customParseFormat"));
dayjs_1.default.extend(utc_1.default);
dayjs_1.default.extend(timezone_1.default);
dayjs_1.default.extend(customParseFormat_1.default);
const parseDateDDMMYYYY = (input) => {
    const cleaned = input.trim();
    const parsed = (0, dayjs_1.default)(cleaned, "DD.MM.YYYY", true);
    return parsed.isValid() ? parsed.toDate() : null;
};
exports.parseDateDDMMYYYY = parseDateDDMMYYYY;
const parseWeight = (input) => {
    const normalized = input.replace(",", ".").replace(/[^\d.]/g, "").trim();
    const value = Number(normalized);
    if (Number.isNaN(value) || value <= 0 || value > 25) {
        return null;
    }
    return value;
};
exports.parseWeight = parseWeight;
const parseTimeHHMM = (input) => {
    const match = input.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match)
        return null;
    return Number(match[1]) * 60 + Number(match[2]);
};
exports.parseTimeHHMM = parseTimeHHMM;
const formatMinutesToHHMM = (minutesOfDay) => {
    const hours = Math.floor(minutesOfDay / 60)
        .toString()
        .padStart(2, "0");
    const minutes = (minutesOfDay % 60).toString().padStart(2, "0");
    return `${hours}:${minutes}`;
};
exports.formatMinutesToHHMM = formatMinutesToHHMM;
const getDayRangeByTimezone = (timezoneName, date = new Date()) => {
    const zoned = (0, dayjs_1.default)(date).tz(timezoneName);
    return {
        start: zoned.startOf("day").utc().toDate(),
        end: zoned.endOf("day").utc().toDate(),
    };
};
exports.getDayRangeByTimezone = getDayRangeByTimezone;
const getWeekRangeByTimezone = (timezoneName, date = new Date()) => {
    const zoned = (0, dayjs_1.default)(date).tz(timezoneName);
    return {
        start: zoned.startOf("week").utc().toDate(),
        end: zoned.endOf("week").utc().toDate(),
    };
};
exports.getWeekRangeByTimezone = getWeekRangeByTimezone;
const getLocalNow = (timezoneName, date = new Date()) => (0, dayjs_1.default)(date).tz(timezoneName);
exports.getLocalNow = getLocalNow;
const getCurrentMinutesByTimezone = (timezoneName, date = new Date()) => {
    const zoned = (0, exports.getLocalNow)(timezoneName, date);
    return zoned.hour() * 60 + zoned.minute();
};
exports.getCurrentMinutesByTimezone = getCurrentMinutesByTimezone;
