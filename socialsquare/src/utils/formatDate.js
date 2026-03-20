import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import relativeTime from "dayjs/plugin/relativeTime.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

const formatDate = (dateVal) => {
  if (!dateVal) return "";

  const d = dayjs(dateVal);
  if (!d.isValid()) return "";

  const now = dayjs();

  // if more than 1 day old → show formatted date
  if (now.diff(d, "day") >= 1) {
    return d.format("DD MMM YYYY"); // 23 Feb 2026
  }

  // otherwise → show relative time
  return d.fromNow();
};

export default formatDate;
export const timeAgo = formatDate;