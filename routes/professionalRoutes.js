// routes/professionalRoutes.js

const express = require('express');
const router = express.Router();
const { sendInvites, acceptInvite } = require('../controllers/professionalController');

router.post('/send-invites', sendInvites);
router.get('/accept-invite/:encryptedInviteId/:encryptedUserId/:encryptedChildId', acceptInvite);

module.exports = router;