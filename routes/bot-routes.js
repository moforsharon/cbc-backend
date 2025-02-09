var express = require("express");
const router = express.Router();
const { botController, linkToFileController } = require("../controllers");
const bodyParser = require("body-parser");
const { response } = require("../response");
router.use(bodyParser.json());
const { createCancellationToken } = require("../libs/cancelation-token");

const apiRequests = {};

router.get("/get", async function (req, res) {
  await botController.getBots(req, res);
});

router.get("/chatbot-count", async function (req, res) {
  await botController.chatbotCount(req, res);
});

router.post("/cancel", (req, res) => {
  const requestId = "123123456456";

  if (apiRequests.hasOwnProperty(requestId)) {
    apiRequests[requestId].cancellationToken.cancel();
    res.send("Request cancelled successfully.");
  } else {
    res.status(404).send("Request not found.");
  }
});

router.post("/", async function (req, res) {
  // const requestId = "12312345645678";

  // const cancellationToken = createCancellationToken();
  // apiRequests[requestId] = { req, res, cancellationToken };
  // try {
  await botController.create(req, res);
  // } catch (error) {
  //   console.log("Processing error:", error);
  // }
  // delete apiRequests[requestId];
});

router.put("/", async function (req, res) {
  const requestId = "12312345645678910";

  const cancellationToken = createCancellationToken();
  apiRequests[requestId] = { req, res, cancellationToken };
  try {
    await botController.update(req, res);
  } catch (error) {
    console.log("Processing error:", error);
  }
  delete apiRequests[requestId];
});

router.put("/delete", async function (req, res) {
  await botController.deleteBot(req, res);
});

router.post("/get-bot-source", async function (req, res) {
  botController.getBotSource(req, res);
});

router.post("/get-bot-data", async function (req, res) {
  botController.getBotData(req, res);
});

router.post("/youtube-to-file", async function (req, res) {
  const requestId = "123123456456";

  const cancellationToken = createCancellationToken();
  apiRequests[requestId] = { req, res, cancellationToken };
  try {
    await linkToFileController.insertYoutubeLink(req, res, cancellationToken);
  } catch (error) {
    console.log("Processing error:", error);
  }
  delete apiRequests[requestId];
});

router.put("/setting-leads", async function (req, res) {
  await botController.leadsSetting(req, res);
});

router.put("/setting-general", async function (req, res) {
  await botController.generalSetting(req, res);
});

router.put("/setting-openai", async function (req, res) {
  await botController.openAISetting(req, res);
});

router.put("/setting-access", async function (req, res) {
  await botController.accessSetting(req, res);
});

router.put("/setting-interface", async function (req, res) {
  await botController.interfaceSetting(req, res);
});

router.post("/get-bot-Setting", async function (req, res) {
  await botController.getBotSetting(req, res);
});
router.post("/get-bubble-Setting", async function (req, res) {
  await botController.getBubbleSetting(req, res);
});

router.post("/set-bot-leadData", async function (req, res) {
  await botController.setLeadData(req, res);
});

router.post("/get-bot-leadData", async function (req, res) {
  await botController.getLeadData(req, res);
});

router.post("/text-to-audio", async function (req, res) {
  await botController.textToAudio(req, res);
});

router.post("/assign-language", async function (req, res) {
  await botController.assign_language(req, res);
});
router.post("/assign-language-update", async function (req, res) {
  await botController.assign_language_update(req, res);
});
router.post("/assign-language-delete", async function (req, res) {
  await botController.assign_language_delete(req, res);
});

router.post("/assign-language-source", async function (req, res) {
  await botController.assign_language_source(req, res);
});
router.post("/assign-language-source-update", async function (req, res) {
  await botController.assign_language_source_Update(req, res);
});

module.exports = router;
