const express = require("express");
const app = express();

const usersRoutes = require("./user-routes");
const botRoutes = require("./bot-routes");
const chatHistoryRoutes = require("./chatHistory-routes");
const keyRoutes = require("./key-routes");
const dataExtractor = require("./data-extractor");
const chatmessageRoute = require("./chat-router");
const paymentRoute = require("./payment-routes");
const scrapperRoute = require("./scrapper-routes");

const sendEmailRoutes = require("./sendEmail-route");
const bubbleSettingRoute = require("./bubble-setting-route");

// const apiRequests = {};

// router.post("/cancel", (req, res) => {
//   const requestId = "123123456456";

//   if (apiRequests.hasOwnProperty(requestId)) {
//     apiRequests[requestId].cancellationToken.cancel();
//     res.send("Request cancelled successfully.");
//   } else {
//     res.status(404).send("Request not found.");
//   }
// });

app.use("/users", usersRoutes);
app.use("/scrap", scrapperRoute);
app.use("/bots", botRoutes);
app.use("/key", keyRoutes);
app.use("/history", chatHistoryRoutes);
app.use("/extract", dataExtractor);
app.use("/chat", chatmessageRoute);
app.use("/pay", paymentRoute);
app.use("/mail", sendEmailRoutes);
app.use("/bubble-settig", bubbleSettingRoute);

module.exports = app;
