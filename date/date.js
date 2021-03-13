const date = new Date();
const today = date.getDate()+'/'+(date.getMonth()+1)+'/'+date.getFullYear();
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