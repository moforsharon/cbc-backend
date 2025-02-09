require("dotenv").config();
const { OpenAIChat } = require("langchain/llms");
const {
  LLMChain,
  ChatVectorDBQAChain,
  loadQAChain,
} = require("langchain/chains");
const { PineconeStore } = require("langchain/vectorstores");
const { PromptTemplate } = require("langchain/prompts");
const { CallbackManager } = require("langchain/callbacks");
const config = require("config");
const CONDENSE_PROMPT =
  PromptTemplate.fromTemplate(`As a language model, your task is to provide clear and concise standalone questions. User asked this question from a folder or group of documents but you will rephrase it as question which is asked from a single document.
   Please note that your responses should demonstrate an understanding of natural language and be flexible enough to allow for various relevant and creative rephrasings.
  
    Follow Up Input: {question}
     Standalone question:`);

const QA_PROMPT = PromptTemplate.fromTemplate(`
As an AI document helpful file, your task is to generate responses to questions asked about document context provided below. If presented with a specific question related to context below,
  you should provide a conversational answer based on the given information below and include relevant hyperlinks. If you cannot find the answer from context or if the answer is not provided in the given context or the question is irrelevant to the document, just say 'theanswerdontexist'. DO NOT try to make up any other answer.
Question: {question}
=========
{context}
=========
Answer in Markdown:`);

const makeChainForMultipleDocuments = (vectorstore, keyData) => {
  const questionGenerator = new LLMChain({
    llm: new OpenAIChat({
      temperature: 0,
      openAIApiKey: process.env.API_KEY_OPENAI,
      // modelName: keyData?.status == 0 ? 'gpt-3.5-turbo' : keyData?.key_desc,
    }),
    prompt: CONDENSE_PROMPT,
  });
  const docChain = loadQAChain(
    new OpenAIChat({
      temperature: 0.1,
      openAIApiKey: process.env.API_KEY_OPENAI,
      modelName: keyData?.status == 0 ? "gpt-3.5-turbo" : keyData?.key_desc,
    }),
    { prompt: QA_PROMPT }
  );

  return new ChatVectorDBQAChain({
    vectorstore,
    combineDocumentsChain: docChain,
    questionGeneratorChain: questionGenerator,
    returnSourceDocuments: true,
    k: 5, //number of source documents to return
  });
};

module.exports = { makeChainForMultipleDocuments };
