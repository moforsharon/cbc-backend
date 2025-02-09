require("dotenv").config();
const path = require("path");
const AWS = require("aws-sdk");
const config = require("config");
const { DeleteObjectsCommand, S3Client } = require("@aws-sdk/client-s3");
const { response } = require("../response");

AWS.config.update({
  accessKeyId: process.env.NEXT_PUBLIC_ACCESS_ID,
  secretAccessKey: process.env.NEXT_PUBLIC_ACCESS_KEY,
});

const bucket = process.env.NEXT_PUBLIC_BUCKET_NAME;
const dirName = process.env.NEXT_PUBLIC_DIR_NAME;

const extensions = [
  ".pdf",
  ".PDF",
  ".csv",
  ".CSV",
  ".doc",
  ".docx",
  ".DOCX",
  ".DOC",
  ".txt",
  ".TXT",
  ".epub",
  ".EPUB",
];
const removeExtension = (filename) => {
  for (let i = 0; i < extensions.length; i++) {
    const extension = extensions[i];
    if (filename.endsWith(extension)) {
      return filename.slice(0, -extension.length);
    }
  }
  return filename;
};

function processFileExtension(filename) {
  const extension = path.extname(filename) ?? "";
  if (extension === ".epub") {
    return `${filename}+zip`;
  } else if (extension === ".txt") {
    const name = removeExtension(filename);
    filename = name + ".plain";
  }

  return filename;
}

let s3 = new AWS.S3({ params: { Bucket: bucket } });
const removeFromBucket = async (e) => {
  try {
    const name = processFileExtension(e);

    const params = { Bucket: bucket, Key: `${dirName}/${name}` };
    await s3.headObject(params).promise();
    console.log("File Found in S3");
    await s3.deleteObject(params).promise();
    console.log("file deleted Successfully");
    return true;
  } catch (err) {
    console.log("File not Found ERROR : ");
    return false;
  }
};

const client = new S3Client({
  region: process.env.NEXT_PUBLIC_REGION,
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_ACCESS_ID,
    secretAccessKey: process.env.NEXT_PUBLIC_ACCESS_KEY,
  },
});

async function deleteFileS3(correctData) {
  try {
    console.log("process.env", bucket, process.env.NEXT_PUBLIC_BUCKET_NAME);
    const command = new DeleteObjectsCommand({
      Bucket: process.env.NEXT_PUBLIC_BUCKET_NAME,
      Delete: {
        Objects: correctData,
      },
    });

    const { Deleted } = await client.send(command);
    console.log(
      `Successfully deleted ${Deleted.length} objects from S3 bucket. Deleted objects:`
    );
    return response(Deleted, null, `Successfully deleted ${Deleted.length}`);
  } catch (err) {
    console.error(err);
    return response(null, null, `Unable to delete files`);
  }
}

module.exports = {
  deleteFileS3,
  removeFromBucket,
  removeExtension,
  processFileExtension,
};
