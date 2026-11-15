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
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { AuthScreen } from './components/AuthScreen';
import { Conversation, Message, Profile, UserStatus } from './types';

const EMOJIS = ['😀', '😂', '🔥', '❤️', '👍', '🎉', '🚀', '🙌', '😎', '🤔', '💯', '✨', '👏', '🥳', '💡', '🤝'];

// Component hiển thị Tên + Huy hiệu Vương miện & Viền vàng nổi bật cho Admin
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
            : 'bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_0_6px_rgba(245,158,11,0.35)]'
        }`}
      >
        {name}
      </span>
      <span
        className={`inline-flex items-center gap-0.5 rounded-full font-extrabold uppercase tracking-wider shrink-0 border border-amber-400/80 bg-gradient-to-r from-amber-500/25 to-yellow-500/20 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.35)] ${
          size === 'xs' ? 'px-1.5 py-0 text-[9px]' : 'px-2 py-0.5 text-[10px]'
        }`}
      >
        <Crown className={size === 'xs' ? 'w-2.5 h-2.5 text-amber-300 fill-amber-400/40' : 'w-3 h-3 text-amber-300 fill-amber-400/40'} />
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

  // Search & Contacts
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [contacts, setContacts] = useState<Profile[]>([]);

  // Real-time Presence & Typing
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const typingTimeoutRef = useRef<number | null>(null);
  const channelRef = useRef<any>(null);

  // Modals
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupUsers, setSelectedGroupUsers] = useState<string[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editStatus, setEditStatus] = useState<UserStatus>('online');

  // Admin Panel Modal
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminUsers, setAdminUsers] = useState<Profile[]>([]);
  const [adminGroups, setAdminGroups] = useState<Conversation[]>([]);
  const [adminTab, setAdminTab] = useState<'users' | 'groups'>('users');
  const [adminLoading, setAdminLoading] = useState(false);

  // Add Member to existing group
  const [addMemberQuery, setAddMemberQuery] = useState('');
  const [addMemberResults, setAddMemberResults] = useState<Profile[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Tổng số tin nhắn chưa đọc trên toàn bộ cuộc trò chuyện
  const totalUnreadCount = useMemo(
    () => conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0),
    [conversations]
  );

  // Cập nhật số tin nhắn chưa đọc lên tiêu đề tab trình duyệt
  useEffect(() => {
    document.title = totalUnreadCount > 0 ? `(${totalUnreadCount}) BocPhet Chat` : 'BocPhet Chat';
  }, [totalUnreadCount]);

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

    // Load contacts
    const { data: contactRows } = await supabase
      .from('contacts')
      .select('contact_id, profiles!contacts_contact_id_fkey(*)')
      .eq('user_id', uid);

    if (contactRows) {
      setContacts(contactRows.map((r: any) => r.profiles).filter(Boolean));
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

  // 3. Global Realtime Presence & Database Change Subscriptions
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
    };
  }, [sessionUserId, me?.id]);

  // 4. Active Conversation Messages & Typing Channel
  useEffect(() => {
    if (!activeConvId || !sessionUserId) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    setLoadingMessages(true);
    setTypingUsers({});

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

  const toggleContact = async (targetUser: Profile) => {
    if (!sessionUserId) return;
    const exists = contacts.some((c) => c.id === targetUser.id);
    if (exists) {
      await supabase.from('contacts').delete().eq('user_id', sessionUserId).eq('contact_id', targetUser.id);
      setContacts((prev) => prev.filter((c) => c.id !== targetUser.id));
    } else {
      await supabase.from('contacts').insert({ user_id: sessionUserId, contact_id: targetUser.id });
      setContacts((prev) => [...prev, targetUser]);
    }
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

  const handleAddMemberToGroup = async (userId: string) => {
    if (!activeConvId) return;
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
      };
    }
    const other = conv.members?.find((m) => m.user_id !== sessionUserId)?.profile;
    const isOnline = other ? onlineUserIds.has(other.id) || other.status === 'online' : false;
    return {
      title: other?.display_name || other?.username || 'Direct Message',
      subtitle: other ? `@${other.username}` : '',
      avatar: other?.avatar_url || null,
      online: isOnline,
      otherUser: other,
      isAdmin: Boolean(other?.is_admin),
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
  const isGroupAdmin =
    Boolean(me?.is_admin) || myMembership?.role === 'owner' || myMembership?.role === 'admin';

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
                      ? 'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
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
                title="Create Group Chat"
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                onClick={() => setDarkMode(!darkMode)}
                title="Toggle Theme"
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              {mobileMenuOpen && (
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="md:hidden p-2 rounded-lg hover:bg-slate-800"
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
                placeholder="Search users by @username..."
                className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-indigo-500"
              />
            </div>

            {searchQuery.trim() && (
              <div className="mt-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 space-y-1 max-h-56 overflow-y-auto">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-1">
                  Matching Users
                </p>
                {searchResults.length === 0 ? (
                  <p className="text-xs text-slate-500 px-2 py-2">No users found matching "{searchQuery}"</p>
                ) : (
                  searchResults.map((u) => {
                    const isContact = contacts.some((c) => c.id === u.id);
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
                            className={`w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden ${
                              u.is_admin ? 'ring-2 ring-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.45)]' : ''
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
                            <p className="text-[11px] text-slate-400 truncate">@{u.username}</p>
                          </div>
                        </button>
                        <button
                          onClick={() => toggleContact(u)}
                          title={isContact ? 'Remove Contact' : 'Add Contact'}
                          className={`p-1.5 rounded-lg text-xs ${
                            isContact
                              ? 'text-emerald-400 bg-emerald-500/10'
                              : 'text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Contacts Strip */}
          {contacts.length > 0 && (
            <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Contacts ({contacts.length})
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {contacts.map((c) => {
                  const online = onlineUserIds.has(c.id) || c.status === 'online';
                  return (
                    <button
                      key={c.id}
                      onClick={() => startDirectChat(c)}
                      className="flex flex-col items-center gap-1 shrink-0 w-14 group"
                    >
                      <div className="relative">
                        <div
                          className={`w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-indigo-400 overflow-hidden transition ${
                            c.is_admin
                              ? 'ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.45)]'
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
                          className={`w-2.5 h-2.5 rounded-full absolute bottom-0 right-0 ring-2 ring-slate-900 ${
                            online ? 'bg-emerald-500' : 'bg-slate-500'
                          }`}
                        />
                      </div>
                      <span
                        className={`text-[11px] truncate w-full text-center ${
                          c.is_admin ? 'text-amber-300 font-bold' : 'text-slate-400'
                        }`}
                      >
                        {c.username}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-1.5">
              Direct & Group Chats
            </p>
            {conversations.length === 0 ? (
              <div className="text-center py-10 px-4">
                <p className="text-xs text-slate-500">No conversations yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Search a username above or click + to create a group chat.
                </p>
              </div>
            ) : (
              conversations.map((conv) => {
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
                        ? 'border border-amber-500/35 bg-amber-500/5 hover:bg-amber-500/10'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm overflow-hidden ${
                          info.isAdmin
                            ? 'ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.45)]'
                            : ''
                        } ${selected ? 'bg-white/20 text-white' : 'bg-indigo-600/15 text-indigo-400'}`}
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
                          } ${info.online ? 'bg-emerald-400' : 'bg-slate-500'}`}
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-sm font-semibold truncate">
                          <AdminNameBadge
                            name={info.title}
                            isAdmin={info.isAdmin}
                            lightText={selected}
                            size="xs"
                          />
                        </p>
                        {conv.unread_count ? (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                            {conv.unread_count}
                          </span>
                        ) : null}
                      </div>
                      <p
                        className={`text-xs truncate mt-0.5 ${
                          selected ? 'text-indigo-100' : 'text-slate-400'
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

          {/* Current User Profile Footer */}
          {me && (
            <div
              className={`p-3 border-t flex items-center justify-between gap-2 ${
                me.is_admin
                  ? 'border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-slate-950 to-amber-500/5'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60'
              }`}
            >
              <button
                onClick={() => setShowProfileModal(true)}
                className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-80 transition"
              >
                <div className="relative shrink-0">
                  <div
                    className={`w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs overflow-hidden ${
                      me.is_admin ? 'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.55)]' : ''
                    }`}
                  >
                    {me.avatar_url ? (
                      <img src={me.avatar_url} alt={me.username} className="w-full h-full object-cover" />
                    ) : (
                      me.username[0].toUpperCase()
                    )}
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute bottom-0 right-0 ring-2 ring-slate-950" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold truncate">
                    <AdminNameBadge name={me.display_name} isAdmin={me.is_admin} size="xs" />
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">@{me.username}</p>
                </div>
              </button>

              <div className="flex items-center gap-1">
                {me.is_admin && (
                  <button
                    onClick={openAdminPanel}
                    title="Bảng điều khiển Admin"
                    className="p-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.25)]"
                  >
                    <Shield className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setShowProfileModal(true)}
                  title="Account Settings"
                  className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={handleLogout}
                  title="Log Out"
                  className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-400"
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
                Open Chats & Search
                {totalUnreadCount > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                    {totalUnreadCount}
                  </span>
                )}
              </button>
              <div className="relative mb-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-600/15 text-indigo-400 flex items-center justify-center">
                  <MessageSquare className="w-8 h-8" />
                </div>
                {totalUnreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center text-xs font-bold rounded-full bg-rose-500 text-white ring-2 ring-slate-50 dark:ring-slate-950">
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold">Welcome to BocPhet Chat</h2>
              <p className="text-xs text-slate-400 max-w-sm mt-1.5 leading-relaxed">
                Search any registered user by username in the sidebar to start a real-time private chat, or create a
                group conversation with multiple friends.
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <header className="h-16 px-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="md:hidden p-2 rounded-lg hover:bg-slate-800 relative"
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
                          className={`w-10 h-10 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 ${
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
                          <p className="text-xs text-slate-400 truncate">
                            {Object.keys(typingUsers).length > 0 ? (
                              <span className="text-indigo-400 font-medium">
                                {Object.values(typingUsers).join(', ')} is typing...
                              </span>
                            ) : activeConversation.type === 'direct' ? (
                              info.online ? (
                                <span className="text-emerald-400">● Online</span>
                              ) : (
                                'Offline'
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

                <button
                  onClick={() => setRightDrawerOpen(!rightDrawerOpen)}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                  title="Conversation Details"
                >
                  <Info className="w-5 h-5" />
                </button>
              </header>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMessages ? (
                  <div className="text-center text-xs text-slate-400 py-8">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-12">
                    No messages yet. Say hello to start the conversation!
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
                            className={`w-8 h-8 rounded-full bg-slate-800 text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden ${
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
                            <span className="text-[11px] text-slate-400 mb-1 ml-1 flex items-center gap-1.5">
                              <AdminNameBadge name={senderName} isAdmin={senderIsAdmin} size="xs" />
                              <span className="opacity-60">@{msg.sender?.username}</span>
                            </span>
                          )}

                          <div
                            className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed relative ${
                              msg.is_deleted
                                ? 'bg-slate-800/40 text-slate-500 italic border border-slate-800'
                                : isMine
                                ? senderIsAdmin
                                  ? 'bg-gradient-to-br from-indigo-600 via-indigo-600 to-amber-600/80 text-white rounded-br-sm border border-amber-400/75 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
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

                        {(isMine || me?.is_admin) && !msg.is_deleted && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            title={isMine ? 'Delete message' : 'Admin: Xóa tin nhắn này'}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition"
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
                    className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => handleTyping(e.target.value)}
                    placeholder="Write a message..."
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
          <aside className="hidden lg:flex w-72 flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-4 overflow-y-auto">
            {(() => {
              const info = getConversationDisplay(activeConversation);
              return (
                <>
                  <div className="flex flex-col items-center text-center pb-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="relative group">
                      <div
                        className={`w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xl overflow-hidden ${
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
                    <h4 className="font-bold text-sm mt-3 flex items-center justify-center">
                      <AdminNameBadge name={info.title} isAdmin={info.isAdmin} size="xs" />
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">{info.subtitle}</p>
                    {info.otherUser?.bio && (
                      <p className="text-xs text-slate-400 mt-2 bg-slate-100 dark:bg-slate-950 p-2.5 rounded-xl w-full">
                        {info.otherUser.bio}
                      </p>
                    )}
                  </div>

                  {/* Group Members & Controls */}
                  {activeConversation.type === 'group' && (
                    <div className="mt-4 space-y-4">
                      {isGroupAdmin && (
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                            Add Member by Username
                          </label>
                          <input
                            type="text"
                            value={addMemberQuery}
                            onChange={(e) => setAddMemberQuery(e.target.value)}
                            placeholder="Search username..."
                            className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none"
                          />
                          {addMemberResults.length > 0 && (
                            <div className="mt-1.5 bg-slate-950 border border-slate-800 rounded-xl p-1 space-y-1">
                              {addMemberResults
                                .filter((u) => !activeConversation.members?.some((m) => m.user_id === u.id))
                                .map((u) => (
                                  <button
                                    key={u.id}
                                    onClick={() => handleAddMemberToGroup(u.id)}
                                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-slate-900"
                                  >
                                    <span>@{u.username}</span>
                                    <Plus className="w-3.5 h-3.5 text-indigo-400" />
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                          Members ({activeConversation.members?.length || 0})
                        </p>
                        <div className="space-y-1.5">
                          {activeConversation.members?.map((m) => {
                            const p = m.profile;
                            const online = p ? onlineUserIds.has(p.id) : false;
                            return (
                              <div
                                key={m.user_id}
                                className={`flex items-center justify-between p-2 rounded-xl ${
                                  p?.is_admin
                                    ? 'bg-amber-500/10 border border-amber-400/50'
                                    : 'bg-slate-50 dark:bg-slate-950/60'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${
                                      online ? 'bg-emerald-500' : 'bg-slate-500'
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
                                    <p className="text-[10px] text-slate-400 capitalize">{m.role}</p>
                                  </div>
                                </div>
                                {isGroupAdmin && m.user_id !== sessionUserId && (
                                  <button
                                    onClick={() => handleRemoveMember(m.user_id)}
                                    title="Remove member"
                                    className="p-1 text-slate-400 hover:text-rose-400"
                                  >
                                    <UserMinus className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemoveMember(sessionUserId)}
                        className="w-full py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium flex items-center justify-center gap-1.5"
                      >
                        <DoorOpen className="w-4 h-4" />
                        Leave Group
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </aside>
        )}

        {/* ADMIN CONTROL PANEL MODAL */}
        {showAdminModal && me?.is_admin && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-amber-500/40 rounded-2xl p-6 flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/50 text-amber-300 flex items-center justify-center">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">Bảng điều khiển Admin Tổng</h3>
                    <p className="text-xs text-slate-400">Quản lý toàn bộ thành viên & nhóm chat trên hệ thống</p>
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
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
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
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
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
                            ? 'bg-amber-500/5 border-amber-400/50'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden ${
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
                                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-rose-500/20 text-rose-400">
                                  BỊ KHÓA
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 truncate">
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
                                  ? 'bg-amber-500/15 text-amber-300 border border-amber-400/50 hover:bg-amber-500/25'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {u.is_admin ? 'Gỡ Admin' : 'Cấp Admin'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleBanUser(u)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1 transition ${
                                u.is_banned
                                  ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                                  : 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25'
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
                        <p className="text-[11px] text-slate-400">
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
                          className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-[11px] font-medium"
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
                <h3 className="font-bold text-base">Create Group Chat</h3>
                <button type="button" onClick={() => setShowNewGroupModal(false)}>
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Group Name</label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Design Squad"
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Select Contacts ({selectedGroupUsers.length} selected)
                </label>
                <div className="max-h-44 overflow-y-auto space-y-1 bg-slate-100 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                  {contacts.length === 0 ? (
                    <p className="text-xs text-slate-500 p-2">
                      Add users to your contacts from the search bar first, then select them here.
                    </p>
                  ) : (
                    contacts.map((c) => {
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
                            checked ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800/50'
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
                Create Group
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
                <h3 className="font-bold text-base">Profile Settings</h3>
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
                  Upload New Avatar
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleAvatarUpload(e, 'profile')}
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Display Name</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Bio</label>
                <input
                  type="text"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Presence Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none"
                >
                  <option value="online">Online</option>
                  <option value="idle">Idle</option>
                  <option value="dnd">Do Not Disturb</option>
                  <option value="offline">Appear Offline</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
              >
                Save Changes
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
