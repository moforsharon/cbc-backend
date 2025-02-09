const config = require("config");

if (!process.env.INDEX_NAME_PINECONE) {
  throw new Error("Missing Pinecone index name in .env file");
}

const INDEX_NAME_PINECONE = config.get("INDEX_NAME_PINECONE") ?? "";

const PINECONE_NAME_SPACE =
  "Battery Monitor with Daisy Chain Interface PDF.pdf"; //namespace is optional for your vectors

module.exports = { INDEX_NAME_PINECONE, PINECONE_NAME_SPACE };
