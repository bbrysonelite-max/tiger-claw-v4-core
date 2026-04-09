const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const result = await prisma.botToken.groupBy({
    by: ['status'],
    _count: true
  });
  console.log("Tokens in DB:", JSON.stringify(result, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
