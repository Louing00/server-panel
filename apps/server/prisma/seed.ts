import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const username = process.env.ADMIN_USERNAME || 'admin';
const password = process.env.ADMIN_PASSWORD || 'admin123456';

await prisma.user.upsert({
  where: { username },
  update: { role: 'admin', status: 'active' },
  create: {
    username,
    role: 'admin',
    status: 'active',
    passwordHash: await bcrypt.hash(password, 12),
  },
});

console.log(`默认管理员已准备好: ${username}`);
await prisma.$disconnect();
