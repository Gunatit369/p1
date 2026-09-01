const { v4: uuidv4 } = require('uuid');

class FaceDetectionModel {
    static create({ photoId, faceId = null, x = 0, y = 0, width = 0, height = 0, confidence = null, label = null, embedding = null }) {
        if (!photoId) {
            throw new Error('photoId is required');
        }
        return {
            _id: uuidv4(),
            photoId,
            faceId: faceId || uuidv4(),
            x,
            y,
            width,
            height,
            confidence: confidence !== null ? confidence : Math.round((85 + Math.random() * 14) * 10) / 10,
            label,
            embedding,
            createdAt: new Date().toISOString(),
        };
    }

    static serialize(detection) {
        if (!detection) return null;
        return {
            id: detection._id,
            photoId: detection.photoId,
            faceId: detection.faceId,
            x: detection.x,
            y: detection.y,
            width: detection.width,
            height: detection.height,
            confidence: detection.confidence,
            label: detection.label,
            createdAt: detection.createdAt,
        };
    }
}

module.exports = FaceDetectionModel;
