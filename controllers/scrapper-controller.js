const { response } = require("../response");
const { compile } = require("html-to-text");
const {
  RecursiveUrlLoader,
} = require("langchain/document_loaders/web/recursive_url");

async function scrap(req, res) {
  try {
    let { url } = req.body;

    const result = await scrapLocal(url);

    res.status(200).json(response(result, null));
  } catch (error) {
    console.log(error);
    res.status(500).json(response(null, null, "ERROR!"));
  }
}

async function scrapLocal(url) {
  try {
    const compiledConvert = compile({ wordwrap: 130 });
    const loader = new RecursiveUrlLoader(url, {
      extractor: compiledConvert,
      maxDepth: 1,
    });

    const docs = await loader.load();
    console.log("testing", docs);

    return docs;
  } catch (error) {
    console.log(error);
    return response(null, null, "ERROR!");
  }
}

module.exports = {
  scrap,
  scrapLocal,
};
