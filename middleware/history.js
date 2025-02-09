const { logHistoryService } = require("../services");

const _logHistoryService = new logHistoryService();

module.exports = async function logUserAction(req, res, next) {
  const excludedRoutes = ["/get"]; // Specify the excluded routes as an array of strings

  if (excludedRoutes.includes(req.path)) {
    // If the request path is in the excludedRoutes array, skip logging and pass control to the next middleware function
    return next();
  }

  const userId =
    req.path == "/api/users/login" ? req.body.user_name : req.headers["userid"];
  const actionType = req?.method;
  const actionData = req?.body?.type_back;
  const actionRoute = req?.path;
  const userNumber = req?.body?.user_number;
  const ticketNumber = req?.body?.ticket_number;
  const patientNumber = req?.body?.patient_number;
  const assignUser = req?.body?.user_id;

  // console.log("actionData", actionData);
  // console.log("req.body.type_back", req.body);

  var query = `INSERT INTO log_history (userId, actionType, actionData,actionRoute,userNumber,ticketNumber,patientNumber,assignUser) VALUES 
                ("${userId}","${actionType}","${actionData}","${actionRoute}","${userNumber}","${ticketNumber}","${patientNumber}","${assignUser}")`;
  const result = await _logHistoryService.get(query);
  if (!result) return res.status(500).send("HISTORY NOT SAVING");
  next();
};
