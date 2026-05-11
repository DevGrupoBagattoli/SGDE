"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { UserModal } from "@/components/organisms/user-modal"
import { UsersList } from "@/components/organisms/users-list"
import { useSession } from "@/hooks/use-session"
import {
  apiCreateUser,
  apiDeleteUser,
  apiGetUsers,
  apiUpdateUser,
  UserDto,
} from "@/lib/api"
import { DashboardHero } from "@/components/organisms/dashboard-hero"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function UsersDashboard() {
  const router = useRouter()
  const { session, status, logout } = useSession()

  const [users, setUsers] = useState<UserDto[]>([])
  const [isBooting, setIsBooting] = useState(true)
  const [globalError, setGlobalError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserDto | null>(null)

  const [userToDelete, setUserToDelete] = useState<UserDto | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (status !== "authenticated" || !session) return

    // Apenas gestores podem acessar
    if (session.role !== "gestor") {
      router.replace("/dashboard")
      return
    }

    const bootstrap = async () => {
      try {
        const loadedUsers = await apiGetUsers()
        setUsers(loadedUsers)
      } catch (error) {
        setGlobalError(
          error instanceof Error ? error.message : "Falha ao carregar usuários"
        )
      } finally {
        setIsBooting(false)
      }
    }

    void bootstrap()
  }, [status, session, router])

  const handleCreateOrUpdateUser = async (data: {
    name: string
    role: "gestor" | "eletricista"
    password?: string
  }) => {
    setGlobalError("")
    setSuccessMessage("")

    if (editingUser) {
      const response = await apiUpdateUser(editingUser.id, data)
      setUsers((current) =>
        current.map((u) => (u.id === editingUser.id ? response.data.user : u))
      )
      setSuccessMessage("Usuário atualizado com sucesso.")
    } else {
      const response = await apiCreateUser(data)
      setUsers((current) => [...current, response.data.user])
      setSuccessMessage("Usuário criado com sucesso.")
    }

    setIsModalOpen(false)
    setEditingUser(null)
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return

    setGlobalError("")
    setSuccessMessage("")
    setIsDeleting(true)

    try {
      await apiDeleteUser(userToDelete.id)
      setUsers((current) => current.filter((u) => u.id !== userToDelete.id))
      setSuccessMessage("Usuário excluído com sucesso.")
      setUserToDelete(null)
    } catch (error) {
      setGlobalError(
        error instanceof Error ? error.message : "Falha ao excluir usuário"
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const handleLogout = () => {
    void logout()
  }

  if (status === "loading" || status === "unauthenticated" || isBooting || !session) {
    return (
      <main className="grid min-h-svh place-items-center bg-slate-100 text-slate-700">
        Carregando...
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-slate-100 text-slate-950">
      <DashboardHero
        isManager={true}
        session={session}
        totalDemands={0} // Não estamos mostrando demandas aqui, mas o componente requer
        onCreateDemand={() => router.push("/dashboard")}
        onLogout={handleLogout}
      />

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Usuários
            </h2>
            <p className="text-sm text-slate-500">
              Gerencie os gestores e eletricistas do sistema.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingUser(null)
              setIsModalOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo usuário
          </Button>
        </div>

        {globalError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {globalError}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            {successMessage}
          </div>
        ) : null}

        <UsersList
          users={users}
          currentUserId={undefined} // O session atual não expõe o ID
          onEdit={(user) => {
            setEditingUser(user)
            setIsModalOpen(true)
          }}
          onDelete={setUserToDelete}
        />
      </section>

      {isModalOpen ? (
        <UserModal
          key={editingUser ? editingUser.id : "new"}
          user={editingUser}
          onClose={() => {
            setIsModalOpen(false)
            setEditingUser(null)
          }}
          onSave={handleCreateOrUpdateUser}
        />
      ) : null}

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && !isDeleting && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário <strong>{userToDelete?.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              onClick={(e) => {
                e.preventDefault()
                void handleDeleteUser()
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
