import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
    FiSend, FiImage, FiPaperclip, FiMoreVertical,
    FiTrash2, FiCheck, FiX, FiUserPlus, FiUserMinus, FiCheckCircle,
    FiMessageCircle, FiUsers, FiSearch, FiLogOut, FiEdit,
    FiLock, FiUnlock, FiMenu, FiSmile, FiDownload,
    FiMoreHorizontal, FiMic, FiPlay, FiPause,
    FiVideo, FiVideoOff, FiMicOff, FiPhoneOff, FiPhone,
    FiChevronDown, FiChevronUp, FiPhoneIncoming, FiPhoneCall, FiCornerUpLeft
} from 'react-icons/fi';
import { HiArrowPathRoundedSquare } from "react-icons/hi2";
import { PiPlayCircleDuotone, PiPauseCircleDuotone } from "react-icons/pi";
import EmojiPicker from '../components/EmojiPicker';
import './Home.css';



const AudioPlayer = ({ src, durationLabel, isSentByMe }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef(null);

    const togglePlay = () => {
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const onTimeUpdate = () => {
        setCurrentTime(audioRef.current.currentTime);
    };

    const onLoadedMetadata = () => {
        setDuration(audioRef.current.duration);
    };

    const onEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
    };

    const handleSeek = (e) => {
        const time = parseFloat(e.target.value);
        audioRef.current.currentTime = time;
        setCurrentTime(time);
    };

    const formatTime = (time) => {
        if (isNaN(time)) return '0:00';
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`messenger-audio-player ${isSentByMe ? 'sent' : 'received'}`}>
            <audio
                ref={audioRef}
                src={src}
                onTimeUpdate={onTimeUpdate}
                onLoadedMetadata={onLoadedMetadata}
                onEnded={onEnded}
            />
            <button type="button" className="audio-play-btn" onClick={togglePlay}>
                {isPlaying ? <PiPauseCircleDuotone /> : <PiPlayCircleDuotone />}
            </button>
            <div className="audio-progress-container">
                <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="0.01"
                    value={currentTime}
                    onChange={handleSeek}
                    className="audio-slider"
                    style={{ '--progress': `${(currentTime / (duration || 1)) * 100}%` }}
                />
            </div>
            <span className="audio-duration">
                {isPlaying ? formatTime(currentTime) : (durationLabel || formatTime(duration))}
            </span>
        </div>
    );
};


const Home = () => {
    const { currentUser, dbUser, logout, fetchDbUser } = useAuth();
    const {
        sendMessage, sendDeletedMessage, sendEditedMessage,
        sendFriendRequest, sendTyping, onReceiveMessage,
        onMessageDeleted, onFriendRequest, onMessageEdited, socket,
        initiateCall, acceptCall, declineCall, sendIceCandidate, endCall, notifyBusy,
        onIncomingCall, onCallAccepted, onCallDeclined, onIceCandidate, onCallEnded, onCallBusy
    } = useSocket();

    const [users, setUsers] = useState([]);
    const [chats, setChats] = useState([]);
    const [unreadChats, setUnreadChats] = useState(new Set());
    const [isUnreadLoaded, setIsUnreadLoaded] = useState(false);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [showUsers, setShowUsers] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [editingMessage, setEditingMessage] = useState(null);
    const [replyingToMessage, setReplyingToMessage] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [fullscreenImage, setFullscreenImage] = useState(null);
    const [selectedImages, setSelectedImages] = useState([]); // Array of { file, preview }
    const [previewFullscreen, setPreviewFullscreen] = useState(null); // Now stores the preview URL itself

    // Search state
    const [isSearching, setIsSearching] = useState(false);
    const [chatSearchTerm, setChatSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0);

    // Audio recording states
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerIntervalRef = useRef(null);

    const [isTyping, setIsTyping] = useState(false);
    const [showFriendRequests, setShowFriendRequests] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showImageMenu, setShowImageMenu] = useState(false);
    const [loading, setLoading] = useState({
        users: false,
        chats: false,
        messages: false
    });

    const messagesEndRef = useRef(null);
    const searchInputRef = useRef(null);
    const imageInputRef = useRef(null);
    const sidebarRef = useRef(null);

    // ─── Call State ───────────────────────────────────────────────────────────
    const [callState, setCallState] = useState('idle'); // idle | calling | incoming | active
    const [incomingCallData, setIncomingCallData] = useState(null);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [cameraMode, setCameraMode] = useState('user'); // 'user' (front) | 'environment' (back)
    const [activeCallUser, setActiveCallUser] = useState(null);
    const [callDuration, setCallDuration] = useState(0);
    const [showHeaderDropdown, setShowHeaderDropdown] = useState(false);
    const [showSelectionDropdown, setShowSelectionDropdown] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState({ show: false, message: '', onConfirm: null, icon: null, isAlert: false });

    // Call refs
    const peerConnectionRef = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const localStreamRef = useRef(null);   // tracks stream for cleanup in closures
    const iceCandidateQueueRef = useRef([]);
    const callTimeoutRef = useRef(null);
    const callDurationTimerRef = useRef(null);
    const callStateRef = useRef('idle');   // mirror of callState for use inside closures
    // ─────────────────────────────────────────────────────────────────────────

    // Load unread chats from localStorage safely
    useEffect(() => {
        if (currentUser?.uid) {
            try {
                const saved = localStorage.getItem(`unreadChats_${currentUser.uid}`);
                if (saved) {
                    setUnreadChats(new Set(JSON.parse(saved)));
                }
            } catch (e) {
                console.error("Error loading unread chats", e);
            }
            setIsUnreadLoaded(true);
        }
    }, [currentUser?.uid]);

    // Save unread chats to localStorage only after initial load
    useEffect(() => {
        if (currentUser?.uid && isUnreadLoaded) {
            localStorage.setItem(`unreadChats_${currentUser.uid}`, JSON.stringify([...unreadChats]));
        }
    }, [unreadChats, currentUser?.uid, isUnreadLoaded]);


    // Toggle sidebar for mobile
    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    // Close sidebar when clicking outside on mobile
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target) &&
                !event.target.closest('.sidebar-toggle') && window.innerWidth <= 768) {
                setSidebarOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Cleanup for audio recording
    useEffect(() => {
        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Close sidebar when chat is selected on mobile
    useEffect(() => {
        if (selectedChat && window.innerWidth <= 768) {
            setSidebarOpen(false);
        }
    }, [selectedChat]);

    // Keep callStateRef in sync with callState
    useEffect(() => {
        callStateRef.current = callState;
    }, [callState]);

    // Sync local video — re-runs when callState changes (overlay mounts/unmounts)
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            if (localVideoRef.current.srcObject !== localStream) {
                localVideoRef.current.srcObject = localStream;
            }
        }
    }, [localStream, callState]);

    // Sync remote video — re-runs when callState changes so it catches the case
    // where ontrack fired BEFORE the overlay rendered (callee flow).
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            if (remoteVideoRef.current.srcObject !== remoteStream) {
                remoteVideoRef.current.srcObject = remoteStream;
                remoteVideoRef.current.play().catch(() => { });
            }
        }
    }, [remoteStream, callState]);

    // Cleanup call on page unload
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(t => t.stop());
            }
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }
            if (activeCallUser) {
                endCall(activeCallUser.uid);
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [activeCallUser]);

    // Close header dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.header-dropdown-wrapper')) {
                setShowHeaderDropdown(false);
                setShowSelectionDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch all users
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setLoading(prev => ({ ...prev, users: true }));
                const response = await fetch(`http://localhost:5000/api/users/all/${currentUser.uid}`);
                const data = await response.json();
                setUsers(data);
            } catch (error) {
                console.error('Error fetching users:', error);
            } finally {
                setLoading(prev => ({ ...prev, users: false }));
            }
        };
        if (currentUser) {
            fetchUsers();
        }
    }, [currentUser]);

    // Fetch user's chats
    useEffect(() => {
        const fetchChats = async () => {
            try {
                setLoading(prev => ({ ...prev, chats: true }));
                const response = await fetch(`http://localhost:5000/api/chats/${currentUser.uid}`);
                const data = await response.json();
                setChats(data);
            } catch (error) {
                console.error('Error fetching chats:', error);
            } finally {
                setLoading(prev => ({ ...prev, chats: false }));
            }
        };
        if (currentUser) {
            fetchChats();
        }
    }, [currentUser]);

    // Fetch messages when chat is selected
    useEffect(() => {
        const fetchMessages = async () => {
            if (selectedChat) {
                try {
                    setLoading(prev => ({ ...prev, messages: true }));
                    const response = await fetch(`http://localhost:5000/api/messages/${selectedChat._id}`);
                    const data = await response.json();
                    setMessages(data);

                    // Check if the other user is blocked
                    const otherUser = selectedChat.participants.find(p => p.uid !== currentUser.uid);
                    if (otherUser) {
                        checkBlockedStatus(otherUser.uid);
                    }
                } catch (error) {
                    console.error('Error fetching messages:', error);
                } finally {
                    setLoading(prev => ({ ...prev, messages: false }));
                }
            }
        };
        fetchMessages();
        setSelectedMessageIds([]);
        setReplyingToMessage(null);
        setIsSearching(false);
        setChatSearchTerm('');
        setSearchResults([]);
    }, [selectedChat]);

    // Socket listeners — chat
    useEffect(() => {
        const handleReceiveMessage = (message) => {
            if (selectedChat && message.chatId === selectedChat._id) {
                setMessages(prev => [...prev, message]);
            } else {
                setUnreadChats(prev => new Set(prev).add(message.chatId));
            }
        };

        const handleMessageDeleted = ({ messageId }) => {
            setMessages(prev => prev.map(msg => {
                if (msg._id === messageId) {
                    let newContent = 'This message was deleted';
                    if (msg.messageType === 'call') {
                        if (msg.content.includes('Missed')) {
                            newContent = 'Missed: This message was deleted';
                        } else {
                            newContent = 'Video Call: This message was deleted';
                        }
                    }
                    return { ...msg, isDeleted: true, content: newContent };
                }
                return msg;
            }));
        };

        const handleMessageEdited = (message) => {
            setMessages(prev => prev.map(msg =>
                msg._id === message._id ? message : msg
            ));
        };

        const handleFriendRequest = () => {
            fetchDbUser(currentUser.uid);
        };

        onReceiveMessage(handleReceiveMessage);
        onMessageDeleted(handleMessageDeleted);
        onMessageEdited(handleMessageEdited);
        onFriendRequest(handleFriendRequest);

        return () => {
            if (socket) {
                socket.off('receive_message', handleReceiveMessage);
                socket.off('message_deleted', handleMessageDeleted);
                socket.off('message_edited', handleMessageEdited);
                socket.off('friend_request', handleFriendRequest);
            }
        };
    }, [selectedChat, currentUser, onReceiveMessage, onMessageDeleted, onMessageEdited, onFriendRequest, fetchDbUser, socket]);

    // Socket listeners — WebRTC calls (separate effect, stable deps)
    useEffect(() => {
        if (!socket) return;

        const handleIncomingCall = (data) => {
            if (callStateRef.current !== 'idle') {
                // Already in a call — notify caller we're busy
                if (socket) socket.emit('call:busy', { callerId: data.callerId });
                return;
            }
            setIncomingCallData(data);
            setCallState('incoming');
        };

        const handleCallAccepted = async (data) => {
            const { answer } = data;
            if (!peerConnectionRef.current) return;
            try {
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
                // Flush queued ICE candidates
                for (const candidate of iceCandidateQueueRef.current) {
                    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
                }
                iceCandidateQueueRef.current = [];

                setCallState('active');
                if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }

                callDurationTimerRef.current = setInterval(() => {
                    setCallDuration(prev => prev + 1);
                }, 1000);
            } catch (err) {
                console.error('handleCallAccepted error:', err);
                cleanupCall();
            }
        };

        const handleCallDeclined = () => {
            cleanupCall();
            alert('Call was declined.');
        };

        const handleIceCandidate = async ({ candidate }) => {
            if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
                try {
                    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                    console.error('addIceCandidate error:', err);
                }
            } else {
                iceCandidateQueueRef.current.push(candidate);
            }
        };

        const handleCallEnded = () => {
            cleanupCall();
        };

        const handleCallBusy = () => {
            cleanupCall();
            alert('User is currently busy.');
        };

        onIncomingCall(handleIncomingCall);
        onCallAccepted(handleCallAccepted);
        onCallDeclined(handleCallDeclined);
        onIceCandidate(handleIceCandidate);
        onCallEnded(handleCallEnded);
        onCallBusy(handleCallBusy);

        return () => {
            socket.off('call:incoming', handleIncomingCall);
            socket.off('call:accepted', handleCallAccepted);
            socket.off('call:declined', handleCallDeclined);
            socket.off('call:ice-candidate', handleIceCandidate);
            socket.off('call:ended', handleCallEnded);
            socket.off('call:busy', handleCallBusy);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Send message
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedChat) return;

        const receiver = selectedChat.participants.find(p => p.uid !== currentUser.uid);

        try {
            const response = await fetch('http://localhost:5000/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: selectedChat._id,
                    senderUid: currentUser.uid,
                    content: newMessage,
                    messageType: 'text',
                    replyTo: replyingToMessage ? replyingToMessage._id : null
                })
            });

            if (!response.ok) {
                const errorMessage = {
                    _id: Date.now().toString(),
                    chatId: selectedChat._id,
                    senderUid: currentUser.uid,
                    content: 'Unable to send',
                    messageType: 'text',
                    createdAt: new Date().toISOString(),
                    isError: true
                };
                setMessages(prev => [...prev, errorMessage]);
                setNewMessage('');
                return;
            }

            const message = await response.json();
            setMessages(prev => [...prev, message]);
            sendMessage(receiver.uid, message);
            setNewMessage('');
            setReplyingToMessage(null);
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    // Format duration for display
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);

            timerIntervalRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        } catch (error) {
            console.error('Error starting recording:', error);
            alert('Could not access microphone.');
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        clearInterval(timerIntervalRef.current);
        setIsRecording(false);
        setRecordingTime(0);
        audioChunksRef.current = [];
    };

    const stopRecordingAndSend = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await sendAudioMessage(audioBlob, recordingTime);
                audioChunksRef.current = [];
                setRecordingTime(0);
            };
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            clearInterval(timerIntervalRef.current);
            setIsRecording(false);
        }
    };

    const sendAudioMessage = async (audioBlob, durationInSeconds) => {
        if (!selectedChat) return;
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64Audio = reader.result;
            const receiver = selectedChat.participants.find(p => p.uid !== currentUser.uid);

            try {
                const response = await fetch('http://localhost:5000/api/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chatId: selectedChat._id,
                        senderUid: currentUser.uid,
                        content: formatTime(durationInSeconds),
                        messageType: 'audio',
                        fileUrl: base64Audio,
                        replyTo: replyingToMessage ? replyingToMessage._id : null
                    })
                });

                if (!response.ok) {
                    const errorMessage = {
                        _id: Date.now().toString(),
                        chatId: selectedChat._id,
                        senderUid: currentUser.uid,
                        content: 'Unable to send',
                        messageType: 'text',
                        createdAt: new Date().toISOString(),
                        isError: true
                    };
                    setMessages(prev => [...prev, errorMessage]);
                    return;
                }

                const message = await response.json();
                setMessages(prev => [...prev, message]);
                sendMessage(receiver.uid, message);
                setReplyingToMessage(null);
            } catch (error) {
                console.error('Error sending audio message:', error);
            }
        };
    };



    // Delete messages (bulk support)
    const handleDeleteMessages = (messageIds) => {
        if (!messageIds || (Array.isArray(messageIds) && messageIds.length === 0)) return;
        const idsToDelete = Array.isArray(messageIds) ? messageIds : [messageIds];

        setConfirmDialog({
            show: true,
            message: `Are you sure you want to delete ${idsToDelete.length} message(s)?`,
            icon: <FiTrash2 />,
            onConfirm: async () => {
                const receiver = selectedChat.participants.find(p => p.uid !== currentUser.uid);

                try {
                    const response = await fetch('http://localhost:5000/api/messages/bulk-delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ messageIds: idsToDelete })
                    });

                    if (response.ok) {
                        setMessages(prev => prev.map(msg => {
                            if (idsToDelete.includes(msg._id)) {
                                let newContent = 'This message was deleted';
                                if (msg.messageType === 'call') {
                                    if (msg.content.includes('Missed')) {
                                        newContent = 'Missed: This message was deleted';
                                    } else {
                                        newContent = 'Video Call: This message was deleted';
                                    }
                                }
                                return { ...msg, isDeleted: true, content: newContent };
                            }
                            return msg;
                        }));
                        idsToDelete.forEach(id => sendDeletedMessage(receiver.uid, id));
                        clearSelection();
                        setShowMessageMenu(null);
                    }
                } catch (error) {
                    console.error('Error deleting messages:', error);
                }
            }
        });
    };

    // Remove all my messages in the chat
    const handleRemoveAllMyMessages = async () => {
        if (!selectedChat) return;

        setConfirmDialog({
            show: true,
            message: 'Are you sure you want to remove all your messages in this chat?',
            icon: <FiTrash2 />,
            onConfirm: async () => {
                try {
                    const response = await fetch(
                        `http://localhost:5000/api/messages/chat/${selectedChat._id}/user/${currentUser.uid}`,
                        {
                            method: 'DELETE'
                        }
                    );

                    const data = await response.json();
                    if (data.success) {
                        const messagesResponse = await fetch(
                            `http://localhost:5000/api/messages/${selectedChat._id}`
                        );
                        const messagesData = await messagesResponse.json();
                        setMessages(messagesData);
                        alert(`Removed ${data.deletedCount} message(s)`);
                    }
                } catch (error) {
                    console.error('Error removing messages:', error);
                    alert('Failed to remove messages. Please make sure the backend server is running.');
                }
            }
        });
    };

    // Edit message
    const handleEditMessage = async (messageId) => {
        if (!editContent.trim()) return;

        const receiver = selectedChat.participants.find(p => p.uid !== currentUser.uid);

        try {
            const response = await fetch(`http://localhost:5000/api/messages/edit/${messageId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: editContent })
            });

            const updatedMessage = await response.json();
            setMessages(prev => prev.map(msg =>
                msg._id === messageId ? updatedMessage : msg
            ));
            sendEditedMessage(receiver.uid, updatedMessage);
            setEditingMessage(null);
            setEditContent('');
        } catch (error) {
            console.error('Error editing message:', error);
        }
    };

    // Start editing a message
    const startEditing = (message) => {
        setEditingMessage(message._id);
        setEditContent(message.content);
    };

    // Cancel editing
    const cancelEditing = () => {
        setEditingMessage(null);
        setEditContent('');
    };

    // Send friend request
    const handleSendFriendRequest = async (user) => {
        try {
            await fetch('http://localhost:5000/api/users/friend-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromUid: currentUser.uid,
                    toUid: user.uid
                })
            });
            setConfirmDialog({
                show: true,
                message: 'Friend request sent!',
                icon: <FiCheckCircle />,
                isAlert: true
            });
        } catch (error) {
            console.error('Error sending friend request:', error);
        }
    };

    // Accept friend request
    const handleAcceptRequest = async (requestId) => {
        try {
            const response = await fetch('http://localhost:5000/api/users/accept-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userUid: currentUser.uid,
                    requestId
                })
            });

            const data = await response.json();
            if (data.success) {
                fetchDbUser(currentUser.uid);
                const chatResponse = await fetch(`http://localhost:5000/api/chats/${currentUser.uid}`);
                const chatData = await chatResponse.json();
                setChats(chatData);
            }
        } catch (error) {
            console.error('Error accepting request:', error);
        }
    };

    // Reject friend request
    const handleRejectRequest = async (requestId) => {
        try {
            await fetch('http://localhost:5000/api/users/reject-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userUid: currentUser.uid,
                    requestId
                })
            });
            fetchDbUser(currentUser.uid);
        } catch (error) {
            console.error('Error rejecting request:', error);
        }
    };

    // Check if user is blocked
    const checkBlockedStatus = async (otherUserUid) => {
        try {
            const response = await fetch(`http://localhost:5000/api/users/is-blocked/${currentUser.uid}/${otherUserUid}`);
            const data = await response.json();
            setIsBlocked(data.isBlocked);
        } catch (error) {
            console.error('Error checking block status:', error);
        }
    };

    // Block user
    const handleBlockUser = async () => {
        const otherUser = getOtherUser(selectedChat);
        if (!otherUser) return;

        setConfirmDialog({
            show: true,
            message: `Are you sure you want to block ${otherUser.displayName || otherUser.email}?`,
            icon: <FiLock />,
            onConfirm: async () => {
                try {
                    await fetch('http://localhost:5000/api/users/block', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userUid: currentUser.uid,
                            blockedUid: otherUser.uid
                        })
                    });
                    setIsBlocked(true);
                } catch (error) {
                    console.error('Error blocking user:', error);
                }
            }
        });
    };

    // Unblock user
    const handleUnblockUser = async () => {
        const otherUser = getOtherUser(selectedChat);
        if (!otherUser) return;

        setConfirmDialog({
            show: true,
            message: `Are you sure you want to unblock ${otherUser.displayName || otherUser.email}?`,
            icon: <FiUnlock />,
            onConfirm: async () => {
                try {
                    await fetch('http://localhost:5000/api/users/unblock', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userUid: currentUser.uid,
                            blockedUid: otherUser.uid
                        })
                    });
                    setIsBlocked(false);
                } catch (error) {
                    console.error('Error unblocking user:', error);
                }
            }
        });
    };

    // Handle image selection (show preview)
    const handleImageSelect = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const readFiles = files.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                    resolve({ file, preview: reader.result });
                };
                reader.readAsDataURL(file);
            });
        });

        Promise.all(readFiles).then(newImages => {
            setSelectedImages(prev => [...prev, ...newImages]);
        });
    };

    // Cancel all selected images
    const handleCancelImage = () => {
        setSelectedImages([]);
        if (imageInputRef.current) {
            imageInputRef.current.value = '';
        }
    };

    // Download fullscreen image
    const handleDownloadImage = async () => {
        let imageUrl = '';
        if (fullscreenImage && typeof fullscreenImage === 'object') {
            imageUrl = fullscreenImage.fileUrl;
        } else if (typeof fullscreenImage === 'string') {
            imageUrl = fullscreenImage;
        } else if (previewFullscreen && typeof previewFullscreen === 'object') {
            imageUrl = previewFullscreen.url;
        } else if (typeof previewFullscreen === 'string') {
            imageUrl = previewFullscreen;
        }

        if (!imageUrl) return;

        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `chat-image-${Date.now()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            setShowImageMenu(false);
        } catch (error) {
            console.error('Error downloading image:', error);
            const link = document.createElement('a');
            link.href = imageUrl;
            link.target = '_blank';
            link.download = `chat-image-${Date.now()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setShowImageMenu(false);
        }
    };

    // Remove individual image from selection
    const handleRemoveIndividualImage = (indexToRemove) => {
        setSelectedImages(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    // Send the selected images
    const handleSendSelectedImage = async () => {
        if (selectedImages.length === 0 || !selectedChat) return;

        const imagesToSend = [...selectedImages];
        handleCancelImage();

        for (const item of imagesToSend) {
            const base64 = item.preview.split(',')[1];
            try {
                const response = await fetch('http://localhost:5000/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: base64 })
                });

                const data = await response.json();

                if (data.url) {
                    const receiver = selectedChat.participants.find(p => p.uid !== currentUser.uid);

                    const msgResponse = await fetch('http://localhost:5000/api/messages', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chatId: selectedChat._id,
                            senderUid: currentUser.uid,
                            content: item.file.name,
                            messageType: 'image',
                            fileUrl: data.url,
                            replyTo: replyingToMessage ? replyingToMessage._id : null
                        })
                    });

                    const message = await msgResponse.json();
                    setMessages(prev => [...prev, message]);
                    sendMessage(receiver.uid, message);
                }
            } catch (error) {
                console.error('Error uploading image:', error);
            }
        }
        setReplyingToMessage(null);
    };

    // Handle image upload (legacy)
    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedChat) return;

        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = reader.result.split(',')[1];

            try {
                const response = await fetch('http://localhost:5000/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: base64 })
                });

                const data = await response.json();

                if (data.url) {
                    const receiver = selectedChat.participants.find(p => p.uid !== currentUser.uid);

                    const msgResponse = await fetch('http://localhost:5000/api/messages', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chatId: selectedChat._id,
                            senderUid: currentUser.uid,
                            content: file.name,
                            messageType: 'image',
                            fileUrl: data.url,
                            replyTo: replyingToMessage ? replyingToMessage._id : null
                        })
                    });

                    const message = await msgResponse.json();
                    setMessages(prev => [...prev, message]);
                    sendMessage(receiver.uid, message);
                    setReplyingToMessage(null);
                }
            } catch (error) {
                console.error('Error uploading image:', error);
            }
        };
        reader.readAsDataURL(file);
    };



    // Add emoji to message
    const addEmoji = (emoji) => {
        if (isSearching) {
            const newTerm = chatSearchTerm + emoji;
            setChatSearchTerm(newTerm);
            // Manually trigger the search logic since state update is async
            fetch(`http://localhost:5000/api/messages/${selectedChat._id}/search?q=${encodeURIComponent(newTerm)}`)
                .then(res => res.json())
                .then(data => {
                    setSearchResults(data);
                    setCurrentSearchIndex(0);
                    // Refocus search input after state update
                    setTimeout(() => {
                        if (searchInputRef.current) searchInputRef.current.focus();
                    }, 0);
                })
                .catch(err => console.error('Error searching with emoji:', err));
        } else if (editingMessage) {
            setEditContent(prev => prev + emoji);
        } else {
            setNewMessage(prev => prev + emoji);
        }
    };

    // Handle backspace in emoji picker
    const handleBackspace = () => {
        const deleteLastCharacter = (str) => {
            if (!str) return str;
            if (typeof Intl !== 'undefined' && Intl.Segmenter) {
                const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
                const segments = Array.from(segmenter.segment(str)).map(s => s.segment);
                return segments.slice(0, -1).join('');
            }
            const arr = [...str];
            return arr.slice(0, -1).join('');
        };

        if (editingMessage) {
            setEditContent(prev => deleteLastCharacter(prev));
        } else {
            setNewMessage(prev => deleteLastCharacter(prev));
        }
    };

    // Handle send button inside emoji picker
    const handleEmojiSend = () => {
        if (editingMessage) {
            handleEditMessage(editingMessage);
        } else {
            handleSendMessage({ preventDefault: () => { } });
        }
        setShowEmojiPicker(false);
    };

    // Get other user in chat
    const getOtherUser = (chat) => {
        return chat.participants.find(p => p.uid !== currentUser.uid);
    };

    // Filter users
    const filteredUsers = users.filter(user => {
        const name = (user.displayName || user.email).toLowerCase();
        return name.includes(searchTerm.toLowerCase());
    });

    // Check if friend request already sent to a user
    const hasSentRequestToUser = (userUid) => {
        return dbUser?.sentRequests?.some(req => req.toUid === userUid);
    };

    // Check if user is a friend
    const isUserFriend = (userUid) => {
        return dbUser?.friends?.some(f => f.uid === userUid);
    };

    // Remove friend
    const handleRemoveFriend = (friendUid) => {
        setConfirmDialog({
            show: true,
            message: 'Are you sure you want to remove this friend?',
            icon: <FiUserMinus />,
            onConfirm: async () => {
                try {
                    const response = await fetch('http://localhost:5000/api/users/remove-friend', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userUid: currentUser.uid,
                            friendUid
                        })
                    });
                    const data = await response.json();
                    if (data.success) {
                        fetchDbUser(currentUser.uid);
                        const chatResponse = await fetch(`http://localhost:5000/api/chats/${currentUser.uid}`);
                        const chatData = await chatResponse.json();
                        setChats(chatData);
                        if (selectedChat) {
                            const otherUser = selectedChat.participants.find(p => p.uid !== currentUser.uid);
                            if (otherUser && otherUser.uid === friendUid) {
                                setSelectedChat(null);
                                setMessages([]);
                            }
                        }
                    } else {
                        setConfirmDialog({
                            show: true,
                            message: data.error || 'Failed to remove friend',
                            icon: <FiX />,
                            isAlert: true
                        });
                    }
                } catch (error) {
                    console.error('Error removing friend:', error);
                    setConfirmDialog({
                        show: true,
                        message: 'Failed to remove friend. Please make sure the backend server is running.',
                        icon: <FiX />,
                        isAlert: true
                    });
                }
            }
        });
    };

    // Filter chats
    const filteredChats = chats.filter(chat => {
        const user = getOtherUser(chat);
        const name = (user?.displayName || user?.email || '').toLowerCase();
        return name.includes(searchTerm.toLowerCase());
    });

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    // Handle chat history search
    const handleChatSearch = async (e) => {
        const term = e.target.value;
        setChatSearchTerm(term);

        if (!term.trim() || !selectedChat) {
            setSearchResults([]);
            return;
        }

        try {
            const response = await fetch(`http://localhost:5000/api/messages/${selectedChat._id}/search?q=${encodeURIComponent(term)}`);
            const data = await response.json();
            setSearchResults(data);
            setCurrentSearchIndex(0);
            setShowSearchDropdown(data.length > 0);
        } catch (error) {
            console.error('Error searching messages:', error);
        }
    };

    const handleNextSearch = () => {
        if (searchResults.length > 0) {
            setCurrentSearchIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
            scrollToSearchResult(currentSearchIndex < searchResults.length - 1 ? currentSearchIndex + 1 : 0);
        }
    };

    const handlePrevSearch = () => {
        if (searchResults.length > 0) {
            setCurrentSearchIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
            scrollToSearchResult(currentSearchIndex > 0 ? currentSearchIndex - 1 : searchResults.length - 1);
        }
    };

    const scrollToSearchResult = (index) => {
        const msg = searchResults[index];
        if (!msg) return;
        const el = document.getElementById(`message-${msg._id}`) || document.querySelector(`[data-message-ids~="${msg._id}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('highlight-pulse');
            setTimeout(() => el.classList.remove('highlight-pulse'), 1500);
        }
    };

    const [showMessageMenu, setShowMessageMenu] = useState(null);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const [selectedMessageIds, setSelectedMessageIds] = useState([]);

    const handleSelectMessage = (item) => {
        const isGroup = item.type === 'image-group';
        const mainMsg = isGroup ? item.messages[0] : item;

        if (!mainMsg.isDeleted) {
            const itemIds = isGroup ? item.messages.map(m => m._id) : [item._id];

            setSelectedMessageIds(prev => {
                const allExists = itemIds.every(id => prev.includes(id));
                if (allExists) {
                    return prev.filter(id => !itemIds.includes(id));
                } else {
                    return [...new Set([...prev, ...itemIds])];
                }
            });
            setEditingMessage(null);
            setEditContent('');
            setReplyingToMessage(null);
        }
    };

    const clearSelection = () => {
        setSelectedMessageIds([]);
        setShowSelectionDropdown(false);
    };

    const selectedMessages = messages.filter(m => selectedMessageIds.includes(m._id));
    const firstSelectedMessage = selectedMessages[0];
    const allSelectedMine = selectedMessages.every(m => m.sender?.uid === currentUser.uid);
    const firstSelectedMessageMine = firstSelectedMessage?.sender?.uid === currentUser.uid;

    const groupedMessages = [];
    messages.forEach((msg, index) => {
        const prevMsg = messages[index - 1];
        const isImage = msg.messageType === 'image';
        const isSameSender = prevMsg && (msg.sender?.uid || msg.senderUid) === (prevMsg.sender?.uid || prevMsg.senderUid);
        const timeDiff = prevMsg ? (new Date(msg.createdAt) - new Date(prevMsg.createdAt)) / 1000 : Infinity;

        if (isImage && prevMsg && prevMsg.messageType === 'image' && isSameSender && timeDiff < 15) {
            const lastGroup = groupedMessages[groupedMessages.length - 1];
            if (lastGroup.type === 'image-group') {
                lastGroup.messages.push(msg);
            } else {
                groupedMessages.pop();
                groupedMessages.push({
                    type: 'image-group',
                    messages: [prevMsg, msg],
                    senderUid: msg.senderUid,
                    sender: msg.sender,
                    createdAt: msg.createdAt,
                    _id: `group-${msg._id}`
                });
            }
        } else {
            groupedMessages.push({ ...msg, type: 'single' });
        }
    });

    const isSingleSelection = selectedMessageIds.length > 0 && groupedMessages.filter(gMsg => {
        if (gMsg.type === 'image-group') {
            return gMsg.messages.some(m => selectedMessageIds.includes(m._id));
        } else {
            return selectedMessageIds.includes(gMsg._id);
        }
    }).length === 1;

    // ─── WebRTC Call Functions ────────────────────────────────────────────────
    const STUN_SERVERS = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
        ]
    };

    const formatCallDuration = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        if (h > 0) {
            return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const cleanupCall = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        iceCandidateQueueRef.current = [];
        if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
        if (callDurationTimerRef.current) { clearInterval(callDurationTimerRef.current); callDurationTimerRef.current = null; }
        setCallState('idle');
        setIncomingCallData(null);
        setLocalStream(null);
        setRemoteStream(null);
        setIsVideoEnabled(true);
        setIsMicMuted(false);
        setCameraMode('user');
        setActiveCallUser(null);
        setCallDuration(0);
    };

    const initPeerConnection = (targetUserId) => {
        const pc = new RTCPeerConnection(STUN_SERVERS);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendIceCandidate(targetUserId, event.candidate);
            }
        };

        // ─── BUG FIX: assign srcObject directly here, not via React state → useEffect.
        // The video element ref may be null when the useEffect runs because React hasn't
        // committed the new render yet. Assigning here (synchronously in the event) is
        // always safe and immediate. We ALSO call setRemoteStream so the UI reacts.
        pc.ontrack = (event) => {
            const incomingStream = (event.streams && event.streams[0])
                ? event.streams[0]
                : new MediaStream([event.track]);

            setRemoteStream(incomingStream);

            // Direct DOM assignment — bypasses React rendering delay
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = incomingStream;
                remoteVideoRef.current.play().catch(() => { });
            }
        };

        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                cleanupCall();
            }
        };

        return pc;
    };

    const startCall = async () => {
        if (!selectedChat || callStateRef.current !== 'idle') return;
        const otherUser = getOtherUser(selectedChat);
        if (!otherUser) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localStreamRef.current = stream;
            setLocalStream(stream);

            const pc = initPeerConnection(otherUser.uid);
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
            peerConnectionRef.current = pc;

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            setCallState('calling');
            setActiveCallUser({
                uid: otherUser.uid,
                name: otherUser.displayName || otherUser.email,
                photo: otherUser.photoURL || ''
            });

            initiateCall(otherUser.uid, offer, {
                uid: currentUser.uid,
                name: dbUser?.displayName || currentUser.displayName || currentUser.email,
                photo: dbUser?.photoURL || currentUser.photoURL || ''
            }, selectedChat._id);

            // ─── BUG FIX: assign local stream directly after state update.
            // After setCallState('calling') React schedules a re-render. The video element
            // (<video ref={localVideoRef}>) only exists after that render commits. We use
            // requestAnimationFrame to wait one paint cycle then assign srcObject.
            requestAnimationFrame(() => {
                if (localVideoRef.current && localStreamRef.current) {
                    localVideoRef.current.srcObject = localStreamRef.current;
                }
            });

            // 30-second no-answer timeout
            callTimeoutRef.current = setTimeout(() => {
                if (callStateRef.current === 'calling') {
                    endCall(otherUser.uid, currentUser.uid, otherUser.uid, selectedChat._id, 0);
                    cleanupCall();
                    setConfirmDialog({
                        show: true,
                        message: 'No answer. The call timed out.',
                        icon: <FiPhoneOff />,
                        isAlert: true
                    });
                }
            }, 30000);
        } catch (err) {
            console.error('startCall error:', err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                alert('Camera/microphone access denied.\nPlease allow permissions in your browser and try again.');
            } else if (err.name === 'NotFoundError') {
                alert('No camera or microphone found.\nPlease connect a device and try again.');
            } else {
                alert('Could not start call. Please check your camera and microphone.');
            }
            cleanupCall();
        }
    };

    const handleAcceptCall = async () => {
        if (!incomingCallData) return;
        const { callerId, callerName, callerPhoto, offer } = incomingCallData;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localStreamRef.current = stream;
            setLocalStream(stream);

            const pc = initPeerConnection(callerId);
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
            peerConnectionRef.current = pc;

            await pc.setRemoteDescription(new RTCSessionDescription(offer));

            // Flush queued ICE candidates
            for (const candidate of iceCandidateQueueRef.current) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
            }
            iceCandidateQueueRef.current = [];

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            acceptCall(callerId, currentUser.uid, answer);

            setCallState('active');
            setActiveCallUser({ uid: callerId, name: callerName, photo: callerPhoto });
            setIncomingCallData(null);

            // ─── BUG FIX: wait one paint cycle then assign local srcObject.
            requestAnimationFrame(() => {
                if (localVideoRef.current && localStreamRef.current) {
                    localVideoRef.current.srcObject = localStreamRef.current;
                }
            });

            callDurationTimerRef.current = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('handleAcceptCall error:', err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                alert('Camera/microphone access denied.\nPlease allow permissions and try again.');
            } else {
                alert('Could not connect the call. Please check your camera and microphone.');
            }
            declineCall(callerId, currentUser.uid);
            cleanupCall();
        }
    };

    const handleDeclineCall = () => {
        if (!incomingCallData) return;
        declineCall(incomingCallData.callerId, currentUser.uid);
        cleanupCall();
    };

    const handleEndCall = () => {
        if (activeCallUser && selectedChat) {
            const isCaller = callTimeoutRef.current !== null || (callState === 'active' && !incomingCallData);
            const callerId = isCaller ? currentUser.uid : activeCallUser.uid;
            const calleeId = isCaller ? activeCallUser.uid : currentUser.uid;

            endCall(activeCallUser.uid, callerId, calleeId, selectedChat._id, callDuration);
        }
        cleanupCall();
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
            }
        }
    };

    const toggleMic = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMicMuted(!audioTrack.enabled);
            }
        }
    };

    const switchCamera = async () => {
        if (!localStreamRef.current || callState === 'idle') return;

        const newMode = cameraMode === 'user' ? 'environment' : 'user';

        try {
            // 1. Get existing tracks
            const currentTracks = localStreamRef.current.getTracks();
            const audioTrack = currentTracks.find(t => t.kind === 'audio');
            const videoTrack = currentTracks.find(t => t.kind === 'video');

            // 2. Stop old video track (essential for many mobile devices to release hardware)
            if (videoTrack) {
                videoTrack.stop();
            }

            // 3. Request new stream with the new facingMode
            // We use { ideal } to avoid OverconstrainedError if 'environment' is not exactly matched
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: newMode } },
                audio: false // Don't request audio again to avoid hardware conflicts/glitches
            });

            const newVideoTrack = newStream.getVideoTracks()[0];

            // 4. Update the enabled state based on current UI toggle
            newVideoTrack.enabled = isVideoEnabled;

            // 5. Replace the track in the peer connection for the remote user
            if (peerConnectionRef.current) {
                const senders = peerConnectionRef.current.getSenders();
                const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                if (videoSender) {
                    await videoSender.replaceTrack(newVideoTrack);
                }
            }

            // 6. Create a new local stream with the new video track and PRESERVED audio track
            const combinedStream = new MediaStream([newVideoTrack]);
            if (audioTrack) {
                combinedStream.addTrack(audioTrack);
            }

            // 7. Update refs and state
            localStreamRef.current = combinedStream;
            setLocalStream(combinedStream);
            setCameraMode(newMode);

            // 8. Update local video element directly
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = combinedStream;
            }
        } catch (err) {
            console.error('Error switching camera:', err);

            // Fallback recovery: try to restart the original camera mode
            try {
                const restartStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: cameraMode } },
                    audio: false
                });
                const restartVideoTrack = restartStream.getVideoTracks()[0];
                const audioTrack = localStreamRef.current?.getAudioTracks()[0];

                const recoveredStream = new MediaStream([restartVideoTrack]);
                if (audioTrack) recoveredStream.addTrack(audioTrack);

                localStreamRef.current = recoveredStream;
                setLocalStream(recoveredStream);
                if (localVideoRef.current) localVideoRef.current.srcObject = recoveredStream;

                if (peerConnectionRef.current) {
                    const videoSender = peerConnectionRef.current.getSenders().find(s => s.track && s.track.kind === 'video');
                    if (videoSender) await videoSender.replaceTrack(restartVideoTrack);
                }
            } catch (restartErr) {
                console.error('Recovery failed:', restartErr);
            }

            alert('Could not switch camera. This device may not support the back camera or permissions are restricted.');
        }
    };
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="home">
            {/* Mobile Sidebar Toggle Button */}
            <button
                className="sidebar-toggle"
                onClick={toggleSidebar}
                aria-label="Toggle sidebar"
            >
                {sidebarOpen ? <FiX /> : <FiMenu />}
            </button>

            {/* Mobile Overlay */}
            <div
                className={`overlay ${sidebarOpen ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar */}
            <div
                className={`sidebar ${sidebarOpen ? 'active' : ''}`}
                ref={sidebarRef}
            >
                <div className="sidebar-header">
                    <h2
                        onClick={() => {
                            setSelectedChat(null);
                            if (window.innerWidth <= 768) setSidebarOpen(false);
                        }}
                        className="sidebar-logo"
                    >
                        KnokTalk
                    </h2>
                    <div className="sidebar-actions">
                        <button
                            className={`icon-btn ${showUsers ? 'active' : ''}`}
                            onClick={() => {
                                setShowUsers(!showUsers);
                                setShowFriendRequests(false);
                            }}
                            title="Find users"
                        >
                            <FiUserPlus />
                        </button>
                        <button
                            className={`icon-btn ${showFriendRequests ? 'active' : ''}`}
                            onClick={() => { setShowFriendRequests(!showFriendRequests); setShowUsers(false); }}
                            title="Friend requests"
                        >
                            <FiUsers />
                            {dbUser?.friendRequests?.length > 0 && (
                                <span className="badge">{dbUser.friendRequests.length}</span>
                            )}
                        </button>
                        <button className="icon-btn" onClick={handleLogout} title="Logout">
                            <FiLogOut />
                        </button>
                    </div>
                </div>

                <div className="search-bar">
                    <FiSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* User Profile */}
                <div className="user-profile">
                    <div className="avatar-wrapper" style={{ position: 'relative', display: 'flex' }}>
                        {(dbUser?.photoURL || currentUser?.photoURL) ? (
                            <img
                                src={dbUser?.photoURL || currentUser?.photoURL}
                                alt="User"
                                className="user-avatar"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    const placeholder = e.target.nextSibling;
                                    if (placeholder) placeholder.style.display = 'flex';
                                }}
                            />
                        ) : null}
                        <div
                            className="user-avatar user-avatar-placeholder"
                            style={{ display: (dbUser?.photoURL || currentUser?.photoURL) ? 'none' : 'flex' }}
                        />
                        {unreadChats.size > 0 && (
                            <span className="unread-dot"
                                style={{
                                    position: 'absolute',
                                    top: '-2px',
                                    right: '-2px',
                                    width: '12px',
                                    height: '12px',
                                    // backgroundColor: '#ef4444',
                                    backgroundColor: '#4f46e5',
                                    border: '2px solid var(--background-sidebar)',
                                    borderRadius: '50%',
                                    zIndex: 10
                                }}></span>
                        )}
                    </div>
                    <div className="user-info">
                        <span className="user-name">{dbUser?.displayName || currentUser?.displayName || 'User'}</span>
                        <span className="user-email">{currentUser?.email}</span>
                    </div>
                </div>

                {/* Users List (for friend requests) */}
                {showUsers && (
                    <div className="users-list">
                        <h3>Find Users</h3>
                        {filteredUsers.map(user => (
                            <div key={user.uid} className="user-item">
                                {user.photoURL ? (
                                    <img
                                        src={user.photoURL}
                                        alt="User"
                                        className="user-avatar-small"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                        }}
                                    />
                                ) : null}
                                <div
                                    className="user-avatar-small user-avatar-small-placeholder"
                                    style={{ display: user.photoURL ? 'none' : 'flex' }}
                                />
                                <div className="user-details">
                                    <span className="user-name">{user.displayName || user.email}</span>
                                </div>
                                {isUserFriend(user.uid) ? (
                                    <button
                                        className="remove-friend-btn"
                                        onClick={() => handleRemoveFriend(user.uid)}
                                    >
                                        Remove
                                    </button>
                                ) : (
                                    <button
                                        className="add-friend-btn"
                                        onClick={() => handleSendFriendRequest(user)}
                                        disabled={hasSentRequestToUser(user.uid)}
                                    >
                                        {hasSentRequestToUser(user.uid) ? 'Pending' : 'Add'}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Friend Requests */}
                {showFriendRequests && (
                    <div className="friend-requests">
                        <h3>Friend Requests</h3>
                        {dbUser?.friendRequests?.map(request => (
                            <div key={request._id} className="request-item">
                                {request.fromPhoto ? (
                                    <img
                                        src={request.fromPhoto}
                                        alt="User"
                                        className="user-avatar-small"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                        }}
                                    />
                                ) : null}
                                <div
                                    className="user-avatar-small user-avatar-small-placeholder"
                                    style={{ display: request.fromPhoto ? 'none' : 'flex' }}
                                />
                                <div className="request-details">
                                    <span className="user-name">{request.fromName}</span>
                                </div>
                                <div className="request-actions">
                                    <button
                                        className="accept-btn"
                                        onClick={() => handleAcceptRequest(request._id)}
                                    >
                                        <FiCheck />
                                    </button>
                                    <button
                                        className="reject-btn"
                                        onClick={() => handleRejectRequest(request._id)}
                                    >
                                        <FiX />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Chats List */}
                {!showUsers && !showFriendRequests && (
                    <div className="chats-list">
                        {filteredChats.map(chat => {
                            const otherUser = getOtherUser(chat);
                            return (
                                <div
                                    key={chat._id}
                                    className={`chat-item ${selectedChat?._id === chat._id ? 'active' : ''}`}
                                    onClick={() => {
                                        setSelectedChat(chat);
                                        setUnreadChats(prev => {
                                            const newSet = new Set(prev);
                                            newSet.delete(chat._id);
                                            return newSet;
                                        });
                                    }}
                                >
                                    <div className="avatar-wrapper" style={{ position: 'relative', display: 'flex' }}>
                                        {otherUser?.photoURL ? (
                                            <img
                                                src={otherUser.photoURL}
                                                alt="User"
                                                className="user-avatar-small"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                        ) : null}
                                        <div
                                            className="user-avatar-small user-avatar-small-placeholder"
                                            style={{ display: otherUser?.photoURL ? 'none' : 'flex' }}
                                        />
                                        {unreadChats.has(chat._id) && (
                                            <span className="unread-dot"
                                                style={{
                                                    position: 'absolute',
                                                    top: '-2px',
                                                    right: '-2px',
                                                    width: '12px',
                                                    height: '12px',
                                                    // backgroundColor: '#ef4444',
                                                    backgroundColor: '#4f46e5',
                                                    border: '2px solid var(--background-sidebar)',
                                                    borderRadius: '50%',
                                                    zIndex: 10
                                                }}>
                                            </span>
                                        )}
                                    </div>
                                    <div className="chat-details">
                                        <span className="chat-name">{otherUser?.displayName || otherUser?.email}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Chat Area */}
            <div className="chat-area">
                {selectedChat ? (
                    <>
                        <div className={`chat-header ${selectedMessageIds.length > 0 ? 'selection-mode' : ''}`}>
                            {selectedMessageIds.length > 0 ? (
                                <>
                                    <button className="icon-btn cancel-selection" onClick={clearSelection} title="Cancel Selection">
                                        <FiX />
                                    </button>
                                    <span className="selection-count">{selectedMessageIds.length} Selected</span>

                                    {/* Desktop Selection Actions (≥992px) */}
                                    <div className="chat-header-actions selection-actions desktop-actions">
                                        {isSingleSelection && (
                                            <button
                                                className="reply-action-btn edit-action-btn"
                                                onClick={() => {
                                                    if (firstSelectedMessage) {
                                                        setReplyingToMessage(firstSelectedMessage);
                                                        clearSelection();
                                                    }
                                                }}
                                                title="Reply to Message"
                                            >
                                                <FiCornerUpLeft /> <span className="action-text">Reply</span>
                                            </button>
                                        )}
                                        {isSingleSelection && firstSelectedMessageMine && firstSelectedMessage?.messageType !== 'audio' && firstSelectedMessage?.messageType !== 'image' && firstSelectedMessage?.messageType !== 'call' && (
                                            <button
                                                className="edit-action-btn"
                                                onClick={() => {
                                                    if (firstSelectedMessage) {
                                                        startEditing(firstSelectedMessage);
                                                        clearSelection();
                                                    }
                                                }}
                                                title="Edit Message"
                                            >
                                                <FiEdit /> <span className="action-text">Edit</span>
                                            </button>
                                        )}
                                        {allSelectedMine && (
                                            <button
                                                className="delete-action-btn remove-messages-btn"
                                                onClick={() => handleDeleteMessages(selectedMessageIds)}
                                                title="Delete Selected"
                                            >
                                                <FiTrash2 /> <span className="action-text">Delete</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Mobile/Tablet Selection Dropdown (<992px) */}
                                    <div className="chat-header-actions selection-actions mobile-actions header-dropdown-wrapper">
                                        <button
                                            className="header-dropdown-btn"
                                            onClick={() => setShowSelectionDropdown(prev => !prev)}
                                            title="More options"
                                        >
                                            <FiMoreVertical />
                                        </button>
                                        {showSelectionDropdown && (
                                            <div className="header-dropdown-menu">
                                                {isSingleSelection && (
                                                    <button
                                                        className="header-dropdown-item"
                                                        onClick={() => {
                                                            if (firstSelectedMessage) {
                                                                setReplyingToMessage(firstSelectedMessage);
                                                                clearSelection();
                                                            }
                                                        }}
                                                    >
                                                        <FiCornerUpLeft /> Reply
                                                    </button>
                                                )}
                                                {isSingleSelection && firstSelectedMessageMine && firstSelectedMessage?.messageType !== 'audio' && firstSelectedMessage?.messageType !== 'image' && firstSelectedMessage?.messageType !== 'call' && (
                                                    <button
                                                        className="header-dropdown-item"
                                                        onClick={() => {
                                                            if (firstSelectedMessage) {
                                                                startEditing(firstSelectedMessage);
                                                                clearSelection();
                                                            }
                                                        }}
                                                    >
                                                        <FiEdit /> Edit
                                                    </button>
                                                )}
                                                {allSelectedMine && (
                                                    <button
                                                        className="header-dropdown-item remove-messages-btn-dropdown"
                                                        // style={{ color: 'var(--error-color)' }}
                                                        onClick={() => handleDeleteMessages(selectedMessageIds)}
                                                    >
                                                        <FiTrash2 /> Delete
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    {getOtherUser(selectedChat)?.photoURL ? (
                                        <img
                                            src={getOtherUser(selectedChat).photoURL}
                                            alt="User"
                                            className="user-avatar"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'flex';
                                            }}
                                        />
                                    ) : null}
                                    <div
                                        className="user-avatar user-avatar-placeholder"
                                        style={{ display: getOtherUser(selectedChat)?.photoURL ? 'none' : 'flex' }}
                                    />
                                    <span className="chat-name">{getOtherUser(selectedChat)?.displayName || getOtherUser(selectedChat)?.email}</span>

                                    {/* ── Desktop Actions (≥992px) ───────────────── */}
                                    <div className="chat-header-actions desktop-actions">
                                        <button
                                            className="remove-messages-btn"
                                            onClick={handleRemoveAllMyMessages}
                                            title="Remove all my messages"
                                        >
                                            <FiTrash2 /> <span className="action-text">Remove</span>
                                        </button>
                                        {isBlocked ? (
                                            <button
                                                className="unblock-btn"
                                                onClick={handleUnblockUser}
                                                title="Unblock user"
                                            >
                                                <FiUnlock /> <span className="action-text">Unblock</span>
                                            </button>
                                        ) : (
                                            <button
                                                className="block-btn"
                                                onClick={handleBlockUser}
                                                title="Block user"
                                            >
                                                <FiLock /> <span className="action-text">Block</span>
                                            </button>
                                        )}
                                        <button
                                            className="search-btn"
                                            onClick={() => setIsSearching(true)}
                                            title="Search conversation"
                                        >
                                            <FiSearch /> <span className="action-text">Search</span>
                                        </button>
                                        <button
                                            id="call-btn-desktop"
                                            className="call-btn"
                                            onClick={startCall}
                                            title="Start video call"
                                            disabled={callState !== 'idle'}
                                        >
                                            <FiVideo /> <span className="action-text">Call</span>
                                        </button>
                                    </div>

                                    {/* ── Mobile/Tablet Dropdown (<992px) ───────── */}
                                    <div className="chat-header-actions mobile-actions header-dropdown-wrapper">
                                        <button
                                            id="header-dropdown-btn"
                                            className="header-dropdown-btn"
                                            onClick={() => setShowHeaderDropdown(prev => !prev)}
                                            title="More options"
                                        >
                                            <FiMoreVertical />
                                        </button>
                                        {showHeaderDropdown && (
                                            <div className="header-dropdown-menu">
                                                <button
                                                    className="header-dropdown-item"
                                                    onClick={() => { handleRemoveAllMyMessages(); setShowHeaderDropdown(false); }}
                                                >
                                                    <FiTrash2 /> Remove
                                                </button>
                                                {isBlocked ? (
                                                    <button
                                                        className="header-dropdown-item"
                                                        onClick={() => { handleUnblockUser(); setShowHeaderDropdown(false); }}
                                                    >
                                                        <FiUnlock /> Unblock
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="header-dropdown-item"
                                                        onClick={() => { handleBlockUser(); setShowHeaderDropdown(false); }}
                                                    >
                                                        <FiLock /> Block
                                                    </button>
                                                )}
                                                <button
                                                    className="header-dropdown-item"
                                                    onClick={() => { setIsSearching(true); setShowHeaderDropdown(false); }}
                                                >
                                                    <FiSearch /> Search
                                                </button>
                                                <button
                                                    id="call-btn-mobile"
                                                    className="header-dropdown-item call-dropdown-item"
                                                    onClick={() => { startCall(); setShowHeaderDropdown(false); }}
                                                    disabled={callState !== 'idle'}
                                                >
                                                    <FiVideo /> Call
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {isSearching && (
                            <div className="chat-search-bar-under-header">
                                <div className="chat-header-search-container">
                                    <div className="search-input-row">
                                        <FiSearch className="search-icon-left" />
                                        <input
                                            type="text"
                                            ref={searchInputRef}
                                            className="chat-search-input"
                                            placeholder="Search in chat..."
                                            value={chatSearchTerm}
                                            onChange={handleChatSearch}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && searchResults.length > 0) {
                                                    scrollToSearchResult(currentSearchIndex);
                                                    setShowSearchDropdown(false);
                                                }
                                            }}
                                            onFocus={() => {
                                                if (searchResults.length > 0) setShowSearchDropdown(true);
                                            }}
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            className="icon-btn search-emoji-btn"
                                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                            title="Emojis"
                                        >
                                            <FiSmile />
                                        </button>
                                        <div className="search-actions-right">
                                            {searchResults.length > 0 && (
                                                <span className="search-count-text">
                                                    {currentSearchIndex + 1} of {searchResults.length}
                                                </span>
                                            )}
                                            <button className="icon-btn" onClick={handlePrevSearch} title="Previous result">
                                                <FiChevronUp />
                                            </button>
                                            <button className="icon-btn" onClick={handleNextSearch} title="Next result">
                                                <FiChevronDown />
                                            </button>
                                            <button className="icon-btn close-search-btn" onClick={() => {
                                                setIsSearching(false);
                                                setChatSearchTerm('');
                                                setSearchResults([]);
                                                setShowSearchDropdown(false);
                                            }} title="Close search">
                                                <FiX />
                                            </button>
                                        </div>
                                    </div>
                                    {chatSearchTerm && searchResults.length > 0 && showSearchDropdown && (
                                        <div className="chat-search-dropdown-results">
                                            {searchResults.map((msg, idx) => {
                                                const senderName = msg.sender?.displayName || msg.sender?.email || 'User';
                                                const date = new Date(msg.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                                                // Highlight logic
                                                const escapedHighlightTerm = chatSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                                const regex = new RegExp(`(${escapedHighlightTerm})`, 'gi');
                                                const parts = msg.content.split(regex);

                                                return (
                                                    <div
                                                        key={msg._id}
                                                        className={`search-dropdown-item ${idx === currentSearchIndex ? 'active-result' : ''}`}
                                                        onClick={() => {
                                                            setCurrentSearchIndex(idx);
                                                            scrollToSearchResult(idx);
                                                            setShowSearchDropdown(false);
                                                        }}
                                                    >
                                                        {msg.sender?.photoURL ? (
                                                            <img src={msg.sender.photoURL} alt="Avatar" className="search-dropdown-avatar" />
                                                        ) : (
                                                            <div className="search-dropdown-avatar placeholder" />
                                                        )}
                                                        <div className="search-dropdown-content">
                                                            <div className="search-dropdown-header">
                                                                <span className="search-dropdown-name">{senderName}</span>
                                                                <span className="search-dropdown-date">{date}</span>
                                                            </div>
                                                            <div className="search-dropdown-text">
                                                                {parts.map((part, i) =>
                                                                    regex.test(part) ? (
                                                                        <mark key={i} className="highlighted-text">{part}</mark>
                                                                    ) : (
                                                                        <span key={i}>{part}</span>
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className={`messages ${isBlocked ? 'disabled' : ''}`}>
                            {isBlocked && (
                                <div className="blocked-notice">
                                    <FiLock />
                                    <p>You have blocked this user. Unblock to send messages.</p>
                                </div>
                            )}
                            {groupedMessages.map((gMsg, index) => {
                                const isGroup = gMsg.type === 'image-group';
                                const msg = isGroup ? gMsg.messages[0] : gMsg;
                                const sender = msg.sender || users.find(u => u.uid === msg.senderUid);
                                const isSentByMe = (msg.sender?.uid || msg.senderUid) === currentUser.uid;

                                const isAnySelected = isGroup
                                    ? gMsg.messages.some(m => selectedMessageIds.includes(m._id))
                                    : selectedMessageIds.includes(gMsg._id);

                                return (
                                    <div
                                        id={`message-${gMsg._id || index}`}
                                        key={gMsg._id || index}
                                        data-message-ids={isGroup ? gMsg.messages.map(m => m._id).join(' ') : gMsg._id}
                                        className={`message-wrapper ${isSentByMe ? 'sent' : 'received'} ${isAnySelected ? 'selected-wrapper' : ''} ${isGroup ? 'group-wrapper' : ''} ${msg.isEdited ? 'has-edited' : ''}`}
                                    >
                                        {sender?.photoURL ? (
                                            <img
                                                src={sender.photoURL}
                                                alt="User"
                                                className="message-avatar"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                        ) : null}
                                        <div
                                            className="message-avatar message-avatar-placeholder"
                                            style={{ display: sender?.photoURL ? 'none' : 'flex' }}
                                        />

                                        <div
                                            className={`message ${isSentByMe ? 'sent' : 'received'} ${msg.isDeleted ? 'deleted' : ''} ${msg.isError ? 'error' : ''} ${isAnySelected ? 'selected' : ''} ${isGroup ? 'group-message' : ''}`}
                                            onDoubleClick={() => handleSelectMessage(gMsg)}
                                            onContextMenu={(e) => {
                                                if (window.innerWidth <= 768) {
                                                    e.preventDefault();
                                                    handleSelectMessage(gMsg);
                                                }
                                            }}
                                        >
                                            {msg.replyTo && (
                                                <div
                                                    className="quoted-message"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const el = document.getElementById(`message-${msg.replyTo._id}`) || document.querySelector(`[data-message-ids~="${msg.replyTo._id}"]`);
                                                        if (el) {
                                                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                            el.classList.add('highlight-pulse');
                                                            setTimeout(() => el.classList.remove('highlight-pulse'), 1500);
                                                        }
                                                    }}
                                                >
                                                    <span className="quoted-name">
                                                        {msg.replyTo.sender?.uid === currentUser.uid
                                                            ? (isSentByMe ? 'Yourself' : 'You')
                                                            : (msg.replyTo.sender?.displayName || msg.replyTo.sender?.email || 'Someone')}
                                                    </span>
                                                    <div className="quoted-text">
                                                        {msg.replyTo.messageType === 'image' ? '📸 Photo' :
                                                            msg.replyTo.messageType === 'audio' ? '🎵 Voice message' :
                                                                msg.replyTo.content || 'Attachment'}
                                                    </div>
                                                </div>
                                            )}
                                            {isGroup ? (
                                                <div className="message-content-container">
                                                    <div className={`image-grid grid-${Math.min(gMsg.messages.length, 5)}`}>
                                                        {gMsg.messages.map((imgMsg, imgIndex) => (
                                                            <div key={imgMsg._id || imgIndex} className="image-grid-item">
                                                                <img
                                                                    src={imgMsg.fileUrl}
                                                                    alt="Shared"
                                                                    className="message-image"
                                                                    onClick={() => setFullscreenImage(imgMsg)}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : msg.messageType === 'image' ? (
                                                <div className="message-content-container">
                                                    <div className="message-image-container">
                                                        <img
                                                            src={msg.fileUrl}
                                                            alt="Shared"
                                                            className="message-image"
                                                            onClick={() => setFullscreenImage(msg)}
                                                        />
                                                    </div>
                                                </div>
                                            ) : msg.messageType === 'file' ? (
                                                <div className="message-content-container">
                                                    <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="message-file">
                                                        <FiPaperclip /> {msg.fileName || msg.content}
                                                    </a>
                                                </div>
                                            ) : msg.messageType === 'audio' ? (
                                                <div className="message-content-container">
                                                    <AudioPlayer
                                                        src={msg.fileUrl}
                                                        durationLabel={msg.content}
                                                        isSentByMe={isSentByMe}
                                                    />
                                                </div>
                                            ) : msg.messageType === 'call' ? (
                                                <div className="message-content-container call-notification-container">
                                                    <div className={`call-notification ${msg.content.includes('Missed') ? 'missed' : 'completed'}`}>
                                                        <div className="call-icon-circle">
                                                            {msg.content.includes('Missed') ? <FiVideoOff /> : <FiVideo />}
                                                        </div>
                                                        <div className="call-details">
                                                            <span className="call-status-text">
                                                                {msg.content.includes('Missed') ? 'Missed Video Call' : 'Video Call'}
                                                            </span>
                                                            <span className="call-duration-text">
                                                                {msg.content.split(': ')[1] || msg.content}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="message-content-container">
                                                    <p className="message-content">
                                                        {msg.content}
                                                    </p>
                                                </div>
                                            )}

                                            <div className="message-info">
                                                <span className="message-date">{new Date(msg.createdAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}</span>
                                                <span className="message-time">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                        {msg.isEdited && <div className="edited-label">(Edited)</div>}
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        <form className={`message-input ${isBlocked ? 'disabled' : ''}`} onSubmit={(e) => {
                            e.preventDefault();
                            if (editingMessage) {
                                handleEditMessage(editingMessage);
                            } else {
                                handleSendMessage(e);
                            }
                        }} disabled={isBlocked}>
                            {replyingToMessage && !editingMessage && (
                                <div className="replying-to-preview">
                                    <div className="reply-preview-content">
                                        <div className="reply-preview-header">
                                            <FiCornerUpLeft />
                                            <span>Replying to {replyingToMessage.sender?.uid === currentUser.uid ? 'yourself' : (replyingToMessage.sender?.displayName || replyingToMessage.sender?.email || 'Someone')}</span>
                                        </div>
                                        <div className="reply-preview-text">
                                            {replyingToMessage.messageType === 'image' ? '📸 Photo' :
                                                replyingToMessage.messageType === 'audio' ? '🎵 Voice message' :
                                                    replyingToMessage.content || 'Attachment'}
                                        </div>
                                    </div>
                                    <button type="button" className="reply-preview-close" onClick={() => setReplyingToMessage(null)}>
                                        <FiX />
                                    </button>
                                </div>
                            )}
                            {editingMessage ? (
                                <div className="unified-input-area edit-mode">
                                    <button type="button" className="emoji-btn-unified cancel-edit-btn" onClick={cancelEditing} title="Cancel Edit">
                                        <FiX />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                        className="emoji-btn-unified"
                                        title="Emojis"
                                    >
                                        <FiSmile />
                                    </button>
                                    <div className="edit-indicator">
                                        <FiEdit />
                                    </div>
                                    <input
                                        type="text"
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        autoFocus
                                        placeholder="Edit message..."
                                    />
                                    <button type="submit" className="send-btn-unified save-edit-btn" title="Save changes">
                                        <FiCheck />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {selectedImages.length === 0 && (
                                        <div className="unified-input-area">
                                            {isRecording ? (
                                                <>
                                                    <button type="button" className="emoji-btn-unified cancel-recording-btn" onClick={cancelRecording} title="Cancel Recording">
                                                        <FiX />
                                                    </button>
                                                    <div className="recording-indicator">
                                                        <div className="recording-dot blink"></div>
                                                        <span className="recording-time">{formatTime(recordingTime)}</span>
                                                    </div>
                                                    <div className="input-right-actions">
                                                        <button type="button" className="send-btn-unified recording-send-btn" onClick={stopRecordingAndSend} title="Send voice message">
                                                            <FiSend />
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                                        className="emoji-btn-unified"
                                                        title="Emojis"
                                                    >
                                                        <FiSmile />
                                                    </button>

                                                    <input
                                                        type="text"
                                                        placeholder="Type a message..."
                                                        value={newMessage}
                                                        onChange={(e) => setNewMessage(e.target.value)}
                                                    />

                                                    <input
                                                        type="file"
                                                        ref={imageInputRef}
                                                        onChange={handleImageSelect}
                                                        accept="image/*"
                                                        multiple
                                                        style={{ display: 'none' }}
                                                    />

                                                    <div className="input-right-actions">
                                                        <button
                                                            type="button"
                                                            className="attach-btn-unified"
                                                            onClick={startRecording}
                                                            title="Voice message"
                                                        >
                                                            <FiMic />
                                                        </button>
                                                        {/* <button
                                                            type="button"
                                                            className="attach-btn-unified"
                                                            onClick={() => imageInputRef.current?.click()}
                                                            title="Attach image"
                                                        >
                                                            <FiImage />
                                                        </button> */}

                                                        <button type="submit" className="send-btn-unified" title="Send message">
                                                            <FiSend />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                </>
                            )}
                        </form>
                        {showEmojiPicker && (
                            <EmojiPicker
                                onEmojiSelect={addEmoji}
                                onClose={() => setShowEmojiPicker(false)}
                                onBackspace={handleBackspace}
                                onSend={handleEmojiSend}
                            />
                        )}
                    </>
                ) : (
                    <div className="no-chat-selected-container">
                        <div className="no-chat-selected-content">
                            <div className="no-chat-3d-wrapper">
                                <div className="no-chat-3d-badge">
                                    <div className="badge-layer front">
                                        <FiMessageCircle />
                                    </div>
                                    <div className="badge-layer middle"></div>
                                    <div className="badge-layer back"></div>
                                </div>
                                <div className="no-chat-pulse-rings">
                                    <div className="pulse-ring ring-1"></div>
                                    <div className="pulse-ring ring-2"></div>
                                </div>
                            </div>

                            <div className="no-chat-text-content">
                                <h1>Welcome to KnokTalk</h1>
                                <p>Select a friend from the sidebar or search to start a conversation.</p>
                            </div>
                        </div>

                        <div className="no-chat-background-decoration">
                            <div className="blob blob-1"></div>
                            <div className="blob blob-2"></div>
                            <div className="blob blob-3"></div>
                        </div>
                    </div>
                )}
            </div>

            {/* Fullscreen Image Viewer */}
            {fullscreenImage && (
                <div className="fullscreen-image-overlay" onClick={() => { setFullscreenImage(null); setShowImageMenu(false); }}>
                    <div className="fullscreen-menu-container" onClick={(e) => e.stopPropagation()}>
                        <button
                            className="fullscreen-menu-btn"
                            onClick={(e) => { e.stopPropagation(); setShowImageMenu(!showImageMenu); }}
                            title="Menu"
                        >
                            <FiMoreHorizontal />
                        </button>
                        {showImageMenu && (
                            <div className="fullscreen-menu">
                                <button
                                    className="fullscreen-menu-item"
                                    onClick={() => setFullscreenImage(null)}
                                    title="Close"
                                >
                                    <FiX /> Close
                                </button>
                                <button
                                    className="fullscreen-menu-item"
                                    onClick={handleDownloadImage}
                                    title="Download"
                                >
                                    <FiDownload /> Download
                                </button>
                                {typeof fullscreenImage === 'object' && (fullscreenImage.sender?.uid === currentUser.uid || fullscreenImage.senderUid === currentUser.uid) && (
                                    <button
                                        className="fullscreen-menu-item remove-action-btn"
                                        onClick={() => {
                                            handleDeleteMessages(fullscreenImage._id);
                                            setFullscreenImage(null);
                                        }}
                                        title="Remove"
                                    >
                                        <FiTrash2 /> Remove
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <img
                        src={typeof fullscreenImage === 'object' ? fullscreenImage.fileUrl : fullscreenImage}
                        alt="Fullscreen"
                        className="fullscreen-image"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* Fullscreen Preview Image Viewer */}
            {previewFullscreen && (
                <div className="fullscreen-image-overlay" onClick={() => { setPreviewFullscreen(null); setShowImageMenu(false); }}>
                    <div className="fullscreen-menu-container" onClick={(e) => e.stopPropagation()}>
                        <button
                            className="fullscreen-menu-btn"
                            onClick={(e) => { e.stopPropagation(); setShowImageMenu(!showImageMenu); }}
                            title="Menu"
                        >
                            <FiMoreHorizontal />
                        </button>
                        {showImageMenu && (
                            <div className="fullscreen-menu">
                                <button
                                    className="fullscreen-menu-item"
                                    onClick={() => setPreviewFullscreen(null)}
                                    title="Close"
                                >
                                    <FiX /> Close
                                </button>
                                <button
                                    className="fullscreen-menu-item"
                                    onClick={handleDownloadImage}
                                    title="Download"
                                >
                                    <FiDownload /> Download
                                </button>
                                <button
                                    className="fullscreen-menu-item remove-action-btn"
                                    onClick={() => {
                                        const idx = typeof previewFullscreen === 'object' ? previewFullscreen.index : -1;
                                        if (idx !== -1) {
                                            handleRemoveIndividualImage(idx);
                                        }
                                        setPreviewFullscreen(null);
                                    }}
                                    title="Remove"
                                >
                                    <FiTrash2 /> Remove
                                </button>
                            </div>
                        )}
                    </div>
                    <img
                        src={typeof previewFullscreen === 'object' ? previewFullscreen.url : previewFullscreen}
                        alt="Preview Fullscreen"
                        className="fullscreen-image"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* Telegram-Style Send Photo Modal */}
            {selectedImages.length > 0 && !previewFullscreen && (
                <div className="send-photo-modal-overlay">
                    <div className="send-photo-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="send-photo-header">
                            <button type="button" className="close-btn" onClick={handleCancelImage} title="Cancel">
                                <FiX />
                            </button>
                            <h3>Send {selectedImages.length} {selectedImages.length === 1 ? 'Photo' : 'Photos'}</h3>
                        </div>
                        <div className="send-photo-content images-list-view">
                            {selectedImages.map((item, index) => (
                                <div key={index} className="send-photo-item">
                                    <img
                                        src={item.preview}
                                        alt={`Preview ${index}`}
                                        className="send-photo-image"
                                        onClick={() => setPreviewFullscreen({ url: item.preview, index })}
                                    />
                                    <button
                                        type="button"
                                        className="remove-image-text-btn"
                                        onClick={() => handleRemoveIndividualImage(index)}
                                        title="Remove this image"
                                    >
                                        <FiTrash2 />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="send-photo-footer">
                            <button
                                type="button"
                                className="send-btn-floating"
                                onClick={handleSendSelectedImage}
                                title="Send Photo"
                            >
                                <FiSend />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Incoming Call Notification ─────────────────────────────────── */}
            {callState === 'incoming' && incomingCallData && (
                <div className="incoming-call-overlay" role="dialog" aria-label="Incoming call notification">
                    <div className="incoming-call-card">
                        <div className="incoming-call-pulse" />
                        <div className="incoming-call-avatar-wrap">
                            {incomingCallData.callerPhoto ? (
                                <img
                                    src={incomingCallData.callerPhoto}
                                    alt={incomingCallData.callerName}
                                    className="incoming-call-avatar"
                                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                />
                            ) : null}
                            <div
                                className="incoming-call-avatar incoming-call-avatar-placeholder"
                                style={{ display: incomingCallData.callerPhoto ? 'none' : 'flex' }}
                            />
                        </div>
                        <div className="incoming-call-info">
                            <span className="incoming-call-label">Incoming Video Call</span>
                            <span className="incoming-call-name">{incomingCallData.callerName}</span>
                        </div>
                        <div className="incoming-call-actions">
                            <button
                                id="accept-call-btn"
                                className="call-action-btn accept-call-btn"
                                onClick={handleAcceptCall}
                                title="Accept call"
                            >
                                <FiPhone />
                            </button>
                            <button
                                id="decline-call-btn"
                                className="call-action-btn decline-call-btn"
                                onClick={handleDeclineCall}
                                title="Decline call"
                            >
                                <FiPhoneOff />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Active Call Overlay ─────────────────────────────────────────── */}
            {(callState === 'calling' || callState === 'active') && (
                <div className="active-call-overlay" role="dialog" aria-label="Active call">

                    {/* ── Remote video — always in DOM so ref is valid for srcObject ── */}
                    {/* BUG FIX: removed display:none. The video is always rendered so
                        remoteVideoRef.current is never null when ontrack fires.
                        The waiting screen floats on top (z-index) when callState==='calling'. */}
                    <video
                        ref={remoteVideoRef}
                        className="remote-video"
                        autoPlay
                        playsInline
                    />

                    {/* Waiting/Calling state — sits on top of the (black) remote video */}
                    {(callState === 'calling' || !remoteStream) && (
                        <div className="call-waiting-screen">
                            <div className="call-waiting-avatar-wrap">
                                {activeCallUser?.photo ? (
                                    <img src={activeCallUser.photo} alt={activeCallUser.name} className="call-waiting-avatar" />
                                ) : (
                                    <div className="call-waiting-avatar call-waiting-avatar-placeholder" />
                                )}
                                <div className="call-ringing-ring ring1" />
                                <div className="call-ringing-ring ring2" />
                                <div className="call-ringing-ring ring3" />
                            </div>
                            <p className="call-waiting-name">{activeCallUser?.name}</p>
                            <p className="call-waiting-status">
                                {callState === 'calling' ? 'Calling…' : 'Connecting…'}
                            </p>
                        </div>
                    )}

                    {/* Active call name + duration */}
                    {callState === 'active' && remoteStream && (
                        <div className="call-info-bar">
                            <span className="call-info-name">{activeCallUser?.name}</span>
                            <span className="call-info-duration">{formatCallDuration(callDuration)}</span>
                        </div>
                    )}

                    {/* Local (self) PiP video — always rendered so localVideoRef is valid */}
                    <div className="local-video-pip-wrapper">
                        <video
                            ref={localVideoRef}
                            className={`local-video-pip ${cameraMode === 'user' ? 'mirrored' : ''}`}
                            autoPlay
                            playsInline
                            muted
                        />
                        {!isVideoEnabled && (
                            <div className="local-video-off-overlay">
                                <FiVideoOff />
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="call-controls">
                        {/* Mute toggle */}
                        <button
                            id="toggle-mic-btn"
                            className={`call-control-btn ${isMicMuted ? 'toggled-off' : ''}`}
                            onClick={toggleMic}
                            title={isMicMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMicMuted ? <FiMicOff /> : <FiMic />}
                        </button>

                        {/* End call */}
                        <button
                            id="end-call-btn"
                            className="call-control-btn end-call-btn"
                            onClick={handleEndCall}
                            title="End call"
                        >
                            <FiPhoneOff />
                        </button>

                        {/* Video toggle */}
                        <button
                            id="toggle-video-btn"
                            className={`call-control-btn ${!isVideoEnabled ? 'toggled-off' : ''}`}
                            onClick={toggleVideo}
                            title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                        >
                            {isVideoEnabled ? <FiVideo /> : <FiVideoOff />}
                        </button>

                        {/* Camera switch toggle */}
                        <button
                            id="switch-camera-btn"
                            className="call-control-btn"
                            onClick={switchCamera}
                            title="Switch Camera"
                        >
                            <HiArrowPathRoundedSquare />
                        </button>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmDialog.show && (
                <div className="confirm-modal-overlay">
                    <div className="confirm-modal-box">
                        <div className="confirm-modal-icon">
                            {confirmDialog.icon || <FiLock />}
                        </div>
                        <h3>Confirmation</h3>
                        <p>{confirmDialog.message}</p>
                        <div className="confirm-modal-actions">
                            {confirmDialog.isAlert ? (
                                <button
                                    className="confirm-btn yes"
                                    onClick={() => setConfirmDialog({ show: false, message: '', onConfirm: null, icon: null, isAlert: false })}
                                >
                                    OK
                                </button>
                            ) : (
                                <>
                                    <button
                                        className="confirm-btn yes"
                                        onClick={() => {
                                            if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                                            setConfirmDialog({ show: false, message: '', onConfirm: null, icon: null, isAlert: false });
                                        }}
                                    >
                                        Yes
                                    </button>
                                    <button
                                        className="confirm-btn no"
                                        onClick={() => setConfirmDialog({ show: false, message: '', onConfirm: null, icon: null, isAlert: false })}
                                    >
                                        No
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;
