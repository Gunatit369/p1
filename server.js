const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const db = require('./services/mongoDB');
const apiRouter = require('./routes/api');
const recognizeRouter = require('./routes/recognize');
const authRouter = require('./routes/auth');
const githubAuthRouter = require('./routes/githubAuth');
const authService = require('./services/auth');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/auth', authRouter);
app.use('/api/auth', githubAuthRouter);
app.use('/api', recognizeRouter);
app.use('/api', apiRouter);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

async function start() {
    const mongoConnected = await db.connect();
    await authService.seedDefaultUsers();

    app.listen(PORT, () => {
        console.log(`FaceAI server running at http://localhost:${PORT}`);
        console.log(`MongoDB ${mongoConnected ? 'connected' : 'NOT connected (set MONGODB_URI in .env)'}`);
    });
}

start();
