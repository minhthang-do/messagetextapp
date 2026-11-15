import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Plus,
  Send,
  Smile,
  Users,
  Settings,
  LogOut,
  Hash,
  UserPlus,
  UserCheck,
  Trash2,
  Check,
  CheckCheck,
  Sun,
  Moon,
  Info,
  X,
  Menu,
  Camera,
  UserMinus,
  DoorOpen,
  MessageSquare,
  Shield,
  Ban,
  CheckCircle,
  Crown,
  Pin,
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  PhoneIncoming,
  Edit3,
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { AuthScreen } from './components/AuthScreen';
import { Conversation, Message, Profile, UserStatus } from './types';

const EMOJIS = ['😀', '😂', '🔥', '❤️', '👍', '🎉', '🚀', '🙌', '😎', '🤔', '💯', '✨', '👏', '🥳', '💡', '🤝'];

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// Component hiển thị Tên + Huy hiệu Vương miện & Viền vàng tương thích cả Light Mode lẫn Dark Mode
function AdminNameBadge({
  name,
  isAdmin,
  lightText = false,
  size = 'sm',
}: {
  name: string;
  isAdmin?: boolean;
  lightText?: boolean;
  size?: 'xs' | 'sm';
}) {
  if (!isAdmin) {
    return <span className="truncate">{name}</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span
        className={`font-extrabold truncate ${
          lightText
            ? 'text-amber-200 drop-shadow-[0_0_8px_rgba(251,191,36,0.65)]'
            : 'bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700 dark:from-amber-300 dark:via-yellow-400 dark:to-amber-500 bg-clip-text text-transparent'
        }`}
      >
        {name}
      </span>
      <span
        className={`inline-flex items-center gap-0.5 rounded-full font-extrabold uppercase tracking-wider shrink-0 border ${
          lightText
            ? 'border-amber-300/80 bg-amber-500/30 text-amber-100'
            : 'border-amber-500/70 dark:border-amber-400/80 bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
        } ${size === 'xs' ? 'px-1.5 py-0 text-[9px]' : 'px-2 py-0.5 text-[10px]'}`}
      >
        <Crown
          className={
            size === 'xs'
              ? 'w-2.5 h-2.5 text-amber-600 dark:text-amber-300 fill-amber-400/40'
              : 'w-3 h-3 text-amber-600 dark:text-amber-300 fill-amber-400/40'
          }
        />
        ADMIN
      </span>
    </span>
  );
}

export default function App() {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [me, setMe] = useState<Profile | null>(null);

  const [darkMode, setDarkMode] = useState(true);
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(true);

  // Conversations & Active Chat
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const activeConvIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeConvIdRef.current = activeConvId;
  }, [activeConvId]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Search & Contacts (Friends)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [contacts, setContacts] = useState<Profile[]>([]);

  // Real-time Presence & Typing
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const typingTimeoutRef = useRef<number | null>(null);
  const channelRef = useRef<any>(null);
  const callSignalChannelRef = useRef<any>(null);

  // Modals
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupUsers, setSelectedGroupUsers] = useState<string[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editStatus, setEditStatus] = useState<UserStatus>('online');

  // Group Management States
  const [addMemberQuery, setAddMemberQuery] = useState('');
  const [addMemberResults, setAddMemberResults] = useState<Profile[]>([]);
  const [groupBannedUsers, setGroupBannedUsers] = useState<Profile[]>([]);
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [newGroupNameInput, setNewGroupNameInput] = useState('');

  // Admin Panel Modal
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminUsers, setAdminUsers] = useState<Profile[]>([]);
  const [adminGroups, setAdminGroups] = useState<Conversation[]>([]);
  const [adminTab, setAdminTab] = useState<'users' | 'groups'>('users');
  const [adminLoading, setAdminLoading] = useState(false);

  // WebRTC Video Call States
  const [callState, setCallState] = useState<'idle' | 'calling' | 'ringing' | 'connected'>('idle');
  const [callPeer, setCallPeer] = useState<{
    userId: string;
    name: string;
    avatar: string | null;
    convId: string;
  } | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<RTCSessionDescriptionInit | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Tổng số tin nhắn chưa đọc
  const totalUnreadCount = useMemo(
    () => conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0),
    [conversations]
  );

  useEffect(() => {
    document.title = totalUnreadCount > 0 ? `(${totalUnreadCount}) BocPhet Chat` : 'BocPhet Chat';
  }, [totalUnreadCount]);

  // Sắp xếp bạn bè: người được ghim (is_pinned) lên trước
  const sortedContacts = useMemo(() => {
    return [...contacts].sort((a, b) => Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)));
  }, [contacts]);

  // Sắp xếp hội thoại: ưu tiên cuộc trò chuyện trực tiếp với bạn đã ghim lên đầu
  const sortedConversations = useMemo(() => {
    const pinnedIds = new Set(contacts.filter((c) => c.is_pinned).map((c) => c.id));
    return [...conversations].sort((a, b) => {
      const aOther = a.type === 'direct' ? a.members?.find((m) => m.user_id !== sessionUserId)?.user_id : null;
      const bOther = b.type === 'direct' ? b.members?.find((m) => m.user_id !== sessionUserId)?.user_id : null;
      const aPinned = aOther && pinnedIds.has(aOther) ? 1 : 0;
      const bPinned = bOther && pinnedIds.has(bOther) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });
  }, [conversations, contacts, sessionUserId]);

  // 1. Auth Session Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionUserId(data.session?.user?.id ?? null);
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user?.id ?? null);
      setAuthReady(true);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // 2. Load Current User Profile, Contacts & Conversations
  const loadMyData = async (uid: string) => {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (profile) {
      if (profile.is_banned) {
        alert('Tài khoản của bạn đã bị Quản trị viên tạm khóa.');
        await supabase.auth.signOut();
        setMe(null);
        return;
      }
      setMe(profile as Profile);
      setEditDisplayName(profile.display_name);
      setEditBio(profile.bio || '');
      setEditStatus(profile.status || 'online');
    }

    const { data: contactRows } = await supabase
      .from('contacts')
      .select('contact_id, is_pinned, profiles!contacts_contact_id_fkey(*)')
      .eq('user_id', uid);

    if (contactRows) {
      setContacts(
        contactRows
          .filter((r: any) => r.profiles)
          .map((r: any) => ({ ...r.profiles, is_pinned: Boolean(r.is_pinned) }))
      );
    }

    await loadConversations(uid);
  };

  const loadConversations = async (uid: string) => {
    const { data: memberRows } = await supabase
      .from('conversation_members')
      .select('conversation_id, last_read_at')
      .eq('user_id', uid);

    if (!memberRows || memberRows.length === 0) {
      setConversations([]);
      return;
    }

    const convIds = memberRows.map((m) => m.conversation_id);
    const readMap = new Map(memberRows.map((m) => [m.conversation_id, m.last_read_at]));

    const { data: convRows } = await supabase
      .from('conversations')
      .select('*, conversation_members(*, profile:profiles(*))')
      .in('id', convIds)
      .order('last_message_at', { ascending: false });

    if (convRows) {
      const formatted: Conversation[] = await Promise.all(
        convRows.map(async (c: any) => {
          const lastRead = readMap.get(c.id) || '1970-01-01T00:00:00Z';
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', c.id)
            .neq('sender_id', uid)
            .gt('created_at', lastRead);

          return {
            ...c,
            members: c.conversation_members || [],
            unread_count: c.id === activeConvIdRef.current ? 0 : count || 0,
          };
        })
      );
      setConversations(formatted);
    }
  };

  useEffect(() => {
    if (!sessionUserId) return;
    loadMyData(sessionUserId);
  }, [sessionUserId]);

  // 3. Global Realtime Presence, Database Sync & WebRTC Call Signaling
  useEffect(() => {
    if (!sessionUserId || !me) return;

    const presenceChannel = supabase.channel('global-presence', {
      config: { presence: { key: sessionUserId } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        setOnlineUserIds(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: sessionUserId, username: me.username });
        }
      });

    const dbSub = supabase
      .channel('public-db-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        loadConversations(sessionUserId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, () => {
        loadConversations(sessionUserId);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMsg = payload.new as any;
        if (newMsg.sender_id !== sessionUserId && newMsg.conversation_id !== activeConvIdRef.current) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === newMsg.conversation_id
                ? {
                    ...c,
                    unread_count: (c.unread_count || 0) + 1,
                    last_message_text: newMsg.content,
                    last_message_at: newMsg.created_at,
                  }
                : c
            )
          );
        }
      })
      .subscribe();

    // Kênh tín hiệu Video Call riêng của từng người dùng
    const callChannel = supabase.channel(`webrtc-call:${sessionUserId}`);
    callSignalChannelRef.current = callChannel;

    callChannel
      .on('broadcast', { event: 'call-offer' }, ({ payload }) => {
        if (pcRef.current) return; // Đang bận cuộc gọi khác
        setCallPeer({
          userId: payload.fromUserId,
          name: payload.fromName,
          avatar: payload.fromAvatar || null,
          convId: payload.convId,
        });
        setIncomingOffer(payload.offer);
        setCallState('ringing');
      })
      .on('broadcast', { event: 'call-answer' }, async ({ payload }) => {
        if (pcRef.current && payload.answer) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
          for (const cand of pendingCandidatesRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(cand));
          }
          pendingCandidatesRef.current = [];
          setCallState('connected');
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (!payload.candidate) return;
        if (pcRef.current && pcRef.current.remoteDescription) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } else {
          pendingCandidatesRef.current.push(payload.candidate);
        }
      })
      .on('broadcast', { event: 'call-end' }, () => {
        cleanupVideoCall();
      })
      .subscribe();

    const handleBeforeUnload = () => {
      supabase
        .from('profiles')
        .update({ status: 'offline', last_seen: new Date().toISOString() })
        .eq('id', sessionUserId);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(dbSub);
      supabase.removeChannel(callChannel);
    };
  }, [sessionUserId, me?.id]);

  // 4. Active Conversation Messages, Group Bans & Typing Channel
  const loadGroupBans = async (convId: string) => {
    const { data } = await supabase
      .from('group_bans')
      .select('user_id, profiles!group_bans_user_id_fkey(*)')
      .eq('conversation_id', convId);

    if (data) {
      setGroupBannedUsers(data.map((r: any) => r.profiles).filter(Boolean));
    } else {
      setGroupBannedUsers([]);
    }
  };

  useEffect(() => {
    if (!activeConvId || !sessionUserId) {
      setMessages([]);
      setGroupBannedUsers([]);
      return;
    }

    let isMounted = true;
    setLoadingMessages(true);
    setTypingUsers({});
    setEditingGroupName(false);

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, sender:profiles(*)')
        .eq('conversation_id', activeConvId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (isMounted && data) {
        setMessages(data as Message[]);
        setLoadingMessages(false);
        markConversationRead(activeConvId);
      }
    };

    fetchMessages();
    loadGroupBans(activeConvId);

    const roomChannel = supabase.channel(`room:${activeConvId}`);
    channelRef.current = roomChannel;

    roomChannel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${activeConvId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const { data: fullMsg } = await supabase
              .from('messages')
              .select('*, sender:profiles(*)')
              .eq('id', payload.new.id)
              .single();

            if (fullMsg && isMounted) {
              setMessages((prev) => (prev.some((m) => m.id === fullMsg.id) ? prev : [...prev, fullMsg as Message]));
              markConversationRead(activeConvId);
            }
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) =>
              prev.map((m) => (m.id === payload.new.id ? { ...m, ...(payload.new as Message) } : m))
            );
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.user_id === sessionUserId) return;
        setTypingUsers((prev) => {
          const next = { ...prev };
          if (payload.is_typing) {
            next[payload.user_id] = payload.username;
          } else {
            delete next[payload.user_id];
          }
          return next;
        });
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(roomChannel);
      channelRef.current = null;
    };
  }, [activeConvId, sessionUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const markConversationRead = async (convId: string) => {
    if (!sessionUserId) return;
    await supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', convId)
      .eq('user_id', sessionUserId);

    setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c)));
  };

  // WebRTC Video Call Helpers
  const sendCallSignal = async (targetUserId: string, event: string, payload: any) => {
    const ch = supabase.channel(`webrtc-call:${targetUserId}`);
    await ch.subscribe();
    await ch.send({
      type: 'broadcast',
      event,
      payload,
    });
    setTimeout(() => supabase.removeChannel(ch), 1500);
  };

  const cleanupVideoCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    pendingCandidatesRef.current = [];
    setIncomingOffer(null);
    setCallPeer(null);
    setCallState('idle');
    setMicEnabled(true);
    setCamEnabled(true);
  };

  const startVideoCall = async (targetUser: Profile, convId: string) => {
    if (!me || !sessionUserId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;

      setCallPeer({
        userId: targetUser.id,
        name: targetUser.display_name || targetUser.username,
        avatar: targetUser.avatar_url,
        convId,
      });
      setCallState('calling');

      setTimeout(() => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      }, 100);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendCallSignal(targetUser.id, 'ice-candidate', {
            candidate: event.candidate.toJSON(),
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await sendCallSignal(targetUser.id, 'call-offer', {
        fromUserId: sessionUserId,
        fromName: me.display_name || me.username,
        fromAvatar: me.avatar_url,
        convId,
        offer,
      });
    } catch {
      alert('Không thể truy cập Camera hoặc Micro. Vui lòng cấp quyền trình duyệt và thử lại.');
      cleanupVideoCall();
    }
  };

  const acceptIncomingCall = async () => {
    if (!callPeer || !incomingOffer || !sessionUserId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setCallState('connected');

      setTimeout(() => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      }, 100);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendCallSignal(callPeer.userId, 'ice-candidate', {
            candidate: event.candidate.toJSON(),
          });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      for (const cand of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      }
      pendingCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await sendCallSignal(callPeer.userId, 'call-answer', { answer });
    } catch {
      alert('Không thể truy cập Camera/Micro để nhận cuộc gọi.');
      endVideoCall();
    }
  };

  const endVideoCall = async () => {
    if (callPeer) {
      await sendCallSignal(callPeer.userId, 'call-end', {});
    }
    cleanupVideoCall();
  };

  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const next = !micEnabled;
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicEnabled(next);
  };

  const toggleCam = () => {
    if (!localStreamRef.current) return;
    const next = !camEnabled;
    localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamEnabled(next);
  };

  // Admin Panel Data Loader
  const openAdminPanel = async () => {
    setShowAdminModal(true);
    setAdminLoading(true);
    const [{ data: usersData }, { data: groupsData }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase
        .from('conversations')
        .select('*, conversation_members(*, profile:profiles(*))')
        .eq('type', 'group')
        .order('created_at', { ascending: false }),
    ]);

    if (usersData) setAdminUsers(usersData as Profile[]);
    if (groupsData) {
      setAdminGroups(
        groupsData.map((g: any) => ({
          ...g,
          members: g.conversation_members || [],
        }))
      );
    }
    setAdminLoading(false);
  };

  const handleToggleBanUser = async (targetUser: Profile) => {
    if (!me?.is_admin || targetUser.id === me.id) return;
    const nextBan = !targetUser.is_banned;
    const { error } = await supabase.from('profiles').update({ is_banned: nextBan }).eq('id', targetUser.id);
    if (!error) {
      setAdminUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, is_banned: nextBan } : u)));
    }
  };

  const handleToggleAdminRole = async (targetUser: Profile) => {
    if (!me?.is_admin || targetUser.id === me.id) return;
    const nextAdmin = !targetUser.is_admin;
    const { error } = await supabase.from('profiles').update({ is_admin: nextAdmin }).eq('id', targetUser.id);
    if (!error) {
      setAdminUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, is_admin: nextAdmin } : u)));
    }
  };

  const handleAdminJoinAndOpenGroup = async (group: Conversation) => {
    if (!sessionUserId || !me?.is_admin) return;
    const isAlreadyMember = group.members?.some((m) => m.user_id === sessionUserId);
    if (!isAlreadyMember) {
      await supabase.from('conversation_members').insert({
        conversation_id: group.id,
        user_id: sessionUserId,
        role: 'admin',
      });
    }
    await loadConversations(sessionUserId);
    setActiveConvId(group.id);
    setShowAdminModal(false);
    setMobileMenuOpen(false);
  };

  const handleAdminDeleteGroup = async (groupId: string) => {
    if (!me?.is_admin || !sessionUserId) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn nhóm chat này không?')) return;
    await supabase.from('conversations').delete().eq('id', groupId);
    setAdminGroups((prev) => prev.filter((g) => g.id !== groupId));
    if (activeConvId === groupId) setActiveConvId(null);
    await loadConversations(sessionUserId);
  };

  // Search Users by Username
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !sessionUserId) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', sessionUserId)
        .ilike('username', `%${q}%`)
        .limit(10);
      setSearchResults((data as Profile[]) || []);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, sessionUserId]);

  // Search Users to Add to Group
  useEffect(() => {
    const q = addMemberQuery.trim().toLowerCase();
    if (!q || !sessionUserId) {
      setAddMemberResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', sessionUserId)
        .ilike('username', `%${q}%`)
        .limit(8);
      setAddMemberResults((data as Profile[]) || []);
    }, 250);
    return () => clearTimeout(timer);
  }, [addMemberQuery, sessionUserId]);

  const startDirectChat = async (targetUser: Profile) => {
    if (!sessionUserId) return;
    const { data: convId, error } = await supabase.rpc('get_or_create_direct_conversation', {
      target_user_id: targetUser.id,
    });
    if (!error && convId) {
      await loadConversations(sessionUserId);
      setActiveConvId(convId);
      setSearchQuery('');
      setMobileMenuOpen(false);
    }
  };

  // Add / Remove Friend
  const toggleContact = async (targetUser: Profile) => {
    if (!sessionUserId) return;
    const exists = contacts.some((c) => c.id === targetUser.id);
    if (exists) {
      await supabase.from('contacts').delete().eq('user_id', sessionUserId).eq('contact_id', targetUser.id);
      setContacts((prev) => prev.filter((c) => c.id !== targetUser.id));
    } else {
      await supabase
        .from('contacts')
        .insert({ user_id: sessionUserId, contact_id: targetUser.id, is_pinned: false });
      setContacts((prev) => [...prev, { ...targetUser, is_pinned: false }]);
    }
  };

  // Pin / Unpin Friend
  const togglePinContact = async (targetUser: Profile) => {
    if (!sessionUserId) return;
    const existing = contacts.find((c) => c.id === targetUser.id);
    if (!existing) {
      // Nếu chưa kết bạn thì tự động kết bạn và ghim luôn
      await supabase
        .from('contacts')
        .insert({ user_id: sessionUserId, contact_id: targetUser.id, is_pinned: true });
      setContacts((prev) => [...prev, { ...targetUser, is_pinned: true }]);
      return;
    }
    const nextPinned = !existing.is_pinned;
    await supabase
      .from('contacts')
      .update({ is_pinned: nextPinned })
      .eq('user_id', sessionUserId)
      .eq('contact_id', targetUser.id);

    setContacts((prev) =>
      prev.map((c) => (c.id === targetUser.id ? { ...c, is_pinned: nextPinned } : c))
    );
  };

  const handleTyping = (val: string) => {
    setMessageInput(val);
    if (!channelRef.current || !me) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: me.id, username: me.username, is_typing: val.length > 0 },
    });

    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: me.id, username: me.username, is_typing: false },
      });
    }, 2000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = messageInput.trim();
    if (!content || !activeConvId || !sessionUserId) return;

    setMessageInput('');
    setShowEmojiPicker(false);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: sessionUserId, username: me?.username, is_typing: false },
    });

    await supabase.from('messages').insert({
      conversation_id: activeConvId,
      sender_id: sessionUserId,
      content,
    });
  };

  const handleDeleteMessage = async (msgId: string) => {
    await supabase
      .from('messages')
      .update({ is_deleted: true, content: 'This message was deleted.' })
      .eq('id', msgId);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUserId || !groupName.trim() || selectedGroupUsers.length === 0) return;

    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({
        type: 'group',
        name: groupName.trim(),
        created_by: sessionUserId,
      })
      .select()
      .single();

    if (!error && newConv) {
      const memberInserts = [
        { conversation_id: newConv.id, user_id: sessionUserId, role: 'owner' },
        ...selectedGroupUsers.map((uid) => ({
          conversation_id: newConv.id,
          user_id: uid,
          role: 'member',
        })),
      ];
      await supabase.from('conversation_members').insert(memberInserts);
      await loadConversations(sessionUserId);
      setActiveConvId(newConv.id);
      setShowNewGroupModal(false);
      setGroupName('');
      setSelectedGroupUsers([]);
    }
  };

  // Group Owner / Admin Actions
  const handleRenameGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConvId || !sessionUserId || !newGroupNameInput.trim()) return;
    await supabase
      .from('conversations')
      .update({ name: newGroupNameInput.trim() })
      .eq('id', activeConvId);
    setEditingGroupName(false);
    await loadConversations(sessionUserId);
  };

  const handleAddMemberToGroup = async (userId: string) => {
    if (!activeConvId) return;
    if (groupBannedUsers.some((b) => b.id === userId)) {
      alert('Người dùng này đang nằm trong danh sách bị cấm (Ban) của nhóm. Hãy gỡ Ban trước khi thêm lại.');
      return;
    }
    await supabase.from('conversation_members').insert({
      conversation_id: activeConvId,
      user_id: userId,
      role: 'member',
    });
    if (sessionUserId) await loadConversations(sessionUserId);
    setAddMemberQuery('');
  };

  const handleRemoveMember = async (userId: string) => {
    if (!activeConvId || !sessionUserId) return;
    await supabase
      .from('conversation_members')
      .delete()
      .eq('conversation_id', activeConvId)
      .eq('user_id', userId);
    if (userId === sessionUserId) {
      setActiveConvId(null);
    }
    await loadConversations(sessionUserId);
  };

  const handleBanMemberFromGroup = async (targetUser: Profile) => {
    if (!activeConvId || !sessionUserId) return;
    if (!window.confirm(`Cấm (Ban) @${targetUser.username} khỏi nhóm này?`)) return;

    await supabase.from('group_bans').upsert({
      conversation_id: activeConvId,
      user_id: targetUser.id,
      banned_by: sessionUserId,
    });
    await supabase
      .from('conversation_members')
      .delete()
      .eq('conversation_id', activeConvId)
      .eq('user_id', targetUser.id);

    await Promise.all([loadConversations(sessionUserId), loadGroupBans(activeConvId)]);
  };

  const handleUnbanMemberFromGroup = async (userId: string) => {
    if (!activeConvId) return;
    await supabase
      .from('group_bans')
      .delete()
      .eq('conversation_id', activeConvId)
      .eq('user_id', userId);
    await loadGroupBans(activeConvId);
  };

  const handleToggleGroupMemberRole = async (userId: string, currentRole: 'owner' | 'admin' | 'member') => {
    if (!activeConvId || !sessionUserId || currentRole === 'owner') return;
    const nextRole = currentRole === 'admin' ? 'member' : 'admin';
    await supabase
      .from('conversation_members')
      .update({ role: nextRole })
      .eq('conversation_id', activeConvId)
      .eq('user_id', userId);
    await loadConversations(sessionUserId);
  };

  const handleDeleteCurrentGroup = async () => {
    if (!activeConvId || !sessionUserId) return;
    if (!window.confirm('Bạn có chắc muốn xóa vĩnh viễn nhóm chat này? Toàn bộ tin nhắn sẽ bị xóa.')) return;
    await supabase.from('conversations').delete().eq('id', activeConvId);
    setActiveConvId(null);
    await loadConversations(sessionUserId);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'profile' | 'group') => {
    const file = e.target.files?.[0];
    if (!file || !sessionUserId) return;

    const path = `${target}/${sessionUserId}-${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadErr) return;

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    if (target === 'profile') {
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', sessionUserId);
      setMe((prev) => (prev ? { ...prev, avatar_url: publicUrl } : null));
    } else if (target === 'group' && activeConvId) {
      await supabase.from('conversations').update({ avatar_url: publicUrl }).eq('id', activeConvId);
      await loadConversations(sessionUserId);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUserId) return;
    await supabase
      .from('profiles')
      .update({
        display_name: editDisplayName.trim() || me?.username,
        bio: editBio.trim(),
        status: editStatus,
      })
      .eq('id', sessionUserId);

    setMe((prev) =>
      prev
        ? {
            ...prev,
            display_name: editDisplayName.trim() || prev.username,
            bio: editBio.trim(),
            status: editStatus,
          }
        : null
    );
    setShowProfileModal(false);
  };

  const handleLogout = async () => {
    if (sessionUserId) {
      await supabase
        .from('profiles')
        .update({ status: 'offline', last_seen: new Date().toISOString() })
        .eq('id', sessionUserId);
    }
    await supabase.auth.signOut();
    setMe(null);
    setActiveConvId(null);
  };

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConvId) || null,
    [conversations, activeConvId]
  );

  const getConversationDisplay = (conv: Conversation) => {
    if (conv.type === 'group') {
      return {
        title: conv.name || 'Unnamed Group',
        subtitle: `${conv.members?.length || 0} members`,
        avatar: conv.avatar_url,
        online: false,
        isAdmin: false,
        isPinned: false,
      };
    }
    const other = conv.members?.find((m) => m.user_id !== sessionUserId)?.profile;
    const isOnline = other ? onlineUserIds.has(other.id) || other.status === 'online' : false;
    const friendRecord = other ? contacts.find((c) => c.id === other.id) : undefined;
    return {
      title: other?.display_name || other?.username || 'Direct Message',
      subtitle: other ? `@${other.username}` : '',
      avatar: other?.avatar_url || null,
      online: isOnline,
      otherUser: other,
      isAdmin: Boolean(other?.is_admin),
      isPinned: Boolean(friendRecord?.is_pinned),
      isFriend: Boolean(friendRecord),
    };
  };

  if (!authReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
        Initializing BocPhet...
      </div>
    );
  }

  if (!sessionUserId) {
    return <AuthScreen onAuthSuccess={() => {}} />;
  }

  const myMembership = activeConversation?.members?.find((m) => m.user_id === sessionUserId);
  const isGroupOwner =
    Boolean(me?.is_admin) ||
    activeConversation?.created_by === sessionUserId ||
    myMembership?.role === 'owner';
  const isGroupAdmin = isGroupOwner || myMembership?.role === 'admin';

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="h-screen flex overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        {/* LEFT SIDEBAR */}
        <aside
          className={`${
            mobileMenuOpen ? 'fixed inset-0 z-40 flex' : 'hidden md:flex'
          } w-full md:w-80 flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0`}
        >
          {/* App Header */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowProfileModal(true)}
                title="Cài đặt hồ sơ cá nhân"
                className="relative group shrink-0 cursor-pointer"
              >
                <div
                  className={`w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm overflow-hidden transition ${
                    me?.is_admin
                      ? 'ring-2 ring-amber-500 dark:ring-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.45)]'
                      : 'shadow-md shadow-indigo-600/20 ring-2 ring-transparent group-hover:ring-indigo-500'
                  }`}
                >
                  {me?.avatar_url ? (
                    <img src={me.avatar_url} alt={me.username} className="w-full h-full object-cover" />
                  ) : me?.username ? (
                    me.username[0].toUpperCase()
                  ) : (
                    <MessageSquare className="w-5 h-5" />
                  )}
                </div>
                {totalUnreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-rose-500 text-white ring-2 ring-white dark:ring-slate-900">
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </span>
                )}
              </button>
              <span className="font-bold text-base tracking-tight">BocPhet Chat</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowNewGroupModal(true)}
                title="Tạo nhóm chat mới"
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                onClick={() => setDarkMode(!darkMode)}
                title="Đổi giao diện Sáng / Tối"
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              {mobileMenuOpen && (
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="md:hidden p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Search Users */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm bạn bè qua @username..."
                className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-indigo-500"
              />
            </div>

            {searchQuery.trim() && (
              <div className="mt-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 space-y-1 max-h-56 overflow-y-auto">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-1">
                  Kết quả tìm kiếm
                </p>
                {searchResults.length === 0 ? (
                  <p className="text-xs text-slate-500 px-2 py-2">Không tìm thấy "{searchQuery}"</p>
                ) : (
                  searchResults.map((u) => {
                    const friendObj = contacts.find((c) => c.id === u.id);
                    const isContact = Boolean(friendObj);
                    return (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-900"
                      >
                        <button
                          onClick={() => startDirectChat(u)}
                          className="flex items-center gap-2.5 text-left flex-1 min-w-0"
                        >
                          <div
                            className={`w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden ${
                              u.is_admin ? 'ring-2 ring-amber-400' : ''
                            }`}
                          >
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
                            ) : (
                              u.username[0].toUpperCase()
                            )}
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-semibold truncate">
                              <AdminNameBadge name={u.display_name} isAdmin={u.is_admin} size="xs" />
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">@{u.username}</p>
                          </div>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => togglePinContact(u)}
                            title={friendObj?.is_pinned ? 'Bỏ ghim bạn bè' : 'Ghim bạn bè lên đầu'}
                            className={`p-1.5 rounded-lg text-xs transition ${
                              friendObj?.is_pinned
                                ? 'text-amber-600 dark:text-amber-400 bg-amber-500/15'
                                : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                            }`}
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => toggleContact(u)}
                            title={isContact ? 'Hủy kết bạn' : 'Kết bạn'}
                            className={`p-1.5 rounded-lg text-xs transition ${
                              isContact
                                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/15'
                                : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                            }`}
                          >
                            {isContact ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Friends / Contacts Strip (Pinned first) */}
          {sortedContacts.length > 0 && (
            <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Bạn bè ({sortedContacts.length})
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {sortedContacts.map((c) => {
                  const online = onlineUserIds.has(c.id) || c.status === 'online';
                  return (
                    <div key={c.id} className="relative flex flex-col items-center gap-1 shrink-0 w-14 group">
                      <button
                        type="button"
                        onClick={() => togglePinContact(c)}
                        title={c.is_pinned ? 'Bỏ ghim bạn bè' : 'Ghim bạn bè'}
                        className={`absolute -top-1 left-0.5 z-10 p-0.5 rounded-full transition ${
                          c.is_pinned
                            ? 'bg-amber-500 text-white opacity-100 shadow'
                            : 'bg-slate-700/80 text-slate-200 opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <Pin className="w-2.5 h-2.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => startDirectChat(c)}
                        className="flex flex-col items-center gap-1 w-full"
                      >
                        <div className="relative">
                          <div
                            className={`w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400 overflow-hidden transition ${
                              c.is_admin
                                ? 'ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.45)]'
                                : c.is_pinned
                                ? 'ring-2 ring-indigo-500'
                                : 'ring-2 ring-transparent group-hover:ring-indigo-500'
                            }`}
                          >
                            {c.avatar_url ? (
                              <img src={c.avatar_url} alt={c.username} className="w-full h-full object-cover" />
                            ) : (
                              c.username[0].toUpperCase()
                            )}
                          </div>
                          <span
                            className={`w-2.5 h-2.5 rounded-full absolute bottom-0 right-0 ring-2 ring-white dark:ring-slate-900 ${
                              online ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-500'
                            }`}
                          />
                        </div>
                        <span
                          className={`text-[11px] truncate w-full text-center ${
                            c.is_admin
                              ? 'text-amber-700 dark:text-amber-300 font-bold'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {c.username}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-2 py-1.5">
              Trò chuyện & Nhóm
            </p>
            {sortedConversations.length === 0 ? (
              <div className="text-center py-10 px-4">
                <p className="text-xs text-slate-500">Chưa có cuộc trò chuyện nào.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Tìm username ở ô trên hoặc bấm dấu + để tạo nhóm mới.
                </p>
              </div>
            ) : (
              sortedConversations.map((conv) => {
                const info = getConversationDisplay(conv);
                const selected = conv.id === activeConvId;
                return (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setActiveConvId(conv.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition ${
                      selected
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : info.isAdmin
                        ? 'border border-amber-500/40 bg-amber-50/70 dark:bg-amber-500/5 hover:bg-amber-100/70 dark:hover:bg-amber-500/10'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm overflow-hidden ${
                          info.isAdmin ? 'ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.45)]' : ''
                        } ${
                          selected
                            ? 'bg-white/20 text-white'
                            : 'bg-indigo-600/15 text-indigo-600 dark:text-indigo-400'
                        }`}
                      >
                        {info.avatar ? (
                          <img src={info.avatar} alt={info.title} className="w-full h-full object-cover" />
                        ) : conv.type === 'group' ? (
                          <Hash className="w-4 h-4" />
                        ) : (
                          info.title[0]?.toUpperCase()
                        )}
                      </div>
                      {conv.type === 'direct' && (
                        <span
                          className={`w-2.5 h-2.5 rounded-full absolute bottom-0 right-0 ring-2 ${
                            selected ? 'ring-indigo-600' : 'ring-white dark:ring-slate-900'
                          } ${info.online ? 'bg-emerald-400' : 'bg-slate-400 dark:bg-slate-500'}`}
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-sm font-semibold truncate flex items-center gap-1">
                          <AdminNameBadge
                            name={info.title}
                            isAdmin={info.isAdmin}
                            lightText={selected}
                            size="xs"
                          />
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          {info.isPinned && (
                            <Pin className={`w-3 h-3 ${selected ? 'text-amber-200' : 'text-amber-500'}`} />
                          )}
                          {conv.unread_count ? (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                              {conv.unread_count}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <p
                        className={`text-xs truncate mt-0.5 ${
                          selected ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {conv.last_message_text || info.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Current User Profile Footer (Fixed Light Mode & Dark Mode Contrast) */}
          {me && (
            <div
              className={`p-3 border-t flex items-center justify-between gap-2 transition-colors ${
                me.is_admin
                  ? 'border-amber-400/60 dark:border-amber-500/40 bg-gradient-to-r from-amber-100/90 via-amber-50 to-yellow-100/80 dark:from-amber-500/15 dark:via-slate-950 dark:to-amber-500/10'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80'
              }`}
            >
              <button
                onClick={() => setShowProfileModal(true)}
                className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-85 transition"
              >
                <div className="relative shrink-0">
                  <div
                    className={`w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs overflow-hidden ${
                      me.is_admin
                        ? 'ring-2 ring-amber-500 dark:ring-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.45)]'
                        : ''
                    }`}
                  >
                    {me.avatar_url ? (
                      <img src={me.avatar_url} alt={me.username} className="w-full h-full object-cover" />
                    ) : (
                      me.username[0].toUpperCase()
                    )}
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute bottom-0 right-0 ring-2 ring-white dark:ring-slate-950" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold truncate">
                    <AdminNameBadge name={me.display_name} isAdmin={me.is_admin} size="xs" />
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">@{me.username}</p>
                </div>
              </button>

              <div className="flex items-center gap-1 shrink-0">
                {me.is_admin && (
                  <button
                    onClick={openAdminPanel}
                    title="Bảng điều khiển Admin"
                    className="p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/60 dark:border-amber-400/50 text-amber-700 dark:text-amber-300 shadow-sm"
                  >
                    <Shield className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setShowProfileModal(true)}
                  title="Cài đặt tài khoản"
                  className="p-2 rounded-lg hover:bg-slate-200/80 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={handleLogout}
                  title="Đăng xuất"
                  className="p-2 rounded-lg hover:bg-rose-500/15 text-rose-600 dark:text-rose-400"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* MAIN CHAT AREA */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950">
          {!activeConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden mb-6 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium relative"
              >
                Mở danh sách trò chuyện
                {totalUnreadCount > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                    {totalUnreadCount}
                  </span>
                )}
              </button>
              <div className="relative mb-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <MessageSquare className="w-8 h-8" />
                </div>
                {totalUnreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center text-xs font-bold rounded-full bg-rose-500 text-white ring-2 ring-slate-50 dark:ring-slate-950">
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold">Chào mừng đến với BocPhet Chat</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1.5 leading-relaxed">
                Tìm kiếm bạn bè qua username ở thanh bên trái để nhắn tin, gọi video trực tiếp hoặc tạo nhóm trò chuyện.
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <header className="h-16 px-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="md:hidden p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 relative"
                  >
                    <Menu className="w-5 h-5" />
                    {totalUnreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 flex items-center justify-center text-[9px] font-bold rounded-full bg-rose-500 text-white">
                        {totalUnreadCount}
                      </span>
                    )}
                  </button>
                  {(() => {
                    const info = getConversationDisplay(activeConversation);
                    return (
                      <>
                        <div
                          className={`w-10 h-10 rounded-full bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 ${
                            info.isAdmin
                              ? 'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                              : ''
                          }`}
                        >
                          {info.avatar ? (
                            <img src={info.avatar} alt={info.title} className="w-full h-full object-cover" />
                          ) : activeConversation.type === 'group' ? (
                            <Users className="w-5 h-5" />
                          ) : (
                            info.title[0]?.toUpperCase()
                          )}
                        </div>
                        <div className="truncate">
                          <h3 className="text-sm font-bold truncate">
                            <AdminNameBadge name={info.title} isAdmin={info.isAdmin} size="xs" />
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {Object.keys(typingUsers).length > 0 ? (
                              <span className="text-indigo-500 dark:text-indigo-400 font-medium">
                                {Object.values(typingUsers).join(', ')} đang nhập...
                              </span>
                            ) : activeConversation.type === 'direct' ? (
                              info.online ? (
                                <span className="text-emerald-600 dark:text-emerald-400">● Đang hoạt động</span>
                              ) : (
                                'Ngoại tuyến'
                              )
                            ) : (
                              info.subtitle
                            )}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Action buttons on Chat Header: Add Friend, Pin Friend, Video Call, Info */}
                <div className="flex items-center gap-1.5">
                  {activeConversation.type === 'direct' && (() => {
                    const info = getConversationDisplay(activeConversation);
                    const otherUser = info.otherUser;
                    if (!otherUser) return null;
                    return (
                      <>
                        <button
                          onClick={() => togglePinContact(otherUser)}
                          title={info.isPinned ? 'Bỏ ghim bạn bè' : 'Ghim bạn bè'}
                          className={`p-2 rounded-xl transition ${
                            info.isPinned
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <Pin className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleContact(otherUser)}
                          title={info.isFriend ? 'Đã kết bạn (Bấm để hủy)' : 'Kết bạn'}
                          className={`p-2 rounded-xl transition ${
                            info.isFriend
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {info.isFriend ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => startVideoCall(otherUser, activeConversation.id)}
                          title="Gọi Video"
                          className="p-2 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 transition"
                        >
                          <Video className="w-4 h-4" />
                        </button>
                      </>
                    );
                  })()}

                  <button
                    onClick={() => setRightDrawerOpen(!rightDrawerOpen)}
                    className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                    title="Chi tiết cuộc trò chuyện"
                  >
                    <Info className="w-5 h-5" />
                  </button>
                </div>
              </header>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMessages ? (
                  <div className="text-center text-xs text-slate-400 py-8">Đang tải tin nhắn...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-12">
                    Chưa có tin nhắn nào. Hãy gửi lời chào đầu tiên!
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.sender_id === sessionUserId;
                    const senderIsAdmin = Boolean(msg.sender?.is_admin);
                    const senderName = msg.sender?.display_name || msg.sender?.username || 'User';
                    return (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2.5 group ${isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isMine && (
                          <div
                            className={`w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden ${
                              senderIsAdmin
                                ? 'ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.55)]'
                                : ''
                            }`}
                          >
                            {msg.sender?.avatar_url ? (
                              <img
                                src={msg.sender.avatar_url}
                                alt={senderName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              senderName[0]?.toUpperCase()
                            )}
                          </div>
                        )}

                        <div className={`max-w-[75%] sm:max-w-md ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                          {!isMine && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 mb-1 ml-1 flex items-center gap-1.5">
                              <AdminNameBadge name={senderName} isAdmin={senderIsAdmin} size="xs" />
                              <span className="opacity-60">@{msg.sender?.username}</span>
                            </span>
                          )}

                          <div
                            className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed relative ${
                              msg.is_deleted
                                ? 'bg-slate-200/70 dark:bg-slate-800/40 text-slate-500 italic border border-slate-300 dark:border-slate-800'
                                : isMine
                                ? senderIsAdmin
                                  ? 'bg-gradient-to-br from-indigo-600 via-indigo-600 to-amber-600/85 text-white rounded-br-sm border border-amber-400/75 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                                  : 'bg-indigo-600 text-white rounded-br-sm'
                                : senderIsAdmin
                                ? 'bg-white dark:bg-slate-900 border-2 border-amber-400/70 rounded-bl-sm shadow-[0_0_14px_rgba(245,158,11,0.18)]'
                                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-bl-sm'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            <div
                              className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                                isMine ? 'text-indigo-200' : 'text-slate-400'
                              }`}
                            >
                              <span>
                                {new Date(msg.created_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {isMine && !msg.is_deleted && <CheckCheck className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        </div>

                        {(isMine || me?.is_admin || isGroupAdmin) && !msg.is_deleted && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            title={isMine ? 'Xóa tin nhắn' : 'Quản trị viên: Xóa tin nhắn này'}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 relative">
                {showEmojiPicker && (
                  <div className="absolute bottom-16 left-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 shadow-xl grid grid-cols-8 gap-1.5 z-20">
                    {EMOJIS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setMessageInput((prev) => prev + em)}
                        className="text-lg hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg p-1"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => handleTyping(e.target.value)}
                    placeholder="Nhập tin nhắn..."
                    className="flex-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!messageInput.trim()}
                    className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </>
          )}
        </main>

        {/* RIGHT INSPECTOR SIDEBAR */}
        {activeConversation && rightDrawerOpen && (
          <aside className="hidden lg:flex w-76 flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-4 overflow-y-auto">
            {(() => {
              const info = getConversationDisplay(activeConversation);
              return (
                <>
                  <div className="flex flex-col items-center text-center pb-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="relative group">
                      <div
                        className={`w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xl overflow-hidden ${
                          info.isAdmin
                            ? 'ring-2 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.5)]'
                            : ''
                        }`}
                      >
                        {info.avatar ? (
                          <img src={info.avatar} alt={info.title} className="w-full h-full object-cover" />
                        ) : activeConversation.type === 'group' ? (
                          <Users className="w-7 h-7" />
                        ) : (
                          info.title[0]?.toUpperCase()
                        )}
                      </div>
                      {activeConversation.type === 'group' && isGroupAdmin && (
                        <label className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition">
                          <Camera className="w-5 h-5 text-white" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleAvatarUpload(e, 'group')}
                          />
                        </label>
                      )}
                    </div>

                    {/* Group Title + Rename Option for Owner */}
                    {activeConversation.type === 'group' && editingGroupName ? (
                      <form onSubmit={handleRenameGroup} className="mt-3 flex items-center gap-1.5 w-full">
                        <input
                          type="text"
                          value={newGroupNameInput}
                          onChange={(e) => setNewGroupNameInput(e.target.value)}
                          className="flex-1 bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs outline-none"
                          autoFocus
                        />
                        <button
                          type="submit"
                          className="px-2 py-1 rounded-lg bg-indigo-600 text-white text-xs font-medium"
                        >
                          Lưu
                        </button>
                      </form>
                    ) : (
                      <div className="mt-3 flex items-center justify-center gap-1.5">
                        <h4 className="font-bold text-sm">
                          <AdminNameBadge name={info.title} isAdmin={info.isAdmin} size="xs" />
                        </h4>
                        {activeConversation.type === 'group' && isGroupOwner && (
                          <button
                            type="button"
                            onClick={() => {
                              setNewGroupNameInput(activeConversation.name || '');
                              setEditingGroupName(true);
                            }}
                            title="Đổi tên nhóm"
                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{info.subtitle}</p>
                    {info.otherUser?.bio && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 bg-slate-100 dark:bg-slate-950 p-2.5 rounded-xl w-full">
                        {info.otherUser.bio}
                      </p>
                    )}

                    {/* Direct Chat Quick Actions */}
                    {activeConversation.type === 'direct' && info.otherUser && (
                      <div className="grid grid-cols-3 gap-2 w-full mt-3">
                        <button
                          type="button"
                          onClick={() => toggleContact(info.otherUser!)}
                          className={`py-2 px-2 rounded-xl text-[11px] font-medium flex flex-col items-center gap-1 transition ${
                            info.isFriend
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {info.isFriend ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                          {info.isFriend ? 'Bạn bè' : 'Kết bạn'}
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePinContact(info.otherUser!)}
                          className={`py-2 px-2 rounded-xl text-[11px] font-medium flex flex-col items-center gap-1 transition ${
                            info.isPinned
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <Pin className="w-4 h-4" />
                          {info.isPinned ? 'Đã ghim' : 'Ghim'}
                        </button>
                        <button
                          type="button"
                          onClick={() => startVideoCall(info.otherUser!, activeConversation.id)}
                          className="py-2 px-2 rounded-xl bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 text-[11px] font-medium flex flex-col items-center gap-1 hover:bg-indigo-600/25 transition"
                        >
                          <Video className="w-4 h-4" />
                          Video Call
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Group Members & Owner Controls */}
                  {activeConversation.type === 'group' && (
                    <div className="mt-4 space-y-4">
                      {isGroupAdmin && (
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                            Thêm thành viên qua Username
                          </label>
                          <input
                            type="text"
                            value={addMemberQuery}
                            onChange={(e) => setAddMemberQuery(e.target.value)}
                            placeholder="Tìm username..."
                            className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none"
                          />
                          {addMemberResults.length > 0 && (
                            <div className="mt-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-1 space-y-1 shadow-lg">
                              {addMemberResults
                                .filter((u) => !activeConversation.members?.some((m) => m.user_id === u.id))
                                .map((u) => (
                                  <button
                                    key={u.id}
                                    onClick={() => handleAddMemberToGroup(u.id)}
                                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900"
                                  >
                                    <span>@{u.username}</span>
                                    <Plus className="w-3.5 h-3.5 text-indigo-500" />
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                          Thành viên ({activeConversation.members?.length || 0})
                        </p>
                        <div className="space-y-1.5">
                          {activeConversation.members?.map((m) => {
                            const p = m.profile;
                            const online = p ? onlineUserIds.has(p.id) : false;
                            const canManageThisMember =
                              isGroupAdmin &&
                              m.user_id !== sessionUserId &&
                              (isGroupOwner || m.role === 'member');

                            return (
                              <div
                                key={m.user_id}
                                className={`flex items-center justify-between p-2 rounded-xl ${
                                  p?.is_admin
                                    ? 'bg-amber-50 dark:bg-amber-500/10 border border-amber-400/50'
                                    : 'bg-slate-50 dark:bg-slate-950/60'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${
                                      online ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-500'
                                    }`}
                                  />
                                  <div className="truncate">
                                    <p className="text-xs font-medium truncate">
                                      <AdminNameBadge
                                        name={p?.display_name || p?.username || 'User'}
                                        isAdmin={p?.is_admin}
                                        size="xs"
                                      />
                                    </p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                      {m.role === 'owner'
                                        ? '👑 Chủ nhóm (Owner)'
                                        : m.role === 'admin'
                                        ? '🛡️ Quản trị nhóm'
                                        : 'Thành viên'}
                                    </p>
                                  </div>
                                </div>

                                {canManageThisMember && p && (
                                  <div className="flex items-center gap-0.5 shrink-0">
                                    {isGroupOwner && (
                                      <button
                                        onClick={() => handleToggleGroupMemberRole(m.user_id, m.role)}
                                        title={m.role === 'admin' ? 'Hạ xuống thành viên' : 'Cấp phó nhóm (Admin)'}
                                        className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 ${
                                          m.role === 'admin' ? 'text-amber-500' : 'text-slate-400'
                                        }`}
                                      >
                                        <Shield className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleRemoveMember(m.user_id)}
                                      title="Mời ra khỏi nhóm (Kick)"
                                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-orange-500"
                                    >
                                      <UserMinus className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleBanMemberFromGroup(p)}
                                      title="Cấm vĩnh viễn khỏi nhóm (Ban)"
                                      className="p-1 rounded hover:bg-rose-500/15 text-slate-400 hover:text-rose-500"
                                    >
                                      <Ban className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Group Banned List */}
                      {isGroupAdmin && groupBannedUsers.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-500 mb-2">
                            Danh sách bị Ban ({groupBannedUsers.length})
                          </p>
                          <div className="space-y-1.5">
                            {groupBannedUsers.map((b) => (
                              <div
                                key={b.id}
                                className="flex items-center justify-between p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs"
                              >
                                <span className="truncate font-medium">@{b.username}</span>
                                <button
                                  type="button"
                                  onClick={() => handleUnbanMemberFromGroup(b.id)}
                                  className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold"
                                >
                                  Gỡ Ban
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <button
                          onClick={() => handleRemoveMember(sessionUserId)}
                          className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5"
                        >
                          <DoorOpen className="w-4 h-4" />
                          Rời khỏi nhóm
                        </button>

                        {isGroupOwner && (
                          <button
                            onClick={handleDeleteCurrentGroup}
                            className="w-full py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-center gap-1.5"
                          >
                            <Trash2 className="w-4 h-4" />
                            Xóa vĩnh viễn nhóm
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </aside>
        )}

        {/* WEBRTC VIDEO CALL OVERLAY */}
        {callState !== 'idle' && callPeer && (
          <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 text-white">
            {callState === 'ringing' ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-sm w-full text-center space-y-5 shadow-2xl">
                <div className="w-20 h-20 rounded-full bg-indigo-600/20 text-indigo-400 mx-auto flex items-center justify-center font-bold text-2xl overflow-hidden ring-4 ring-indigo-500/30 animate-pulse">
                  {callPeer.avatar ? (
                    <img src={callPeer.avatar} alt={callPeer.name} className="w-full h-full object-cover" />
                  ) : (
                    callPeer.name[0]?.toUpperCase()
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-indigo-400 font-semibold">Cuộc gọi Video đến</p>
                  <h3 className="text-lg font-bold mt-1">{callPeer.name}</h3>
                </div>
                <div className="flex items-center justify-center gap-4 pt-2">
                  <button
                    type="button"
                    onClick={endVideoCall}
                    className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2"
                  >
                    <PhoneOff className="w-4 h-4" />
                    Từ chối
                  </button>
                  <button
                    type="button"
                    onClick={acceptIncomingCall}
                    className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2"
                  >
                    <PhoneIncoming className="w-4 h-4" />
                    Nghe máy
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative w-full max-w-4xl h-[75vh] bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
                {/* Remote Video */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />

                {callState === 'calling' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70">
                    <div className="w-20 h-20 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-2xl overflow-hidden mb-3 animate-pulse">
                      {callPeer.avatar ? (
                        <img src={callPeer.avatar} alt={callPeer.name} className="w-full h-full object-cover" />
                      ) : (
                        callPeer.name[0]?.toUpperCase()
                      )}
                    </div>
                    <p className="text-base font-bold">{callPeer.name}</p>
                    <p className="text-xs text-slate-400 mt-1">Đang đổ chuông...</p>
                  </div>
                )}

                {/* Local Video PIP */}
                <div className="absolute bottom-20 right-4 w-36 sm:w-48 aspect-video bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-xl">
                  <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                </div>

                {/* Controls Bar */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-950/80 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-slate-800">
                  <button
                    type="button"
                    onClick={toggleMic}
                    className={`p-3 rounded-xl transition ${
                      micEnabled ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-rose-600 text-white'
                    }`}
                    title={micEnabled ? 'Tắt Micro' : 'Bật Micro'}
                  >
                    {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </button>
                  <button
                    type="button"
                    onClick={toggleCam}
                    className={`p-3 rounded-xl transition ${
                      camEnabled ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-rose-600 text-white'
                    }`}
                    title={camEnabled ? 'Tắt Camera' : 'Bật Camera'}
                  >
                    {camEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  </button>
                  <button
                    type="button"
                    onClick={endVideoCall}
                    className="px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-2"
                  >
                    <PhoneOff className="w-4 h-4" />
                    Kết thúc
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ADMIN CONTROL PANEL MODAL */}
        {showAdminModal && me?.is_admin && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-amber-500/50 rounded-2xl p-6 flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/50 text-amber-600 dark:text-amber-300 flex items-center justify-center">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">Bảng điều khiển Admin Tổng</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Quản lý toàn bộ thành viên & nhóm chat trên hệ thống
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowAdminModal(false)}>
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setAdminTab('users')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                    adminTab === 'users'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Thành viên ({adminUsers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAdminTab('groups')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                    adminTab === 'groups'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Tất cả nhóm chat ({adminGroups.length})
                </button>
              </div>

              <div className="flex-1 overflow-y-auto mt-4 space-y-2 pr-1">
                {adminLoading ? (
                  <p className="text-center text-xs text-slate-400 py-8">Đang tải dữ liệu hệ thống...</p>
                ) : adminTab === 'users' ? (
                  adminUsers.map((u) => {
                    const isSelf = u.id === me.id;
                    return (
                      <div
                        key={u.id}
                        className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${
                          u.is_admin
                            ? 'bg-amber-50/70 dark:bg-amber-500/5 border-amber-400/50'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-full bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden ${
                              u.is_admin ? 'ring-2 ring-amber-400' : ''
                            }`}
                          >
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
                            ) : (
                              u.username[0].toUpperCase()
                            )}
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold truncate">
                                <AdminNameBadge name={u.display_name} isAdmin={u.is_admin} size="xs" />
                              </p>
                              {u.is_banned && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-rose-500/20 text-rose-500">
                                  BỊ KHÓA
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              @{u.username} • {u.email}
                            </p>
                          </div>
                        </div>

                        {!isSelf && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleAdminRole(u)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition ${
                                u.is_admin
                                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-400/50'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {u.is_admin ? 'Gỡ Admin' : 'Cấp Admin'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleBanUser(u)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1 transition ${
                                u.is_banned
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {u.is_banned ? (
                                <>
                                  <CheckCircle className="w-3.5 h-3.5" /> Mở khóa
                                </>
                              ) : (
                                <>
                                  <Ban className="w-3.5 h-3.5" /> Khóa
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : adminGroups.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-8">Chưa có nhóm chat nào trên hệ thống.</p>
                ) : (
                  adminGroups.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                    >
                      <div className="truncate">
                        <p className="text-xs font-bold truncate">{g.name || 'Unnamed Group'}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {g.members?.length || 0} thành viên • Tin nhắn cuối: {g.last_message_text || 'Trống'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAdminJoinAndOpenGroup(g)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium"
                        >
                          Vào nhóm
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdminDeleteGroup(g.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 text-[11px] font-medium"
                        >
                          Xóa nhóm
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* CREATE GROUP MODAL */}
        {showNewGroupModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <form
              onSubmit={handleCreateGroup}
              className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base">Tạo nhóm chat mới</h3>
                <button type="button" onClick={() => setShowNewGroupModal(false)}>
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Tên nhóm</label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Nhóm bạn thân..."
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Chọn bạn bè ({selectedGroupUsers.length} đã chọn)
                </label>
                <div className="max-h-44 overflow-y-auto space-y-1 bg-slate-100 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                  {sortedContacts.length === 0 ? (
                    <p className="text-xs text-slate-500 p-2">
                      Hãy kết bạn với người dùng từ thanh tìm kiếm trước rồi chọn tại đây.
                    </p>
                  ) : (
                    sortedContacts.map((c) => {
                      const checked = selectedGroupUsers.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setSelectedGroupUsers((prev) =>
                              checked ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                            )
                          }
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                            checked ? 'bg-indigo-600 text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <span>
                            {c.display_name} (@{c.username})
                          </span>
                          {checked && <Check className="w-4 h-4" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={!groupName.trim() || selectedGroupUsers.length === 0}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium"
              >
                Tạo nhóm (Bạn làm Chủ nhóm)
              </button>
            </form>
          </div>
        )}

        {/* PROFILE SETTINGS MODAL */}
        {showProfileModal && me && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <form
              onSubmit={handleSaveProfile}
              className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base">Cài đặt hồ sơ cá nhân</h3>
                <button type="button" onClick={() => setShowProfileModal(false)}>
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div
                  className={`w-16 h-16 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xl overflow-hidden ${
                    me.is_admin ? 'ring-2 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.55)]' : ''
                  }`}
                >
                  {me.avatar_url ? (
                    <img src={me.avatar_url} alt={me.username} className="w-full h-full object-cover" />
                  ) : (
                    me.username[0].toUpperCase()
                  )}
                </div>
                <label className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium cursor-pointer hover:opacity-90">
                  Tải ảnh đại diện mới
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleAvatarUpload(e, 'profile')}
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Tên hiển thị
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Tiểu sử</label>
                <input
                  type="text"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Trạng thái hoạt động
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none"
                >
                  <option value="online">Trực tuyến (Online)</option>
                  <option value="idle">Tạm vắng (Idle)</option>
                  <option value="dnd">Không làm phiền</option>
                  <option value="offline">Ẩn trạng thái</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
              >
                Lưu thay đổi
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
