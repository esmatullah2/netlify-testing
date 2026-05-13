import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "./schema.js";
const pool = new Pool({
  connectionString:
    "postgresql://neondb_owner:npg_nUvumABV41Qy@ep-winter-fire-ao38vf86-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
});

export const db = drizzle(pool, { schema });
