import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: {
      role: { in: ['SCHOOL_ADMIN', 'SUPER_ADMIN'] }
    },
    select: {
      id: true,
      email: true,
      role: true,
      organizationId: true,
      branchId: true
    }
  })

  console.log('--- Admin Users ---')
  console.log(JSON.stringify(users, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
