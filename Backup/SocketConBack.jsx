import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const socketRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const { currentUser, dbUser } = useAuth();

    useEffect(() => {
        // Initialize socket connection
        socketRef.current = io('https://knoktalkend.onrender.com');

        socketRef.current.on('connect', () => {
            console.log('Connected to socket server');
            setIsConnected(true);
        });

        socketRef.current.on('disconnect', () => {
            console.log('Disconnected from socket server');
            setIsConnected(false);
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);

    // Join user's room when logged in
    useEffect(() => {
        if (socketRef.current && currentUser) {
            socketRef.current.emit('join_chat', currentUser.uid);
        }
    }, [currentUser]);

    // ─── Chat helpers ─────────────────────────────────────────────────────────
    const sendMessage = (receiverId, message) => {
        if (socketRef.current) {
            socketRef.current.emit('send_message', {
                receiverId,
                message,
                senderId: currentUser.uid
            });
        }
    };

    const sendEditedMessage = (receiverId, message) => {
        if (socketRef.current) {
            socketRef.current.emit('message_edited', { receiverId, message });
        }
    };

    const sendDeletedMessage = (receiverId, messageId) => {
        if (socketRef.current) {
            socketRef.current.emit('message_deleted', { receiverId, messageId });
        }
    };

    const sendFriendRequest = (receiverId, request) => {
        if (socketRef.current) {
            socketRef.current.emit('friend_request', { receiverId, request });
        }
    };

    const sendFriendRequestAccepted = (receiverId, user) => {
        if (socketRef.current) {
            socketRef.current.emit('friend_request_accepted', { receiverId, user });
        }
    };

    const sendTyping = (receiverId, isTyping) => {
        if (socketRef.current) {
            socketRef.current.emit('typing', { receiverId, isTyping });
        }
    };

    const onReceiveMessage = (callback) => {
        if (socketRef.current) {
            socketRef.current.on('receive_message', callback);
        }
    };

    const onMessageEdited = (callback) => {
        if (socketRef.current) {
            socketRef.current.on('message_edited', callback);
        }
    };

    const onMessageDeleted = (callback) => {
        if (socketRef.current) {
            socketRef.current.on('message_deleted', callback);
        }
    };

    const onFriendRequest = (callback) => {
        if (socketRef.current) {
            socketRef.current.on('friend_request', callback);
        }
    };

    const onFriendRequestAccepted = (callback) => {
        if (socketRef.current) {
            socketRef.current.on('friend_request_accepted', callback);
        }
    };

    const onTyping = (callback) => {
        if (socketRef.current) {
            socketRef.current.on('typing', callback);
        }
    };

    const removeAllListeners = () => {
        if (socketRef.current) {
            socketRef.current.removeAllListeners();
        }
    };

    // ─── WebRTC Call helpers ──────────────────────────────────────────────────
    const initiateCall = (calleeId, offer, callerInfo, chatId) => {
        if (socketRef.current) {
            socketRef.current.emit('call:initiate', {
                calleeId,
                offer,
                callerId: callerInfo.uid,
                callerName: callerInfo.name,
                callerPhoto: callerInfo.photo,
                chatId
            });
        }
    };

    const acceptCall = (callerId, calleeId, answer) => {
        if (socketRef.current) {
            socketRef.current.emit('call:accepted', { callerId, calleeId, answer });
        }
    };

    const declineCall = (callerId, calleeId) => {
        if (socketRef.current) {
            socketRef.current.emit('call:declined', { callerId, calleeId });
        }
    };

    const sendIceCandidate = (targetId, candidate) => {
        if (socketRef.current) {
            socketRef.current.emit('call:ice-candidate', { targetId, candidate });
        }
    };

    const endCall = (targetId, callerId, calleeId, chatId, duration) => {
        if (socketRef.current) {
            socketRef.current.emit('call:ended', { targetId, callerId, calleeId, chatId, duration });
        }
    };

    const notifyBusy = (callerId) => {
        if (socketRef.current) {
            socketRef.current.emit('call:busy', { callerId });
        }
    };

    const onIncomingCall = (callback) => {
        if (socketRef.current) {
            socketRef.current.on('call:incoming', callback);
        }
    };

    const onCallAccepted = (callback) => {
        if (socketRef.current) {
            socketRef.current.on('call:accepted', callback);
        }
    };

    const onCallDeclined = (callback) => {
        if (socketRef.current) {
            socketRef.current.on('call:declined', callback);
        }
    };

    const onIceCandidate = (callback) => {
        if (socketRef.current) {
            socketRef.current.on('call:ice-candidate', callback);
        }
    };

    const onCallEnded = (callback) => {
        if (socketRef.current) {
            socketRef.current.on('call:ended', callback);
        }
    };

    const onCallBusy = (callback) => {
        if (socketRef.current) {
            socketRef.current.on('call:busy', callback);
        }
    };
    // ─────────────────────────────────────────────────────────────────────────

    const value = {
        socket: socketRef.current,
        isConnected,
        // Chat
        sendMessage,
        sendEditedMessage,
        sendDeletedMessage,
        sendFriendRequest,
        sendFriendRequestAccepted,
        sendTyping,
        onReceiveMessage,
        onMessageEdited,
        onMessageDeleted,
        onFriendRequest,
        onFriendRequestAccepted,
        onTyping,
        removeAllListeners,
        // Calls
        initiateCall,
        acceptCall,
        declineCall,
        sendIceCandidate,
        endCall,
        notifyBusy,
        onIncomingCall,
        onCallAccepted,
        onCallDeclined,
        onIceCandidate,
        onCallEnded,
        onCallBusy,
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};
