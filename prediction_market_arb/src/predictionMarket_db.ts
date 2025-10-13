// src/db.ts
import dotenv from 'dotenv';
import { Pool } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const pool = new Pool({
  user: process.env.DATABASE_USERNAME_HETZNER,
  host: process.env.DATABASE_HOST_HETZNER,
  database: process.env.DATABASE_NAME_HETZNER_PREDICTION_MARKETS,
  password: process.env.DATABASE_PASSWORD_HETZNER,
  port: Number(process.env.DATABASE_PORT_HETZNER),
});



