import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

export const bookmarks = pgTable("bookmarks", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  title: text("title"),
  description: text("description"),
  favicon: text("favicon"),
  isFavorite: boolean("is_favorite").notNull().default(false),
  visitCount: integer("visit_count").notNull().default(0),
  tags: text("tags"),
  createdAt: timestamp("created_at").defaultNow(),
})
