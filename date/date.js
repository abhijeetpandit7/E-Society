const date = new Date();
const today = date.toLocaleString().split(',')[0];
const month = date.toLocaleString("default", { month: "long" });
const year = today.split('/')[2];
exports.today = today
exports.month = month
exports.year = year
exports.dateString = `${today.split('/')[0]} ${month.slice(0,3)}  ${year.slice(2)}`

function monthDiff(dateFrom, dateTo) {
    return dateTo.getMonth() - dateFrom.getMonth() + 
    (12 * (dateTo.getFullYear() - dateFrom.getFullYear()))
}
exports.monthDiff = monthDiff