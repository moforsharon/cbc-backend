var express = require("express");
const router = express.Router();
const { userController } = require("../controllers");
const bodyParser = require("body-parser");
router.use(bodyParser.json());
// get data
router.get("/", async (req, res) => {
  userController.get(req, res);
});

// insert data
router.post("/", async function (req, res) {
  userController.signup(req, res);
});


// specific data
router.post("/login", async function (req, res) {
  console.log("request", req.body);
  userController.login(req, res);
});

router.post("/google", async function (req, res) {
  userController.google(req, res);
});

router.post("/logindetails", async function (req, res) {
  console.log("login detail runs");
  userController.logindetails(req, res);
});


router.post("/verify", async function (req, res) {
  console.log('verify runs');
  userController.verify(req, res);
});

router.post("/resendemail", async function (req, res) {
  console.log('resend email runs');
  userController.reSendEmail(req, res);
});

router.get("/accountdetails", async function (req, res) {
  console.log('account details hit');
  userController.accountDetails(req, res);
});



module.exports = router;
