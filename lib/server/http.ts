import { NextResponse } from "next/server"

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE"
  | "INTERNAL"

export type ApiWarning = {
  code: string
  message: string
}

type ValidationErrorDetails = {
  formErrors?: string[]
  fieldErrors?: Record<string, string[] | undefined>
}

export const jsonOk = <T>(data: T, warnings?: ApiWarning[]) => {
  return NextResponse.json({ success: true, data, warnings: warnings ?? [] })
}

export const jsonError = (
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown
) => {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
    },
    { status }
  )
}

const summarizeValidationDetails = (details?: ValidationErrorDetails) => {
  if (!details) {
    return null
  }

  const formMessages = details.formErrors?.filter(Boolean) ?? []
  const fieldMessages = Object.entries(details.fieldErrors ?? {})
    .flatMap(([field, messages]) =>
      (messages ?? []).filter(Boolean).map((message) => `${field}: ${message}`)
    )

  const combined = [...formMessages, ...fieldMessages]

  if (combined.length === 0) {
    return null
  }

  return combined.join("; ")
}

export const jsonValidationError = (
  message: string,
  details: ValidationErrorDetails,
  status = 422
) => {
  const summary = summarizeValidationDetails(details)

  return jsonError(
    status,
    "UNPROCESSABLE",
    summary ? `${message}: ${summary}` : message,
    details
  )
}
