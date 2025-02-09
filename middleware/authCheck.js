const jwt = require("jsonwebtoken");
const config = require("config");
const { frontendVersion } = require("../global/version");
const { response } = require("../response");

module.exports = async function VersionCheck(req, res, next) {
  try {
    console.log("CALLS VersionCheck", req.headers["frontendversion"]);
    console.log("CALLS VersionChecssk", frontendVersion);

    const frontendVersionClientSide = req.headers["frontendversion"];

    if (frontendVersion === frontendVersionClientSide) {
      next();
    } else {
      const err = {
        frontendversion: frontendVersion !== frontendVersionClientSide,
      };
      console.log("err", err);

      res.status(400).json(response(null, err));
    }
  } catch (err) {
    res.status(500).send("SOMETHING WENT WRONG!");
  }
};
