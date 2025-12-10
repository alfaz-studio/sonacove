import {
  pgSchema,
  serial,
  boolean,
  integer,
  timestamp,
  varchar,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Define the custom 'sonacove' schema
const sonacoveSchema = pgSchema("sonacove");

// Users table
export const users = sonacoveSchema.table("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  isActiveHost: boolean("is_active_host").notNull().default(false),
  maxBookings: integer("max_bookings").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  totalHostMinutes: integer("total_host_minutes").notNull().default(0),
  hostSessionStartTime: timestamp("host_session_start_time", { withTimezone: true }),
  });

// Organizations table
export const organizations = sonacoveSchema.table("organizations", {
  id: serial("id").primaryKey(),
  kcOrgId: varchar("kc_org_id", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  alias: varchar("alias", { length: 255 }).notNull().unique(),
  ownerUserId: integer("owner_user_id")
    .notNull()
    .references(() => users.id),
  domains: jsonb("domains"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Organization members table
export const organizationMembers = sonacoveSchema.table("organization_members", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull().default("teacher"),
  joinedAt: timestamp("joined_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => {
  return {
    userUnique: unique("organization_members_user_id_unique").on(table.userId),
    membershipUnique: unique("organization_members_org_user_unique")
      .on(table.orgId, table.userId),
  };
});


// Booked rooms table
export const bookedRooms = sonacoveSchema.table("booked_rooms", {
  id: serial("id").primaryKey(),
  roomName: varchar("room_name", { length: 255 }).notNull().unique(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  lobbyEnabled: boolean("lobby_enabled").notNull().default(false),
  meetingPassword: varchar("meeting_password", { length: 255 }),
  maxOccupants: integer("max_occupants").notNull().default(100),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  endDate: timestamp("end_date", { withTimezone: true }),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  bookedRooms: many(bookedRooms),
  organizations: many(organizations, { relationName: "orgOwner" }),
  memberships: many(organizationMembers, { relationName: "userMembership" }),
}));

export const bookedRoomsRelations = relations(bookedRooms, ({ one }) => ({
  user: one(users, {
    fields: [bookedRooms.userId],
    references: [users.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  owner: one(users, {
    fields: [organizations.ownerUserId],
    references: [users.id],
    relationName: "orgOwner",
  }),
  members: many(organizationMembers),
}));

export const organizationMembersRelations = relations(
  organizationMembers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.orgId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [organizationMembers.userId],
      references: [users.id],
      relationName: "userMembership",
    }),
  })
);

// Meetings table
export const meetings = sonacoveSchema.table("meetings", {
  id: serial("id").primaryKey(),
  roomName: varchar("room_name", { length: 255 }).notNull(),
  roomJid: varchar("room_jid", { length: 255 }).notNull(),
  isBreakout: boolean("is_breakout").notNull().default(false),
  breakoutRoomId: varchar("breakout_room_id", { length: 255 }),
  isLobby: boolean("is_lobby").notNull().default(false),
  lobbyRoomId: varchar("lobby_room_id", { length: 255 }),
  status: varchar("status", { length: 20 }).notNull().default("ongoing"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Meeting events table
export const meetingEvents = sonacoveSchema.table("meeting_events", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id")
    .notNull()
    .references(() => meetings.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .notNull()
    .defaultNow(),
  metadata: jsonb("metadata").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const meetingsRelations = relations(meetings, ({ many }) => ({
  events: many(meetingEvents),
}));

export const meetingEventsRelations = relations(meetingEvents, ({ one }) => ({
  meeting: one(meetings, {
    fields: [meetingEvents.meetingId],
    references: [meetings.id],
  }),
}));

// Export schema object for drizzle client
export const schema = {
  users,
  organizations,
  organizationMembers,
  bookedRooms,
  meetings,
  meetingEvents,
  usersRelations,
  organizationsRelations,
  organizationMembersRelations,
  bookedRoomsRelations,
  meetingsRelations,
  meetingEventsRelations,
};
