import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const applicationId = 'ae3530af-99ef-4c83-b873-77395b6e56eb'
  
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      organizationId: true,
      branchId: true,
      payments: {
        select: {
          id: true,
          paymentType: true,
          gateway: true,
          status: true,
          receiptUrl: true,
        }
      }
    }
  })

  console.log('--- Application ---')
  console.log(JSON.stringify(application, null, 2))
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
