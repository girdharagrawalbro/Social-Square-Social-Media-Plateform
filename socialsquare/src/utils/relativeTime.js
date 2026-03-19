import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import relativeTime from "dayjs/plugin/relativeTime.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

export default (dateVal) => {
  if (!dateVal) return "";
  const d = dayjs(dateVal);
  if (!d.isValid()) return "";
  return d.fromNow();
};

export const timeAgo = (dateVal) => {
  if (!dateVal) return "";
  const d = dayjs(dateVal);
  if (!d.isValid()) return "";
  return d.fromNow();
};

