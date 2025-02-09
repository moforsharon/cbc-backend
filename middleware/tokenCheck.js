const jwt = require("jsonwebtoken");
const config = require("config");

module.exports =async function (req, res, next) {
  try {

    // const token =
    // req?.body?.token ||
    // req?.query?.token ||
    // req.headers["authorization"] ||
    // req?.cookie?.token;
    // // if (!token) return res.status(401).send(" ACCESS TOKEN REQUIRED");
    // // const decoded = jwt.verify(token, config.get("jwtPrivateKey"));
    // // req.user = decoded;
    // // next();
    // console.log("token", req.cookie);
    // if (token == undefined || token == "")
    //   return res.status(403).send("ACCESS TOKEN REQUIRED");
  
    // await jwt.verify(token, config.get("jwtPrivateKey"), async (err, decoded) => {
    //   if (err) return res.status(401).send({ message: "Unauthorized!" });

    //   next();
    // });
    console.log("tokenCheck");
  } catch (err) {
    console.log(err);
    res.status(401).send("INVALID TOKEN ERR");
  }
};