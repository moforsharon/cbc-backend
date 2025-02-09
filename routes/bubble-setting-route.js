var express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const { response } = require("../response");
router.use(bodyParser.json());
const { RunQuery } = require("../services");

router.post("/", async function (req, res) {
  try {
    const { chatbot_id } = req?.body;

    var query = `select 
        chat_icon,remove_chat_icon,
        chat_bubble_button_color,
        align_chat_bubble_button
        from chatbot where chatbot_id = ?`;

    const values = [chatbot_id];
    const result = await RunQuery(query, values);

    res.status(200).json(response(result, null, ""));
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
});

module.exports = router;
