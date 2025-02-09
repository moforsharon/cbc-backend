const winston = require("winston");

module.exports = function (err, req, res, next) {
  try {
    winston.error(err);

    res.status(500).json({
      error: "Internal Server Error",
    });
  } catch (error) {
    winston.error("Error handling middleware encountered an error:", error);
    res.status(500).json({
      error: "Internal Server Error",
    });
  }
};
