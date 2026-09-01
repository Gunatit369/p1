const { v4: uuidv4 } = require('uuid');

class PhotoModel {
    static create({ userId, url, faces = [], album = 'default', sharedWith = [] }) {
        if (!userId || !url) {
            throw new Error('userId and url are required');
        }
        return {
            _id: uuidv4(),
            userId,
            url,
            faces,
            album,
            sharedWith,
            createdAt: new Date().toISOString(),
            status: 'active',
        };
    }

    static serialize(photo) {
        if (!photo) return null;
        return {
            id: photo._id,
            userId: photo.userId,
            url: photo.url,
            faces: photo.faces || [],
            album: photo.album || 'default',
            sharedWith: photo.sharedWith || [],
            createdAt: photo.createdAt,
            status: photo.status || 'active',
        };
    }
}

module.exports = PhotoModel;
