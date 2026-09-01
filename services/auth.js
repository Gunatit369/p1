const crypto = require('crypto');
const userStore = require('./userStore');
const UserModel = require('../models/User');

const sessions = new Map();

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
    if (!stored || !stored.includes(':')) return false;
    const [salt, hash] = stored.split(':');
    const check = crypto.createHash('sha256').update(salt + password).digest('hex');
    return check === hash;
}

async function seedDefaultUsers() {
    const existing = await userStore.getUsers();
    if (Array.isArray(existing) && existing.length > 0) return;

    const defaults = [
        { name: 'Owner', email: 'abhishektiwari234000@gmail.com', password: 'owner123', role: 'owner' },
        { name: 'Admin', email: 'admin@faceai.com', password: 'admin123', role: 'admin' },
        { name: 'User', email: 'user@faceai.com', password: 'user123', role: 'user' },
    ];

    for (const d of defaults) {
        const user = UserModel.create({
            name: d.name,
            email: d.email,
            password: hashPassword(d.password),
            role: d.role,
        });
        await userStore.addUser(user);
    }
    console.log('Seeded default users (owner/admin/user).');
}

async function register({ name, email, password, role = 'user' }) {
    if (!name || !email || !password) {
        throw new Error('Name, email and password are required');
    }
    const existing = await userStore.getUserByEmail(email.toLowerCase());
    if (existing) {
        throw new Error('User with this email already exists');
    }
    const user = UserModel.create({
        name,
        email,
        password: hashPassword(password),
        role,
    });
    await userStore.addUser(user);
    return UserModel.serialize(user);
}

async function login({ email, password }) {
    if (!email || !password) {
        throw new Error('Email and password are required');
    }
    const user = await userStore.getUserByEmail(email.toLowerCase());
    if (!user || user.status !== 'active') {
        throw new Error('Invalid email or password');
    }
    if (!verifyPassword(password, user.password)) {
        throw new Error('Invalid email or password');
    }
    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, {
        userId: user._id,
        role: user.role || 'user',
        createdAt: Date.now(),
    });
    return {
        token,
        user: UserModel.serialize(user),
    };
}

function logout(token) {
    sessions.delete(token);
}

function getSession(token) {
    return sessions.get(token) || null;
}

function authenticate(req, res, next) {
    const token = req.headers['authorization']?.replace(/^Bearer\s+/i, '') || req.query.token;
    const session = getSession(token);
    if (!session) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    req.session = session;
    req.userId = session.userId;
    req.role = session.role;
    next();
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.session) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }
        if (!roles.includes(req.session.role)) {
            return res.status(403).json({ success: false, message: `Access denied. Requires ${roles.join('/')} role` });
        }
        next();
    };
}

module.exports = {
    hashPassword,
    verifyPassword,
    seedDefaultUsers,
    register,
    login,
    logout,
    getSession,
    authenticate,
    requireRole,
};
