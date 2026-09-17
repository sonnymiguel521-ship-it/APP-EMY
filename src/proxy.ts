import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url), 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/health|api/auth|api/v1|login|_next/static|_next/image|favicon.ico).*)"],
};
