const mysql = require('mysql');
const connection = mysql.createConnection({
    host: '165.227.154.82',
    user: 'root',
    password: 'root',
    database: 'cbc'
});

connection.connect(err => {
    if (err) throw err;
    console.log('Connected to the database!');
});

exports.save_child_data = (childData, callback) => {
    const sql = `INSERT INTO children (user_id, child_name, child_race_or_ethnicity, child_gender, diagnosis, individual_education_plan, preferred_communication_method_for_request, preferred_communication_method_for_refusal, favorite_things, additional_caregiver_response) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    connection.query(sql, [childData.user_id, childData.child_name, childData.child_race_or_ethnicity, childData.child_gender, childData.diagnosis, childData.individual_education_plan, childData.preferred_communication_method_for_request, childData.preferred_communication_method_for_refusal, childData.favorite_things, childData.additional_caregiver_response], callback);
};

exports.update_child_data = (child_id, childData, callback) => {
    const sql = `UPDATE children SET child_name = ?, child_race_or_ethnicity = ?, child_gender = ?, diagnosis = ?, individual_education_plan = ?, preferred_communication_method_for_request = ?, preferred_communication_method_for_refusal = ?, favorite_things = ?, additional_caregiver_response = ? WHERE child_id = ?`;
    connection.query(sql, [childData.child_name, childData.child_race_or_ethnicity, childData.child_gender, childData.diagnosis, childData.individual_education_plan, childData.preferred_communication_method_for_request, childData.preferred_communication_method_for_refusal, childData.favorite_things, childData.additional_caregiver_response, child_id], callback);
};

exports.get_child_data_by_id = (child_id, callback) => {
    const sql = `SELECT * FROM children WHERE child_id = ?`;
    connection.query(sql, [child_id], callback);
};

exports.get_all_children_data = (callback) => {
    const sql = `SELECT * FROM children`;
    connection.query(sql, callback);
};

exports.delete_child_data_by_id = (child_id, callback) => {
    const sql = `DELETE FROM children WHERE child_id = ?`;
    connection.query(sql, [child_id], callback);
};
