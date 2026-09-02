const express = require('express');
const router = express.Router();
const authService = require('../services/auth');
const UserModel = require('../models/User');

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const GITHUB_EMAIL_URL = 'https://api.github.com/user/emails';
const REDIRECT_URI = process.env.GITHUB_REDIRECT_URI ||
    (process.env.BASE_URL || 'http://localhost:3000') + '/api/auth/github/callback';

// GET /api/auth/github - redirect the user to GitHub to authorize
router.get('/github', (req, res) => {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        return res.status(503).send('GitHub login is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env');
    }
    const scope = 'read:user user:email';
    const url = `${GITHUB_AUTH_URL}?client_id=${encodeURIComponent(CLIENT_ID)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scope)}`;
    res.redirect(url);
});

// GET /api/auth/github/callback - GitHub redirects here after authorization
router.get('/github/callback', async (req, res) => {
    const code = req.query.code;
    const error = req.query.error;
    if (error) {
        return res.status(400).send(`GitHub authorization failed: ${error}`);
    }
    if (!code) {
        return res.status(400).send('Missing authorization code');
    }

    try {
        // 1. Exchange the code for an access token
        const tokenRes = await fetch(GITHUB_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code,
                redirect_uri: REDIRECT_URI,
            }),
        });
        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;
        if (!accessToken) {
            return res.status(400).send('Failed to exchange code for access token');
        }

        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': 'FaceAI',
            'Accept': 'application/json',
        };

        // 2. Fetch the GitHub profile
        const userRes = await fetch(GITHUB_USER_URL, { headers });
        const profile = await userRes.json();
        if (!profile || !profile.id) {
            return res.status(400).send('Failed to fetch GitHub profile');
        }

        // 3. Fetch a public email if the profile email is null
        let email = profile.email || null;
        if (!email) {
            try {
                const emailRes = await fetch(GITHUB_EMAIL_URL, { headers });
                const emails = await emailRes.json();
                const primary = (Array.isArray(emails) ? emails : [])
                    .find(e => e.primary && e.verified);
                email = primary ? primary.email : null;
            } catch (e) { /* ignore */ }
        }

        // 4. Find or create the local user
        const { user } = await authService.findOrCreateGithubUser({
            id: String(profile.id),
            login: profile.login,
            name: profile.name,
            email,
        });

        // 5. Create a session and redirect back to the site with the token
        const token = authService.createSession(user);
        const serialized = encodeURIComponent(JSON.stringify(UserModel.serialize(user)));
        const redirect = `${process.env.BASE_URL || 'http://localhost:3000'}/?gh_token=${token}&gh_user=${serialized}`;
        res.redirect(redirect);
    } catch (err) {
        res.status(500).send(`GitHub login server error: ${err.message}`);
    }
});

module.exports = router;
