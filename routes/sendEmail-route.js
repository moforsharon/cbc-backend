var express = require("express");
const router = express.Router();
const { mailer } = require("../global/mailer");
const bodyParser = require("body-parser");
router.use(bodyParser.json());

// insert data
router.post("/", async function (req, res) {
  await mailer(req, res);
});

module.exports = router;
