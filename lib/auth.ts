export type UserRole = "gestor" | "eletricista"

export type UserSession = {
  name: string
  role: UserRole
}

export const roleLabels: Record<UserRole, string> = {
  gestor: "Gestor",
  eletricista: "Eletricista",
}
