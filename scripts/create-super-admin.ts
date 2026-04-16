import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = "imoruj@hotmail.com";
  const tempPassword = "Setup@1234";

  // Upsert a bootstrap organization
  const org = await db.organization.upsert({
    where: { slug: "sams-platform" },
    update: { isActive: true },
    create: {
      name: "SAMS Platform",
      slug: "sams-platform",
      email: "admin@sams-platform.com",
      phone: "+2348000000000",
      address: "SAMS Platform HQ",
      state: "Lagos",
      lga: "Lagos Island",
      subscriptionPlan: "PREMIUM",
      isActive: true,
    },
  });

  console.log("✅ Organization:", org.name, `(${org.id})`);

  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const user = await db.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: "SUPER_ADMIN",
      organizationId: org.id,
      emailVerified: true,
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      email,
      firstName: "Super",
      lastName: "Admin",
      passwordHash,
      role: "SUPER_ADMIN",
      organizationId: org.id,
      emailVerified: true,
      isActive: true,
    },
  });

  console.log("✅ Super admin ready:");
  console.log("   Email   :", user.email);
  console.log("   Password:", tempPassword);
  console.log("   Org     :", org.name);
  console.log("   Role    :", user.role);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
