// controllers/professionalController.js

const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { RunQuery } = require("../services"); // Assuming you have a database utility

// Function to encrypt data
function encrypt(text) {
  const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// Function to decrypt data
function decrypt(encrypted) {
  const decipher = crypto.createDecipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Function to validate email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Function to send invitation email
// async function sendInvitationEmail(email, inviteLink, childName, userEmail) {
//   let transporter = nodemailer.createTransport({
//     host: "smtp.office365.com",
//     port: 587,
//     secure: false,
//     auth: {
//       user: "support@childbehaviorcheck.com",
//       pass: process.env.EMAIL_PASSWORD
//     }
//   });
//   const transporter = nodemailer.createTransport({
//     service: 'outlook', // or 'hotmail'
//     auth: {
//         user: 'support@childbehaviorcheck.com',
//         pass: process.env.EMAIL_PASSWORD
//     }
// });

//   let info = await transporter.sendMail({
//     from: '"Child Behavior Checkin" <support@childbehaviorcheck.com>',
//     to: email,
//     subject: `Invitation to Access ${childName}'s Information`,
//     text: `You've been invited to join Child Behavior Check. Click here to accept: ${inviteLink}`,
//     html: `<p>You've been invited to join Child Behavior Check. <a href="${inviteLink}">Click here to accept</a></p>`
//   });

//   console.log("Message sent: %s", info.messageId);
// }

async function sendInvitationEmail(professionalEmail, inviteLink, childName, parentName, professionalName) {
  const transporter = nodemailer.createTransport({
    service: 'outlook', // or 'hotmail'
    auth: {
      user: 'support@childbehaviorcheck.com',
      pass: process.env.EMAIL_PASSWORD
    }
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invitation to Access ${childName}'s Information</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #0C3948; background-color: #E1F4F9; margin: 0; padding: 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #E1F4F9; padding: 20px;">
        <tr>
          <td>
            <table align="center" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <tr>
                <td style="padding: 40px 30px; text-align: center;">
                  <img src="https://childbehaviorcheck.com/assets/icon.png" alt="Child Behavior Check Logo" style="max-width: 100px; height: auto;">
                </td>
              </tr>
              <tr>
                <td style="padding: 0 30px 20px;">
                  <h1 style="color: #0C3948; margin-bottom: 20px;">Invitation to Access ${childName}'s Information</h1>
                  <p>Dear ${professionalName},</p>
                  <p>You have been invited by ${parentName} to access their child's information, including their data and behavior support plan, on our platform.</p>
                  <p>This access will allow you to:</p>
                  <ul>
                    <li>View ${childName}'s information, data, and behavior support plan</li>
                    <li>Add your own data, which ${parentName} will be able to view</li>
                  </ul>
                  <p>Please note that you will not be able to make any changes to ${parentName}'s account settings or existing data.</p>
                  <p style="text-align: center; margin-top: 30px;">
                    <a href="${inviteLink}" style="background-color: #5EB0E0; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Accept Invitation</a>
                  </p>
                  <p style="margin-top: 30px;">If you have any questions or concerns, please don't hesitate to reach out to ${parentName} directly.</p>

                  <p style="margin-top: 30px;"> If the button does not work, please click on this link - ${inviteLink} </p>

                  <p>Best regards,<br>Child Behavior Check Team</p>
                </td>
              </tr>
              <tr>
                <td style="background-color: #0C3948; color: #ffffff; text-align: center; padding: 20px; border-bottom-left-radius: 5px; border-bottom-right-radius: 5px;">
                  <p style="margin: 0;">&copy; 2025 Child Behavior Check. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  let info = await transporter.sendMail({
    from: '"Child Behavior Check" <support@childbehaviorcheck.com>',
    to: professionalEmail,
    subject: `Invitation to Access ${childName}'s Information`,
    text: `Dear ${professionalName},
You have been invited by ${parentName} to access their child's information, including their data and behavior support plan, on our platform.
This access will allow you to:
- View ${childName}'s information, data, and behavior support plan
- Add your own data, which ${parentName} will be able to view
Please note that you will not be able to make any changes to ${parentName}'s account settings or existing data.
To accept this invitation, please visit: ${inviteLink}
If you have any questions or concerns, please don't hesitate to reach out to ${parentName} directly.
If the button does not work, please click on this link - ${inviteLink}
Best regards,
Child Behavior Check Team`,
    html: htmlContent
  });

  console.log("Message sent: %s", info.messageId);
}

// Controller function to send invites
async function sendInvites(req, res) {
    try {
      const { professionals, childId } = req.body;
      const userId = req.headers["userid"];
  
      if (!Array.isArray(professionals) || professionals.length === 0) {
        return res.status(400).json({ message: 'Invalid professionals data' });
      }
  
      // Check if the child exists and get the child's name
      const childQuery = "SELECT child_name FROM children WHERE child_id = ?";
      const childResult = await RunQuery(childQuery, [childId]);
      if (!childResult.success || childResult.success.length === 0) {
        return res.status(404).json({ message: 'Child not found' });
      }
      const childName = childResult.success[0].child_name;
  
      // Check if the user exists and get the user's email
      const userQuery = "SELECT email FROM users WHERE user_id = ?";
      const userResult = await RunQuery(userQuery, [userId]);
      if (!userResult.success || userResult.success.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      const userEmail = userResult.success[0].email;
  
      const results = [];
  
      for (const professional of professionals) {
        if (!isValidEmail(professional.email)) {
          results.push({ email: professional.email, status: 'failed', message: 'Invalid email' });
          continue;
        }
  
        // Insert the pending invite first with a placeholder for invite_link
        const insertQuery = `INSERT INTO pending_invites (professional_name, professional_email, child_id, user_id, invite_link) VALUES (?, ?, ?, ?, ?)`;
        const insertValues = [professional.name, professional.email, childId, userId, 'placeholder'];
        const insertResult = await RunQuery(insertQuery, insertValues);
  
        if (!insertResult.success) {
          results.push({ email: professional.email, status: 'failed', message: 'Failed to create invite' });
          continue;
        }
  
        // Get the generated invite ID
        const inviteId = insertResult.success.insertId;
  
        // Now create the encrypted invite link
        const encryptedInviteId = encrypt(inviteId.toString());
        const encryptedUserId = encrypt(userId);
        const encryptedChildId = encrypt(childId.toString());
  
        const inviteLink = `https://childbehaviorcheck.com/invite/${encryptedInviteId}/${encryptedUserId}/${encryptedChildId}`;
  
        // Update the pending invite with the actual invite link
        const updateQuery = `UPDATE pending_invites SET invite_link = ? WHERE id = ?`;
        const updateValues = [inviteLink, inviteId];
        const updateResult = await RunQuery(updateQuery, updateValues);
  
        if (updateResult.success) {
          await sendInvitationEmail(professional.email, inviteLink, childName, userEmail, professional.name);
          results.push({ email: professional.email, status: 'success', message: 'Invite sent' });
        } else {
          results.push({ email: professional.email, status: 'failed', message: 'Failed to update invite link' });
        }
      }
  
      res.status(200).json({ results });
    } catch (error) {
      console.error('Error sending invites:', error);
      res.status(500).json({ message: 'Error sending invites' });
    }
  }

// Controller function to accept invite
async function acceptInvite(req, res) {
    try {
      const { encryptedInviteId, encryptedUserId, encryptedChildId } = req.params;
  
      const inviteId = decrypt(encryptedInviteId);
      const userId = decrypt(encryptedUserId);
      const childId = decrypt(encryptedChildId);
  
      // Check if invite exists and is not accepted
      const checkInviteQuery = `SELECT * FROM pending_invites WHERE id = ? AND user_id = ? AND child_id = ? AND is_invite_accepted = FALSE`;
      const checkInviteValues = [inviteId, userId, childId];
      const inviteResult = await RunQuery(checkInviteQuery, checkInviteValues);
  
      if (!inviteResult.success || inviteResult.success.length === 0) {
        return res.status(404).json({ message: 'Invalid or expired invite' });
      }
  
      const invite = inviteResult.success[0];
  
      // Update pending_invites table
      const updateInviteQuery = `UPDATE pending_invites SET is_invite_accepted = TRUE, date_accepted = CURRENT_TIMESTAMP WHERE id = ?`;
      const updateInviteValues = [inviteId];
      await RunQuery(updateInviteQuery, updateInviteValues);
  
      // Insert into professionals table
      const insertProfessionalQuery = `INSERT INTO professionals (professional_name, professional_email, user_id, child_id) VALUES (?, ?, ?, ?)`;
      const insertProfessionalValues = [invite.professional_name, invite.professional_email, userId, childId];
      await RunQuery(insertProfessionalQuery, insertProfessionalValues);
  
      res.status(200).json({ message: 'Invite accepted successfully' });
    } catch (error) {
      console.error('Error accepting invite:', error);
      res.status(500).json({ message: 'Error accepting invite' });
    }
  }

module.exports = {
  sendInvites,
  acceptInvite
};