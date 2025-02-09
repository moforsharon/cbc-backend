const { fetchData } = require("../libs/fetchData");
const jwt = require("jsonwebtoken");
const { getObjectId } = require("../libs/id");
const { RunQuery, RunTransactionQuery } = require("../services");
const { response } = require("../response");
const config = require("config");
const {
  errorFunction,
  removeBulkFiles,
  setSourceFIles,
  run,
  insertBot,
  updateBot,
  updateBulkSource,
  removePrevFile,
  removeBulkFilesS3,
} = require("./createBot-controller");
const { deleteFileS3 } = require("../libs/removeFrom-s3");
const {
  beginTransaction,
  rollbackTransaction,
  commitTransaction,
} = require("../connection");
const { getUserData } = require("../global/UserData");
const { genericApi } = require("../libs/genericApi");
const { extractText } = require("../libs/extractText");
const OpenAI = require("openai");
const { scrapLocal } = require("./scrapper-controller");

async function getBots(req, res) {
  try {
    const user_id = req.headers["userid"];

    var botquery = `select name,chatbot_id,create_at from chatbot where user_id = ? and status != 'inactive'`;
    const botResult = await RunQuery(botquery, [user_id]);

    res.status(200).json(botResult);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json(response(null, null, "user_name or password incorrect"));
  }
}

async function chatbotCount(req, res) {
  try {
    const user_id = req.headers["userid"];

    var query = `
    SELECT users.* FROM users WHERE user_id = ?;`;

    const result = await RunQuery(query, [user_id]);

    if (!result?.success) {
      return res.status(400).json(response(null, null, "Can't find user data"));
    }

    const Udata = fetchData(result?.success);

    console.log({ Udata });

    if (Udata && Udata?.password) {
      delete Udata.password; // Remove the "password" field from the object
    }

    if (Udata?.status === "inactive")
      return res.status(401).send("USER HAS BEEN INACTIVE!");

    if (!Udata?.email)
      return res
        .status(401)
        .json(response(null, null, "Invalid email or password"));

    if (Udata?.verified === "0") {
      return res.status(403).json(response(null, null));
    }

    const userData = await getUserData(user_id, res);

    if (!(userData.bots_usage < userData.allowed_bots))
      return res
        .status(200)
        .json(
          response(
            false,
            null,
            "Exceeded chatbot limits! Upgrade your plan to continue."
          )
        );

    res.status(200).json(response(true, null, ""));
  } catch (error) {
    console.log(error);
    res
      .status(200)
      .json(
        response(
          false,
          null,
          "Exceeded chatbot limits! Upgrade your plan to continue."
        )
      );
  }
}

function transformArray(arr) {
  let result = [];
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].type === "file" || arr[i].type === "youtube") {
      result.push(/* arr[i].file_id  */ arr[i].source_id);
    } else if (arr[i].type === "question") {
      let obj = {};
      obj.file_id = arr[i].source_id;
      obj.file = arr[i].question + " " + arr[i].answer;
      result.push(obj);
    } else if (arr[i].type === "text") {
      let obj = {};
      obj.file_id = arr[i].source_id;
      obj.file = arr[i].source_name;
      result.push(obj);
    }
  }
  return result;
}
//==============================================================

function modifyUrlWithWWW(url) {
  if (url.includes("www.")) {
    return url.replace("www.", "");
  } else if (!url.includes("www.")) {
    return url.replace("https://", "https://www.");
  }
}

async function handleGetResponse(url, connection, res) {
  let resultFetch = {};
  const result = scrapLocal(url);
  if (result?.length > 1) {
    return result;
  } else {
    resultFetch = await handleCallResponse(url);
    if (!resultFetch?.extracted_urls?.length) {
      resultFetch = await handleCallResponse(modifyUrlWithWWW(url));
    }
    return resultFetch;
  }
}

async function handleCallResponse(url) {
  const response = await fetch(`https://whisper.chatdox.com/scrape`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: url,
    }),
  });
  const result = await response.json();
  return result;
}

//===============================================================
async function extractLinks(url, connection, res) {
  try {
    const links = url?.map((f) => f.source_name).join(",");

    console.log({ links });
    const response = await fetch(
      `https://whisper.chatdox.com/scrape_page`,

      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: links }),
      }
    );
    const result = await response.json();

    return result;
  } catch (error) {
    console.log(error);
    rollbackTransaction(connection);
    res.status(500).json(response(null, null, "Fail to ingest data!"));
  }
}

async function create(req, res) {
  try {
    let { name, sourceFiles } = req?.body;

    const chatbot_id = getObjectId();
    const user_id = req.headers["userid"];

    connection = await beginTransaction();

    const links = sourceFiles?.filter((s) => s.type == "website");
    const transform = sourceFiles?.filter((s) => s.type !== "website");

    const file_ids = await transformArray(transform);

    const linkText = await extractLinks(links, connection, res);
    // const url = links?.map((f) => f.source_name).join(",");
    // const linkText = await handleGetResponse(url, connection, res);

    if (linkText?.extracted_data) {
      file_ids?.push({
        file_id: getObjectId(),
        file: linkText?.extracted_data,
      });
    }

    console.log({ linkText });
    console.log({ file_ids });

    const runResult = await genericApi({
      url: "folder",
      method: "POST",
      data: {
        folder_id: getObjectId(),
        files_to_add: file_ids,
        storage_type: "aws",
      },
    });
    console.log({ runResult });

    if (!runResult?.success) {
      return await errorFunction({
        chatbot_file_name: runResult?.success?.file?.name,
        res,
        filesToDelete: sourceFiles,
        connection,
      });
    }

    const result = await insertBot({
      chatbot_id,
      user_id,
      number_of_characters: runResult?.success?.text_content?.length,
      name,
      chatbot_file_name: runResult?.success?.file?.name,
      connection,
    });

    if (!result?.success) {
      return await errorFunction({
        chatbot_file_name: runResult?.success?.file?.name,
        res,
        filesToDelete: sourceFiles,
        connection,
      });
    }

    const sourceResult = await setSourceFIles(
      sourceFiles,
      chatbot_id,
      connection
    );

    if (!sourceResult?.success) {
      return await errorFunction({
        chatbot_file_name: runResult?.success?.file?.name,
        res,
        filesToDelete: sourceFiles,
        connection,
      });
    }

    const assign_language_id = getObjectId();
    var query = `insert into assign_language (assign_language_id,chatbot_id,language_id,status) values (?,?,?,?)`;

    const valuesInsert = [assign_language_id, chatbot_id, 1, "enable"];

    const resultAL = await RunTransactionQuery(query, connection, valuesInsert);

    if (!resultAL?.success) {
      return await errorFunction({
        chatbot_file_name: runResult?.success?.file?.name,
        res,
        filesToDelete: sourceFiles,
        connection,
      });
    }

    // var query = `insert into assign_language_source (assign_language_source_id,assign_language_id) values (?,?)`;

    // const valuesAssingSource = [assign_language_id, assign_language_id];

    // const resultALS = await RunTransactionQuery(
    //   query,
    //   connection,
    //   valuesAssingSource
    // );

    // if (!resultALS?.success)
    //   return res
    //     .status(500)
    //     .json(response(null, null, "UNABLE TO ASSIGN LANGUAGE"));

    await commitTransaction(connection);

    console.log("response", result);

    res.status(200).json(result);
  } catch (error) {
    console.log(error);
    rollbackTransaction(connection);
    res.status(500).json(response(null, null, "Fail to ingest data!"));
  }
}

async function update(req, res) {
  try {
    let { chatbot_id, name, sourceFiles, textContent } = req?.body;

    const filesToDelete = sourceFiles?.filter(
      (s) => s?.source_type === "delete"
    );
    const filesToUpdate = sourceFiles?.filter(
      (s) => s?.source_type === "update" && s.type !== "website"
    );
    const filesToAdd = sourceFiles?.filter((s) => s?.source_type === "new");

    connection = await beginTransaction();

    const links = sourceFiles?.filter(
      (s) => s.type == "website" && s?.source_type !== "delete"
    );
    const transform = filesToAdd?.filter((s) => s.type !== "website");

    const files_to_add = transformArray(transform);

    const linkText = await extractLinks(links, connection, res);
    if (linkText?.extracted_data) {
      files_to_add?.push({
        file_id: getObjectId(),
        file: linkText?.extracted_data,
      });
    }

    console.log({ linkText });

    console.log({ files_to_add });
    const files_to_remove = filesToDelete?.map((f) => f.source_id);
    console.log({ files_to_remove });

    // extractText(chatbot_id);

    console.log({ textContent });
    console.log({ filesToUpdate });
    const runResult = await genericApi({
      url: "folder",
      method: "POST",
      data: {
        folder_id: chatbot_id,
        files_to_add,
        files_to_remove,
        text_content: textContent,
        storage_type: "aws",
      },
    });

    console.log({ runResult });

    if (!runResult?.success) {
      return await errorFunction({
        chatbot_file_name: runResult?.success?.file?.name,
        res,
        connection,
      });
    }

    if (filesToDelete?.length) {
      const source_ids = filesToDelete?.map((f) => f.source_id);
      const deleteFromDB = await removeBulkFiles(
        chatbot_id,
        source_ids,
        connection
      );
      if (!deleteFromDB?.success) {
        console.log({ deleteFromDB });
        return await errorFunction({
          chatbot_file_name: runResult?.success?.file?.name,
          res,
          connection,
        });
      }
      console.log({ filesToDelete });
      const deleteResult = await removeBulkFilesS3(
        filesToDelete,
        /* "file_id" || */ "source_id"
      );
      if (!deleteResult?.success) {
        console.log({ deleteResult });
        return await errorFunction({
          chatbot_file_name: runResult?.success?.file?.name,
          res,
          connection,
        });
      }
    }

    if (filesToUpdate?.length) {
      const updateBulkFiles = await updateBulkSource(
        filesToUpdate,
        chatbot_id,
        connection
      );
      if (!updateBulkFiles?.success) {
        console.log({ updateBulkFiles });
        return errorFunction({
          chatbot_file_name: runResult?.success?.file?.name,
          res,
          connection,
        });
      }
    }

    if (filesToAdd?.length) {
      const sourceResult = await setSourceFIles(
        filesToAdd,
        chatbot_id,
        connection
      );
      if (!sourceResult?.success) {
        console.log({ updateBulkFiles });
        return errorFunction({
          chatbot_file_name: runResult?.success?.file?.name,
          res,
          connection,
        });
      }
    }
    // console.log("calls removedFile");
    // const removedFile = await removePrevFile(chatbot_id, connection);

    // if (!removedFile?.success) {
    //   return await errorFunction({ chatbot_file_name, res, connection });
    // }

    const result = await updateBot({
      chatbot_id,
      number_of_characters: runResult?.success?.text_content?.length,
      name,
      chatbot_file_name: runResult?.success?.file?.name,
      connection,
    });

    if (!result?.success) {
      console.log({ result });
      return await errorFunction({
        chatbot_file_name: runResult?.success?.file?.name,
        res,
        connection,
      });
    }

    await commitTransaction(connection);
    console.log("response", result);
    res.status(200).json(result);
  } catch (error) {
    console.log(error);
    rollbackTransaction(connection);
    res.status(500).json(response(null, null, "Fail to ingest data!"));
  }
}

async function getBotSource(req, res) {
  try {
    const { chatbot_id } = req?.body;
    const _id = req.headers["userid"];
    console.log("chatbot_id", chatbot_id);
    var query = `
    select * from sources WHERE chatbot_id = ?`;
    const values = [chatbot_id];
    const resultu = await RunQuery(query, values);
    // console.log("resultu", resultu);
    res.status(200).json(resultu);
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function getBotData(req, res) {
  try {
    const { chatbot_id } = req?.body;

    var query = `select * from chatbot where chatbot_id = ?`;
    const values = [chatbot_id];
    const resultu = await RunQuery(query, values);

    var query = `select * from default_settings`;
    const valuesd = [chatbot_id];
    const resultd = await RunQuery(query, valuesd);

    var query = `select * from chatbot_assign_data where chatbot_id = ?`;
    const valuesM = [chatbot_id];
    const resultM = await RunQuery(query, valuesM);

    var query = `select * from languages`;
    const resultL = await RunQuery(query);

    var query = `select * from assign_language where chatbot_id = ? `;
    const valuesL = [chatbot_id];
    const resultAL = await RunQuery(query, valuesL);

    const message = resultM?.success;
    const resultAll = [
      ...resultu?.success,
      message,
      ...resultd?.success,
      resultL?.success,
      resultAL?.success,
    ];

    res.status(200).json(response(resultAll, null, ""));
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function generalSetting(req, res) {
  try {
    const { name, chatbot_id } = req?.body;

    var query = `update chatbot set name = ? where chatbot_id = ?`;
    const valuesu = [name, chatbot_id];
    const resultu = await RunQuery(query, valuesu);

    if (!resultu?.success)
      return res.status(500).json(response(null, null, "unable to update bot"));

    var query = `select name,chatbot_id from chatbot where chatbot_id = ?`;
    const values = [chatbot_id];
    const result = await RunQuery(query, values);

    res
      .status(200)
      .json(response(result?.success, null, "Your changes are saved."));
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function leadsSetting(req, res) {
  try {
    const {
      leads_title,
      leads_name,
      leads_name_value,
      leads_email,
      leads_email_value,
      leads_number,
      leads_number_value,
      chatbot_id,
    } = req?.body;

    console.log("req?.body", req?.body);

    var query = `update chatbot set 
    leads_title = ?, leads_name = ?, leads_name_value = ?, leads_email = ?,
    leads_email_value = ?, leads_number = ?, leads_number_value = ? 
    where chatbot_id = ?`;

    const valuesu = [
      leads_title,
      leads_name,
      leads_name_value,
      leads_email,
      leads_email_value,
      leads_number,
      leads_number_value,
      chatbot_id,
    ];
    const resultu = await RunQuery(query, valuesu);

    if (!resultu?.success)
      return res.status(500).json(response(null, null, "unable to update bot"));

    var query = `select leads_title,
    leads_name,
    leads_name_value,
    leads_email,
    leads_email_value,
    leads_number,
    leads_number_value
     from chatbot where chatbot_id = ?`;
    const values = [chatbot_id];
    const result = await RunQuery(query, values);

    res
      .status(200)
      .json(response(result?.success, null, "Your changes are saved."));
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function openAISetting(req, res) {
  try {
    const {
      prompt,
      model,
      temperature,
      message_history,
      prompt_template,
      chatbot_id,
    } = req?.body;
    console.log({ openAISetting: req?.body });
    var query = `update chatbot set prompt = ?, model=?,temperature=?,message_history=?,prompt_template=? where chatbot_id = ?`;
    const valuesu = [
      prompt,
      model,
      temperature,
      message_history,
      prompt_template,
      chatbot_id,
    ];
    const resultu = await RunQuery(query, valuesu);

    if (!resultu?.success)
      return res.status(500).json(response(null, null, "unable to update bot"));

    var query = `select prompt, model, temperature,message_history,prompt_template from chatbot where chatbot_id = ?`;
    const values = [chatbot_id];
    const result = await RunQuery(query, values);

    res
      .status(200)
      .json(response(result?.success, null, "Your changes are saved."));
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function chatbot_data(messages, chatbot_id) {
  console.log("new_messages", messages);

  const placeholders = messages?.map(() => "(?, ?, ?, ?, ?)").join(", ");

  const values = messages?.flatMap((record) => [
    getObjectId(),
    chatbot_id,
    record.data,
    record.heading,
    record.types,
  ]);

  const query = `INSERT INTO chatbot_assign_data (data_id, chatbot_id, data, heading, types)
  VALUES ${placeholders}`;

  const result = await RunQuery(query, values);

  return result;
}

async function del_chatbot_data(data_ids, chatbot_id) {
  console.log("data_ids", data_ids);
  let vals = data_ids?.join("','");
  var query = `delete from chatbot_assign_data where data_id in ('${vals}') and chatbot_id='${chatbot_id}'`;

  const result = await RunQuery(query);

  return result;
}

async function accessSetting(req, res) {
  try {
    const {
      messages,
      visibility,
      allow_on_specific_domains,
      rate_limit_time,
      rate_limit_message,
      limit_hit_message,
      chatbot_id,
    } = req?.body;

    var query = `update chatbot set visibility=?,allow_on_specific_domains=?,rate_limit_time=?,
                 rate_limit_message=?,limit_hit_message=? where chatbot_id = ?`;
    const valuesu = [
      visibility,
      allow_on_specific_domains,
      rate_limit_time,
      rate_limit_message,
      limit_hit_message,
      chatbot_id,
    ];
    const resultu = await RunQuery(query, valuesu);

    if (!resultu?.success)
      return res.status(500).json(response(null, null, "unable to update bot"));

    if (messages?.length) {
      const new_messages = messages?.filter((f) => f.selected_type == "new");
      const deleted_messages = messages?.filter(
        (f) => f.selected_type == "delete"
      );
      if (new_messages?.length) {
        const dataResult = await chatbot_data(new_messages, chatbot_id);

        console.log("dataResult", dataResult);

        if (!dataResult?.success)
          return res
            .status(500)
            .json(response(null, null, "unable to update bot"));
      }

      if (deleted_messages?.length) {
        const data_ids = deleted_messages?.map((f) => f.data_id);
        const dataResult = await del_chatbot_data(data_ids, chatbot_id);

        console.log("dataResult", dataResult);

        if (!dataResult?.success)
          return res
            .status(500)
            .json(response(null, null, "unable to update bot"));
      }
    }

    var query = `select 
                  visibility,
                  allow_on_specific_domains,
                  rate_limit_time,
                  rate_limit_message,
                  limit_hit_message from 
                  chatbot where chatbot_id = ?`;

    const values = [chatbot_id];
    const result = await RunQuery(query, values);

    var query = `select * from chatbot_assign_data where chatbot_id = ? and types = 'domains'`;
    const valuesM = [chatbot_id];
    const resultM = await RunQuery(query, valuesM);

    const resultAll = [...result?.success, resultM?.success];

    res.status(200).json(response(resultAll, null, "Your changes are saved."));
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function interfaceSetting(req, res) {
  try {
    const {
      messages,
      theme,
      profile_picture,
      remove_profile_picture,
      interface_display_name,
      user_message_color,
      chat_icon,
      remove_chat_icon,
      chat_bubble_button_color,
      align_chat_bubble_button,
      initial_messages_popup_time,
      welcome_message,
      name,
      welcome_title,
      placeholder_text,
      bubble_launcher_text,
      brand_logo,
      remove_brand_logo,
      enable_source,
      enable_powered_by,
      chatbot_id,
      light_accent_color,
      light_text_color,
      dark_accent_color,
      dark_text_color,
    } = req?.body;
    console.log("calls interfaceSettingss", req?.body);

    var query = `update chatbot set
    theme = ?,
    profile_picture=?,
    remove_profile_picture=?,
    interface_display_name=?,
    user_message_color=?,
    chat_icon=?,
    remove_chat_icon=?,
    chat_bubble_button_color=?,
    align_chat_bubble_button=?,
    initial_messages_popup_time=?,
    welcome_message=?,
    name=?,
      welcome_title=?,
      placeholder_text=?,
      bubble_launcher_text=?,
      brand_logo=?,
      remove_brand_logo=?,
      enable_source=?,
      enable_powered_by=?,
      light_accent_color=?,
light_text_color=?,
dark_accent_color=?,
dark_text_color=?

    where chatbot_id = ?`;

    const valuesu = [
      theme,
      profile_picture,
      remove_profile_picture,
      interface_display_name,
      user_message_color,
      chat_icon,
      remove_chat_icon,
      chat_bubble_button_color,
      align_chat_bubble_button,
      initial_messages_popup_time,
      welcome_message,
      name,
      welcome_title,
      placeholder_text,
      bubble_launcher_text,
      brand_logo,
      remove_brand_logo,
      enable_source,
      enable_powered_by,
      light_accent_color,
      light_text_color,
      dark_accent_color,
      dark_text_color,
      chatbot_id,
    ];

    const resultu = await RunQuery(query, valuesu);
    console.log("calls interfaceSetting", resultu);
    if (!resultu?.success)
      return res.status(500).json(response(null, null, "unable to update bot"));

    if (messages?.length) {
      const new_messages = messages?.filter((f) => f.selected_type == "new");
      const deleted_messages = messages?.filter(
        (f) => f.selected_type == "delete"
      );

      if (new_messages?.length) {
        const dataResult = await chatbot_data(new_messages, chatbot_id);

        console.log("dataResult", dataResult);

        if (!dataResult?.success)
          return res
            .status(500)
            .json(response(null, null, "unable to update bot"));
      }

      if (deleted_messages?.length) {
        console.log("deleted_messages", deleted_messages);
        const data_ids = deleted_messages?.map((f) => f.data_id);
        const dataResult = await del_chatbot_data(data_ids, chatbot_id);

        console.log("dataResult", dataResult);

        if (!dataResult?.success)
          return res
            .status(500)
            .json(response(null, null, "unable to update bot"));
      }
    }

    var query = `select theme,
    profile_picture,
    remove_profile_picture,
    interface_display_name,
    user_message_color,
    chat_icon,
    remove_chat_icon,
    chat_bubble_button_color,
    align_chat_bubble_button,
    initial_messages_popup_time,welcome_message,
    
    name,
      welcome_title,
      placeholder_text,
      bubble_launcher_text,
      brand_logo,
      remove_brand_logo,
      enable_source,
      enable_powered_by,
      light_accent_color,
      light_text_color,
      dark_accent_color,
      dark_text_color

    from chatbot where chatbot_id = ?`;

    const values = [chatbot_id];
    const result = await RunQuery(query, values);

    var query = `select * from chatbot_assign_data where chatbot_id = ? and types != 'domains'`;
    const valuesM = [chatbot_id];
    const resultM = await RunQuery(query, valuesM);

    const resultAll = [...result?.success, resultM?.success];

    res.status(200).json(response(resultAll, null, "Your changes are saved."));
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function getBotSetting(req, res) {
  try {
    const { chatbot_id, language_id } = req?.body;
    console.log({ chatbot_id, language_id });

    var query = `select theme,
    profile_picture,
    remove_profile_picture,
    interface_display_name,
    user_message_color,
    chat_icon,
    remove_chat_icon,
    chat_bubble_button_color,
    align_chat_bubble_button,
    initial_messages_popup_time,
    leads_email,leads_email_value,
    leads_name,leads_name_value,
    leads_number,leads_number_value,leads_title,
    limit_hit_message,
    visibility,
    welcome_message,
    welcome_title,
    placeholder_text,
    bubble_launcher_text,
    brand_logo,
    remove_brand_logo,
    enable_source,
    enable_powered_by,
    name,
    light_accent_color,
light_text_color,
dark_accent_color,
dark_text_color,
create_at,
default_language
    from chatbot where chatbot_id = ?`;

    const values = [chatbot_id];
    const result = await RunQuery(query, values);

    var query = `select * from chatbot_assign_data where chatbot_id = ? `;
    const valuesM = [chatbot_id];
    const resultM = await RunQuery(query, valuesM);

    var query = `select * from assign_language where chatbot_id = ? `;
    const valuesL = [chatbot_id];
    const resultAL = await RunQuery(query, valuesL);

    const assignedLang = await resultAL?.success?.find(
      (l) => l?.language_id == (language_id ?? 1) && l?.chatbot_id == chatbot_id
    );

    var query = `select * from assign_language_source where assign_language_id = ? `;
    const valuesALS = [assignedLang?.assign_language_id];
    const resultALS = await RunQuery(query, valuesALS);

    var query = `select * from languages`;
    const resultL = await RunQuery(query);

    const resultAll = [
      ...result?.success,
      resultM?.success,
      resultAL?.success,
      resultL?.success,
      resultALS?.success,
    ];

    res.status(200).json(response(resultAll, null, ""));
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function getBubbleSetting(req, res) {
  try {
    const { chatbot_id } = req?.body;
    console.log("chatbot_id123123", chatbot_id);
    var query = `select
    chat_icon,
    remove_chat_icon,
    chat_bubble_button_color,
    align_chat_bubble_button,
    theme,
    bubble_launcher_text
    from chatbot where chatbot_id = ?`;

    const values = [chatbot_id];
    const result = await RunQuery(query, values);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function setLeadData(req, res) {
  try {
    const { machine_id, email, number, name } = req?.body;

    const lead_id = getObjectId();

    const query = `INSERT INTO leads (lead_id, machine_id, email, number, name)
    VALUES (?, ?, ?, ?, ?)`;
    const values = [lead_id, machine_id, email, number, name];

    const result = await RunQuery(query, values);

    console.log("result", result);

    if (!result?.success)
      return es
        .status(500)
        .json(response(null, { status: false }, "SOMETHING WENTS WRONG"));

    res
      .status(200)
      .json(
        response({ status: true }, null, "The lead has been sent successfully.")
      );
  } catch (error) {
    res
      .status(500)
      .json(response(null, { status: false }, "SOMETHING WENTS WRONG"));
  }
}

async function getLeadData(req, res) {
  try {
    const { chatbot_id } = req?.body;

    const query = `SELECT DISTINCT *
    FROM leads ld
    WHERE machine_id IN (SELECT DISTINCT machine_id FROM chat_logs WHERE chatbot_id = ?)`;

    const values = [chatbot_id];

    const result = await RunQuery(query, values);

    console.log("result", result);

    if (!result?.success)
      return es.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function deleteBot(req, res) {
  try {
    const { chatbot_id } = req?.body;

    const query = `
    update chatbot set status = 'inactive' where chatbot_id  = ?
    `;

    const values = [chatbot_id];

    const result = await RunQuery(query, values);

    console.log("result", result);

    if (!result?.success)
      return es.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));

    res.status(200).json(response({ chatbot_id }, null, ""));
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function textToAudio(req, res) {
  try {
    const { text } = req?.body;

    console.log({ text });

    const openai = new OpenAI({
      apiKey: process.env.API_KEY_OPENAI,
    });

    const mp3 = await openai.audio.speech.create({
      model: "tts-1-hd",
      voice: "alloy",
      input: text,
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());

    res.status(200).json(response({ buffer }, null, ""));
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function assign_language(req, res) {
  try {
    const { chatbot_id, language_id } = req?.body;

    const assign_language_id = getObjectId();

    var query = `insert into assign_language (assign_language_id,chatbot_id,language_id,status) values (?,?,?,?)`;

    const valuesInsert = [
      assign_language_id,
      chatbot_id,
      language_id,
      "enable",
    ];

    const resultAL = await RunQuery(query, valuesInsert);

    if (!resultAL?.success)
      return res
        .status(500)
        .json(response(null, null, "UNABLE TO ASSIGN LANGUAGE"));

    var query = `insert into assign_language_source (assign_language_source_id,assign_language_id) values (?,?)`;

    const valuesAssingSource = [getObjectId(), assign_language_id];

    const resultALS = await RunQuery(query, valuesAssingSource);

    if (!resultALS?.success)
      return res
        .status(500)
        .json(response(null, null, "UNABLE TO ASSIGN LANGUAGE"));

    var query = `select * from assign_language where chatbot_id = ?`;

    const value = [chatbot_id];
    const result = await RunQuery(query, value);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function assign_language_update(req, res) {
  try {
    const { status, chatbot_id, language_id } = req?.body;

    var query = `update assign_language set status = ? where language_id = ? and chatbot_id = ?`;

    const valuesInsert = [status, language_id, chatbot_id];

    const resultAL = await RunQuery(query, valuesInsert);

    if (!resultAL?.success)
      return res
        .status(500)
        .json(response(null, null, "SOMETHING WENTS WRONG"));

    var query = `select * from assign_language where chatbot_id = ?`;

    const value = [chatbot_id];
    const result = await RunQuery(query, value);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function assign_language_delete(req, res) {
  try {
    const { chatbot_id, language_id } = req?.body;

    var query = `delete from assign_language where language_id = ? and chatbot_id = ?`;

    const valuesInsert = [language_id, chatbot_id];

    const resultAL = await RunQuery(query, valuesInsert);

    if (!resultAL?.success)
      return res
        .status(500)
        .json(response(null, null, "UNABLE TO DELETE LANGUAGE"));

    var query = `select * from assign_language where chatbot_id = ?`;

    const value = [chatbot_id];
    const result = await RunQuery(query, value);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function assign_language_source(req, res) {
  try {
    const { assign_language_id } = req?.body;

    var query = `select * from assign_language_source where assign_language_id = ?`;

    const value = [assign_language_id];
    const result = await RunQuery(query, value);
    console.log({ result });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function assign_language_source_Update(req, res) {
  try {
    const {
      welcome_message,
      placeholder_text,
      welcome_title,
      assign_language_id,
    } = req?.body;

    console.log({ req: req?.body });

    var query = `update assign_language_source set welcome_message= ?, placeholder_text =?, welcome_title=? where assign_language_id = ?`;

    const value = [
      welcome_message,
      placeholder_text,
      welcome_title,
      assign_language_id,
    ];
    const result = await RunQuery(query, value);

    if (!result?.success)
      return res
        .status(500)
        .json(response(null, null, "UNABLE TO UPDATE MESSAGE(S)"));

    var query = `select * from assign_language_source where assign_language_id = ?`;

    const valueA = [assign_language_id];
    const resultA = await RunQuery(query, valueA);

    res
      .status(200)
      .json(response(resultA?.success, null, "Your changes are saved."));
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

module.exports = {
  create,
  update,
  getBotData,
  getBotSource,
  generalSetting,
  openAISetting,
  accessSetting,
  interfaceSetting,
  getBotSetting,
  leadsSetting,
  setLeadData,
  getLeadData,
  deleteBot,
  getBots,
  chatbotCount,
  getBubbleSetting,
  textToAudio,
  assign_language,
  assign_language_update,
  assign_language_delete,
  assign_language_source,
  assign_language_source_Update,
};
