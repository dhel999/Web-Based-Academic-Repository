const express = require('express');
const { checkPlagiarism, checkTitle, getResults, checkInternet } = require('../controllers/plagiarismController');

const router = express.Router();

// POST /api/check-plagiarism
router.post('/check-plagiarism', checkPlagiarism);

// POST /api/check-internet
router.post('/check-internet', checkInternet);

// POST /api/check-title
router.post('/check-title', checkTitle);

// GET /api/results/:document_id
router.get('/results/:document_id', getResults);

module.exports = router;
