-- ============================================================================
-- PULSECHAT PRODUCTION SCHEMA (SUPABASE POSTGRESQL + REALTIME + RLS + STORAGE)
-- Run this entire file in your Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) >= 3 and username ~ '^[a-zA-Z0-9_]+$'),
  email text unique not null,
  display_name text not null,
  avatar_url text,
  bio text default 'Hey there! I am using PulseChat.',
  status text default 'online' check (status in ('online', 'idle', 'dnd', 'offline')),
  last_seen timestamptz default now(),
  created_at timestamptz default now()
);

-- 2. CONVERSATIONS TABLE (Direct & Group)
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('direct', 'group')),
  name text,
  avatar_url text,
  created_by uuid references public.profiles(id) on delete set null,
  last_message_text text,
  last_message_at timestamptz default now(),
  created_at timestamptz default now()
);

-- 3. CONVERSATION MEMBERS TABLE
create table if not exists public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  last_read_at timestamptz default now(),
  joined_at timestamptz default now(),
  primary key (conversation_id, user_id)
);

-- 4. MESSAGES TABLE
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  edited_at timestamptz,
  is_deleted boolean default false,
  created_at timestamptz default now()
);

-- 5. CONTACTS / FRIENDS TABLE
create table if not exists public.contacts (
  user_id uuid references public.profiles(id) on delete cascade,
  contact_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, contact_id),
  check (user_id <> contact_id)
);

-- INDEXES FOR FAST REAL-TIME QUERIES
create index if not exists idx_messages_conv_created on public.messages(conversation_id, created_at desc);
create index if not exists idx_members_user on public.conversation_members(user_id);
create index if not exists idx_profiles_username on public.profiles(lower(username));

-- HELPER SECURITY DEFINER FUNCTION TO AVOID RECURSIVE RLS
create or replace function public.is_conversation_member(conv_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = conv_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_conversation_admin(conv_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = conv_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- RPC TO FIND OR CREATE A 1-ON-1 DIRECT CONVERSATION ATOMICALLY
create or replace function public.get_or_create_direct_conversation(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_conv_id uuid;
  new_conv_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'Cannot start direct chat with yourself';
  end if;

  select c.id into existing_conv_id
  from public.conversations c
  join public.conversation_members m1 on m1.conversation_id = c.id and m1.user_id = auth.uid()
  join public.conversation_members m2 on m2.conversation_id = c.id and m2.user_id = target_user_id
  where c.type = 'direct'
  limit 1;

  if existing_conv_id is not null then
    return existing_conv_id;
  end if;

  insert into public.conversations (type, created_by)
  values ('direct', auth.uid())
  returning id into new_conv_id;

  insert into public.conversation_members (conversation_id, user_id, role)
  values
    (new_conv_id, auth.uid(), 'owner'),
    (new_conv_id, target_user_id, 'member');

  return new_conv_id;
end;
$$;

-- TRIGGER TO AUTO-UPDATE CONVERSATION PREVIEW ON NEW MESSAGE
create or replace function public.handle_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_text = case when new.is_deleted then 'Message deleted' else left(new.content, 120) end,
      last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists on_message_inserted on public.messages;
create trigger on_message_inserted
  after insert on public.messages
  for each row execute function public.handle_new_message();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.contacts enable row level security;

-- Profiles: Authenticated users can view profiles (to search usernames) and update only their own
create policy "Profiles viewable by authenticated users"
  on public.profiles for select to authenticated using (true);

create policy "Users can insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- Conversations: Only members can view; any authenticated user can create
create policy "Members can view conversations"
  on public.conversations for select to authenticated
  using (public.is_conversation_member(id) or created_by = auth.uid());

create policy "Authenticated users can create conversations"
  on public.conversations for insert to authenticated
  with check (auth.uid() = created_by);

create policy "Admins can update group conversations"
  on public.conversations for update to authenticated
  using (public.is_conversation_admin(id));

-- Conversation Members: Members see fellow members; admins or creators can add; members can leave
create policy "Members can view conversation members"
  on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id));

create policy "Creator or admin can add members"
  on public.conversation_members for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.is_conversation_admin(conversation_id)
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = auth.uid()
    )
  );

create policy "Members can update own read timestamp"
  on public.conversation_members for update to authenticated
  using (user_id = auth.uid());

create policy "Members can leave or admins can remove"
  on public.conversation_members for delete to authenticated
  using (user_id = auth.uid() or public.is_conversation_admin(conversation_id));

-- Messages: Only members of the conversation can read/send; senders can edit/delete their own
create policy "Members can view messages"
  on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id));

create policy "Members can send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_member(conversation_id)
  );

create policy "Senders can update own messages"
  on public.messages for update to authenticated
  using (sender_id = auth.uid());

create policy "Senders can delete own messages"
  on public.messages for delete to authenticated
  using (sender_id = auth.uid());

-- Contacts: Users manage only their own contacts
create policy "Users view own contacts"
  on public.contacts for select to authenticated using (user_id = auth.uid());

create policy "Users add own contacts"
  on public.contacts for insert to authenticated with check (user_id = auth.uid());

create policy "Users remove own contacts"
  on public.contacts for delete to authenticated using (user_id = auth.uid());

-- ============================================================================
-- REALTIME PUBLICATION
-- ============================================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.conversation_members;
alter publication supabase_realtime add table public.profiles;

-- ============================================================================
-- STORAGE BUCKET FOR AVATARS
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly accessible"
  on storage.objects for select using (bucket_id = 'avatars');

create policy "Authenticated users can upload avatars"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars');

create policy "Authenticated users can update avatars"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars');
