const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { listAllDocuments, deleteDocument, listUsers, deleteUser, updateUserRole, getStats, getAdminSettings, updateAdminSettings } = require('../controllers/adminController');

router.get('/admin/documents', requireAdmin, listAllDocuments);
router.delete('/admin/documents/:id', requireAdmin, deleteDocument);
router.get('/admin/users', requireAdmin, listUsers);
router.delete('/admin/users/:id', requireAdmin, deleteUser);
router.patch('/admin/users/:id/role', requireAdmin, updateUserRole);
router.get('/admin/stats', requireAdmin, getStats);
router.get('/admin/settings', requireAdmin, getAdminSettings);
router.put('/admin/settings', requireAdmin, updateAdminSettings);

module.exports = router;
