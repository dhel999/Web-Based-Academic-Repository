const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { listAllDocuments, deleteDocument, listUsers, deleteUser, getStats } = require('../controllers/adminController');

router.get('/admin/documents', requireAdmin, listAllDocuments);
router.delete('/admin/documents/:id', requireAdmin, deleteDocument);
router.get('/admin/users', requireAdmin, listUsers);
router.delete('/admin/users/:id', requireAdmin, deleteUser);
router.get('/admin/stats', requireAdmin, getStats);

module.exports = router;
