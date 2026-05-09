require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const { MongoDBUri, ImgBBApiKey } = require('./config');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chats');
const messageRoutes = require('./routes/messages');
const User = require('./models/User');
const Message = require('./models/Message');
const Chat = require('./models/Chat');

// Track active calls and socket mappings
const activeCalls = new Map();
const socketToUid = new Map();
const uidToSocket = new Map();

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// MongoDB Connection
mongoose.connect(MongoDBUri)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);

// ImgBB Upload endpoint
app.post('/api/upload', async (req, res) => {
    try {
        const { image } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'No image provided' });
        }

        const formData = new FormData();
        formData.append('image', image);
        formData.append('key', ImgBBApiKey);

        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            res.json({ url: data.data.url });
        } else {
            res.status(500).json({ error: 'Upload failed' });
        }
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_chat', (userId) => {
        socket.join(userId);
        socketToUid.set(socket.id, userId);
        uidToSocket.set(userId, socket.id);
        console.log(`User ${userId} joined their room`);
    });

    socket.on('send_message', async (data) => {
        const { receiverId, message, senderId } = data;

        // Check if receiver has blocked the sender
        const receiver = await User.findOne({ uid: receiverId });
        if (receiver) {
            const isBlocked = receiver.blockedUsers.some(
                blockedId => blockedId.toString() === senderId
            );

            if (isBlocked) {
                console.log(`Message blocked: ${senderId} is blocked by ${receiverId}`);
                return; // Don't deliver the message
            }
        }

        io.to(receiverId).emit('receive_message', message);
    });

    socket.on('message_edited', (data) => {
        const { receiverId, message } = data;
        io.to(receiverId).emit('message_edited', message);
    });

    socket.on('message_deleted', (data) => {
        const { receiverId, messageId } = data;
        io.to(receiverId).emit('message_deleted', { messageId });
    });

    socket.on('friend_request', (data) => {
        const { receiverId, request } = data;
        io.to(receiverId).emit('friend_request', request);
    });

    socket.on('friend_request_accepted', (data) => {
        const { receiverId, user } = data;
        io.to(receiverId).emit('friend_request_accepted', user);
    });

    socket.on('typing', (data) => {
        const { receiverId, isTyping } = data;
        io.to(receiverId).emit('typing', { isTyping });
    });

    // ─── WebRTC Signaling ────────────────────────────────────────────────────
    // Caller → Callee: initiate a call with an SDP offer
    socket.on('call:initiate', (data) => {
        const { calleeId, offer, callerId, callerName, callerPhoto, chatId } = data;
        console.log(`Call initiated: ${callerId} → ${calleeId} in chat ${chatId}`);

        // Store call start attempt
        activeCalls.set(callerId, {
            chatId,
            calleeId,
            callerId,
            startTime: null, // Set when accepted
            initiatedAt: new Date()
        });
        activeCalls.set(calleeId, callerId); // Link callee back to caller info

        io.to(calleeId).emit('call:incoming', { offer, callerId, callerName, callerPhoto, chatId });
    });

    // Callee → Caller: accept with SDP answer
    socket.on('call:accepted', (data) => {
        const { callerId, calleeId, answer } = data;
        console.log(`Call accepted: ${calleeId} → ${callerId}`);

        const callInfo = activeCalls.get(callerId);
        if (callInfo) {
            callInfo.startTime = new Date();
        }

        io.to(callerId).emit('call:accepted', { answer, calleeId });
    });

    // Callee → Caller: declined the call
    socket.on('call:declined', async (data) => {
        const { callerId, calleeId } = data;
        console.log(`Call declined: ${calleeId} → ${callerId}`);

        const callInfo = activeCalls.get(callerId);
        if (callInfo) {
            await saveCallMessage(callInfo.chatId, callerId, 'Missed', 0);
            activeCalls.delete(callerId);
            activeCalls.delete(calleeId);
        }

        io.to(callerId).emit('call:declined', { calleeId });
    });

    // Both directions: relay ICE candidates
    socket.on('call:ice-candidate', (data) => {
        const { targetId, candidate } = data;
        io.to(targetId).emit('call:ice-candidate', { candidate });
    });

    // Either party: ended the call
    socket.on('call:ended', async (data) => {
        const { targetId } = data;
        console.log(`Call ended → ${targetId}`);

        // Find call info. Socket emitting could be either caller or callee.
        let callInfo = activeCalls.get(socket.id); // This might not work if we use UIDs
        // Let's assume we pass callerId/calleeId or just look up by UIDs if we had them.
        // For now, let's look through activeCalls for calleeId or callerId matching the target/sender.
        // Actually, let's just pass the necessary info in call:ended from client.

        const { callerId, calleeId, chatId, duration } = data;
        if (chatId) {
            const status = duration > 0 ? 'Ended' : 'Missed';
            await saveCallMessage(chatId, callerId, status, duration);

            activeCalls.delete(callerId);
            activeCalls.delete(calleeId);
        }

        io.to(targetId).emit('call:ended');
    });

    // Callee is busy (already in a call)
    socket.on('call:busy', (data) => {
        const { callerId } = data;
        io.to(callerId).emit('call:busy');
    });

    // Helper to save call message
    async function saveCallMessage(chatId, senderId, status, duration) {
        try {
            const sender = await User.findOne({ uid: senderId });
            if (!sender) return;

            let content = '';
            if (status === 'Missed') {
                const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                content = `Missed video call at ${timeStr}`;
            } else {
                const hours = Math.floor(duration / 3600);
                const minutes = Math.floor((duration % 3600) / 60);
                const seconds = duration % 60;

                let durationStr = '';
                if (hours > 0) durationStr += `${hours}hr `;
                if (minutes > 0 || hours > 0) durationStr += `${minutes}m `;
                durationStr += `${seconds}s`;

                content = `Video call: ${durationStr}`;
            }

            const message = new Message({
                chatId,
                sender: sender._id,
                content,
                messageType: 'call'
            });

            await message.save();

            const chat = await Chat.findById(chatId);
            if (chat) {
                chat.lastMessage = content;
                chat.lastMessageTime = new Date();
                await chat.save();
            }

            const populatedMessage = await Message.findById(message._id)
                .populate('sender', 'uid email displayName photoURL');

            // Emit to both participants
            if (chat) {
                const receiverId = chat.participants.find(p => p.toString() !== sender._id.toString());
                const receiver = await User.findById(receiverId);
                if (receiver) {
                    io.to(receiver.uid).emit('receive_message', populatedMessage);
                }
                io.to(sender.uid).emit('receive_message', populatedMessage);
            }
        } catch (error) {
            console.error('Error saving call message:', error);
        }
    }
    // ─────────────────────────────────────────────────────────────────────────

    socket.on('disconnect', async () => {
        const userId = socketToUid.get(socket.id);
        console.log('User disconnected:', socket.id, userId);

        if (userId) {
            // Check if user was in a call
            let callInfo = activeCalls.get(userId);
            let otherUserId = null;

            if (!callInfo) {
                // Check if they were the callee
                const callerId = activeCalls.get(userId);
                if (typeof callerId === 'string') {
                    callInfo = activeCalls.get(callerId);
                    otherUserId = callerId;
                }
            } else {
                otherUserId = callInfo.calleeId;
            }

            if (callInfo && callInfo.chatId) {
                const duration = callInfo.startTime ? Math.floor((new Date() - callInfo.startTime) / 1000) : 0;
                const status = duration > 0 ? 'Ended' : 'Missed';

                await saveCallMessage(callInfo.chatId, callInfo.callerId, status, duration);

                activeCalls.delete(callInfo.callerId);
                activeCalls.delete(callInfo.calleeId);

                // Notify the other party
                if (otherUserId) {
                    io.to(otherUserId).emit('call:ended');
                }
            }

            socketToUid.delete(socket.id);
            uidToSocket.delete(userId);
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
