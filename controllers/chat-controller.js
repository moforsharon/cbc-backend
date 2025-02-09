const { fetchData } = require("../libs/fetchData");
const { response } = require("../response");
const { RunQuery } = require("../services");
const { OpenAIEmbeddings } = require("langchain/embeddings");
const { PineconeStore } = require("langchain/vectorstores");
const { makeChain } = require("../langchain/utils/makechain");
const { PineconeClient } = require("@pinecone-database/pinecone");
const { getUserData } = require("../global/UserData");

async function chat(req, res) {
  try {
    const { question, history, _id, language } = req?.body;

    let chat_model = "";
    let chat_prompt = "";

    const file_id_query = `select chatbot_file_name,prompt,model,temperature,user_id,prompt_template from chatbot where chatbot_id =? `;
    const file_id_values = [_id];
    const result = await RunQuery(file_id_query, file_id_values);
    const {
      chatbot_file_name,
      prompt,
      model,
      temperature,
      user_id,
      prompt_template,
    } = fetchData(result?.success);
    chat_model = model;

    const userData = await getUserData(user_id, res);
    if (prompt_template == "custom_prompt") {
      chat_prompt = prompt;
    } else {
      const prompt_query = `select prompt from prompts where personality = ? `;
      const prompt_values = [prompt_template];
      const prompt_result = await RunQuery(prompt_query, prompt_values);
      const fetch_prompt = fetchData(prompt_result?.success);
      chat_prompt = fetch_prompt?.prompt;
    }

    if (!userData?.gpt4 && model == "gpt-4-1106-preview") {
      const model_query = `update chatbot set model = 'gpt-3.5-turbo' where chatbot_id = ? `;
      const model_values = [_id];
      const result = await RunQuery(model_query, model_values);
      if (result?.success != null) {
        const get_model_query = `select model from chatbot where chatbot_id = ? `;
        const get_model_values = [_id];
        const resultModel = await RunQuery(get_model_query, get_model_values);
        const fetchRes = fetchData(resultModel?.success);
        chat_model = fetchRes?.model;
      }
    }

    console.log({
      chatbot_file_name,
      chat_prompt,
      model,
      temperature,
      user_id,
      chat_model,
    });

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    const sendData = (data) => {
      res.write(`data: ${data}\n\n`);
      console.log("QUESTION", data);
    };
    console.log(
      "userData.question_usage < userData.allowed_questions",
      userData.question_usage,
      userData.allowed_questions
    );

    if (!(userData.question_usage < userData.allowed_questions)) {
      return sendData("[exceed]");
    }

    async function initPinecone() {
      try {
        const pinecone = new PineconeClient();
        await pinecone.init({
          environment: process.env.ENVIRONMENT_PINECONE,
          apiKey: process.env.API_KEY_PINECONE,
        });

        return pinecone;
      } catch (error) {
        throw new Error("Failed to initialize Pinecone Client132");
      }
    }

    const pinecone = await initPinecone();

    if (!question) {
      return res.status(400).json({ message: "No question in the request" });
    }

    const sanitizedQuestion = question.trim().replaceAll("\n", " ");

    const index = pinecone.Index(process.env.INDEX_NAME_PINECONE);

    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({
        openAIApiKey: process.env.API_KEY_OPENAI,
      }),
      {
        pineconeIndex: index,
        textKey: "text",
        namespace: chatbot_file_name, // file name from store
      }
    );

    const chain = makeChain(
      vectorStore,
      (token) => {
        sendData(JSON.stringify({ data: token }));
      },
      chat_prompt,
      chat_model,
      temperature,
      language
    );

    try {
      const response = await chain.call({
        question: sanitizedQuestion,
        chat_history: history || [],
      });

      console.log("Chain response", response);
      sendData(JSON.stringify({ sourceDocs: response.sourceDocuments }));
    } finally {
      sendData("[DONE]");
      res.end();
    }
  } catch (error) {
    console.log(error);
    res.status(500).json(response(null, null, "UNABLE TO GET CHAT"));
  }
}

module.exports = {
  chat,
};
