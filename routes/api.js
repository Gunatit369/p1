const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const db = require('../services/mongoDB');
const authService = require('../services/auth');
const userStore = require('../services/userStore');
const photoStore = require('../services/photoStore');
const UserModel = require('../models/User');
const PhotoModel = require('../models/Photo');
const FaceDetectionModel = require('../models/FaceDetection');
const AlbumModel = require('../models/Album');

// ---- Photo file upload (saved to /uploads) ----
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadsDir),
        filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^\w.\-]/g, '_')}`),
    }),
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    },
});

// Database connection status
router.get('/status', async (req, res) => {
    res.json({
        connected: db.connected,
        dbName: process.env.MONGODB_DB || 'faceai',
        mongoUriSet: !!process.env.MONGODB_URI,
    });
});

// ---- Users ----
router.get('/users', authService.authenticate, authService.requireRole('owner', 'admin'), async (req, res) => {
    const users = await userStore.getUsers();
    res.json(users.map(UserModel.serialize));
});

router.get('/users/:id', authService.authenticate, authService.requireRole('owner', 'admin'), async (req, res) => {
    const user = await userStore.getUserById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json(UserModel.serialize(user));
});

// Only the owner can create/update users
router.post('/users', authService.authenticate, authService.requireRole('owner'), async (req, res) => {
    try {
        const existing = await userStore.getUserByEmail(req.body.email);
        if (existing) {
            return res.status(409).json({ success: false, message: 'User with this email already exists' });
        }
        const user = UserModel.create(req.body);
        const result = await userStore.addUser(user);
        res.json({ success: true, user: UserModel.serialize(user), _id: result._id });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

router.put('/users/:id', authService.authenticate, authService.requireRole('owner'), async (req, res) => {
    const { name, email, photoCount, status, role } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (photoCount !== undefined) updates.photoCount = photoCount;
    if (status) updates.status = status;
    if (role) updates.role = role;

    const result = await userStore.updateUser(req.params.id, updates);
    if (result.success) {
        const user = await userStore.getUserById(req.params.id);
        res.json({ success: true, user: UserModel.serialize(user) });
    } else {
        res.status(404).json(result);
    }
});

// ---- Photos ----
router.get('/photos', authService.authenticate, async (req, res) => {
    const filter = {};
    // Regular users can only see their own photos
    if (req.role === 'user') filter.userId = req.userId;
    if (req.query.userId && req.role !== 'user') filter.userId = req.query.userId;
    if (req.query.album) filter.album = req.query.album;
    const photos = await photoStore.getPhotos(filter);
    res.json(photos.map(PhotoModel.serialize));
});

// Upload image files to the gallery (multipart/form-data, "images" fields)
router.post('/photos/upload', authService.authenticate, upload.array('images', 12), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No images uploaded' });
        }
        const userId = req.role === 'user' ? req.userId : (req.body.userId || req.userId);
        const album = req.body.album || 'gallery';
        const user = await userStore.getUserById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const uploaded = [];
        for (const file of req.files) {
            const url = `/uploads/${file.filename}`;
            const photo = PhotoModel.create({ userId, url, album });
            const result = await photoStore.addPhoto(photo);
            uploaded.push({ ...PhotoModel.serialize(photo), id: photo._id, url });
        }

        await userStore.updateUser(userId, { photoCount: (user.photoCount || 0) + uploaded.length });
        res.json({ success: true, count: uploaded.length, photos: uploaded });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

router.get('/photos/:id', authService.authenticate, async (req, res) => {
    const photo = await photoStore.getPhotoById(req.params.id);
    if (!photo) return res.status(404).json({ success: false, message: 'Photo not found' });
    // Users can only read their own photos
    if (req.role === 'user' && photo.userId !== req.userId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }
    res.json(PhotoModel.serialize(photo));
});

router.post('/photos', authService.authenticate, async (req, res) => {
    try {
        const userId = req.role === 'user' ? req.userId : (req.body.userId || req.userId);
        const user = await userStore.getUserById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const photo = PhotoModel.create({ ...req.body, userId });
        const result = await photoStore.addPhoto(photo);

        // Increment the user's photo count
        await userStore.updateUser(userId, { photoCount: (user.photoCount || 0) + 1 });

        res.json({ success: true, photo: PhotoModel.serialize(photo), _id: result._id });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

router.delete('/photos/:id', authService.authenticate, async (req, res) => {
    const photo = await photoStore.getPhotoById(req.params.id);
    if (!photo) return res.status(404).json({ success: false, message: 'Photo not found' });
    // Users can only delete their own photos; owner/admin can delete any
    if (req.role === 'user' && photo.userId !== req.userId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const result = await photoStore.deletePhoto(req.params.id);
    if (result.success && photo.url && photo.url.startsWith('/uploads/')) {
        const filePath = path.join(uploadsDir, path.basename(photo.url));
        fs.unlink(filePath, () => {});
    }
    res.json(result);
});

// ---- Face Detections ----
router.get('/detections', authService.authenticate, async (req, res) => {
    if (!db.connected) return res.status(503).json({ success: false, message: 'Database not connected' });
    const filter = {};
    if (req.query.photoId) filter.photoId = req.query.photoId;
    const detections = await db.getDetections(filter);
    // For regular users, only return detections tied to their photos
    if (req.role === 'user') {
        const photos = await db.getPhotos({ userId: req.userId });
        const photoIds = new Set(photos.map(p => p._id));
        const allowed = detections.filter(d => photoIds.has(d.photoId));
        return res.json(allowed.map(FaceDetectionModel.serialize));
    }
    res.json(detections.map(FaceDetectionModel.serialize));
});

router.post('/detections', authService.authenticate, async (req, res) => {
    if (!db.connected) return res.status(503).json({ success: false, message: 'Database not connected' });
    try {
        const detection = FaceDetectionModel.create(req.body);
        const result = await db.addDetection(detection);
        res.json({ success: true, detection: FaceDetectionModel.serialize(detection), _id: result._id });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// ---- Shared Albums ----
router.get('/albums', authService.authenticate, async (req, res) => {
    if (!db.connected) return res.status(503).json({ success: false, message: 'Database not connected' });
    const filter = {};
    if (req.role === 'user') {
        // Users see albums they own or ones shared with them
        const owned = await db.getAlbums({ userId: req.userId });
        const all = await db.getAlbums({});
        const shared = all.filter(a => Array.isArray(a.sharedWith) && a.sharedWith.includes(req.userId));
        return res.json([...owned, ...shared]
            .filter((v, i, a) => a.findIndex(x => x._id === v._id) === i)
            .map(AlbumModel.serialize));
    }
    if (req.query.userId) filter.userId = req.query.userId;
    const albums = await db.getAlbums(filter);
    res.json(albums.map(AlbumModel.serialize));
});

router.get('/albums/:id', authService.authenticate, async (req, res) => {
    if (!db.connected) return res.status(503).json({ success: false, message: 'Database not connected' });
    const album = await db.getAlbumById(req.params.id);
    if (!album) return res.status(404).json({ success: false, message: 'Album not found' });
    if (req.role === 'user' && album.userId !== req.userId && !(album.sharedWith || []).includes(req.userId)) {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }
    res.json(AlbumModel.serialize(album));
});

router.post('/albums', authService.authenticate, async (req, res) => {
    if (!db.connected) return res.status(503).json({ success: false, message: 'Database not connected' });
    try {
        const userId = req.role === 'user' ? req.userId : (req.body.userId || req.userId);
        const album = AlbumModel.create({ ...req.body, userId });
        const result = await db.addAlbum(album);
        res.json({ success: true, album: AlbumModel.serialize(album), _id: result._id });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

module.exports = router;
