const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const User = require('../models/User');

// Search messages in a chat
router.get('/:chatId/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json([]);

        // Escape special regex characters to allow literal partial matching
        const escapedQuery = q.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');

        const messages = await Message.find({
            chatId: req.params.chatId,
            isDeleted: false,
            content: { $regex: escapedQuery, $options: 'i' }
        })
            .populate('sender', 'uid email displayName photoURL')
            .sort({ createdAt: 1 });

        res.json(messages);
    } catch (error) {
        console.error('Search messages error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get messages for a chat
router.get('/:chatId', async (req, res) => {
    try {
        const messages = await Message.find({
            chatId: req.params.chatId,
            isDeleted: false
        })
            .populate('sender', 'uid email displayName photoURL')
            .populate({
                path: 'replyTo',
                select: 'content messageType sender fileUrl fileName isDeleted',
                populate: {
                    path: 'sender',
                    select: 'uid email displayName photoURL'
                }
            })
            .sort({ createdAt: 1 });

        res.json(messages);
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Send a message
router.post('/', async (req, res) => {
    try {
        const { chatId, senderUid, content, messageType, fileUrl, fileName, replyTo } = req.body;

        const sender = await User.findOne({ uid: senderUid });
        if (!sender) {
            return res.status(404).json({ error: 'Sender not found' });
        }

        // Get the chat to find the receiver
        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        // Find the receiver (the other participant)
        const receiverId = chat.participants.find(
            p => p.toString() !== sender._id.toString()
        );

        if (receiverId) {
            const receiver = await User.findById(receiverId);
            if (receiver) {
                // Check if receiver has blocked the sender
                const isBlocked = receiver.blockedUsers.some(
                    id => id.toString() === sender._id.toString()
                );

                if (isBlocked) {
                    return res.status(403).json({ error: 'You are blocked by this user' });
                }
            }
        }

        const message = new Message({
            chatId,
            sender: sender._id,
            content,
            messageType: messageType || 'text',
            fileUrl: fileUrl || '',
            fileName: fileName || '',
            replyTo: replyTo || null
        });

        await message.save();

        // Update chat's last message
        if (chat) {
            chat.lastMessage = content || 'Sent an attachment';
            chat.lastMessageTime = new Date();
            await chat.save();
        }

        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'uid email displayName photoURL')
            .populate({
                path: 'replyTo',
                select: 'content messageType sender fileUrl fileName isDeleted',
                populate: {
                    path: 'sender',
                    select: 'uid email displayName photoURL'
                }
            });

        res.json(populatedMessage);
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Edit a message
router.put('/edit/:messageId', async (req, res) => {
    try {
        const { content } = req.body;

        const message = await Message.findById(req.params.messageId);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        message.content = content;
        message.isEdited = true;
        await message.save();

        // Update chat's last message to reflect the edited content
        // Only update if this is the latest message
        const chat = await Chat.findById(message.chatId);
        if (chat) {
            // Check if this is the latest message
            const latestMessage = await Message.findOne({
                chatId: message.chatId,
                isDeleted: false
            }).sort({ createdAt: -1 });

            if (latestMessage && latestMessage._id.toString() === message._id.toString()) {
                chat.lastMessage = content || 'Sent an attachment';
                await chat.save();
            }
        }

        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'uid email displayName photoURL');

        res.json(populatedMessage);
    } catch (error) {
        console.error('Edit message error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Helper function to update chat's last message
const updateChatLastMessage = async (chatId) => {
    try {
        const chat = await Chat.findById(chatId);
        if (!chat) return;

        // Find the latest non-deleted message
        const latestMessage = await Message.findOne({
            chatId: chatId,
            isDeleted: false
        }).sort({ createdAt: -1 });

        if (latestMessage) {
            chat.lastMessage = latestMessage.content || 'Sent an attachment';
            chat.lastMessageTime = latestMessage.createdAt;
        } else {
            chat.lastMessage = '';
            chat.lastMessageTime = chat.createdAt;
        }

        await chat.save();
    } catch (error) {
        console.error('Error updating chat last message:', error);
    }
};

// Delete a message (permanent delete from database)
router.delete('/:messageId', async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        const chatId = message.chatId;

        // Permanently delete the message from the database
        await Message.findByIdAndDelete(req.params.messageId);

        // Update chat's last message to the current latest message
        await updateChatLastMessage(chatId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete all messages sent by current user in a chat
router.delete('/chat/:chatId/user/:userUid', async (req, res) => {
    try {
        const { chatId, userUid } = req.params;

        const user = await User.findOne({ uid: userUid });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Delete all messages sent by this user in the chat
        const result = await Message.deleteMany({
            chatId: chatId,
            sender: user._id
        });

        // Update chat's last message to the current latest message
        await updateChatLastMessage(chatId);

        res.json({ success: true, deletedCount: result.deletedCount });
    } catch (error) {
        console.error('Delete user messages error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Bulk delete messages
router.post('/bulk-delete', async (req, res) => {
    try {
        const { messageIds } = req.body;
        if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
            return res.status(400).json({ error: 'Invalid message IDs' });
        }

        // Get the chatId from the first message to update the chat's last message later
        const firstMessage = await Message.findById(messageIds[0]);
        if (!firstMessage) {
            return res.status(404).json({ error: 'Messages not found' });
        }
        const chatId = firstMessage.chatId;

        // Permanently delete the messages
        await Message.deleteMany({ _id: { $in: messageIds } });

        // Update chat's last message
        await updateChatLastMessage(chatId);

        res.json({ success: true, deletedCount: messageIds.length });
    } catch (error) {
        console.error('Bulk delete error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;