import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle/migrations",
  schema: "./drizzle/db/schema.js",
  dialect: "postgresql",
  dbCredentials: {
    url: "postgresql://neondb_owner:npg_nUvumABV41Qy@ep-winter-fire-ao38vf86-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  },
});
