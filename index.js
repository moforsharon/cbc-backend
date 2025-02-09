require("express-async-errors");
const winston = require("winston");
const express = require("express");
// const cors = require('cors');
const app = express();
const config = require("config");
const err = require("./middleware/err");
const routhandler = require("./routes");
const bodyParser = require("body-parser");
const childRoutes = require('./routes/child-routes'); 
const professionalRoutes = require('./routes/professionalRoutes');
global.__basedir = __dirname;

const PORT = 30007;

// Allow CORS for specific origin
// const allowedOrigins = ['https://childbehaviorcheck.com'];

const fileTransport = new winston.transports.File({
  filename: "error.log",
  level: "error",
});

const consoleTransport = new winston.transports.Console();
const uncaughtExceptionTransport = new winston.transports.File({
  filename: "uncaughtException.log",
});
const logFileTransport = new winston.transports.File({
  filename: "logfile.log",
});
// Add mysqlTransport if needed

const logger = winston.createLogger({
  transports: [
    consoleTransport,
    fileTransport,
    uncaughtExceptionTransport,
    logFileTransport,
  ],
});

app
  .listen(PORT, () => console.log(`express is running on ${PORT}`))
  .on("error", function (err) {
    console.log(err);
  });

// Unhandled exceptions and rejections
process.on("uncaughtException", (error) => {
  logger.error(error.message, error);
  process.exit(1);
});

winston.exceptions.handle([
  new winston.transports.Console(),
  new winston.transports.File({ filename: "uncaughtException.log" }),
]);

if (!config.get("jwtPrivateKey")) {
  logger.error("FATAL ERROR: jwtPrivateKey is not defined.");
  process.exit(1);
}

/* Route middlewares */
const allowedOrigins = [
  "http://localhost:3001",
  "http://localhost:3000",
  "http://localhost:3002",
  "http://127.0.0.1:3000",
  "http://localhost:30008",
  "http://127.0.0.1:5501",
  "https://www.base.cx",
  "http://127.0.0.1:5500",
  "http://localhost:19006/",
  "http://localhost:19007/",
  "https://childbehaviorcheck.com"
];

/* Cors Setup */
const cors = require("cors");
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.options("*", cors());


app.use(
  express.json({
    limit: "5mb",
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);





// app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use("/back", routhandler);
app.use(err);
app.use("/api", childRoutes);
app.use('/api/professionals', professionalRoutes);
