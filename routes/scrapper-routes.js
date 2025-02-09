var express = require("express");
const router = express.Router();
const { scrapController } = require("../controllers");
const bodyParser = require("body-parser");
router.use(bodyParser.json());
// get data
router.post("/", async (req, res) => {
  scrapController.scrap(req, res);
});

module.exports = router;
