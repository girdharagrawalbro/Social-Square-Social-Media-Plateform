// 🧩 Core Types

// 👤 User Types
export interface UserLite {
  _id: string;
  username: string;
  profilePicture: string | null;
}

export interface UserFull extends UserLite {
  fullname: string;
  email: string;
  bio: string;
  followersCount: number;
  followingCount: number;
}

// 📝 Post Type
export interface Post {
  _id: string;
  content: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  category: string;
  author: UserLite;

  likesCount: number;
  commentsCount: number;
  isLiked: boolean;

  createdAt: string; // ISO date
}

// 💬 Message & Conversation Types
export interface Message {
  _id: string;
  conversationId: string;
  sender: UserLite;

  content: string;
  isRead: boolean;

  replyTo: {
    _id: string;
    content: string;
    sender: UserLite;
  } | null;

  createdAt: string;
}

export interface Conversation {
  _id: string;
  otherUser: UserLite;

  lastMessage: {
    content: string;
    createdAt: string;
  };

  unreadCount: number;
}

// 🔔 Notification Type
export type NotificationType = "like" | "comment" | "follow";

export interface Notification {
  _id: string;
  type: NotificationType;

  sender: UserLite;
  postId?: string;

  isRead: boolean;
  createdAt: string;
}

// 📦 API Response Types

// ✅ Common Response Wrapper
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

// 🔐 Auth Responses
export interface AuthResponse {
  user: UserFull;
  token: string;
}

// 🔍 Search Users
export interface SearchUser extends UserLite {
  fullname: string;
  isFollowing: boolean;
}

export interface SearchResponse {
  users: SearchUser[];
}

// 📝 Feed Response
export interface FeedResponse {
  posts: Post[];
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
    total: number;
  };
}

// 💬 Messages Response
export interface MessagesResponse {
  conversation: {
    _id: string;
    participants: UserLite[];
  };
  messages: Message[];
  nextCursor?: string;
  hasMore: boolean;
}

// 💬 Send Message Response
export interface SendMessageResponse {
  message: Message;
}

// 💬 Conversation List Response
export interface ConversationListResponse {
  conversations: Conversation[];
}

// 🔔 Notification Response
export interface NotificationResponse {
  notifications: Notification[];
}

// 🚀 Bonus: Utility Types

// 🔹 Pagination Query
export interface PaginationQuery {
  page?: number;
  limit?: number;
}

// 🔹 Follow Response
export interface FollowResponse {
  action: "followed" | "unfollowed";
  isFollowing: boolean;
}
