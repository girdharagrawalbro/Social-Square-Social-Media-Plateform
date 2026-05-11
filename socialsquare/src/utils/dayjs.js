import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import relativeTime from "dayjs/plugin/relativeTime.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

export default dayjs;
