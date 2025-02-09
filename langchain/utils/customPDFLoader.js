const { Document } = require("langchain/document");
const fsPromises = require("fs").promises;
const { BaseDocumentLoader } = require("langchain/document_loaders");

class BufferLoader extends BaseDocumentLoader {
  constructor(filePathOrBlob) {
    super();
    this.filePathOrBlob = filePathOrBlob;
  }

  async parse(raw, metadata) {
    throw new Error("Subclasses must implement the parse method.");
  }

  async load() {
    let buffer;
    let metadata;
    if (typeof this.filePathOrBlob === "string") {
      buffer = await fsPromises.readFile(this.filePathOrBlob);
      metadata = { source: this.filePathOrBlob };
    } else {
      const arrayBuffer = await this.filePathOrBlob.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      metadata = { source: "blob", blobType: this.filePathOrBlob.type };
    }
    return this.parse(buffer, metadata);
  }
}

class CustomPDFLoader extends BufferLoader {
  async parse(raw, metadata) {
    const pdfModule = await PDFLoaderImports();
    const pdf = pdfModule.pdf;
    const parsed = await pdf(raw);
    return [
      new Document({
        pageContent: parsed.text,
        metadata: {
          ...metadata,
          pdf_numpages: parsed.numpages,
        },
      }),
    ];
  }
}

async function PDFLoaderImports() {
  try {
    const { default: pdf } = await import("pdf-parse/lib/pdf-parse.js");
    return { pdf };
  } catch (e) {
    console.error(e);
    throw new Error(
      "Failed to load pdf-parse. Please install it with eg. `npm install pdf-parse`."
    );
  }
}

module.exports = { BufferLoader, CustomPDFLoader };
