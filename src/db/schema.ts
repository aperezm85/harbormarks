import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("user"),
  isActive: boolean("is_active").notNull().default(true),
  emailVerifiedAt: timestamp("email_verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow(),
})

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
})

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
})

export const bookmarks = pgTable("bookmarks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  url: text("url").notNull(),
  title: text("title"),
  description: text("description"),
  favicon: text("favicon"),
  previewImage: text("preview_image"),
  isFavorite: boolean("is_favorite").notNull().default(false),
  visitCount: integer("visit_count").notNull().default(0),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastVisitedAt: timestamp("last_visited_at"),
  deletedAt: timestamp("deleted_at"),
  // Story 7 enrichment columns: extracted from the target page where present,
  // left null where not. Additive and nullable; existing rows are not backfilled.
  siteName: text("site_name"),
  author: text("author"),
  publishedAt: timestamp("published_at"),
  language: text("language"),
  canonicalUrl: text("canonical_url"),
  // Story 12 notes-only slice: private user note, nullable, searchable via
  // the search_vector generated column (migrations/0006_bookmark_note.sql).
  note: text("note"),
  // Read status slice: unread | reading | archived, defaulting to unread
  // (migrations/0007_bookmark_status.sql).
  status: text("status").notNull().default("unread"),
})

// Weekly digest preferences: one row per user, created lazily on first save
// (migrations/0008_digest_prefs.sql). Scope picks which bookmarks land in the
// Sunday email: unread saved in the last 7 days, all unread, or all bookmarks
// saved in the last 7 days.
export const digestPreferences = pgTable("digest_preferences", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  scope: text("scope").notNull().default("unread_7d"),
  sendDay: integer("send_day").notNull().default(0),
  sendTime: text("send_time").notNull().default("07:00"),
  lastSentAt: timestamp("last_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

// App-wide key-value settings (migrations/0009_link_secret.sql). Currently
// holds the auto-generated HMAC secret that signs email tracking links
// (see src/lib/link-tokens.ts).
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})
