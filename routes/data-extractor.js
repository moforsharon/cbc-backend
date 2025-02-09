require("dotenv").config();
var express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
router.use(bodyParser.json());

const { extractText } = require("../libs/extractText");

// insert data
router.post("/", async function (req, res) {
  console.log({ callls: "hayy" });
  await extractText(req, res);
});

module.exports = router;
