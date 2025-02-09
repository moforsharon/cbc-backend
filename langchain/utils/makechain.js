require("dotenv").config();

const { ConversationalRetrievalQAChain } = require("langchain/chains");
const { ChatOpenAI } = require("langchain/chat_models/openai");
const { CallbackManager } = require("langchain/callbacks");

const CONDENSE_TEMPLATE = `As a language model, your task is to rephrase follow-up questions related to a
given conversation into standalone questions. If the follow-up question is not related to the conversation,
please leave it unchanged. Please provide clear and concise standalone questions that can be easily understood without requiring context from the original conversation.
Please note that your responses should demonstrate an understanding of natural language and be flexible enough to allow for various relevant and creative rephrasings.
 Follow Up Input: {question}
 Standalone question:`;

const getQATemplate = (prompt) => {
  return `${prompt}`;
};

function replaceLanguageWithEnglish(inputString, language) {
  return inputString?.replace(/{language}/g, language);
}

const makeChain = (
  vectorstore,
  onTokenStream,
  prompt,
  chat_model,
  temperature,
  language
) => {
  const QA_TEMPLATE = getQATemplate(
    replaceLanguageWithEnglish(prompt, language)
  );
  console.log({ QA_TEMPLATE });
  const model = new ChatOpenAI({
    temperature: temperature || 0.1,
    openAIApiKey: process.env.API_KEY_OPENAI,
    modelName: chat_model || "gpt-3.5-turbo",
    streaming: Boolean(onTokenStream),
    callbackManager: onTokenStream
      ? CallbackManager.fromHandlers({
          async handleLLMNewToken(token) {
            onTokenStream(token);
            console.log(token);
          },
        })
      : undefined,
  });
  /*   const nonStreamingModel = new ChatOpenAI({
    temperature: 0.1,
    modelName: chat_model || "gpt-3.5-turbo",
    openAIApiKey: process.env.API_KEY_OPENAI,
  }); */
  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorstore.asRetriever(),
    {
      qaTemplate: QA_TEMPLATE,
      questionGeneratorTemplate: CONDENSE_TEMPLATE,
      returnSourceDocuments: true, //The number of source documents returned is 4 by default
      /* questionGeneratorChainOptions: {
        llm: nonStreamingModel,
      }, */
    }
  );
  return chain;
};
module.exports = { makeChain };
