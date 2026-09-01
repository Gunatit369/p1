# FaceAI - AI Face Recognition Photo Sharing

AI-powered photo sharing platform that uses face recognition to automatically group and share photos with specific people.

## Features

- AI Face Detection
- Smart Grouping by Person
- One-Click Personalized Photo Sharing
- Privacy-first encrypted storage
- Bulk photo upload
- **MongoDB database integration**

## Tech Stack

- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Backend**: Node.js, Express
- **Database**: MongoDB

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up MongoDB

You have two options:

#### Option A: Local MongoDB (recommended for development)
1. Install [MongoDB Community Server](https://www.mongodb.com/try/download/community)
2. Start MongoDB (default runs on `mongodb://localhost:27017`)

#### Option B: MongoDB Atlas (cloud)
1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Create a database user (username + password)
4. Get your connection string under "Connect" → "Connect your application"
5. It will look like: `mongodb+srv://username:password@cluster.mongodb.net`

### 3. Configure the app

Edit the `.env` file:

```
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=faceai
PORT=3000

# Gemini AI face recognition
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
```

For Atlas, set `MONGODB_URI` to your Atlas connection string.

Configure your **Gemini API key**:
1. Get one at [Google AI Studio](https://aistudio.google.com/apikey)
2. Set it as `GEMINI_API_KEY` in `.env`

> **Note:** Gemini face detection uses the `generateContent` API to return
> normalized bounding boxes for detected faces. If the key or model is
> misconfigured, the frontend automatically falls back to a simulated demo.

### 4. Run the server

```bash
node server.js
```

The app runs at `http://localhost:3000`.

## Database Collections

MongoDB documents are stored in a `faceai` database with these collections:

| Collection | Description | Key Fields |
|-----------|-------------|------------|
| `users` | Registered users | `_id`, `name`, `email`, `photoCount`, `status` |
| `photos` | Uploaded photos | `_id`, `userId`, `url`, `faces`, `album`, `sharedWith` |
| `detections` | Face detection results | `_id`, `photoId`, `faceId`, `x`, `y`, `width`, `height`, `confidence`, `label` |
| `albums` | Shared photo albums | `_id`, `name`, `userId`, `photoIds`, `sharedWith` |

Indexes are auto-created on `email` (unique), `userId`, `album`, and `photoId`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Check database connection |
| GET | `/api/users` | List all users |
| GET | `/api/users/:id` | Get user by id |
| POST | `/api/users` | Create user |
| PUT | `/api/users/:id` | Update user |
| GET | `/api/photos` | List photos (filter by `?userId=` or `?album=`) |
| GET | `/api/photos/:id` | Get photo by id |
| POST | `/api/photos` | Add photo |
| DELETE | `/api/photos/:id` | Delete photo |
| GET | `/api/detections` | List face detections (filter by `?photoId=`) |
| POST | `/api/detections` | Add face detection |
| GET | `/api/albums` | List shared albums |
| GET | `/api/albums/:id` | Get album by id |
| POST | `/api/albums` | Create shared album |
| GET | `/api/recognize/status` | Check Gemini API config |
| POST | `/api/recognize` | Detect faces (multipart `image` upload) |

## Project Structure

```
├── index.html                # Main landing page
├── styles.css                # Styles
├── app.js                    # Frontend logic
├── server.js                 # Express server
├── routes/
│   ├── api.js                # CRUD API routes
│   └── recognize.js          # Gemini face recognition route
├── services/
│   ├── mongoDB.js            # MongoDB service
│   └── faceRecognition.js    # Gemini face detection service
├── models/
│   ├── User.js               # User model
│   ├── Photo.js              # Photo model
│   ├── FaceDetection.js      # Face detection model
│   └── Album.js              # Shared album model
├── package.json
└── .env                      # Config (MongoDB credentials)
```
