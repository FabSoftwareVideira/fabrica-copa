function formatDateParts(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).formatToParts(date);

    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
        date: `${map.year}-${map.month}-${map.day}`,
        dateTime: `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`,
    };
}

function createDateTimeUtils(timeZone) {
    function todayStr() {
        return formatDateParts(new Date(), timeZone).date;
    }

    function addDaysISO(days) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.toISOString();
    }

    function nowSqlTimestamp() {
        return formatDateParts(new Date(), timeZone).dateTime;
    }

    return {
        todayStr,
        addDaysISO,
        nowSqlTimestamp,
    };
}

module.exports = {
    formatDateParts,
    createDateTimeUtils,
};
