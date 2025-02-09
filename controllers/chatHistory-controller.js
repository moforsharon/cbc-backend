const { fetchData } = require("../libs/fetchData");
const { getObjectId } = require("../libs/id");
const { newDate } = require("../libs/newDate");
const { response } = require("../response");
const { RunQuery } = require("../services");
const axios = require('axios');

async function get(req, res) {
  try {
    let { _id } = req.body;

    const user_id = req.headers["userid"];
    const chat_summary_id = req.headers["chatsummaryid"];

    var query = `
    select * from chat_logs where user_id = ? and chat_summary_id = ? and status != 'delete'`;
    const values = [user_id, chat_summary_id];
    const result = await RunQuery(query, values);

    var query = `select * from chatbot_assign_data where chatbot_id = ? and types = 'initial_msg'`;
    const valuesM = [_id];
    const initialMessage = await RunQuery(query, valuesM);

    const newData = [
      ...initialMessage?.success?.map((m) => ({
        message: m?.data || "Hi, what would you like to learn about your bot?",
        type: "apiMessage",
        _id: m?.types || "",
      })),
    ];

    const sort = result?.success.sort(
      (a, b) =>
        new Date(a.create_at).getTime() - new Date(b.create_at).getTime()
    );

    for (let i = 0; i < sort?.length; i++) {
      await newData.push({
        message: sort?.[i].question,
        type: "userMessage",
        _id: sort?.[i]._id,
        chat_id: sort?.[i].chat_id,
        review: sort?.[i].review,
      });

      await newData.push({
        message: sort?.[i].response,
        type: "apiMessage",
        _id: sort?.[i]._id,
        chat_id: sort?.[i].chat_id,
        review: sort?.[i].review,
      });
    }

    console.log({ dataaa: result?.success });
    console.log({ newData });

    res.status(200).json(response(newData, null, ""));
  } catch (error) {
    console.log(error);
    res.status(500).json(response(null, null, "UNABLE TO GET CHAT"));
  }
}

async function insert(req, res) {
  try {
    let { _id, question, status, response, machine_id, chat_id, thread_id, chat_summary_id } =
      req.body;
    // const returnResponse = JSON.stringify(response);
    const user_id = req.headers["userid"];

    // let chat_id = getObjectId();
    let conversation_id = await getconversation_id(machine_id, _id);

    console.log("conversation_id", conversation_id);

    var query = `
    select model from chatbot where chatbot_id = ? `;
    const key_values = [_id];
    const result = await RunQuery(query, key_values);
    const data = fetchData(result?.success);
    const key_desc = data?.model;

    var query = `
    INSERT INTO chat_logs (chat_id, conversation_id, chatbot_id , question, response, status,key_desc,machine_id,thread_id,user_id,chat_summary_id) VALUES
    (?,?,?,?,?,?,?,?,?,?,?)`;
    let values = [
      chat_id,
      conversation_id,
      _id,
      question,
      response,
      status,
      key_desc,
      machine_id,
      thread_id,
      user_id,
      chat_summary_id
    ];

    const resultu = await RunQuery(query, values);

    if (resultu.success !== null) {

      // Update chat summary's updated_at value
      var updateQuery = `
      UPDATE chat_summaries SET updated_at = NOW() WHERE chat_summary_id = ?`;
      const updateValues = [chat_summary_id];
      await RunQuery(updateQuery, updateValues);


      var query = `
      select * from chat_logs WHERE chat_id = ? `;
      const values = [_id];
      const result = await RunQuery(query, values);

      res.status(200).json(result);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json(response(null, null, "ERROR IN chat_logs"));
  }
}

async function getConversationHistory(req, res) {
  try {
    let { conversation_id, _id } = req.body;
    var query = `
  select * from chat_logs where conversation_id =? and chatbot_id = ? `;
    const values = [conversation_id, _id];
    const result = await RunQuery(query, values);

    const newData = [];

    for (let i = 0; i < result?.success?.length; i++) {
      newData.push({
        message: result?.success[i].question,
        type: "userMessage",
        _id: result?.success[i]._id,
      });

      newData.push({
        message: result?.success[i].response,
        type: "apiMessage",
        _id: result?.success[i]._id,
      });
    }
    res.status(200).json(response(newData, null, ""));
  } catch (error) {
    console.log(error);
    res.status(500).json(response(null, null, "UNABLE TO GET CONVERSATION"));
  }
}

async function getConversationIds(req, res) {
  try {
    let { _id } = req.body;

    var query = `SELECT cl1.*
    FROM chat_logs AS cl1
    INNER JOIN (
        SELECT conversation_id, MIN(create_at) AS min_create_at
        FROM chat_logs
        WHERE chatbot_id = ?
        GROUP BY conversation_id
    ) AS cl2
    ON cl1.conversation_id = cl2.conversation_id AND cl1.create_at = cl2.min_create_at
    WHERE cl1.chatbot_id = ?`;

    const values = [_id, _id];
    const result = await RunQuery(query, values);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function single(req, res) {
  try {
    let { _id } = req.body;
    var query = `
    select * from chat_logs WHERE chat_id = ?`;
    const values = [_id];
    const result = await RunQuery(query, values);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function getconversation_id(machine_id, _id) {
  var query = `SELECT create_at, conversation_id FROM chat_logs WHERE machine_id = ? AND chatbot_id =?
ORDER BY create_at DESC LIMIT 1`;
  const caht_log_values = [machine_id, _id];
  const chat_result = await RunQuery(query, caht_log_values);
  const chat_data = fetchData(chat_result?.success);

  let conversation_id;

  if (chat_data?.create_at) {
    let previousCreateAt = chat_data.create_at;
    let newCreateAt = new Date();
    let previousDate = new Date(previousCreateAt);
    let newDateValue = new Date(newCreateAt);
    let timeDifference = newDateValue - previousDate;
    let maxTimeDifference = 3 * 60 * 1000;

    if (timeDifference <= maxTimeDifference) {
      conversation_id = chat_data.conversation_id;
    } else {
      conversation_id = getObjectId();
    }
  } else {
    conversation_id = getObjectId();
  }

  return conversation_id;
}

async function update(req, res) {
  try {
    let { chat_id, user_email, file_id, question, status, response } = req.body;
    var query = `UPDATE chat_logs SET user_email ="${user_email}",file_id="${file_id}",question="${question}",status="${status}",response="${response}" WHERE chat_id ="${chat_id}"`;
    const result = await RunQuery(query);
    if (result.success !== null) {
      var query = `
      select * from chat_logs WHERE chat_id = ? `;
      const values = [_id];
      const result = await RunQuery(query, values);
      res.status(200).json(result);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function remove(req, res) {
  try {
    const user_id = req.headers["userid"];
    var query = `
    update chat_logs set status = ? WHERE user_id = ? `;
    const values = ["delete", user_id];
    const result = await RunQuery(query, values);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function likeDislike(req, res) {
  try {
    let { review, feedback, chat_id } = req.body;

    var query = `UPDATE chat_logs SET review = ?, feedback = ? WHERE chat_id = ?`;
    const value = [review, feedback, chat_id];
    const result = await RunQuery(query, value);

    if (result.success !== null) {
      var query = `
      select * from chat_logs WHERE chat_id = ?`;
      const valueS = [chat_id];
      const result = await RunQuery(query, valueS);
      res.status(200).json(result);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function getReview(req, res) {
  try {
    let { _id } = req.body;
    var query = `
    select * from chat_logs WHERE chatbot_id = ? and review is not null`;

    const values = [_id];
    const result = await RunQuery(query, values);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function updatebulkReview(req, res) {
  try {
    let { review, chat_id } = req.body;
    console.log("updatebulkReview", { review, chat_id });

    const placeholders = chat_id.map(
      (update, index) => `(CASE WHEN chat_id = ? THEN ? ELSE review END)`
    );
    var query = `
    UPDATE chat_logs
    SET review = CASE 'review' END
    WHERE chat_id IN (${chat_id.map((update) => "?").join(", ")})
  `;
    const values = [review, chat_id];
    const result = await RunQuery(query, values);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

getHumanResponse = async (prompt) => {
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o', // General-purpose model for language response
      messages: [
        {
          "role": "system",
          "content": "As a child behaviour check-in specialist for children, your role is to summerize the user's message into a single sentence of at most 5 words"
        },          
        { "role": "user", "content": prompt }
      ],
      max_tokens: 150
    }, {
      headers: {
        'Authorization': `Bearer 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`
      }
    });

    // Extract the response
    const intelligentResponse = response.data.choices[0].message.content;
    return intelligentResponse.trim();
  } catch (error) {
    console.error('Error calling OpenAI API for response:', error.response?.data || error.message);
    throw new Error('OpenAI API call failed for response generation');
  }
};

async function generateChatSummary(req, res) {
  try {
    const { userQuestion } = req.body;
    const user_id = req.headers["userid"];

    // Generate chat summary
    const chatSummaryPrompt = `Summarize this interaction into a few words (maybe at most five words). It should be in passive voice: User asked "${userQuestion}".`;
    const chatSummary = await getHumanResponse(chatSummaryPrompt);

    // Store new chat summary
    var query = `
      INSERT INTO chat_summaries (chat_summary,user_id) VALUES (?,?)`;
    const values = [chatSummary, user_id];

    const result = await RunQuery(query, values);

    if (result.success !== null) {
      var query = `
        SELECT chat_summary_id FROM chat_summaries ORDER BY chat_summary_id DESC LIMIT 1`;
      const result = await RunQuery(query);

      const newChatSummaryId = result.success[0].chat_summary_id;

      res.status(200).json({ chat_summary_id: newChatSummaryId });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json(response(null, null, "ERROR GENERATING CHAT SUMMARY"));
  }
}

async function getAllChatSummaries(req, res) {
  try {
    const userId = req.headers["userid"];

    // Fetch all unique chat_summary_ids linked to the user's machine IDs
    var query = `SELECT * FROM chat_summaries WHERE user_id = ? ORDER BY updated_at DESC`;
    const values = [userId];
    const chatSummariesResult = await RunQuery(query, values);

    if (!chatSummariesResult.success.length) {
      return res.status(404).json({ message: 'No chat summaries found for this user' });
    }

    res.status(200).json(chatSummariesResult.success);
  } catch (error) {
    console.error('Error fetching chat summaries:', error);
    res.status(500).json({ message: 'Error fetching chat summaries' });
  }
}

async function getArchivedChatSummaries(req, res) {
  try {
    const userId = req.headers["userid"];

    // Fetch all unique chat_summary_ids linked to the user's machine IDs
    var query = `SELECT * FROM chat_summaries WHERE user_id = ? AND isArchived = ? ORDER BY updated_at DESC`;
    const values = [userId, true];
    const chatSummariesResult = await RunQuery(query, values);

    if (!chatSummariesResult.success.length) {
      return res.status(404).json({ message: 'No archived chat summaries found for this user' });
    }

    res.status(200).json(chatSummariesResult.success);
  } catch (error) {
    console.error('Error fetching archived chat summaries:', error);
    res.status(500).json({ message: 'Error fetching archived chat summaries' });
  }
}

async function getActiveChatSummaries(req, res) {
  try {
    const userId = req.headers["userid"];

    // Fetch all unique chat_summary_ids linked to the user's machine IDs
    var query = `SELECT * FROM chat_summaries WHERE user_id = ? AND isArchived = ? ORDER BY updated_at DESC`;
    const values = [userId, false];
    const chatSummariesResult = await RunQuery(query, values);

    if (!chatSummariesResult.success.length) {
      return res.status(404).json({ message: 'No active chat summaries found for this user' });
    }

    res.status(200).json(chatSummariesResult.success);
  } catch (error) {
    console.error('Error fetching active chat summaries:', error);
    res.status(500).json({ message: 'Error fetching active chat summaries' });
  }
}

async function archiveChatSummary(req, res) {
  try {
    const userId = req.headers["userid"];
    const chatSummaryId = req.headers["chatsummaryid"];

    // Update isArchived to true for the specified chat summary
    var query = `UPDATE chat_summaries SET isArchived = ? WHERE user_id = ? AND chat_summary_id = ?`;
    const values = [true, userId, chatSummaryId];
    const archiveResult = await RunQuery(query, values);

    if (!archiveResult.affectedRows) {
      return res.status(404).json({ message: 'Chat summary not found or already archived' });
    }

    res.status(200).json({ message: 'Chat summary archived successfully' });
  } catch (error) {
    console.error('Error archiving chat summary:', error);
    res.status(500).json({ message: 'Error archiving chat summary' });
  }
}

async function unarchiveChatSummary(req, res) {
  try {
    const userId = req.headers["userid"];
    const chatSummaryId = req.headers["chatsummaryid"];

    // Update isArchived to true for the specified chat summary
    var query = `UPDATE chat_summaries SET isArchived = ? WHERE user_id = ? AND chat_summary_id = ?`;
    const values = [false, userId, chatSummaryId];
    const archiveResult = await RunQuery(query, values);

    if (!archiveResult.affectedRows) {
      return res.status(404).json({ message: 'Chat summary not found or already archived' });
    }

    res.status(200).json({ message: 'Chat summary archived successfully' });
  } catch (error) {
    console.error('Error archiving chat summary:', error);
    res.status(500).json({ message: 'Error archiving chat summary' });
  }
}

module.exports = {
  get,
  insert,
  update,
  remove,
  single,
  getConversationHistory,
  getConversationIds,
  likeDislike,
  getReview,
  updatebulkReview,
  getAllChatSummaries,
  generateChatSummary,
  getArchivedChatSummaries,
  getActiveChatSummaries,
  archiveChatSummary,
  unarchiveChatSummary
};
