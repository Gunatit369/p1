const express = require('express');
const multer = require('multer');
const router = express.Router();
const faceService = require('../services/faceRecognition');
const db = require('../services/mongoDB');
const FaceDetectionModel = require('../models/FaceDetection');

// Store uploaded files in memory (do not persist to disk)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// Detect faces in a photo
// POST /api/recognize  (multipart/form-data with "image" field, optional "photoId", optional "save")
router.post('/recognize', upload.single('image'), async (req, res) => {
    if (!faceService.isConfigured()) {
        return res.status(503).json({
            success: false,
            message: 'Gemini API key not configured (set GEMINI_API_KEY in .env)',
        });
    }

    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    try {
        const save = req.body.save === 'true';
        const photoId = req.body.photoId || `photo-${Date.now()}`;
        const mimeType = req.file.mimetype || 'image/jpeg';
        const detections = await faceService.detectFaces(req.file.buffer, mimeType);

        // Optionally persist detections to MongoDB
        if (save && db.connected) {
            for (const d of detections) {
                const model = FaceDetectionModel.create({
                    photoId,
                    faceId: d.faceId,
                    x: d.x,
                    y: d.y,
                    width: d.width,
                    height: d.height,
                    confidence: d.confidence,
                    label: d.label,
                });
                await db.addDetection(model);
            }
        }

        res.json({
            success: true,
            count: detections.length,
            photoId,
            detections,
        });
    } catch (error) {
        res.status(502).json({ success: false, message: error.message });
    }
});

// Check if the face recognition service is configured/available
router.get('/recognize/status', (req, res) => {
    res.json({
        configured: faceService.isConfigured(),
        keySet: !!faceService.apiKey,
    });
});

module.exports = router;
