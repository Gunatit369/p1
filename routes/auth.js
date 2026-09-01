const express = require('express');
const router = express.Router();
const authService = require('../services/auth');
const userModel = require('../models/User');

// POST /api/auth/register - create a new user account (default role: user)
router.post('/register', async (req, res) => {
    try {
        const user = await authService.register(req.body);
        res.json({ success: true, user });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// POST /api/auth/login - authenticate and return a session token
router.post('/login', async (req, res) => {
    try {
        const result = await authService.login(req.body);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(401).json({ success: false, message: error.message });
    }
});

// POST /api/auth/logout - destroy the session
router.post('/logout', (req, res) => {
    const token = req.headers['authorization']?.replace(/^Bearer\s+/i, '');
    if (token) {
        authService.logout(token);
    }
    res.json({ success: true });
});

// GET /api/auth/me - return current session user
router.get('/me', authService.authenticate, async (req, res) => {
    const userStore = require('../services/userStore');
    const found = await userStore.getUserById(req.userId);
    res.json({
        success: true,
        session: { userId: req.userId, role: req.role },
        user: userModel.serialize(found),
    });
});

// GET /api/auth/roles - list available roles (public)
router.get('/roles', (req, res) => {
    res.json({ success: true, roles: userModel.ROLES });
});

module.exports = router;
