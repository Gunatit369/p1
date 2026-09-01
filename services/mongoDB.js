const { MongoClient } = require('mongodb');

class MongoDBService {
    constructor() {
        this.client = null;
        this.db = null;
        this.connected = false;
    }

    async connect() {
        try {
            const uri = process.env.MONGODB_URI;
            if (!uri) {
                console.warn('MONGODB_URI not set in .env - database disabled');
                return false;
            }

            const dbName = process.env.MONGODB_DB || 'faceai';

            this.client = new MongoClient(uri, {
                serverSelectionTimeoutMS: 5000,
            });

            await this.client.connect();
            this.db = this.client.db(dbName);

            // Ensure indexes
            await this.collection('users').createIndex({ email: 1 }, { unique: true });
            await this.collection('photos').createIndex({ userId: 1 });
            await this.collection('photos').createIndex({ album: 1 });
            await this.collection('detections').createIndex({ photoId: 1 });

            this.connected = true;
            console.log(`MongoDB connected to database: ${dbName}`);
            return true;
        } catch (error) {
            console.error('MongoDB connection failed:', error.message);
            this.connected = false;
            return false;
        }
    }

    collection(name) {
        return this.db.collection(name);
    }

    // ---- Users ----
    async getUsers() {
        return this.collection('users').find({}).sort({ createdAt: -1 }).toArray();
    }

    async getUserById(id) {
        return this.collection('users').findOne({ _id: id });
    }

    async getUserByEmail(email) {
        return this.collection('users').findOne({ email });
    }

    async addUser(user) {
        const result = await this.collection('users').insertOne(user);
        return { success: true, message: 'User created', _id: result.insertedId };
    }

    async updateUser(id, updates) {
        const result = await this.collection('users').updateOne(
            { _id: id },
            { $set: updates }
        );
        return result.modifiedCount > 0
            ? { success: true, message: 'User updated' }
            : { success: false, message: 'User not found' };
    }

    // ---- Photos ----
    async getPhotos(filter = {}) {
        return this.collection('photos').find(filter).sort({ createdAt: -1 }).toArray();
    }

    async getPhotoById(id) {
        return this.collection('photos').findOne({ _id: id });
    }

    async addPhoto(photo) {
        const result = await this.collection('photos').insertOne(photo);
        return { success: true, message: 'Photo added', _id: result.insertedId };
    }

    async deletePhoto(id) {
        const result = await this.collection('photos').deleteOne({ _id: id });
        return result.deletedCount > 0
            ? { success: true, message: 'Photo deleted' }
            : { success: false, message: 'Photo not found' };
    }

    // ---- Face Detections ----
    async getDetections(filter = {}) {
        return this.collection('detections').find(filter).toArray();
    }

    async getDetectionsByPhoto(photoId) {
        return this.collection('detections').find({ photoId }).toArray();
    }

    async addDetection(detection) {
        const result = await this.collection('detections').insertOne(detection);
        return { success: true, message: 'Detection added', _id: result.insertedId };
    }

    // ---- Shared Albums ----
    async getAlbums(filter = {}) {
        return this.collection('albums').find(filter).sort({ createdAt: -1 }).toArray();
    }

    async getAlbumById(id) {
        return this.collection('albums').findOne({ _id: id });
    }

    async addAlbum(album) {
        const result = await this.collection('albums').insertOne(album);
        return { success: true, message: 'Album created', _id: result.insertedId };
    }

    async close() {
        if (this.client) {
            await this.client.close();
            this.connected = false;
        }
    }
}

module.exports = new MongoDBService();
