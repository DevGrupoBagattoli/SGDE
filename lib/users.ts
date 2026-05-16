/** Alinhado a `createUserSchema` / `updateUserSchema` em `lib/server/users.ts`. */
export const USER_NAME_MIN_LENGTH = 2
export const USER_PASSWORD_MIN_LENGTH = 4

export const validateUserPassword = (
  password: string,
  options: { required: boolean }
): string | null => {
  if (!password) {
    return options.required ? "A senha é obrigatória para novos usuários." : null
  }
  if (password.length < USER_PASSWORD_MIN_LENGTH) {
    return `A senha deve ter pelo menos ${USER_PASSWORD_MIN_LENGTH} caracteres.`
  }
  return null
}

export const validateUserName = (name: string): string | null => {
  const trimmed = name.trim()
  if (trimmed.length < USER_NAME_MIN_LENGTH) {
    return `O nome deve ter pelo menos ${USER_NAME_MIN_LENGTH} caracteres.`
  }
  return null
}
