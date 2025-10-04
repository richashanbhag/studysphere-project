const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config(); // To use environment variables from a .env file

// --- App & Server Initialization ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "https://studysphere-richa.netlify.app", // IMPORTANT: In production, restrict this to your front-end's actual URL
        methods: ["GET", "POST"]
    }
});

// --- Database Connection ---
const connectDB = async () => {
    try {
        // Use environment variables for sensitive data like the MongoDB URI
        const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://ricshanbhag_db_user:dUAw63evTV8x0XoQ@database.ltuc9jc.mongodb.net/?retryWrites=true&w=majority&appName=Database";
        if (MONGO_URI.includes('<username>')) {
             console.warn("Warning: MongoDB URI is using a placeholder. Make sure to set your MONGO_URI environment variable.");
        }
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB Connected Successfully!');
    } catch (err) {
        console.error(`MongoDB Connection Error: ${err.message}`);
        process.exit(1); // Exit process with failure
    }
};

connectDB();

// --- General Middleware ---
app.use(cors());
app.use(express.json());

// --- File Uploads (Static Serving) ---
// Create the 'uploads' directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
// Serve files from the 'uploads' directory
app.use('/uploads', express.static(uploadDir));

// --- API Routes ---
// Link the authentication and group route handlers
app.use('/api/auth', require('./routes/auth'));
app.use('/api/groups', require('./routes/groups'));

// --- Socket.IO Real-time Logic ---
// JWT is needed to verify users for socket events
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Message = require('./models/Message');
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_jwt_secret';

io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // User joins a group's chat room upon entering the page
    socket.on('join group', (groupId) => {
        socket.join(groupId);
        console.log(`Socket ${socket.id} joined room: ${groupId}`);
    });

    // Listen for a new chat message from a client
    socket.on('chat message', async ({ groupId, token, content }) => {
        if (!content || !token) return; // Ignore empty messages or requests without a token
        try {
            // Verify the user's token to authorize the message
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = await User.findById(decoded.user.id).select('fullName');
            if (!user) return; // User not found, ignore

            const message = new Message({
                group: groupId,
                user: user.id,
                content: content,
            });
            await message.save();
            
            // Populate user details before broadcasting to other clients
            const populatedMessage = {
                ...message.toObject(),
                user: { _id: user._id, fullName: user.fullName }
            };

            // Broadcast the new message to all clients in that specific group room
            io.to(groupId).emit('chat message', populatedMessage);
        } catch (err) {
            console.error('Socket chat message error:', err.message);
            // Optionally, emit an error back to the sender
            socket.emit('error', 'Authentication failed. Could not send message.');
        }
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
    });
});

// --- Start the Server ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Backend server with chat started on http://localhost:${PORT}`));

