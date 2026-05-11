import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  const hasCookie = request.cookies.has("sgde_access")
  const isLoginPage = request.nextUrl.pathname.startsWith("/login")
  const isApiRoute = request.nextUrl.pathname.startsWith("/api")

  if (isApiRoute) {
    return NextResponse.next()
  }

  if (!hasCookie && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (hasCookie && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico|jpg|jpeg|webp|gif|woff2)$).*)",
  ],
}
