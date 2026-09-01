const fs = require('fs');
const path = require('path');
const db = require('./mongoDB');

const FILE = path.join(__dirname, '..', 'data', 'photos.json');

let filePhotos = null;
let dirty = false;

function loadFile() {
    if (filePhotos) return filePhotos;
    try {
        if (fs.existsSync(FILE)) {
            filePhotos = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        } else {
            filePhotos = [];
        }
    } catch (e) {
        console.error('Failed to load photos file:', e.message);
        filePhotos = [];
    }
    return filePhotos;
}

function saveFile() {
    if (!dirty) return;
    try {
        fs.mkdirSync(path.dirname(FILE), { recursive: true });
        fs.writeFileSync(FILE, JSON.stringify(filePhotos, null, 2));
        dirty = false;
    } catch (e) {
        console.error('Failed to save photos file:', e.message);
    }
}

const fileStore = {
    async getPhotos(filter = {}) {
        let list = [...loadFile()];
        if (filter.userId) list = list.filter(p => p.userId === filter.userId);
        if (filter.album) list = list.filter(p => p.album === filter.album);
        return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    },
    async getPhotoById(id) {
        return loadFile().find(p => p._id === id) || null;
    },
    async addPhoto(photo) {
        loadFile().push(photo);
        dirty = true;
        saveFile();
        return { success: true, message: 'Photo added', _id: photo._id };
    },
    async deletePhoto(id) {
        loadFile();
        const before = filePhotos.length;
        filePhotos = filePhotos.filter(p => p._id !== id);
        const changed = filePhotos.length !== before;
        dirty = changed;
        saveFile();
        return changed ? { success: true, message: 'Photo deleted' } : { success: false, message: 'Photo not found' };
    },
};

const store = {
    get connected() { return db.connected; },

    async getPhotos(filter = {}) {
        return db.connected ? db.getPhotos(filter) : fileStore.getPhotos(filter);
    },
    async getPhotoById(id) {
        return db.connected ? db.getPhotoById(id) : fileStore.getPhotoById(id);
    },
    async addPhoto(photo) {
        return db.connected ? db.addPhoto(photo) : fileStore.addPhoto(photo);
    },
    async deletePhoto(id) {
        return db.connected ? db.deletePhoto(id) : fileStore.deletePhoto(id);
    },
};

module.exports = store;
