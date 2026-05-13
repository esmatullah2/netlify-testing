CREATE TYPE "public"."currency" AS ENUM('AFN', 'USD', 'PKR');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('Income', 'Expense', 'Capital');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('Admin', 'User');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients_vendors" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" varchar(150) NOT NULL,
	"phone" varchar(20),
	"type" varchar(50),
	"address" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"client_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"total_value" numeric(15, 2) DEFAULT '0.00',
	"start_date" date,
	"end_date" date,
	"status" varchar(50) DEFAULT 'Active'
);
--> statement-breakpoint
CREATE TABLE "debts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"client_id" integer NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"paid_amount" numeric(15, 2) DEFAULT '0.00',
	"currency" varchar(10) DEFAULT 'AFN' NOT NULL,
	"type" varchar(20) NOT NULL,
	"due_date" timestamp,
	"description" text,
	"status" varchar(20) DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fund_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" "currency" DEFAULT 'AFN' NOT NULL,
	"rate" numeric(15, 4) DEFAULT '1',
	"deducted_afn" numeric(15, 2) DEFAULT '0.00',
	"description" text,
	"transfer_date" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"contract_id" integer,
	"client_vendor_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"payment_method_id" integer NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" "currency" DEFAULT 'AFN' NOT NULL,
	"transaction_date" date DEFAULT now() NOT NULL,
	"type" "transaction_type" NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"currency" "currency" NOT NULL,
	"base_capital" numeric(15, 2) DEFAULT '0.00',
	"current_balance" numeric(15, 2) DEFAULT '0.00',
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(150) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'User',
	"permissions" jsonb DEFAULT '{"viewDashboard":true,"addTransaction":true,"viewClients":true,"addClient":true,"viewDebts":true,"viewContracts":true}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "clients_vendors" ADD CONSTRAINT "clients_vendors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_id_clients_vendors_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients_vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_client_id_clients_vendors_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients_vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_transfers" ADD CONSTRAINT "fund_transfers_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_transfers" ADD CONSTRAINT "fund_transfers_employee_id_users_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_client_vendor_id_clients_vendors_id_fk" FOREIGN KEY ("client_vendor_id") REFERENCES "public"."clients_vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;