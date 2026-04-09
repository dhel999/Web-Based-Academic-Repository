const express = require('express');
const { listDocuments, getDocument } = require('../controllers/documentController');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/documents?search=keyword&mine=true
router.get('/documents', optionalAuth, listDocuments);

// GET /api/documents/:id
router.get('/documents/:id', getDocument);

module.exports = router;
