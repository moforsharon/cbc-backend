function fetchData(result) {
  var string = JSON.stringify(result);
  var json = JSON.parse(string);
  let value = json[0];
  return value;
}

module.exports = { fetchData };
