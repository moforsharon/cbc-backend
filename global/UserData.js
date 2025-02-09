const { fetchData } = require("../libs/fetchData");
const { RunQuery } = require("../services");
const { format, startOfMonth, endOfMonth } = require("date-fns");

const getUserData = async (user_id, res) => {
    const currentDate = new Date();
    const startDate = format(startOfMonth(currentDate), "yyyy-MM-dd");
    const endDate = format(endOfMonth(currentDate), "yyyy-MM-dd");
    console.log("date", startDate, endDate);

    var query = `
            SELECT
            query1.allowed_questions, query2.question_usage, query1.allowed_bots, query3.bots_usage, query1.bot_characters, query1.remove_logo, query1.gpt4, query1.weblinks 
        FROM

        (select 
        ifnull(sum(msg_qty), 0) as allowed_questions, 
        ifnull(sum(bot_qty), 0) as allowed_bots, 
        ifnull(max(bot_characters), 0) as bot_characters, 
        ifnull(max(weblinks), 0) as weblinks, 
        if(sum(remove_logo) > 0 , 1 , 0) as remove_logo,
        ifnull(if(max(gpt_4) > 0, 1, 0),0) as gpt4  
        from subscriptions sb 
        inner join plans pl on sb.plan_name = pl.plan_name 
        where sb.user_id = '${user_id}' and (sb.status = 'active' || sb.status = 'past_due'))  AS query1

        cross join 
        (
        select ifnull(sum(if(cl.key_desc = 'gpt-4', 20 , 1)),0) as question_usage from chatbot cb 
        inner join chat_logs cl on cb.chatbot_id = cl.chatbot_id 
        where cl.status != 'noresponse' and cb.user_id = '${user_id}' and date(cl.create_at) >= '${startDate}' and date(cl.create_at) <= '${endDate}' 
        ) AS query2

        cross join 
        (
        select ifnull(count(distinct(cb.chatbot_id)),0) as bots_usage from chatbot cb 
        where cb.status = 'active' and cb.user_id = '${user_id}' 
        ) AS query3;`;

    const result = await RunQuery(query);

    if (!result?.success) {
        return res
            .status(400)
            .json(response(null, null, "Can't find user data"));
    }

    const userData = fetchData(result?.success);

    return userData;
};

module.exports = { getUserData };
