import {
  pgTable,
  serial,
  varchar,
  text,
  jsonb,
  timestamp,
  integer,
  decimal,
  pgEnum,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ==========================================
// 1. ENUMS
// ==========================================
export const userRoleEnum = pgEnum("user_role", ["Admin", "User"]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "Income",
  "Expense",
  "Capital",
]);
export const currencyEnum = pgEnum("currency", ["AFN", "USD", "PKR"]);

// ==========================================
// 2. TABLES
// ==========================================

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 150 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: userRoleEnum("role").default("User"),

  permissions: jsonb("permissions").default({
    viewDashboard: true,
    addTransaction: true,
    viewClients: true,
    addClient: true,
    viewDebts: true,
    viewContracts: true,
  }),

  createdAt: timestamp("created_at").defaultNow(),
});

// 🌟 نوی ټیبل: د اډمین لخوا کارمند ته د پیسو ورکول (د تبادلې له نرخ سره)
export const fundTransfers = pgTable("fund_transfers", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id")
    .notNull()
    .references(() => users.id),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => users.id),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: currencyEnum("currency").default("AFN").notNull(),

  // 🌟 دا دوه لاینونه نوي دي د تبادلې د حساب لپاره
  rate: decimal("rate", { precision: 15, scale: 4 }).default("1"),
  deductedAfn: decimal("deducted_afn", { precision: 15, scale: 2 }).default(
    "0.00",
  ),

  description: text("description"),
  transferDate: timestamp("transfer_date").defaultNow(),
});

export const userWallets = pgTable("user_wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  currency: currencyEnum("currency").notNull(),
  baseCapital: decimal("base_capital", { precision: 15, scale: 2 }).default(
    "0.00",
  ),
  currentBalance: decimal("current_balance", {
    precision: 15,
    scale: 2,
  }).default("0.00"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clientsVendors = pgTable("clients_vendors", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id), // دا مشتري چا ثبت کړی؟
  name: varchar("name", { length: 150 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  type: varchar("type", { length: 50 }),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id), // دا قرارداد چا ثبت کړی؟
  clientId: integer("client_id")
    .notNull()
    .references(() => clientsVendors.id, { onDelete: "restrict" }),
  title: varchar("title", { length: 255 }).notNull(),
  totalValue: decimal("total_value", { precision: 15, scale: 2 }).default(
    "0.00",
  ),
  startDate: date("start_date"),
  endDate: date("end_date"),
  status: varchar("status", { length: 50 }).default("Active"),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
});

export const paymentMethods = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  contractId: integer("contract_id").references(() => contracts.id, {
    onDelete: "set null",
  }),
  clientVendorId: integer("client_vendor_id")
    .notNull()
    .references(() => clientsVendors.id, { onDelete: "restrict" }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "restrict" }),
  paymentMethodId: integer("payment_method_id")
    .notNull()
    .references(() => paymentMethods.id, { onDelete: "restrict" }),

  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: currencyEnum("currency").default("AFN").notNull(),

  transactionDate: date("transaction_date").defaultNow().notNull(),
  type: transactionTypeEnum("type").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const debts = pgTable("debts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  clientId: integer("client_id")
    .references(() => clientsVendors.id)
    .notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 15, scale: 2 }).default(
    "0.00",
  ),
  currency: varchar("currency", { length: 10 }).notNull().default("AFN"),
  type: varchar("type", { length: 20 }).notNull(),
  dueDate: timestamp("due_date"),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull().default("Pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ==========================================
// 3. RELATIONSHIPS
// ==========================================
export const usersRelations = relations(users, ({ many }) => ({
  transactions: many(transactions),
  wallets: many(userWallets),
  clients: many(clientsVendors),
  debts: many(debts),
  contracts: many(contracts),
  receivedTransfers: many(fundTransfers, {
    relationName: "employee_transfers",
  }),
}));

export const fundTransfersRelations = relations(fundTransfers, ({ one }) => ({
  admin: one(users, {
    fields: [fundTransfers.adminId],
    references: [users.id],
    relationName: "admin_transfers",
  }),
  employee: one(users, {
    fields: [fundTransfers.employeeId],
    references: [users.id],
    relationName: "employee_transfers",
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  contract: one(contracts, {
    fields: [transactions.contractId],
    references: [contracts.id],
  }),
  clientVendor: one(clientsVendors, {
    fields: [transactions.clientVendorId],
    references: [clientsVendors.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  paymentMethod: one(paymentMethods, {
    fields: [transactions.paymentMethodId],
    references: [paymentMethods.id],
  }),
}));

export const clientsVendorsRelations = relations(
  clientsVendors,
  ({ one, many }) => ({
    user: one(users, {
      fields: [clientsVendors.userId],
      references: [users.id],
    }),
    contracts: many(contracts),
    transactions: many(transactions),
    debts: many(debts),
  }),
);

export const contractsRelations = relations(contracts, ({ one, many }) => ({
  user: one(users, { fields: [contracts.userId], references: [users.id] }),
  client: one(clientsVendors, {
    fields: [contracts.clientId],
    references: [clientsVendors.id],
  }),
  transactions: many(transactions),
}));

export const debtsRelations = relations(debts, ({ one }) => ({
  user: one(users, { fields: [debts.userId], references: [users.id] }),
  client: one(clientsVendors, {
    fields: [debts.clientId],
    references: [clientsVendors.id],
  }),
}));
