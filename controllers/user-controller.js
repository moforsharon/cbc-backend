require("dotenv").config();
const { fetchData } = require("../libs/fetchData");
const jwt = require("jsonwebtoken");
const dateFns = require("date-fns");

const { getObjectId } = require("../libs/id");
const { loginType } = require("../global/fileName");
const { response } = require("../response");
const { RunQuery, RunTransactionQuery } = require("../services");
const config = require("config");

const { OAuth2Client } = require("google-auth-library");
const { newDate } = require("../libs/newDate");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const { format, addMonths, startOfMonth } = require("date-fns");
var nodemailer = require("nodemailer");

const uuid = require("uuid");
// const AWS = require('aws-sdk');

const {
  beginTransaction,
  rollbackTransaction,
  commitTransaction,
} = require("../connection");

async function get(req, res) {
  try {
    let {} = req.body;
    var query = `
    select * from users`;
    const result = await RunQuery(query);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function loginCommonSection(Udata, res, loginType, machine_id) {
  WebOrGoogle = loginType === "google" ? "web" : "google";

  if (Udata?.login_type === WebOrGoogle) {
    // if user is already signup from web and then signin from google then change the status of user in db
    var updateLoginTypeQuery = `UPDATE users SET login_type=?, verified=1 where user_id=? `;

    const updateLoginTypeValues = [loginType, Udata?.user_id];
    const updateLoginTypeResult = await RunQuery(
      updateLoginTypeQuery,
      updateLoginTypeValues
    );

    if (!updateLoginTypeResult?.success) {
      return res
        .status(500)
        .json(response(null, null, "Failed to insert login type in user"));
    }

    Udata.login_type = loginType;
    console.log("web case true", Udata);
  }

  console.log("user_data", Udata?.user_id);

  if (Udata && Udata?.password) {
    delete Udata.password; // Remove the "password" field from the object
  }

  if (Udata?.status === "inactive")
    return res.status(401).send("USER HAS BEEN INACTIVE!");

  if (!Udata?.email)
    return res
      .status(401)
      .json(response(null, null, "Invalid email or password"));

  if (Udata?.verified === "0") {
    return res.status(403).json(response(null, null));
  }

  const { user_id } = Udata;

  const userData = await getUserData(user_id, res);

  console.log({ userData });
  Udata.allowed_questions = userData.allowed_questions;
  Udata.question_usage = userData.question_usage;
  Udata.allowed_bots = userData.allowed_bots;
  Udata.bots_usage = userData.bots_usage;
  Udata.bot_characters = userData.bot_characters;
  Udata.weblinks = userData.weblinks;
  Udata.remove_logo = userData.remove_logo;
  Udata.gpt4 = userData.gpt4 === 1 ? true : false;

  //======================================================================
  //subscription details start

  let logsQuery = `update chat_logs set user_id = ? where machine_id = ?`;
  const logsValue = [user_id, machine_id];
  const logsRes = await RunQuery(logsQuery, logsValue);

  if (!logsRes?.success)
    return res.status(401).json(response(null, null, "unable to set logs"));

  let planQuery = `select  sb.subscription_id, pl.display_name, if(sb.duration = 'one_time', 'lifetime', sb.duration) as duration, sb.qty, sb.bot_qty, sb.msg_qty, sb.status, DATE_FORMAT(sb.cancel_at, '%b %e, %Y') AS cancel_at
from subscriptions sb 
    inner join plans pl on sb.plan_name = pl.plan_name 
    where sb.user_id= ? and (sb.status = 'active' or sb.status = 'past_due') order by 
    FIELD(sb.plan_name, 'free') DESC,
    FIELD(sb.plan_name, 'basicmonth') DESC,FIELD(sb.plan_name, 'basicyear') DESC,FIELD(sb.plan_name, 'basiclifetime') DESC,
    FIELD(sb.plan_name, 'plusmonth') DESC,FIELD(sb.plan_name, 'plusyear') DESC,FIELD(sb.plan_name, 'pluslifetime') DESC,
    FIELD(sb.plan_name, 'premiummonth') DESC,FIELD(sb.plan_name, 'premiumyear') DESC,FIELD(sb.plan_name, 'premiumlifetime') DESC,
    FIELD(sb.plan_name, 'addmsg') DESC,FIELD(sb.plan_name, 'addbot') DESC,
    FIELD(sb.plan_name, 'removelogo') DESC;`;
  const accountDetails = await RunQuery(planQuery, [user_id]);

  if (!accountDetails?.success)
    return res
      .status(401)
      .json(response(null, null, "unable to get user subscription data"));

  Udata.userSubDetails = accountDetails?.success;

  console.log("Udata", Udata);

  console.log("user id", user_id);

  //=========================== END subscription=====================================================
  //=========================== TOKEN START =====================================================

  const payload = { userId: user_id };
  const secretKey = config.get("jwtPrivateKey");
  const options = { expiresIn: "1h" };

  const token = jwt.sign(payload, secretKey, options);
  if (token) {
    res.cookie("token", token, {
      maxAge: 31536000000,
      httpOnly: false,
      secure: false,
    });
    res.cookie("refresh-token", token, {
      maxAge: 31536000000,
      httpOnly: false,
      secure: true,
      signed: false,
    });
  } else if (!token) {
    return res.status(500).send("!TOKEN NOT GENERATED");
  }

  res.status(200).json(response({ token, user_data: Udata }, null, ""));
}

async function login(req, res) {
  try {
    console.log("login by us", req.body);
    let { email_id, password, machine_id } = req.body;

    var query = `
    SELECT users.* FROM users WHERE email = "${email_id}" AND password = "${password}"`;

    const result = await RunQuery(query);

    if (!result?.success) {
      return res.status(400).json(response(null, null, "Can't find user data"));
    }

    const Udata = fetchData(result?.success);
    loginCommonSection(Udata, res, "web", machine_id);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json(response(null, null, "username or password incorrect"));
  }
}

function generateVerificationToken() {
  // Get current date and time
  const currentDate = new Date();

  // Add 24 hours (24 * 60 * 60 * 1000 milliseconds) to the current date
  const expiryDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);

  // Convert the expiryDate to a MySQL-compatible format (YYYY-MM-DD HH:MM:SS)
  const mysqlDatetime = expiryDate.toISOString().slice(0, 19).replace("T", " ");

  return {
    token: uuid.v4(),
    tokenExpiry: mysqlDatetime,
  };
}

const { getLastDate } = require("../global/getStartEndDate");
const { getUserData } = require("../global/UserData");

async function signup(req, res) {
  let connection;

  try {
    console.log("insert", req.body);
    let { email_id, password, plan_name } = req.body;

    // Check if email already exists
    var checkQuery = `SELECT * FROM users WHERE email = ?`;
    const checkResult = await RunQuery(checkQuery, [email_id]);
    const existingUser = checkResult?.success;

    if (existingUser.length) {
      return res
        .status(400)
        .json(response(null, null, "User with this email already exists"));
    }

    const user_id = getObjectId();

    // Generate a verification token
    const verificationToken = generateVerificationToken();

    // console.log("verification", verificationToken);

    // Start a transaction
    connection = await beginTransaction();

    var query = `SELECT * FROM plans WHERE plan_name = ?;`;
    const dbPlanResult = await RunTransactionQuery(query, connection, [
      plan_name,
    ]);

    if (!dbPlanResult?.success) {
      await rollbackTransaction(connection);
      return res
        .status(404)
        .json(response(null, null, "Failed to retrieve plan data"));
    }

    const dbPlan = fetchData(dbPlanResult?.success);

    console.log("dbPlan?.success", dbPlan);
    var query = `INSERT INTO users (user_id, email, password, status, login_type, verified) 
    VALUES (?, ?, ?, "active", "web", "0");`;

    const usersValues = [user_id, email_id, password];
    const resultu = await RunTransactionQuery(query, connection, usersValues);

    if (!resultu?.success) {
      await rollbackTransaction(connection);
      return res
        .status(500)
        .json(response(null, null, "Failed to insert user data"));
    }

    var subscriptionQuery = `INSERT INTO subscriptions (subscription_id, user_id, subscription_type, duration, create_at,
      status, bot_qty, msg_qty, plan_name, qty ) 
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
    console.log("subscriptionQuery", subscriptionQuery);
    const subscriptionValues = [
      getObjectId(),
      user_id,
      dbPlan?.category,
      dbPlan?.duration,
      newDate(),
      "active",
      dbPlan?.chatbots,
      dbPlan?.questions,
      dbPlan?.plan_name,
      1,
    ];
    const subscriptionResult = await RunTransactionQuery(
      subscriptionQuery,
      connection,
      subscriptionValues
    );

    if (!subscriptionResult?.success) {
      return res
        .status(500)
        .json(response(null, null, "Failed to insert subscription data"));
    }

    var query = `INSERT INTO verify_email (user_id,verification_token, token_expiry) 
    VALUES (?,?,?);`;

    const verifyEmailValues = [
      user_id,
      verificationToken.token,
      verificationToken.tokenExpiry,
    ];
    const resultv = await RunTransactionQuery(
      query,
      connection,
      verifyEmailValues
    );

    if (!resultv?.success) {
      await rollbackTransaction(connection);
      return res
        .status(500)
        .json(response(null, null, "Failed to insert verification data"));
    }

    ///send email logic
    // sendMail(email_id, verificationToken?.token);

    // Commit the transaction
    await commitTransaction(connection);

    // await sendVerificationEmail(email_id, verificationToken);

    return res
      .status(200)
      .json(response({ email_id }, null, "Signup Successfull!", false));
  } catch (error) {
    console.log(error);
    if (connection) {
      await rollbackTransaction(connection);
    }
    return res.status(500).json(response(null, null, "Failed to Signup User!"));
  }
}

async function verify(req, res) {
  try {
    // Extract the verification token from the URL query parameters
    const token = req?.body?.token;

    var query = `
    select * from verify_email ve inner join users us on ve.user_id=us.user_id WHERE ve.verification_token = ? ORDER BY created_at DESC LIMIT 1`;
    const result = await RunQuery(query, [token]);
    const user = fetchData(result?.success);

    console.log("users@@@@@@", user);

    if (!user || user.verification_token !== token) {
      // Invalid or expired token
      return res
        .status(400)
        .json(response(null, null, "Oops, Invalid Link.", false));
    }

    const currentTime = new Date();
    const tokenExpiry = user && new Date(user?.token_expiry);

    if (!user || tokenExpiry <= currentTime) {
      return res
        .status(410)
        .json(
          response(
            null,
            { email: user.email },
            "Oops, verification expired.",
            false
          )
        );
    }

    console.log("before query");

    var query = `
    update users set verified=1 where user_id=?;`;

    const updateResult = await RunQuery(query, [user.user_id]);
    //console.log('updatequery', updateResult);

    console.log("users", user);

    console.log("users", user);

    if (updateResult.success !== null) {
      req.body.email_id = user.email;
      req.body.password = user.password;
      await login(req, res);
    }
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG", false));
  }
}

async function reSendEmail(req, res) {
  try {
    console.log("resend email runs");
    // Extract the verification token from the URL query parameters
    const email = req?.body?.email;

    console.log("email", email);
    var getUserQuery = `SELECT user_id FROM users WHERE email = ?`;

    const userResult = await RunQuery(getUserQuery, [email]);
    if (!userResult?.success) {
      return res
        .status(400)
        .json(response(null, null, "Can't find relevant user"));
    }
    const user = fetchData(userResult?.success);
    console.log("user", user);

    var getVerifyQuery = `select created_at from verify_email WHERE user_id = ? ORDER BY created_at DESC LIMIT 1;`;

    const verifyResult = await RunQuery(getVerifyQuery, [user?.user_id]);
    if (!verifyResult?.success) {
      return res
        .status(400)
        .json(response(null, null, "Can't find relevant verfication data"));
    }
    const lastEmail = fetchData(verifyResult?.success);
    console.log("verify", lastEmail);

    const canSendEmail = checkIfEmailCanBeSent(lastEmail?.created_at);

    if (!canSendEmail) {
      res
        .status(400)
        .json(response(null, null, "Cannot send email at this time", false));
      return;
    }

    const verificationToken = generateVerificationToken();

    console.log("verificationToken", verificationToken);
    var query = `INSERT INTO verify_email (user_id, verification_token, token_expiry) VALUES (?, ?, ?);`;

    console.log("user?.user_id", user?.user_id, query);
    const resultv = await RunQuery(query, [
      user?.user_id,
      verificationToken?.token,
      verificationToken?.tokenExpiry,
    ]);

    if (!resultv?.success) {
      return res
        .status(500)
        .json(
          response(null, null, "Failed to insert verification data", false)
        );
    }

    console.log("email", !resultv?.success);

    ///send email logic
    // sendMail(email, verificationToken?.token);

    res
      .status(200)
      .json(response(resultv, null, "Email sent successfully!", false));
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG", false));
  }
}

function checkIfEmailCanBeSent(lastSendTime) {
  if (!lastSendTime) {
    // If no previous send time is available, a new email can be sent
    return true;
  }

  // Parse the lastSendTime string into a Date object
  const lastSendDate = new Date(lastSendTime);

  // Get the current time
  const currentTime = new Date();

  // Calculate the time difference in milliseconds
  const timeDiff = currentTime - lastSendDate;

  // Convert the time difference to seconds
  const timeDiffSeconds = Math.floor(timeDiff / 1000);

  console.log(
    "timedifference",
    timeDiff,
    currentTime,
    lastSendDate,
    timeDiffSeconds
  );

  // Check if the time difference is greater than or equal to 60 seconds
  if (timeDiffSeconds >= 60) {
    // If the last email was sent more than 60 seconds ago, a new email can be sent
    return true;
  }

  // If the last email was sent within the last 60 seconds, a new email cannot be sent yet
  return false;
}

async function logindetails(req, res) {
  try {
    // const email = req.headers["useremail"];
    const user_id = req.headers["userid"];
    console.log("user_id", user_id);
    var query = `
    SELECT users.* FROM users WHERE user_id = ?;`;

    const result = await RunQuery(query, [user_id]);

    if (!result?.success) {
      return res.status(400).json(response(null, null, "Can't find user data"));
    }
    console.log("result?.success", result?.success);

    const Udata = fetchData(result?.success);

    console.log({ Udata });

    if (Udata && Udata?.password) {
      delete Udata.password; // Remove the "password" field from the object
    }

    if (Udata?.status === "inactive")
      return res.status(401).send("USER HAS BEEN INACTIVE!");

    if (!Udata?.email)
      return res
        .status(401)
        .json(response(null, null, "Invalid email or password"));

    if (Udata?.verified === "0") {
      return res.status(403).json(response(null, null));
    }

    const userData = await getUserData(user_id, res);

    console.log({ userData });
    Udata.allowed_questions = userData.allowed_questions;
    Udata.question_usage = userData.question_usage;
    Udata.allowed_bots = userData.allowed_bots;
    Udata.bots_usage = userData.bots_usage;
    Udata.bot_characters = userData.bot_characters;
    Udata.weblinks = userData.weblinks;
    Udata.remove_logo = userData.remove_logo;
    Udata.gpt4 = userData.gpt4 === 1 ? true : false;

    //======================================================================
    //subscription details start

    let planQuery = `select  sb.subscription_id, pl.display_name, if(sb.duration = 'one_time', 'lifetime', sb.duration) as duration, sb.qty, sb.bot_qty, sb.msg_qty, sb.status, DATE_FORMAT(sb.cancel_at, '%b %e, %Y') AS cancel_at
from subscriptions sb 
    inner join plans pl on sb.plan_name = pl.plan_name 
    where sb.user_id= ? and (sb.status = 'active' or sb.status = 'past_due') order by 
    FIELD(sb.plan_name, 'free') DESC,
    FIELD(sb.plan_name, 'basicmonth') DESC,FIELD(sb.plan_name, 'basicyear') DESC,FIELD(sb.plan_name, 'basiclifetime') DESC,
    FIELD(sb.plan_name, 'plusmonth') DESC,FIELD(sb.plan_name, 'plusyear') DESC,FIELD(sb.plan_name, 'pluslifetime') DESC,
    FIELD(sb.plan_name, 'premiummonth') DESC,FIELD(sb.plan_name, 'premiumyear') DESC,FIELD(sb.plan_name, 'premiumlifetime') DESC,
    FIELD(sb.plan_name, 'addmsg') DESC,FIELD(sb.plan_name, 'addbot') DESC,
    FIELD(sb.plan_name, 'removelogo') DESC;`;
    const accountDetails = await RunQuery(planQuery, [user_id]);

    if (!accountDetails?.success)
      return res
        .status(401)
        .json(response(null, null, "unable to get user subscription data"));

    Udata.userSubDetails = accountDetails?.success;

    console.log("Udata", Udata);

    console.log("user id", user_id);

    //=========================== END subscription =====================================================

    res.status(200).json(response({ user_data: Udata }, null, ""));
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json(response(null, null, "user_name or password incorrect"));
  }
}

async function google(req, res) {
  try {
    let { email_id, plan_name, machine_id } = req.body;

    // Check if email already exists
    var query = `
    SELECT users.* FROM users WHERE email = ?;`;

    const result = await RunQuery(query, [email_id]);

    if (!result?.success) {
      return res.status(400).json(response(null, null, "Can't find user data"));
    }

    const Udata = fetchData(result?.success);

    console.log("Udata", Udata);
    if (Udata && Udata?.user_id) {
      console.log("email exist");
      //email exist
      loginCommonSection(Udata, res, "google", machine_id);
    } else {
      const user_id = getObjectId();
      var query = `SELECT * FROM plans WHERE plan_name = ?;`;
      const dbPlanResult = await RunQuery(query, [plan_name]);

      if (!dbPlanResult?.success) {
        return res
          .status(404)
          .json(response(null, null, "Failed to retrieve plan data"));
      }

      const dbPlan = fetchData(dbPlanResult?.success);

      // transaction start
      connection = await beginTransaction();

      console.log("dbPlan?.success", dbPlan);
      var query = `INSERT INTO users (user_id, email, status, login_type, verified) 
    VALUES (?, ?, "active", ?, "1");`;
      console.log("query", query);
      const userValues = [user_id, email_id, "google"];
      const resultu = await RunTransactionQuery(query, connection, userValues);

      if (!resultu?.success) {
        return res
          .status(500)
          .json(response(null, null, "Failed to insert user data"));
      }

      var subscriptionQuery = `INSERT INTO subscriptions (subscription_id, user_id, subscription_type, duration, create_at,
        status, bot_qty, msg_qty, plan_name, qty ) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
      console.log("subscriptionQuery", subscriptionQuery);
      const subscriptionValues = [
        getObjectId(),
        user_id,
        dbPlan?.category,
        dbPlan?.duration,
        newDate(),
        "active",
        dbPlan?.chatbots,
        dbPlan?.questions,
        dbPlan?.plan_name,
        1,
      ];
      const subscriptionResult = await RunTransactionQuery(
        subscriptionQuery,
        connection,
        subscriptionValues
      );

      if (!subscriptionResult?.success) {
        return res
          .status(500)
          .json(response(null, null, "Failed to insert subscription data"));
      }

      // Commit the transaction
      await commitTransaction(connection);

      const user_data = {
        user_id,
        email: email_id,
        status: "active",
        stripe_cus_id: null,
        login_type: "google",
        allowed_questions: dbPlan?.questions,
        question_usage: 0,
        allowed_bots: dbPlan?.chatbots,
        bots_usage: 0,
        bot_characters: dbPlan?.bot_characters,
        weblinks: dbPlan?.weblinks,
        remove_logo: dbPlan?.remove_logo,
      };

      //================================================================================

      const payload = { userId: user_id };
      const secretKey = config.get("jwtPrivateKey");
      const options = { expiresIn: "1h" };

      const token = jwt.sign(payload, secretKey, options);
      if (token) {
        res.cookie("token", token, {
          maxAge: 31536000000,
          httpOnly: false,
          secure: false,
        });
        res.cookie("refresh-token", token, {
          maxAge: 31536000000,
          httpOnly: false,
          secure: true,
          signed: false,
        });
      } else if (!token) {
        return res.status(500).send("!TOKEN NOT GENERATED");
      }

      res.status(200).json(response({ token, user_data }, null, ""));
    }
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json(response(null, null, "username or password incorrect"));
  }
}

async function accountDetails(req, res) {
  try {
    const user_id = req.headers["userid"];
    // console.log('user_id', user_id);

    console.log("getpricing start");
    let planQuery = `select  sb.subscription_id, pl.display_name, if(sb.duration = 'one_time', 'lifetime', sb.duration) as duration, sb.qty, sb.bot_qty, sb.msg_qty, sb.status, DATE_FORMAT(sb.cancel_at, '%b %e, %Y') AS cancel_at
		from subscriptions sb 
        inner join plans pl on sb.plan_name = pl.plan_name 
        where sb.user_id= ? and (sb.status = 'active' or sb.status = 'past_due') order by 
        FIELD(sb.plan_name, 'free') DESC,
        FIELD(sb.plan_name, 'basicmonth') DESC,FIELD(sb.plan_name, 'basicyear') DESC,FIELD(sb.plan_name, 'basiclifetime') DESC,
        FIELD(sb.plan_name, 'plusmonth') DESC,FIELD(sb.plan_name, 'plusyear') DESC,FIELD(sb.plan_name, 'pluslifetime') DESC,
        FIELD(sb.plan_name, 'premiummonth') DESC,FIELD(sb.plan_name, 'premiumyear') DESC,FIELD(sb.plan_name, 'premiumlifetime') DESC,
        FIELD(sb.plan_name, 'addmsg') DESC,FIELD(sb.plan_name, 'addbot') DESC,
        FIELD(sb.plan_name, 'removelogo') DESC;`;
    const accountDetails = await RunQuery(planQuery, [user_id]);
    // const accountDetails = fetchData(accountResult?.success);

    console.log({ accountDetails });

    const userData = await getUserData(user_id, res);

    const currentDate = new Date();
    const startDate =
      format(addMonths(startOfMonth(currentDate), 1), "MMMM 1") + "st";

    // console.log({ userData });
    // accountDetails.allowed_questions = userData.allowed_questions;
    // accountDetails.question_usage = userData.question_usage;
    // accountDetails.allowed_bots = userData.allowed_bots;
    // accountDetails.bots_usage = userData.bots_usage;
    // accountDetails.bot_characters = userData.bot_characters;
    // accountDetails.remove_logo = userData.remove_logo;

    res
      .status(200)
      .json(
        response(
          { accountDetails: accountDetails?.success, userData, startDate },
          null,
          ""
        )
      );
  } catch (error) {
    res.status(500).json(response(null, null, "UNABLE TO GET ACCOUNT DETAILS"));
  }
}

function checkIfEmailCanBeSent(lastSendTime) {
  if (!lastSendTime) {
    // If no previous send time is available, a new email can be sent
    return true;
  }

  // Parse the lastSendTime string into a Date object
  const lastSendDate = new Date(lastSendTime);

  // Get the current time
  const currentTime = new Date();

  // Calculate the time difference in milliseconds
  const timeDiff = currentTime - lastSendDate;

  // Convert the time difference to seconds
  const timeDiffSeconds = Math.floor(timeDiff / 1000);

  console.log(
    "timedifference",
    timeDiff,
    currentTime,
    lastSendDate,
    timeDiffSeconds
  );

  // Check if the time difference is greater than or equal to 60 seconds
  if (timeDiffSeconds >= 60) {
    // If the last email was sent more than 60 seconds ago, a new email can be sent
    return true;
  }

  // If the last email was sent within the last 60 seconds, a new email cannot be sent yet
  return false;
}

async function sendMail(toEmail, verificationToken) {
  try {
    var transporter = nodemailer.createTransport({
      port: 465,
      host: "smtp.mail.us-east-1.awsapps.com",
      secure: true,
      auth: {
        user: process.env.NEXT_MAIL_USER,
        pass: process.env.NEXT_MAIL_PASS,
      },
    });

    var mailOptions = {
      from: "team@chatwebby.com",
      to: toEmail,
      subject: `Verify Your Email Address for ChatWebby AI`,
      html: `
      <head>
      <meta charset="UTF-8" />
      <meta http-equiv="X-UA-Compatible" content="IE=edge" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body
      style="
        font-family: 'Google Sans', Roboto, RobotoDraft, Helvetica, Arial,
          sans-serif;
        margin: 0;
        font-weight: 400;
      "
    >
      <div class="row" style="background-color: white">
        <div
          class="column"
          style="width: 100%; margin-bottom: 16px; padding: 0 50px"
        >
          <div
            class="card"
            style="
              margin: 8px;
              padding: 5% 10%;
              background: linear-gradient(0deg, #EAECEB 100%);
              display: flex;
              justify-content: center;
              align-items: center;
            "
          >
            <div
              class="container-email"
              style="
                text-align: center;
                box-shadow: rgba(157, 157, 167, 0.2) 0px 7px 29px 0px;
                border: 1px solid rgba(180, 180, 180, 0.344);
                width: 600px;
                border-radius: 5px;
                background-color: white;
                padding: 20px 50px;
              "
            >
              <img src="https://base.cx/img/favicon.png" alt="aiIcon" style="background-color:white; width:80px"/>
              <h2 style="text-align: center">VERIFICATION REQUIRED!</h2>
              <br />

              <p style=" text-align: start;">
              Dear User,
              <br/>
              <br/>
              Thank you for signing up with Chatwebby To get started and enjoy all the benefits of our platform, we need to verify your email address.
              <br/>
              <br/>
              Please follow the link below to complete the verification process:
              <br/>
              <br/>
              https://base.cx/verify?token=${verificationToken}
              </p>
              <p></p>
              <br />
              <p style=" text-align: start;">
              Best regards,
              <br />
              <br />
              Team ChatWebby AI
              </p>
            </div>
          </div>
        </div>
      </div>
    </body>`,
    };

    console.log("Sending Email");
    try {
      transporter.sendMail(mailOptions);
    } catch (error) {
      console.log({ error });
    }
    console.log("Email Sent");
    return true;
  } catch (error) {
    console.log(error, "reereeeeeeeeeeeeeeeeeeeeeee");
  }
}

module.exports = {
  get,
  login,
  logindetails,
  signup,
  verify,
  reSendEmail,
  google,
  accountDetails,
};
// var query = `select * from users`;
// var query = `select * from users WHERE user_name = "${user_name}" `;
// var query = `DELETE FROM users WHERE user_name = "${user_name}" `;
// var query = `UPDATE users SET user_name ="${user_name}",name ="${name}",password ="${password}", status ="${status}" WHERE user_name ="${user_name}"`;
// var query = `INSERT INTO users (user_name, name,password, status) VALUES ("${user_name}","${name}","${password}","${status}")`;
