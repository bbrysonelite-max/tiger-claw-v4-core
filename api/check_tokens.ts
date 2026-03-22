import { getPoolCounts } from './src/services/db.js';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  try {
    const counts = await getPoolCounts();
    console.log("Token Pool Status:", counts);
  } catch (error) {
    console.error("Database query failed:", error);
  }
  process.exit(0);
}

main();
