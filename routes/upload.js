const express = require('express');
const multer = require('multer');
const path = require('path');
const { uploadDocument } = require('../controllers/uploadController');

const router = express.Router();

// Multer storage – save to /uploads with original extension preserved
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    cb(null, safeName);
  }
});

const allowedMimes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
];

const allowedExts = ['.pdf', '.docx', '.txt'];

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      return cb(null, true);
    }
    return cb(Object.assign(new Error('Only PDF, DOCX, and TXT files are allowed'), { code: 'INVALID_FILE_TYPE' }));
  }
});

const { requireAuth } = require('../middleware/auth');
const { quickScan, quickScanAI, quickScanInternet } = require('../controllers/quickScanController');

// POST /api/upload
router.post('/upload', requireAuth, upload.single('file'), uploadDocument);

// POST /api/quick-scan (no auth required)
router.post('/quick-scan', upload.single('file'), quickScan);
router.post('/quick-scan-ai', express.json({ limit: '2mb' }), quickScanAI);
router.post('/quick-scan-internet', express.json({ limit: '2mb' }), quickScanInternet);

module.exports = router;
