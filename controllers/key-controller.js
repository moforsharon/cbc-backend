const { fetchData } = require("../libs/fetchData");
const { getObjectId } = require("../libs/id");
const { response } = require("../response");

const { RunQuery } = require("../services");

async function updateKey(req, res) {
  try {
    let { key_id, key_type, status, key_desc, gpt35turbo, gpt4 } = req.body;
    const user_email = req.headers["useremail"];

    var getQuery = `select key_id from api_key where user_email = "${user_email}" `;
    const resData = await RunQuery(getQuery);
    const resvalues = fetchData(resData.success);
    var query = ``;
    if (resvalues?.key_id) {
      query = `update api_key set key_id="${key_id}", gpt35turbo= ${gpt35turbo}, gpt4=${gpt4} where user_email = "${user_email}" `;
    } else {
      query = `insert into api_key (key_id,user_email,key_type,status,key_desc,gpt35turbo,
        gpt4) values (?,?,?,?,?,?,?)`;
    }

    const values = [
      key_id,
      user_email,
      key_type,
      status,
      key_desc,
      gpt35turbo,
      gpt4,
    ];
    console.log("values", values);
    const result = await RunQuery(query, values);

    if (result.success !== null) {
      var selectQuery = `
        select * from api_key where user_email = "${user_email}" `;
      const result = await RunQuery(selectQuery);
      res.status(200).json(result);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json(response(null, null, "UNABLE TO UPDATE API KEY"));
  }
}

async function setStatus(req, res) {
  try {
    let { key_desc, key_id } = req.body;
    const user_email = req.headers["useremail"];

    var query = `update api_key set key_desc="${key_desc}"  where user_email = "${user_email}" and key_id = "${key_id}"`;
    const result = await RunQuery(query);

    if (result.success !== null) {
      var selectQuery = `
        select * from api_key where user_email = "${user_email}" `;
      const result = await RunQuery(selectQuery);
      res.status(200).json(result);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json(response(null, null, "UNABLE TO UPDATE API KEY"));
  }
}

async function checkStatus(req, res) {
  try {
    let { key_desc, key_id, gpt4 } = req.body;
    const user_email = req.headers["useremail"];

    var query = `update api_key set key_desc="${key_desc}", gpt4=${gpt4}  where user_email = "${user_email}" and key_id = "${key_id}"`;
    const result = await RunQuery(query);

    if (result.success !== null) {
      var selectQuery = `
        select * from api_key where user_email = "${user_email}" `;
      const result = await RunQuery(selectQuery);
      res.status(200).json(result);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json(response(null, null, "UNABLE TO UPDATE API KEY"));
  }
}

async function setType(req, res) {
  try {
    let { status } = req.body;
    const user_email = req.headers["useremail"];
    var query = `update api_key set status = ${status} where user_email = "${user_email}" `;
    const result = await RunQuery(query);

    if (result.success !== null) {
      var selectQuery = `
        select * from api_key where user_email = "${user_email}" `;
      const result = await RunQuery(selectQuery);
      res.status(200).json(result);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json(response(null, null, "UNABLE TO UPDATE API KEY"));
  }
}

async function setKey(req, res) {
  try {
    let { key_id } = req.body;
    const email = req.headers["useremail"];

    var query = `update api_key set key_id="${key_id}" where email = "${email}"`;
    const result = await RunQuery(query);

    if (result.success !== null) {
      var selectQuery = `
        select * from api_key where email = "${email}" `;
      const result = await RunQuery(selectQuery);
      res.status(200).json(result);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json(response(null, null, "UNABLE TO SELECT API KEY"));
  }
}

async function remove(req, res) {
  try {
    let { key_id } = req.body;
    const email = req.headers["useremail"];

    var query = `delete from api_key where user_email = "${email}" and key_id="${key_id}"`;
    const result = await RunQuery(query);

    if (result.success !== null) {
      var selectQuery = `
        select * from api_key where user_email = "${email}"`;
      const result = await RunQuery(selectQuery);
      res.status(200).json(result);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json(response(null, null, "UNABLE TO DELETE API KEY"));
  }
}

module.exports = {
  updateKey,
  setStatus,
  setKey,
  setType,
  remove,
  checkStatus,
};
