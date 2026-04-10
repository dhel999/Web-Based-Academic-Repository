const express = require('express');
const { checkPlagiarism, checkTitle, getResults, checkInternet } = require('../controllers/plagiarismController');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/check-plagiarism
router.post('/check-plagiarism', optionalAuth, checkPlagiarism);

// POST /api/check-internet
router.post('/check-internet', optionalAuth, checkInternet);

// POST /api/check-title
router.post('/check-title', checkTitle);

// GET /api/results/:document_id
router.get('/results/:document_id', optionalAuth, getResults);

module.exports = router;
