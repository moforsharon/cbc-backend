var express = require("express");
const router = express.Router();
const { keyController } = require("../controllers");
const bodyParser = require("body-parser");
router.use(bodyParser.json());

// insert data
router.post("/", async function (req, res) {
  keyController.updateKey(req, res);
});

router.put("/", async function (req, res) {
  keyController.setStatus(req, res);
});
router.post("/set-key", async function (req, res) {
  keyController.setKey(req, res);
});
router.put("/set-type", async function (req, res) {
  keyController.setType(req, res);
});
router.delete("/", async function (req, res) {
  keyController.remove(req, res);
});

router.put("/check-status", async function (req, res) {
  keyController.checkStatus(req, res);
});

module.exports = router;
