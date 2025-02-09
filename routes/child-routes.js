const express = require('express');
const router = express.Router();
const child_controller = require('../controllers/child-controller');

router.post('/child', child_controller.save_child_data);
router.put('/child/:child_id', child_controller.update_child_data);
router.get('/child/:child_id', child_controller.retrieve_child_data);
router.get('/children', child_controller.retrieve_all_child_data);
router.delete('/child/:child_id', child_controller.delete_child_data);

module.exports = router;
