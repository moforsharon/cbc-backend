require("dotenv").config();
const { fetchData } = require("../libs/fetchData");
const { getObjectId } = require("../libs/id");
const { response } = require("../response");
const { RunQuery, RunTransactionQuery } = require("../services");
const {
  DirectoryLoader,
  CheerioWebBaseLoader,
  PDFLoader,
  UnstructuredLoader,
  TextLoader,
  CSVLoader,
  DocxLoader,
  EPubLoader,
} = require("langchain/document_loaders");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { OpenAIEmbeddings } = require("langchain/embeddings");
const { PineconeStore } = require("langchain/vectorstores");

const config = require("config");
const { CustomPDFLoader } = require("../langchain/utils/customPDFLoader");
const { PineconeClient } = require("@pinecone-database/pinecone");
const path = require("path");
const AWS = require("aws-sdk");
const {
  removeFromBucket,
  processFileExtension,
  deleteFileS3,
  removeExtension,
} = require("../libs/removeFrom-s3");
const { rollbackTransaction } = require("../connection");

async function updateBulkSource(sourceFiles, chatbot_id, connection) {
  console.log("sourceFiles", sourceFiles);

  const placeholders = sourceFiles
    .map(() => "(?, ?, ?, ?, ?, ?, ?)")
    .join(", ");

  const values = sourceFiles.flatMap((record) => [
    record.source_id,
    record.source_name,
    record.question,
    record.answer,
    chatbot_id,
    record.length,
    record.type,
  ]);

  const bulkQuery = `INSERT INTO sources (source_id, source_name, question, answer,chatbot_id, no_of_characters,type)
VALUES ${placeholders}
ON DUPLICATE KEY UPDATE
    source_name = VALUES(source_name),
    question = VALUES(question),
    answer = VALUES(answer),
    chatbot_id = VALUES(chatbot_id),
    no_of_characters = VALUES(no_of_characters),
    type = VALUES(type);`;

  const result = await RunTransactionQuery(bulkQuery, connection, values);

  return result;
}

const setSourceFIles = async (sourceFiles, chatbot_id, connection) => {
  const placeholders = sourceFiles
    .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .join(", ");

  const values = sourceFiles.flatMap((record) => [
    // getObjectId(),
    record.source_id,
    record.source_name,
    record.file_id,
    record.question,
    record.answer,
    chatbot_id,
    record.length,
    record.type,
    record.status,
  ]);

  const bulkQuery = `INSERT INTO sources (source_id, source_name, orginal_file, question,answer,chatbot_id,no_of_characters,type,status)
  VALUES ${placeholders}`;

  const result = await RunTransactionQuery(bulkQuery, connection, values);
  console.log("setSourceFIles", result);
  return result;
};

async function insertBot({
  chatbot_id,
  user_id,
  number_of_characters,
  name,
  chatbot_file_name,
  connection,
}) {
  // const user_id = req.headers["userid"];

  var query = `
    SELECT name FROM chatbot WHERE user_id = ? AND name LIKE ?`;
  const botVals = [user_id, `${name}%`];

  let counter = 1;
  let uniqueName = name;

  while (true) {
    const botResult = await RunTransactionQuery(query, connection, botVals);

    const existingBotNames = botResult?.success?.map((bot) => bot.name);
    if (!existingBotNames.includes(uniqueName)) {
      name = uniqueName;
      break;
    }
    uniqueName = `${name} ${counter}`;
    counter++;
  }

  var query = `
  INSERT INTO chatbot (chatbot_id,user_id,number_of_characters,name,chatbot_file_name) VALUES
  (?,?,?,?,?)`;
  const values = [
    chatbot_id,
    user_id,
    number_of_characters,
    name,
    chatbot_file_name,
  ];

  const resultu = await RunTransactionQuery(query, connection, values);

  if (resultu.success !== null) {
    var query = `INSERT INTO chatbot_assign_data (data_id, chatbot_id, data, types)
  VALUES (?,?,?,?)`;
    const data_id = getObjectId();

    const valuesA = [
      data_id,
      chatbot_id,
      "Hi, what would you like to learn about your bot?",
      "initial_msg",
    ];

    const resultA = await RunTransactionQuery(query, connection, valuesA);

    console.log("chatbot_assign_data", resultA);

    if (resultA.success !== null) {
      var query = `
      select * from chatbot WHERE chatbot_id = ? `;
      const values = [chatbot_id];
      const result = await RunTransactionQuery(query, connection, values);

      return result;
    }
  }
}

async function updateBot({
  chatbot_id,
  number_of_characters,
  name,
  chatbot_file_name,
  connection,
}) {
  try {
    var query = `UPDATE chatbot SET number_of_characters =?,name=?,chatbot_file_name=? WHERE chatbot_id =?`;
    const values = [number_of_characters, name, chatbot_file_name, chatbot_id];
    const result = await RunTransactionQuery(query, connection, values);
    if (result.success !== null) {
      var query = `
      select * from chatbot WHERE chatbot_id = ?`;
      const values = [chatbot_id];
      const result = await RunTransactionQuery(query, connection, values);
      return result;
    }
  } catch (error) {
    console.log(error);
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function errorFunction({
  chatbot_file_name,
  res,
  filesToDelete,
  connection,
}) {
  await rollbackTransaction(connection);
  await removeFromBucket(chatbot_file_name);

  filesToDelete && (await removeBulkFilesS3(filesToDelete, "file_id"));

  return res.status(500).json(response(null, null, "unable to create bot!"));
}

async function removeBulkFiles(chatbot_id, source_ids, connection) {
  let vals = source_ids.join("','");
  var query = `delete from sources where source_id in ('${vals}') and chatbot_id='${chatbot_id}'`;
  const result = await RunTransactionQuery(query, connection);
  return result;
}

async function removeBulkFilesS3(filesToDelete, value) {
  try {
    const correctData = await filesToDelete?.map((item) => ({
      Key: `${process.env.NEXT_PUBLIC_DIR_NAME}/${processFileExtension(
        item[value]
      )}`,
    }));
    const deleteResult = await deleteFileS3(correctData);

    return deleteResult;
  } catch (err) {
    return response(null, err, `unable to bulk file`);
  }
}

async function removePrevFile(chatbot_id, connection) {
  try {
    var query = `select chatbot_file_name from chatbot where chatbot_id='${chatbot_id}'`;
    const result = await RunTransactionQuery(query, connection);
    const { chatbot_file_name } = fetchData(result?.success);
    const apiUrl = `https://chatwebby-ebf8176.svc.asia-southeast1-gcp.pinecone.io/vectors/delete?deleteAll=true&namespace=${chatbot_file_name}`;
    const resp = await fetch(apiUrl, {
      method: "DELETE",
      headers: {
        "Api-Key": "0d09d2b0-ca6e-461f-91c7-2bf727f30d91",
      },
    });
    const data = await resp.json();
    console.log("data", data);
    const file_name = processFileExtension(chatbot_file_name);
    const deleteResult = await removeFromBucket(file_name);
    return response(deleteResult, null, `prev file deleted success`);
  } catch (err) {
    return response(null, err, `unable to delete prev file`);
  }
}

const run = async ({ fileName }) => {
  try {
    let result = { message: "", status: false };

    async function initPinecone() {
      try {
        console.log(
          "ENVIRONMENT_PINECONE==API_KEY_PINECONE",
          process.env.ENVIRONMENT_PINECONE,
          process.env.API_KEY_PINECONE
        );
        const pinecone = new PineconeClient();
        await pinecone.init({
          environment: "asia-southeast1-gcp",
          apiKey: "0d09d2b0-ca6e-461f-91c7-2bf727f30d91",
        });

        return pinecone;
      } catch (error) {
        // throw new Error("Failed to initialize Pinecone Client");
        return (result = {
          message: "Failed to initialize Pinecone Client",
          status: false,
        });
      }
    }

    const pinecone = await initPinecone();
    //===============================================

    console.log("run", processFileExtension(fileName));

    const bucket = process.env.NEXT_PUBLIC_BUCKET_NAME;

    const pdfUrl = `https://${bucket}.s3.amazonaws.com//${fileName}`;

    AWS.config.update({
      accessKeyId: process.env.NEXT_PUBLIC_ACCESS_ID,
      secretAccessKey: process.env.NEXT_PUBLIC_ACCESS_KEY,
    });

    const dirName = process.env.NEXT_PUBLIC_DIR_NAME;

    if (!bucket) {
      return (result = { message: "Bucket name not defined", status: false });
    }
    let key = `${processFileExtension(fileName)}`;

    let s3 = new AWS.S3({ params: { Bucket: bucket } });
    const params = { Bucket: bucket, Key: `${dirName}/${key}` };
    console.log("params", params);
    const response = await s3
      .getObject(params)
      .promise()
      .then((response) => response.Body);

    const extension = path.extname(pdfUrl);
    let rawDocs;
    switch (extension) {
      case ".docx":
        const docBlob = new Blob([response], {
          type: "application/msword",
        });
        console.log("DocBlob", docBlob);
        const loader = new DocxLoader(docBlob);
        console.log("DocBlobsss", loader);
        rawDocs = await loader.load();
        console.log("rawDocs", rawDocs);
        break;
      case ".csv":
        const csvBlob = new Blob([response], { type: "text/csv" });
        const csvLoader = new CSVLoader(csvBlob);
        rawDocs = await csvLoader.load();

        break;
      case ".txt":
      case ".plain":
        const txtBlob = new Blob([response], { type: "text/plain" });
        const txtLoader = new TextLoader(txtBlob);
        rawDocs = await txtLoader.load();
        break;
      case ".pdf":
        console.log("reached to pdf");

        const pdfBlob = new Blob([response], { type: "application/pdf" });
        const pdfLoader = new CustomPDFLoader(pdfBlob);

        rawDocs = await pdfLoader.load();
        break;
      case ".epub":
        const epubBlob = new Blob([response], { type: "application/epub+zip" });
        const ePubLoader = new EPubLoader(
          "https://chatwebby-bucket-file-storage.s3.amazonaws.com//6494362e34ce6b60a9d2ac76The+Hard+Thing+About+Hard+Things+by+Ben+Horowitz.epub%2Bzip"
        );
        rawDocs = await ePubLoader.load();

        break;

      default:
        break;
    }

    // console.log('rawDocs', rawDocs);
    /* Split text into chunks */
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const docs = await textSplitter.splitDocuments(rawDocs ?? []);
    // console.log('split docs', docs);

    console.log("creating vector store...", fileName);
    /*create and store the embeddings in the vectorStore*/

    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.API_KEY_OPENAI,
    });
    console.log(
      "process.env.INDEX_NAME_PINECONE",
      process.env.INDEX_NAME_PINECONE
    );
    const index = pinecone.Index("chatwebby"); //change to your own index name

    //embed the PDF documents
    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
      namespace: fileName, // props coming form credentials
      textKey: "text",
    });
    // console.log('processing2', cancelToken001?.isCancelled());

    // return "ingestion complete";
    return (result = { message: "ingestion complete", status: true });
  } catch (error) {
    console.log("error", error);
    // throw new Error("Failed to ingest your data" + error);
    return (result = { message: "Failed to ingest your data", status: false });
  }
};

module.exports = {
  errorFunction,
  removeBulkFiles,
  setSourceFIles,
  run,
  insertBot,
  removeBulkFilesS3,
  updateBot,
  updateBulkSource,
  removePrevFile,
};
