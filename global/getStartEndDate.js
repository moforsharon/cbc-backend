const { fetchData } = require("../libs/fetchData");
const { RunQuery } = require("../services");

function calculateRemainingValues(value, newDate) {
  var dayOfMonth = newDate.getDate();
  var remainingDays;
  var endMonth;
  var endDate;
  var startDate;

  if (dayOfMonth > value) {
    var lastDateOfMonth = new Date(
      newDate.getFullYear(),
      newDate.getMonth() + 1,
      0
    ).getDate();
    remainingDays = lastDateOfMonth - dayOfMonth + value;
    endMonth = newDate.getMonth() + 2;
    endDate = `${newDate.getFullYear()}-${formatMonth(
      newDate.getMonth() + 2
    )}-${formatDay(value)}`;
    startDate = `${newDate.getFullYear()}-${formatMonth(
      newDate.getMonth() + 1
    )}-${formatDay(value)}`;
    // if (endMonth > 12) {
    //   endMonth = 1;
    // }
  } else {
    endDate = `${newDate.getFullYear()}-${formatMonth(
      newDate.getMonth() + 1
    )}-${formatDay(value)}`;
    startDate = `${newDate.getFullYear()}-${formatMonth(
      newDate.getMonth()
    )}-${formatDay(value)}`;
    remainingDays = value - dayOfMonth;
    endMonth = newDate.getMonth() + 1;
  }

  return { endMonth, remainingDays, endDate, startDate };
}
function formatDay(day) {
  return day < 10 ? "0" + day : day;
}

function formatMonth(month) {
  return month < 10 ? "0" + month : month;
}
const getLastDate = async (email) => {
  let dateQuery = `select subscription_date from users where email = '${email}'`;
  const resultDate = await RunQuery(dateQuery);
  const subDate = fetchData(resultDate?.success);
  let startingDate = subDate?.subscription_date;
  const startDate = new Date(startingDate);
  const date = new Date();

  var endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  var day = endDate.getDate();

  let result = await calculateRemainingValues(day, date);
  return result;
};

module.exports = { getLastDate };
