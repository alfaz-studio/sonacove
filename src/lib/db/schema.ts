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
  status: varchar("status", { length: 20 }).notNull().default("active"),
  kcUserId: varchar("kc_user_id", { length: 255 }),
  invitedEmail: varchar("invited_email", { length: 255 }),
  invitedAt: timestamp("invited_at", { withTimezone: true }),
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

// (relations are defined after all tables)

// Paddle subscriptions table - mirrors Paddle subscriptions for users and orgs
export const paddleSubscriptions = sonacoveSchema.table(
  "paddle_subscriptions",
  {
    id: serial("id").primaryKey(),
    paddleSubscriptionId: varchar("paddle_subscription_id", {
      length: 255,
    }).notNull().unique(),
    paddleCustomerId: varchar("paddle_customer_id", { length: 255 }).notNull(),
    paddleBusinessId: varchar("paddle_business_id", { length: 255 }),
    userId: integer("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    orgId: integer("org_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    isOrgSubscription: boolean("is_org_subscription")
      .notNull()
      .default(false),
    status: varchar("status", { length: 50 }).notNull(),
    billingInterval: varchar("billing_interval", { length: 10 }),
    billingFrequency: integer("billing_frequency"),
    quantity: integer("quantity").notNull().default(1),
    currency: varchar("currency", { length: 10 }),
    unitPrice: integer("unit_price"),
    collectionMode: varchar("collection_mode", { length: 20 }),
    trialEndAt: timestamp("trial_end_at", { withTimezone: true }),
    nextBilledAt: timestamp("next_billed_at", { withTimezone: true }),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  }
);

// Paddle subscription items table - optional line-item level data
export const paddleSubscriptionItems = sonacoveSchema.table(
  "paddle_subscription_items",
  {
    id: serial("id").primaryKey(),
    subscriptionId: integer("subscription_id")
      .notNull()
      .references(() => paddleSubscriptions.id, { onDelete: "cascade" }),
    paddlePriceId: varchar("paddle_price_id", { length: 255 }).notNull(),
    productType: varchar("product_type", { length: 50 }),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: integer("unit_price"),
    rawItem: jsonb("raw_item"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  }
);

// Paddle businesses table - mirrors Paddle businesses, linked to customers (which link to users)
export const paddleBusinesses = sonacoveSchema.table(
  "paddle_businesses",
  {
    id: serial("id").primaryKey(),
    paddleBusinessId: varchar("paddle_business_id", {
      length: 255,
    }).notNull().unique(),
    paddleCustomerId: varchar("paddle_customer_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    taxId: varchar("tax_id", { length: 255 }),
    country: varchar("country", { length: 2 }),
    city: varchar("city", { length: 255 }),
    region: varchar("region", { length: 255 }),
    postalCode: varchar("postal_code", { length: 50 }),
    addressLine1: varchar("address_line_1", { length: 255 }),
    addressLine2: varchar("address_line_2", { length: 255 }),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  }
);

// Paddle customers table - mirrors Paddle customers and links to users
export const paddleCustomers = sonacoveSchema.table(
  "paddle_customers",
  {
    id: serial("id").primaryKey(),
    paddleCustomerId: varchar("paddle_customer_id", {
      length: 255,
    }).notNull().unique(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  }
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

// Define relations (after all tables)
export const usersRelations = relations(users, ({ one, many }) => ({
  bookedRooms: many(bookedRooms),
  organizations: many(organizations, { relationName: "orgOwner" }),
  memberships: many(organizationMembers, { relationName: "userMembership" }),
  subscriptions: many(paddleSubscriptions),
  paddleCustomer: one(paddleCustomers, {
    fields: [users.id],
    references: [paddleCustomers.userId],
  }),
}));

export const bookedRoomsRelations = relations(bookedRooms, ({ one }) => ({
  user: one(users, {
    fields: [bookedRooms.userId],
    references: [users.id],
  }),
}));

export const organizationsRelations = relations(
  organizations,
  ({ one, many }) => ({
    owner: one(users, {
      fields: [organizations.ownerUserId],
      references: [users.id],
      relationName: "orgOwner",
    }),
    members: many(organizationMembers),
    subscriptions: many(paddleSubscriptions),
  }),
);

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
  }),
);

export const paddleSubscriptionsRelations = relations(
  paddleSubscriptions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [paddleSubscriptions.userId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [paddleSubscriptions.orgId],
      references: [organizations.id],
    }),
    paddleCustomer: one(paddleCustomers, {
      fields: [paddleSubscriptions.paddleCustomerId],
      references: [paddleCustomers.paddleCustomerId],
    }),
    paddleBusiness: one(paddleBusinesses, {
      fields: [paddleSubscriptions.paddleBusinessId],
      references: [paddleBusinesses.paddleBusinessId],
    }),
    items: many(paddleSubscriptionItems),
  }),
);

export const paddleSubscriptionItemsRelations = relations(
  paddleSubscriptionItems,
  ({ one }) => ({
    subscription: one(paddleSubscriptions, {
      fields: [paddleSubscriptionItems.subscriptionId],
      references: [paddleSubscriptions.id],
    }),
  }),
);

export const paddleBusinessesRelations = relations(
  paddleBusinesses,
  ({ one }) => ({
    paddleCustomer: one(paddleCustomers, {
      fields: [paddleBusinesses.paddleCustomerId],
      references: [paddleCustomers.paddleCustomerId],
    }),
  }),
);

export const paddleCustomersRelations = relations(
  paddleCustomers,
  ({ one }) => ({
    user: one(users, {
      fields: [paddleCustomers.userId],
      references: [users.id],
    }),
  }),
);

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
  paddleSubscriptions,
  paddleSubscriptionItems,
  paddleBusinesses,
  paddleCustomers,
  usersRelations,
  organizationsRelations,
  organizationMembersRelations,
  bookedRoomsRelations,
  meetingsRelations,
  meetingEventsRelations,
  paddleSubscriptionsRelations,
  paddleSubscriptionItemsRelations,
  paddleBusinessesRelations,
  paddleCustomersRelations,
};
