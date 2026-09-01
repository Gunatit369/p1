const fs = require('fs');
const path = require('path');
const db = require('./mongoDB');

const FILE = path.join(__dirname, '..', 'data', 'users.json');

let fileUsers = null;
let dirty = false;

function loadFile() {
    if (fileUsers) return fileUsers;
    try {
        if (fs.existsSync(FILE)) {
            fileUsers = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        } else {
            fileUsers = [];
        }
    } catch (e) {
        console.error('Failed to load users file:', e.message);
        fileUsers = [];
    }
    return fileUsers;
}

function saveFile() {
    if (!dirty) return;
    try {
        fs.mkdirSync(path.dirname(FILE), { recursive: true });
        fs.writeFileSync(FILE, JSON.stringify(fileUsers, null, 2));
        dirty = false;
    } catch (e) {
        console.error('Failed to save users file:', e.message);
    }
}

const fileStore = {
    async getUsers() {
        return [...loadFile()];
    },
    async getUserById(id) {
        return loadFile().find(u => u._id === id) || null;
    },
    async getUserByEmail(email) {
        return loadFile().find(u => u.email === (email || '').toLowerCase()) || null;
    },
    async addUser(user) {
        loadFile().push(user);
        dirty = true;
        saveFile();
        return { success: true, message: 'User created', _id: user._id };
    },
    async updateUser(id, updates) {
        const users = loadFile();
        const i = users.findIndex(u => u._id === id);
        if (i === -1) return { success: false, message: 'User not found' };
        users[i] = { ...users[i], ...updates };
        dirty = true;
        saveFile();
        return { success: true, message: 'User updated' };
    },
};

const store = {
    get connected() { return db.connected; },

    async getUsers() {
        return db.connected ? db.getUsers() : fileStore.getUsers();
    },
    async getUserById(id) {
        return db.connected ? db.getUserById(id) : fileStore.getUserById(id);
    },
    async getUserByEmail(email) {
        return db.connected ? db.getUserByEmail(email) : fileStore.getUserByEmail(email);
    },
    async addUser(user) {
        return db.connected ? db.addUser(user) : fileStore.addUser(user);
    },
    async updateUser(id, updates) {
        return db.connected ? db.updateUser(id, updates) : fileStore.updateUser(id, updates);
    },
};

module.exports = store;
