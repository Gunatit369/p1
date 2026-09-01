const { v4: uuidv4 } = require('uuid');

class AlbumModel {
    static create({ name, userId, photoIds = [], sharedWith = [] }) {
        if (!name || !userId) {
            throw new Error('name and userId are required');
        }
        return {
            _id: uuidv4(),
            name,
            userId,
            photoIds,
            sharedWith,
            createdAt: new Date().toISOString(),
        };
    }

    static serialize(album) {
        if (!album) return null;
        return {
            id: album._id,
            name: album.name,
            userId: album.userId,
            photoIds: album.photoIds || [],
            sharedWith: album.sharedWith || [],
            createdAt: album.createdAt,
        };
    }
}

module.exports = AlbumModel;
