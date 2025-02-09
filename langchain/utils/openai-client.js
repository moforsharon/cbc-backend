require("dotenv").config();
const { OpenAI } = require("langchain/llms");

if (!process.env.API_KEY_OPENAI) {
  throw new Error("Missing OpenAI Credentials");
}

const openai = new OpenAI({
  temperature: 0,
});
module.exports = { openai };
