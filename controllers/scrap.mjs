// const { compile } = require("html-to-text");
// const {
//   RecursiveUrlLoader,
// } = require("langchain/document_loaders/web/recursive_url");

import { compile } from "html-to-text";
import { RecursiveUrlLoader } from "langchain/document_loaders/web/recursive_url";

const url = "https://ravengames.io";
const compiledConvert = compile({ wordwrap: 130 });
const loader = new RecursiveUrlLoader(url, {
  extractor: compiledConvert,
  maxDepth: 1,
  // excludeDirs: ["https://js.langchain.com/docs/api/"],
});

const docs = await loader.load();
console.log("testing", docs);
