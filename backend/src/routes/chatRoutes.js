const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const requireAuth = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

// Protect all chat endpoints
router.use(requireAuth);

// Debug verification
[
  'getUserConversations',
  'getMessageHistory',
  'getGroupMembers',
  'updateGroupName',
  'makeAdmin',
  'kickMember',
  'leaveGroup',
  'deleteGroup',
  'addMemberToGroup',
  'createOrGetDirectChat',
  'createGroupChat',
  'uploadMedia'
].forEach((fnName) => {
  if (typeof chatController[fnName] !== 'function') {
    console.error(`[CRITICAL ROUTE ERROR]: chatController.${fnName} is NOT a function! Check chatController.js exports.`);
  }
});

// Conversation feeds
router.get('/conversations', chatController.getUserConversations);
router.get('/conversations/:conversationId/messages', chatController.getMessageHistory);
router.get('/conversations/:conversationId/members', chatController.getGroupMembers);

// Group Actions
router.patch('/conversations/:conversationId/title', chatController.updateGroupName);
router.post('/conversations/:conversationId/make-admin', chatController.makeAdmin);
router.post('/conversations/:conversationId/kick', chatController.kickMember);
router.post('/conversations/:conversationId/leave', chatController.leaveGroup);
router.delete('/conversations/:conversationId', chatController.deleteGroup);
router.post('/conversations/:conversationId/members', chatController.addMemberToGroup);

// Creation & Uploads
router.post('/direct', chatController.createOrGetDirectChat);
router.post('/group', chatController.createGroupChat);
router.post('/upload', upload.single('media'), chatController.uploadMedia);

module.exports = router;