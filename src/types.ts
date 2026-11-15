export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface Profile {
  id: string;
  username: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  status: UserStatus;
  last_seen: string;
  created_at: string;
  is_admin?: boolean;
  is_banned?: boolean;
  is_pinned?: boolean;
}

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  last_read_at: string;
  joined_at: string;
  profile?: Profile;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  avatar_url: string | null;
  created_by: string | null;
  last_message_text: string | null;
  last_message_at: string;
  created_at: string;
  members?: ConversationMember[];
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  edited_at: string | null;
  is_deleted: boolean;
  created_at: string;
  sender?: Profile;
}
