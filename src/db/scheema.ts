import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"

export const bookmarks = pgTable("bookmarks", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  title: text("title"),
  description: text("description"),
  favicon: text("favicon"),
  isFavorite: boolean("is_favorite").notNull().default(false),
  tags: text("tags"), // JSON or comma-separated
  createdAt: timestamp("created_at").defaultNow(),
})
