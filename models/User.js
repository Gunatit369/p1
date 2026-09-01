const { v4: uuidv4 } = require('uuid');

const ROLES = ['owner', 'admin', 'user'];

class UserModel {
    static create({ name, email, password = null, role = 'user' }) {
        if (!name || !email) {
            throw new Error('Name and email are required');
        }
        if (role && !ROLES.includes(role)) {
            throw new Error(`Invalid role. Allowed roles: ${ROLES.join(', ')}`);
        }
        return {
            _id: uuidv4(),
            name,
            email: email.toLowerCase(),
            password: password || null,
            role,
            createdAt: new Date().toISOString(),
            photoCount: 0,
            status: 'active',
        };
    }

    static serialize(user) {
        if (!user) return null;
        return {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role || 'user',
            createdAt: user.createdAt,
            photoCount: user.photoCount || 0,
            status: user.status || 'active',
        };
    }
}

UserModel.ROLES = ROLES;

module.exports = UserModel;
