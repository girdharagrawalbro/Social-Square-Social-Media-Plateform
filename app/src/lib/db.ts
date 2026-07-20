/**
 * db.ts — SQLite database layer for persistent app data.
 *
 * Uses @op-engineering/op-sqlite (JSI-based, fastest SQLite for React Native).
 *
 * Tables:
 *   messages     — chat messages per conversation (WhatsApp pattern)
 *   draft_posts  — user draft posts
 *
 * Pattern:
 *   Messages in RAM (useState) = last 50 visible messages (hot layer)
 *   Messages in SQLite         = full history persisted on disk (cold layer)
 *   Server                     = source of truth, synced every 4s
 */

import { open, type DB } from '@op-engineering/op-sqlite';

let _db: DB | null = null;

function getDB(): DB {
  if (!_db) {
    _db = open({ name: 'social_square.db' });
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: DB) {
  // ─── Chat Messages ─────────────────────────────────────────────────────────
  db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      _id             TEXT PRIMARY KEY,
      conversationId  TEXT NOT NULL,
      content         TEXT,
      mediaUrl        TEXT,
      senderId        TEXT,
      senderName      TEXT,
      senderAvatar    TEXT,
      isRead          INTEGER DEFAULT 0,
      isEncrypted     INTEGER DEFAULT 0,
      replyTo         TEXT,
      sharedPost      TEXT,
      storyReply      TEXT,
      deletedAt       TEXT,
      edited          INTEGER DEFAULT 0,
      createdAt       TEXT NOT NULL,
      updatedAt       TEXT
    );
  `);
  db.execute(`
    CREATE INDEX IF NOT EXISTS idx_messages_conv
    ON messages (conversationId, createdAt DESC);
  `);

  // ─── Draft Posts ────────────────────────────────────────────────────────────
  db.execute(`
    CREATE TABLE IF NOT EXISTS draft_posts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      caption     TEXT,
      imageUri    TEXT,
      videoUri    TEXT,
      postType    TEXT,
      groupId     TEXT,
      goalId      TEXT,
      savedAt     TEXT NOT NULL
    );
  `);
}

// ─── MESSAGE OPERATIONS ──────────────────────────────────────────────────────

/**
 * Load the most recent N messages for a conversation from SQLite (instant, no network).
 * Returns messages in ascending order (oldest first) for chat display.
 */
export function getMessagesFromDB(conversationId: string, limit = 50, offset = 0): any[] {
  try {
    const db = getDB();
    const result = db.execute(
      `SELECT * FROM messages
       WHERE conversationId = ?
       ORDER BY createdAt DESC
       LIMIT ? OFFSET ?`,
      [conversationId, limit, offset]
    );
    const rows = (result as any).rows?._array || [];
    // Reverse so oldest is first (chat display order)
    return rows.reverse().map(parseMessageRow);
  } catch (e) {
    console.warn('[DB] getMessagesFromDB error:', e);
    return [];
  }
}

/**
 * Upsert a batch of messages into SQLite.
 * Safe to call repeatedly — uses INSERT OR REPLACE for idempotency.
 */
export function upsertMessages(messages: any[]): void {
  if (!messages.length) return;
  try {
    const db = getDB();
    db.transaction(async (tx) => {
      for (const msg of messages) {
        tx.execute(
          `INSERT OR REPLACE INTO messages
           (_id, conversationId, content, mediaUrl, senderId, senderName, senderAvatar,
            isRead, isEncrypted, replyTo, sharedPost, storyReply, deletedAt, edited, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            msg._id,
            msg.conversationId,
            msg.content || null,
            msg.mediaUrl || null,
            msg.senderId || msg.sender?._id || null,
            msg.senderName || msg.sender?.fullname || null,
            msg.senderAvatar || msg.sender?.profile_picture || null,
            msg.isRead ? 1 : 0,
            msg.isEncrypted ? 1 : 0,
            msg.replyTo ? JSON.stringify(msg.replyTo) : null,
            msg.sharedPost ? JSON.stringify(msg.sharedPost) : null,
            msg.storyReply ? JSON.stringify(msg.storyReply) : null,
            msg.deletedAt || null,
            msg.edited ? 1 : 0,
            msg.createdAt,
            msg.updatedAt || null,
          ]
        );
      }
    });
  } catch (e) {
    console.warn('[DB] upsertMessages error:', e);
  }
}

/**
 * Mark messages as read in SQLite.
 */
export function markMessagesRead(conversationId: string): void {
  try {
    getDB().execute(
      `UPDATE messages SET isRead = 1 WHERE conversationId = ?`,
      [conversationId]
    );
  } catch (e) {
    console.warn('[DB] markMessagesRead error:', e);
  }
}

/**
 * Soft-delete a message by ID.
 */
export function deleteMessageInDB(messageId: string): void {
  try {
    getDB().execute(
      `UPDATE messages SET deletedAt = ? WHERE _id = ?`,
      [new Date().toISOString(), messageId]
    );
  } catch (e) {
    console.warn('[DB] deleteMessageInDB error:', e);
  }
}

/**
 * Delete all messages for a conversation (e.g., user cleared chat).
 */
export function clearConversationMessages(conversationId: string): void {
  try {
    getDB().execute(
      `DELETE FROM messages WHERE conversationId = ?`,
      [conversationId]
    );
  } catch (e) {
    console.warn('[DB] clearConversationMessages error:', e);
  }
}

// ─── DRAFT POST OPERATIONS ───────────────────────────────────────────────────

export function saveDraft(draft: {
  caption?: string;
  imageUri?: string;
  videoUri?: string;
  postType?: string;
  groupId?: string;
  goalId?: string;
}): void {
  try {
    getDB().execute(
      `INSERT INTO draft_posts (caption, imageUri, videoUri, postType, groupId, goalId, savedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        draft.caption || null,
        draft.imageUri || null,
        draft.videoUri || null,
        draft.postType || null,
        draft.groupId || null,
        draft.goalId || null,
        new Date().toISOString(),
      ]
    );
  } catch (e) {
    console.warn('[DB] saveDraft error:', e);
  }
}

export function getDrafts(): any[] {
  try {
    const result = getDB().execute(
      `SELECT * FROM draft_posts ORDER BY savedAt DESC`
    );
    return (result as any).rows?._array || [];
  } catch (e) {
    console.warn('[DB] getDrafts error:', e);
    return [];
  }
}

export function deleteDraft(id: number): void {
  try {
    getDB().execute(`DELETE FROM draft_posts WHERE id = ?`, [id]);
  } catch (e) {
    console.warn('[DB] deleteDraft error:', e);
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function parseMessageRow(row: any): any {
  return {
    ...row,
    isRead: !!row.isRead,
    isEncrypted: !!row.isEncrypted,
    edited: !!row.edited,
    replyTo: row.replyTo ? tryParse(row.replyTo) : null,
    sharedPost: row.sharedPost ? tryParse(row.sharedPost) : null,
    storyReply: row.storyReply ? tryParse(row.storyReply) : null,
  };
}

function tryParse(val: string | null): any {
  if (!val) return null;
  try { return JSON.parse(val); } catch { return null; }
}
