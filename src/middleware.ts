import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Exclude: login, next-auth, Next.js internals, static files,
    // AND the backend/ws proxy paths (they're internal server-to-server).
    "/((?!login|api/auth|backend|ws|_next/static|_next/image|favicon.ico).*)",
  ],
};
