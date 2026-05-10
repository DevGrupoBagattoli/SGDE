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
