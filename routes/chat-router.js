var express = require("express");
const router = express.Router();
const { chatmessageController } = require("../controllers");
const bodyParser = require("body-parser");
const { response } = require("../response");
router.use(bodyParser.json());
const { createCancellationToken } = require("../libs/cancelation-token");

router.post("/", async function (req, res) {
  const requestId = "12312345645678";
  console.log("calls chat");
  // const cancellationToken = createCancellationToken();
  // apiRequests[requestId] = { req, res, cancellationToken };
  try {
    await chatmessageController.chat(req, res);
  } catch (error) {
    console.log("Processing error:", error);
  }
  // delete apiRequests[requestId];
});

module.exports = router;
