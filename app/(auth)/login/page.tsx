import { prisma } from "@/lib/server/prisma"
import { LoginPageClient } from "./_components/login-page-client"

export const dynamic = "force-dynamic"

export default async function LoginPage() {
  let technicians: { id: string; name: string }[] = []

  try {
    technicians = await prisma.user.findMany({
      where: { role: "ELECTRICIAN" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
  } catch {
    technicians = []
  }

  return <LoginPageClient technicians={technicians} />
}
