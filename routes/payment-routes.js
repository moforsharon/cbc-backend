var express = require("express");
const router = express.Router();


const { paymentController } = require("../controllers");


const bodyParser = require("body-parser");
router.use(bodyParser.json());



router.get("/pricing", async function (req, res) {
    console.log("getpricing runs");
    paymentController.getPricing(req, res);
});


router.post("/payment-success", async function (req, res) {
    console.log("payment success calls");
    paymentController.paymentSuccess(req, res);
});


router.post("/webhook", async function (req, res) {
    console.log("payment success calls");
    paymentController.webhook(req, res);
});


router.post("/create-customer-portal-session", async function (req, res) {
    console.log("create-customer-portal-session");
    paymentController.createCustomerPortalSession(req, res);
});


router.post("/create-checkout-session", async function (req, res) {
    console.log("create-checkout-session calls");
    paymentController.createCheckoutSession(req, res);
});





module.exports = router;
