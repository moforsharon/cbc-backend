const { sendMail } = require("./sendmail");
const { response } = require("../response");

const mailer = async (req, res) => {
  const data = req.body;

  console.log(data, "data");

  if (data?.email === "") {
    res
      .status(400)
      .json(
        response(
          null,
          { message: "All fields are required" },
          "SOMETHING WENTS WRONG"
        )
      );
  }

  try {
    await sendMail(data?.email);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  res.status(200).json(response({ message: "ok" }, null, ""));
};

module.exports = { mailer };
