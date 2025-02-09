require("dotenv").config();
var express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
router.use(bodyParser.json());
var AWS = require("aws-sdk");
const config = require("config");
const fs = require("fs");
const { PDFDocument, GlobalWorkerOptions } = require("pdfjs-dist");
const mammoth = require("mammoth");
const xml2js = require("xml2js");
const csv = require("csv-parser");
const streamifier = require("streamifier");
const PDFExtract = require("pdf.js-extract").PDFExtract;
const pdfExtract = new PDFExtract();
const options = {}; /* see below */
const path = require("path");
const { response } = require("../response");
const { processFileExtension } = require("./removeFrom-s3");

const extractText = async (req, res) => {
  try {
    console.log({ dataaaa: req?.body?.fileArr });
    const correctData = req?.body?.fileArr.map((item) =>
      processFileExtension(item.orginal_file)
    );

    console.log("correctData", correctData);

    AWS.config.update({
      accessKeyId: process.env.NEXT_PUBLIC_ACCESS_ID,
      secretAccessKey: process.env.NEXT_PUBLIC_ACCESS_KEY,
    });

    const bucket = process.env.NEXT_PUBLIC_BUCKET_NAME;
    const dirName = process.env.NEXT_PUBLIC_DIR_NAME;
    const s3 = new AWS.S3({ params: { Bucket: bucket } });

    // Set the keys of the objects to retrieve
    const keys = correctData;
    // const keys = ["Api Documentation (1).pdf"];

    // Create an array of promises to retrieve the objects
    const promises = keys.map((key) => {
      const params = { Bucket: bucket, Key: `${dirName}/${key}` };
      console.log("params:::", params);
      return s3.getObject(params).promise();
    });

    const results = await Promise.all(promises);

    if (!results)
      return res.status(500).json(response(null, null, "NO FILES FOUND"));

    let textContent = "";

    const extractPromises = results.map((result) => {
      return new Promise((resolve, reject) => {
        // const fileType = req.body?.type;
        const fileType = result.ContentType;
        if (fileType === "application/pdf") {
          pdfExtract.extractBuffer(result.Body, options, (err, data) => {
            if (err)
              return res
                .status(500)
                .json(response(null, null, "SOMETHING WENTS WRONG"));
            let pages = data?.pages;
            pages.forEach((page) => {
              page.content.forEach((textItem) => {
                textContent += textItem?.str + " ";
              });
            });
            textContent += "\n\n";
            resolve();
          });
        } else if (fileType === "text/plain") {
          // Assuming result.Body contains the plain text content
          const plainTextBuffer = result.Body;
          const plainTextContent = plainTextBuffer.toString("utf8");
          textContent += plainTextContent + "\n\n";
          resolve();
        } else if (fileType === "text/csv") {
          streamifier
            .createReadStream(result.Body)
            .pipe(csv())
            .on("data", (row) => {
              Object.values(row).forEach((value) => {
                textContent += value + " ";
              });
            })
            .on("end", () => {
              console.log("CSV", textContent);
              resolve();
            });
        } else if (
          fileType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ) {
          mammoth
            .extractRawText({ buffer: result.Body })
            .then(function (data) {
              textContent += data.value + " ";
              resolve();
            })
            .done();
        } else {
          reject(new Error("Unsupported file type"));
        }
      });
    });

    await Promise.all(extractPromises);

    console.log(textContent);
    res.status(200).json(response(textContent, null, ""));
  } catch (error) {
    return res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
};

module.exports = { extractText };
