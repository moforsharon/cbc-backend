const axios = require("axios");

async function genericApi({ url, method, data, type, header, query }) {
  try {
    let endpoint = `${process.env.GENERIC_IP}/api/${url}?openai_key=${process.env.API_KEY_OPENAI}`;

    if (query && Object.keys(query)?.length > 0) {
      const queryParams = Object.entries(query)
        .map(([key, value]) => `${key}=${value}`)
        .join("&");
      endpoint = `${endpoint}&${queryParams}`;
    }

    let axiosConfig = {
      method,
      url: endpoint,
    };

    console.log({
      API_KEY_OPENAI:process.env.API_KEY_OPENAI,
      "Pinecone-Key": process.env.API_KEY_PINECONE,
      "Pinecone-Environment": process.env.ENVIRONMENT_PINECONE,
      "Pinecone-Index": process.env.INDEX_NAME_PINECONE,
      "Aws-Access-Key": process.env.NEXT_PUBLIC_ACCESS_ID,
      "Aws-Secret-Key": process.env.NEXT_PUBLIC_ACCESS_KEY,
      "Aws-Bucket-Name": process.env.NEXT_PUBLIC_BUCKET_NAME,
      "Aws-Region": process.env.NEXT_PUBLIC_REGION,
      "Aws-Directory": process.env.NEXT_PUBLIC_DIR_NAME,
    });

    axiosConfig = {
      method,
      url: endpoint,
      data,
      headers: {
        "Content-Type":
          type === "file" ? "multipart/form-data" : "application/json",
        "Pinecone-Key": process.env.API_KEY_PINECONE,
        "Pinecone-Environment": process.env.ENVIRONMENT_PINECONE,
        "Pinecone-Index": process.env.INDEX_NAME_PINECONE,
        "Aws-Access-Key": process.env.NEXT_PUBLIC_ACCESS_ID,
        "Aws-Secret-Key": process.env.NEXT_PUBLIC_ACCESS_KEY,
        "Aws-Bucket-Name": process.env.NEXT_PUBLIC_BUCKET_NAME,
        "Aws-Region": process.env.NEXT_PUBLIC_REGION,
        "Aws-Directory": process.env.NEXT_PUBLIC_DIR_NAME,
        ...header,
      },
    };

    const response = await axios(axiosConfig);
    return response.data;
  } catch (error) {
    console.log(error);
  }
}

module.exports = { genericApi };
