const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);
router.get('/search', userController.searchUsers);
router.patch('/profile', userController.updateProfile);

module.exports = router;