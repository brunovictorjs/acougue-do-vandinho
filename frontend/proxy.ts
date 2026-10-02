import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PROTECTED = ["/pedidos", "/perfil", "/favoritos", "/checkout", "/cadastro", "/entregador", "/admin"]

/**
 * Cheap gate: pages that need an account redirect to /entrar when there is no
 * session cookie. Roles and onboarding are enforced by the API and the pages.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const needsSession = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  if (needsSession && !request.cookies.has("vnd_session")) {
    const url = request.nextUrl.clone()
    url.pathname = "/entrar"
    url.search = `?next=${encodeURIComponent(pathname + search)}`
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|logo.png).*)"],
}
