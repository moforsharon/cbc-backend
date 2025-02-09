const child_model = require('../models/child-model');

exports.save_child_data = (req, res) => {
    child_model.save_child_data(req.body, (error, result) => {
        if (error) {
            return res.status(500).json({ success: false, message: 'Error saving child data', error });
        }
        res.status(201).json({ success: true, message: 'Child data saved successfully', child_id: result.insertId });
    });
};

exports.update_child_data = (req, res) => {
    const child_id = parseInt(req.params.child_id, 10);
    if (isNaN(child_id)) {
        console.log('Received invalid child_id:', req.params.child_id);
        return res.status(400).json({ success: false, message: 'Invalid child ID provided' });
    }
    child_model.update_child_data(child_id, req.body, (error, result) => {
        if (error) {
            return res.status(500).json({ success: false, message: 'Error updating child data', error });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Child data not found' });
        }
        res.json({ success: true, message: 'Child data updated successfully' });
    });
};

exports.retrieve_child_data = (req, res) => {
    const child_id = parseInt(req.params.child_id, 10);
    if (isNaN(child_id)) {
        console.log('Received invalid child_id:', req.params.child_id);
        return res.status(400).json({ success: false, message: 'Invalid child ID provided' });
    }
    child_model.get_child_data_by_id(child_id, (error, result) => {
        if (error) {
            return res.status(500).json({ success: false, message: 'Error retrieving child data', error });
        }
        if (result.length === 0) {
            return res.status(404).json({ success: false, message: 'Child data not found' });
        }
        res.json({ success: true, child_data: result[0] });
    });
};

exports.retrieve_all_child_data = (req, res) => {
    child_model.get_all_children_data((error, results) => {
        if (error) {
            return res.status(500).json({ success: false, message: 'Error retrieving all children data', error });
        }
        res.json({ success: true, all_children_data: results });
    });
};

exports.delete_child_data = (req, res) => {
    const child_id = parseInt(req.params.child_id, 10);
    if (isNaN(child_id)) {
        console.log('Received invalid child_id:', req.params.child_id);
        return res.status(400).json({ success: false, message: 'Invalid child ID provided' });
    }
    child_model.delete_child_data_by_id(child_id, (error, result) => {
        if (error || result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Child data not found or already deleted' });
        }
        res.json({ success: true, message: 'Child data deleted successfully' });
    });
};
