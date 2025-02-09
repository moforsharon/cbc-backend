var express = require("express");
const router = express.Router();
const { chatHistoryController } = require("../controllers");
const bodyParser = require("body-parser");
router.use(bodyParser.json());
// get data
router.post("/get", async (req, res) => {
  chatHistoryController.get(req, res);
});
router.post("/get-conversation-history", async (req, res) => {
  chatHistoryController.getConversationHistory(req, res);
});

// insert data
router.post("/", async function (req, res) {
  chatHistoryController.insert(req, res);
});
router.post("/single", async function (req, res) {
  chatHistoryController.single(req, res);
});

router.post("/get-conversations", async function (req, res) {
  chatHistoryController.getConversationIds(req, res);
});

// update data
router.put("/", async function (req, res) {
  chatHistoryController.update(req, res);
});

//delete data
router.put("/delete", async function (req, res) {
  chatHistoryController.remove(req, res);
});

router.put("/like-dislike", async function (req, res) {
  chatHistoryController.likeDislike(req, res);
});

router.post("/get-review", async function (req, res) {
  chatHistoryController.getReview(req, res);
});

router.put("/update-review-bulk", async function (req, res) {
  chatHistoryController.updatebulkReview(req, res);
});

// insert data
router.post("/generate-chat-summary", async function (req, res) {
  chatHistoryController.generateChatSummary(req, res);
});

// insert data
router.post("/get-user-chat-summaries", async function (req, res) {
  chatHistoryController.getAllChatSummaries(req, res);
});
//archive chat
router.post("/archive_chat", async function (req, res) {
  chatHistoryController.archiveChatSummary(req, res);
});

//get archive chats
router.post("/get_archive_chats", async function (req, res) {
  chatHistoryController.getArchivedChatSummaries(req, res);
});

//get active chats 
router.post("/active_chats", async function (req, res) {
  chatHistoryController.getActiveChatSummaries(req, res);
});

//unarchive

router.post("/unarchive_chat", async function (req, res) {
  chatHistoryController.unarchiveChatSummary(req, res);
});
module.exports = router;
