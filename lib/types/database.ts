export type ProfileVisibility = 'public' | 'department' | 'connections';
export type UserRole = 'student' | 'club_admin' | 'super_admin';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  year: number | null;
  branch: string | null;
  bio: string | null;
  avatar_url: string | null;
  skills: string[];
  interests: string[];
  github_url: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  visibility: ProfileVisibility;
  role: UserRole;
  onboarded_at: string | null;
  seeking_mentorship: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ProfileUpdate = Partial<
  Pick<
    Profile,
    | 'full_name'
    | 'year'
    | 'branch'
    | 'bio'
    | 'avatar_url'
    | 'skills'
    | 'interests'
    | 'github_url'
    | 'linkedin_url'
    | 'portfolio_url'
    | 'visibility'
    | 'onboarded_at'
    | 'seeking_mentorship'
  >
>;

export type ConnectionStatus = 'pending' | 'accepted' | 'rejected';
export type NotificationType =
  | 'mentorship_request'
  | 'mentorship_accepted'
  | 'connection_request'
  | 'connection_accepted'
  | 'group_join_request'
  | 'group_join_approved'
  | 'event_reminder';

export type Connection = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

/** Row shape returned by the `suggested_people` RPC. */
export type SuggestedPerson = Pick<
  Profile,
  'id' | 'full_name' | 'year' | 'branch' | 'bio' | 'avatar_url' | 'skills' | 'interests'
> & {
  shared_skills: number;
  shared_interests: number;
  mutual_connections: number;
  score: number;
};

/** Row shape returned by the `profile_preview` RPC. */
export type ProfilePreview = Pick<
  Profile,
  'id' | 'full_name' | 'avatar_url' | 'branch' | 'year' | 'visibility'
>;

/** Row shape returned by the `connection_state` RPC. */
export type ConnectionState = {
  connection_id: string;
  status: ConnectionStatus;
  direction: 'incoming' | 'outgoing';
};

/** A connection joined to the other participant's profile. */
export type ConnectionWithProfile = Connection & {
  profile: Pick<
    Profile,
    'id' | 'full_name' | 'avatar_url' | 'year' | 'branch' | 'skills' | 'interests'
  >;
};

export type GroupType = 'public' | 'private';
export type GroupCategory = 'club' | 'batch' | 'project' | 'interest';
export type GroupMemberRole = 'owner' | 'admin' | 'member';
export type GroupMemberStatus = 'pending' | 'active';

export type Group = {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  type: GroupType;
  category: GroupCategory;
  created_by: string | null;
  batch_branch: string | null;
  batch_year: number | null;
  created_at: string;
  updated_at: string;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  role: GroupMemberRole;
  status: GroupMemberStatus;
  created_at: string;
};

export type GroupPost = {
  id: string;
  group_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type GroupPostComment = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
};

export type GroupPostLike = {
  post_id: string;
  user_id: string;
  created_at: string;
};

export type ProfileSummary = Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'year' | 'branch'>;

/** A group plus the viewer's relationship with it. */
export type GroupWithMembership = Group & {
  member_count: number;
  viewer_role: GroupMemberRole | null;
  viewer_status: GroupMemberStatus | null;
};

export type GroupPostWithMeta = GroupPost & {
  author: ProfileSummary | null;
  like_count: number;
  comment_count: number;
  liked_by_viewer: boolean;
};

export type GroupMemberWithProfile = GroupMember & { profile: ProfileSummary };

export type ConversationType = 'dm' | 'group';

export type Conversation = {
  id: string;
  type: ConversationType;
  group_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationParticipant = {
  conversation_id: string;
  user_id: string;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_by: string[];
  created_at: string;
};

export type MessageWithSender = Message & { sender: ProfileSummary | null };

/** Row shape returned by the `list_conversations` RPC. */
export type ConversationSummary = {
  conversation_id: string;
  type: ConversationType;
  group_id: string | null;
  title: string;
  avatar_url: string | null;
  other_user_id: string | null;
  last_message: string | null;
  last_sender_id: string | null;
  last_message_at: string | null;
  unread_count: number;
};

export type EventCategory =
  | 'workshop'
  | 'talk'
  | 'competition'
  | 'social'
  | 'sports'
  | 'cultural'
  | 'other';

export type RsvpStatus = 'going' | 'interested' | 'not_going';

export type CampusEvent = {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  location: string | null;
  cover_url: string | null;
  category: EventCategory;
  created_by: string | null;
  /** Generated: coalesce(end_time, start_time). */
  ends_at: string;
  created_at: string;
  updated_at: string;
};

export type EventRsvp = {
  event_id: string;
  user_id: string;
  status: RsvpStatus;
  created_at: string;
  updated_at: string;
};

export type Announcement = {
  id: string;
  title: string;
  content: string;
  created_by: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type EventWithMeta = CampusEvent & {
  going_count: number;
  interested_count: number;
  viewer_status: RsvpStatus | null;
  organiser: ProfileSummary | null;
};

export type AnnouncementWithAuthor = Announcement & { author: ProfileSummary | null };

export type MentorshipStatus = 'requested' | 'accepted' | 'declined' | 'completed';

export type Mentor = {
  user_id: string;
  expertise: string[];
  bio: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MentorAvailability = {
  id: string;
  mentor_id: string;
  slot_start: string;
  slot_end: string;
  is_booked: boolean;
  booked_by: string | null;
  created_at: string;
};

export type MentorshipRequest = {
  id: string;
  mentor_id: string;
  mentee_id: string;
  message: string;
  status: MentorshipStatus;
  slot_id: string | null;
  /** Set by the transition guard; drives the re-request cooling-off window. */
  declined_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Row shape returned by the `search_mentors` RPC. */
export type MentorDirectoryEntry = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  branch: string | null;
  year: number | null;
  expertise: string[];
  bio: string | null;
  open_slots: number;
  is_connected: boolean;
};

/** `get_mentor_profile` adds the paused flag the directory filters out. */
export type MentorProfile = MentorDirectoryEntry & { is_active: boolean };

/** A slot with the booker attached, for the mentor's own availability list. */
export type MentorSlotWithBooker = MentorAvailability & { booker: ProfileSummary | null };

export type MentorshipRequestWithPeople = MentorshipRequest & {
  mentor: ProfileSummary | null;
  mentee: ProfileSummary | null;
  slot: MentorAvailability | null;
};

export type ReportTargetType = 'post' | 'message' | 'user';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export type Report = {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  status: ReportStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution: string | null;
  created_at: string;
};

/** Row shape returned by the `admin_report_queue` RPC. */
export type ReportQueueEntry = {
  id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
  reporter_id: string;
  reporter_name: string | null;
  target_preview: string | null;
  target_author: string | null;
  target_exists: boolean;
};

/** Row shape returned by the `admin_user_list` RPC. */
export type AdminUserRow = {
  id: string;
  full_name: string | null;
  email: string;
  branch: string | null;
  year: number | null;
  role: UserRole;
  is_active: boolean;
  onboarded_at: string | null;
  created_at: string;
  open_reports: number;
};

export type AdminStats = {
  total_users: number;
  active_users: number;
  onboarded_users: number;
  open_reports: number;
  pending_groups: number;
  total_groups: number;
  total_events: number;
};

export type PendingGroupRequest = {
  group_id: string;
  group_name: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  requested_at: string;
};

export type AppSetting = {
  key: string;
  value: string;
  updated_at: string;
}

/**
 * Shape of the tables this phase touches, matching what postgrest-js expects
 * from a generated `Database` type. Later phases extend `Tables` with
 * connections, groups, messages, events, and so on.
 */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; email: string };
        Update: ProfileUpdate;
        Relationships: [];
      };
      app_settings: {
        Row: AppSetting;
        Insert: AppSetting;
        Update: Partial<AppSetting>;
        Relationships: [];
      };
      connections: {
        Row: Connection;
        Insert: Pick<Connection, 'requester_id' | 'addressee_id'> & Partial<Connection>;
        Update: Partial<Pick<Connection, 'status'>>;
        /*
         * These mirror the FK names Postgres generates. PostgREST needs them to
         * type embedded selects such as
         * `profiles!connections_requester_id_fkey(...)`.
         */
        Relationships: [
          {
            foreignKeyName: 'connections_requester_id_fkey';
            columns: ['requester_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'connections_addressee_id_fkey';
            columns: ['addressee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      groups: {
        Row: Group;
        Insert: Pick<Group, 'name'> & Partial<Group>;
        Update: Partial<Group>;
        Relationships: [
          {
            foreignKeyName: 'groups_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      group_members: {
        Row: GroupMember;
        Insert: Pick<GroupMember, 'group_id' | 'user_id'> & Partial<GroupMember>;
        Update: Partial<Pick<GroupMember, 'role' | 'status'>>;
        Relationships: [
          {
            foreignKeyName: 'group_members_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      group_posts: {
        Row: GroupPost;
        Insert: Pick<GroupPost, 'group_id' | 'author_id' | 'content'> & Partial<GroupPost>;
        Update: Partial<Pick<GroupPost, 'content'>>;
        Relationships: [
          {
            foreignKeyName: 'group_posts_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_posts_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      group_post_comments: {
        Row: GroupPostComment;
        Insert: Pick<GroupPostComment, 'post_id' | 'author_id' | 'content'> & Partial<GroupPostComment>;
        Update: Partial<Pick<GroupPostComment, 'content'>>;
        Relationships: [
          {
            foreignKeyName: 'group_post_comments_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'group_posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_post_comments_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      group_post_likes: {
        Row: GroupPostLike;
        Insert: Pick<GroupPostLike, 'post_id' | 'user_id'>;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'group_post_likes_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'group_posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_post_likes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      conversations: {
        Row: Conversation;
        Insert: Pick<Conversation, 'type'> & Partial<Conversation>;
        Update: Partial<Conversation>;
        Relationships: [
          {
            foreignKeyName: 'conversations_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
        ];
      };
      conversation_participants: {
        Row: ConversationParticipant;
        Insert: Pick<ConversationParticipant, 'conversation_id' | 'user_id'>;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'conversation_participants_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversation_participants_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: Message;
        Insert: Pick<Message, 'conversation_id' | 'sender_id' | 'content'> & Partial<Message>;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: CampusEvent;
        Insert: Pick<CampusEvent, 'title' | 'start_time'> & Partial<CampusEvent>;
        Update: Partial<CampusEvent>;
        Relationships: [
          {
            foreignKeyName: 'events_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      event_rsvps: {
        Row: EventRsvp;
        Insert: Pick<EventRsvp, 'event_id' | 'user_id' | 'status'> & Partial<EventRsvp>;
        Update: Partial<Pick<EventRsvp, 'status'>>;
        Relationships: [
          {
            foreignKeyName: 'event_rsvps_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_rsvps_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      announcements: {
        Row: Announcement;
        Insert: Pick<Announcement, 'title' | 'content'> & Partial<Announcement>;
        Update: Partial<Announcement>;
        Relationships: [
          {
            foreignKeyName: 'announcements_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      mentors: {
        Row: Mentor;
        Insert: Pick<Mentor, 'user_id'> & Partial<Mentor>;
        Update: Partial<Mentor>;
        Relationships: [
          {
            foreignKeyName: 'mentors_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      mentor_availability: {
        Row: MentorAvailability;
        Insert: Pick<MentorAvailability, 'mentor_id' | 'slot_start' | 'slot_end'> &
          Partial<MentorAvailability>;
        Update: Partial<MentorAvailability>;
        Relationships: [
          {
            foreignKeyName: 'mentor_availability_booked_by_fkey';
            columns: ['booked_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      mentorship_requests: {
        Row: MentorshipRequest;
        Insert: Pick<MentorshipRequest, 'mentor_id' | 'mentee_id' | 'message'> &
          Partial<MentorshipRequest>;
        Update: Partial<Pick<MentorshipRequest, 'status' | 'slot_id'>>;
        Relationships: [
          {
            foreignKeyName: 'mentorship_requests_mentor_id_fkey';
            columns: ['mentor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mentorship_requests_mentee_id_fkey';
            columns: ['mentee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mentorship_requests_slot_id_fkey';
            columns: ['slot_id'];
            isOneToOne: false;
            referencedRelation: 'mentor_availability';
            referencedColumns: ['id'];
          },
        ];
      };
      reports: {
        Row: Report;
        Insert: Pick<Report, 'reporter_id' | 'target_type' | 'target_id' | 'reason'> &
          Partial<Report>;
        Update: Partial<Pick<Report, 'status' | 'resolution'>>;
        Relationships: [
          {
            foreignKeyName: 'reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: Notification;
        Insert: Partial<Notification> & Pick<Notification, 'user_id' | 'type'>;
        Update: Partial<Pick<Notification, 'read_at'>>;
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      search_profiles: {
        Args: {
          q?: string | null;
          branches?: string[] | null;
          years?: number[] | null;
          skill_tags?: string[] | null;
          interest_tags?: string[] | null;
          page_limit?: number;
          page_offset?: number;
        };
        Returns: Profile[];
      };
      suggested_people: {
        Args: { page_limit?: number };
        Returns: SuggestedPerson[];
      };
      connection_state: {
        Args: { target: string };
        Returns: ConnectionState[];
      };
      profile_preview: {
        Args: { target: string };
        Returns: ProfilePreview[];
      };
      can_receive_request: {
        Args: { target: string };
        Returns: boolean;
      };
      mutual_connection_count: {
        Args: { target: string };
        Returns: number;
      };
      group_member_count: {
        Args: { gid: string };
        Returns: number;
      };
      group_member_counts: {
        Args: { gids: string[] };
        Returns: { group_id: string; member_count: number }[];
      };
      transfer_group_ownership: {
        Args: { gid: string; new_owner: string };
        Returns: undefined;
      };
      get_or_create_dm: {
        Args: { other_user: string };
        Returns: string;
      };
      get_or_create_group_conversation: {
        Args: { gid: string };
        Returns: string;
      };
      mark_conversation_read: {
        Args: { cid: string };
        Returns: undefined;
      };
      can_post_to_conversation: {
        Args: { cid: string; uid?: string };
        Returns: boolean;
      };
      can_moderate_conversation: {
        Args: { cid: string; uid?: string };
        Returns: boolean;
      };
      is_super_admin: {
        Args: { uid?: string };
        Returns: boolean;
      };
      generate_event_reminders: {
        Args: { lead_time?: string };
        Returns: number;
      };
      event_rsvp_counts: {
        Args: { event_ids: string[] };
        Returns: { event_id: string; going_count: number; interested_count: number }[];
      };
      get_mentor_profile: {
        Args: { target: string };
        Returns: MentorProfile[];
      };
      search_mentors: {
        Args: {
          q?: string | null;
          expertise_tags?: string[] | null;
          branches?: string[] | null;
          years?: number[] | null;
          page_limit?: number;
          page_offset?: number;
        };
        Returns: MentorDirectoryEntry[];
      };
      book_mentor_slot: {
        Args: { slot: string };
        Returns: string;
      };
      release_mentor_slot: {
        Args: { slot: string };
        Returns: undefined;
      };
      is_active_mentor: {
        Args: { uid: string };
        Returns: boolean;
      };
      admin_report_queue: {
        Args: { filter_status?: ReportStatus; page_limit?: number };
        Returns: ReportQueueEntry[];
      };
      admin_resolve_report: {
        Args: { report: string; action: string; note?: string | null };
        Returns: undefined;
      };
      admin_user_list: {
        Args: { q?: string | null; page_limit?: number; page_offset?: number };
        Returns: AdminUserRow[];
      };
      admin_set_user_active: {
        Args: { target: string; active: boolean };
        Returns: undefined;
      };
      admin_set_user_role: {
        Args: { target: string; new_role: UserRole };
        Returns: undefined;
      };
      admin_pending_group_requests: {
        Args: Record<string, never>;
        Returns: PendingGroupRequest[];
      };
      admin_stats: {
        Args: Record<string, never>;
        Returns: AdminStats[];
      };
      can_request_mentorship: {
        Args: { mentor: string; mentee?: string };
        Returns: boolean;
      };
      is_conversation_participant: {
        Args: { cid: string; uid?: string };
        Returns: boolean;
      };
      list_conversations: {
        Args: Record<string, never>;
        Returns: ConversationSummary[];
      };
      is_group_member: {
        Args: { gid: string; uid?: string };
        Returns: boolean;
      };
      is_group_admin: {
        Args: { gid: string; uid?: string };
        Returns: boolean;
      };
    };
    Enums: {
      profile_visibility: ProfileVisibility;
      user_role: UserRole;
      connection_status: ConnectionStatus;
      group_type: GroupType;
      group_category: GroupCategory;
      group_member_role: GroupMemberRole;
      group_member_status: GroupMemberStatus;
      conversation_type: ConversationType;
      event_category: EventCategory;
      rsvp_status: RsvpStatus;
      mentorship_status: MentorshipStatus;
      report_target_type: ReportTargetType;
      report_status: ReportStatus;
      notification_type: NotificationType;
    };
    CompositeTypes: Record<never, never>;
  };
}
