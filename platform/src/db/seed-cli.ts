import { createPrismaClient } from "./client";
import { seedDemoData } from "./seed";

async function main() {
  const reset = process.argv.includes("--reset");
  const prisma = createPrismaClient();
  try {
    const result = await seedDemoData(prisma, { reset });
    console.log(
      `Seeded ${result.users} users and ${result.cases} new KYC cases${reset ? " (after reset)" : ""}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Failed to seed database:", err);
  process.exit(1);
});
