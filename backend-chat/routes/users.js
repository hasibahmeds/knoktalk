const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');

// Sync user (create or update user from Firebase)
router.post('/sync', async (req, res) => {
    try {
        const { uid, email, displayName, photoURL } = req.body;

        let user = await User.findOne({ uid });

        if (user) {
            // Update existing user ONLY if new values are provided and not empty
            if (displayName !== undefined && displayName !== null && displayName !== '') {
                user.displayName = displayName;
            }
            if (photoURL !== undefined && photoURL !== null && photoURL !== '') {
                user.photoURL = photoURL;
            }
            await user.save();
        } else {
            // Create new user - only use email prefix as fallback if displayName is NOT provided at all
            // Do NOT use email prefix if displayName is explicitly sent as empty string
            const finalDisplayName = (displayName === undefined || displayName === null) ? email.split('@')[0] : displayName;
            user = new User({
                uid,
                email,
                displayName: finalDisplayName,
                photoURL: photoURL || ''
            });
            await user.save();
        }

        res.json(user);
    } catch (error) {
        console.error('Sync user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get current user
router.get('/me/:uid', async (req, res) => {
    try {
        const user = await User.findOne({ uid: req.params.uid })
            .populate('friends', 'uid email displayName photoURL')
            .populate('friendRequests.from', 'uid email displayName photoURL')
            .populate('blockedUsers', 'uid email displayName photoURL');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all users (except current user)
router.get('/all/:uid', async (req, res) => {
    try {
        const users = await User.find({ uid: { $ne: req.params.uid } })
            .select('uid email displayName photoURL friends friendRequests');

        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Send friend request
router.post('/friend-request', async (req, res) => {
    try {
        const { fromUid, toUid } = req.body;

        const fromUser = await User.findOne({ uid: fromUid });
        const toUser = await User.findOne({ uid: toUid });

        if (!fromUser || !toUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if already friends
        if (fromUser.friends.includes(toUser._id)) {
            return res.status(400).json({ error: 'Already friends' });
        }

        // Check if request already sent
        const existingRequest = fromUser.sentRequests.find(
            req => req.toUid === toUid
        );
        if (existingRequest) {
            return res.status(400).json({ error: 'Request already sent' });
        }

        // Add to sent requests
        fromUser.sentRequests.push({
            to: toUser._id,
            toUid: toUser.uid
        });
        await fromUser.save();

        // Add to received requests
        toUser.friendRequests.push({
            from: fromUser._id,
            fromUid: fromUser.uid,
            fromName: fromUser.displayName,
            fromPhoto: fromUser.photoURL
        });
        await toUser.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Friend request error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Accept friend request
router.post('/accept-request', async (req, res) => {
    try {
        const { userUid, requestId } = req.body;

        const user = await User.findOne({ uid: userUid });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const request = user.friendRequests.id(requestId);
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const fromUser = await User.findById(request.from);
        if (!fromUser) {
            return res.status(404).json({ error: 'Request sender not found' });
        }

        // Add to friends
        user.friends.push(fromUser._id);
        fromUser.friends.push(user._id);

        // Remove from friend requests
        user.friendRequests = user.friendRequests.filter(
            req => req._id.toString() !== requestId
        );

        // Remove from sent requests
        fromUser.sentRequests = fromUser.sentRequests.filter(
            req => req.toUid !== userUid
        );

        await user.save();
        await fromUser.save();

        // Create chat between them
        let chat = await Chat.findOne({
            participants: { $all: [user._id, fromUser._id] }
        });

        if (!chat) {
            chat = new Chat({
                participants: [user._id, fromUser._id]
            });
            await chat.save();
        }

        res.json({ success: true, chat });
    } catch (error) {
        console.error('Accept request error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Reject friend request
router.post('/reject-request', async (req, res) => {
    try {
        const { userUid, requestId } = req.body;

        const user = await User.findOne({ uid: userUid });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const request = user.friendRequests.id(requestId);
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const fromUser = await User.findById(request.from);
        if (fromUser) {
            fromUser.sentRequests = fromUser.sentRequests.filter(
                req => req.toUid !== userUid
            );
            await fromUser.save();
        }

        user.friendRequests = user.friendRequests.filter(
            req => req._id.toString() !== requestId
        );
        await user.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Reject request error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update user profile
router.put('/update/:uid', async (req, res) => {
    try {
        const { displayName, photoURL } = req.body;

        const user = await User.findOne({ uid: req.params.uid });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (displayName) user.displayName = displayName;
        if (photoURL) user.photoURL = photoURL;

        await user.save();
        res.json(user);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Block user
router.post('/block', async (req, res) => {
    try {
        const { userUid, blockedUid } = req.body;

        const user = await User.findOne({ uid: userUid });
        const blockedUser = await User.findOne({ uid: blockedUid });

        if (!user || !blockedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if already blocked
        if (user.blockedUsers.includes(blockedUser._id)) {
            return res.status(400).json({ error: 'User already blocked' });
        }

        user.blockedUsers.push(blockedUser._id);
        await user.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Block user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Unblock user
router.post('/unblock', async (req, res) => {
    try {
        const { userUid, blockedUid } = req.body;

        const user = await User.findOne({ uid: userUid });
        const blockedUser = await User.findOne({ uid: blockedUid });

        if (!user || !blockedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.blockedUsers = user.blockedUsers.filter(
            id => id.toString() !== blockedUser._id.toString()
        );
        await user.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Unblock user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Remove friend
router.post('/remove-friend', async (req, res) => {
    try {
        const { userUid, friendUid } = req.body;

        const user = await User.findOne({ uid: userUid });
        const friend = await User.findOne({ uid: friendUid });

        if (!user || !friend) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Remove friend from both users
        user.friends = user.friends.filter(
            id => id.toString() !== friend._id.toString()
        );
        friend.friends = friend.friends.filter(
            id => id.toString() !== user._id.toString()
        );

        await user.save();
        await friend.save();

        // Find and delete chat between users
        const chat = await Chat.findOne({
            participants: { $all: [user._id, friend._id] }
        });
        if (chat) {
            // Delete all messages associated with this chat
            await Message.deleteMany({ chatId: chat._id });
            // Delete the chat
            await Chat.findByIdAndDelete(chat._id);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Remove friend error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Check if user is blocked
router.get('/is-blocked/:userUid/:blockedUid', async (req, res) => {
    try {
        const user = await User.findOne({ uid: req.params.userUid });
        const blockedUser = await User.findOne({ uid: req.params.blockedUid });

        if (!user || !blockedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isBlocked = user.blockedUsers.some(
            id => id.toString() === blockedUser._id.toString()
        );

        res.json({ isBlocked });
    } catch (error) {
        console.error('Check block status error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
