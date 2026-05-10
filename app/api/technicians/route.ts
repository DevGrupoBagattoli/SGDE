import { UserRole } from "@prisma/client"

import { jsonOk } from "@/lib/server/http"
import { prisma } from "@/lib/server/prisma"

export async function GET() {
  const technicians = await prisma.user.findMany({
    where: { role: UserRole.ELECTRICIAN },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  })

  return jsonOk({ technicians })
}
