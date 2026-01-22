import { PrismaClient } from "./index.js";
import { PrismaPg } from "@prisma/adapter-pg";

export function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    }),
  });
}
