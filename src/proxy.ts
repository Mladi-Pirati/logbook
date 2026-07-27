import { auth } from "@/auth";

export default auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  // api/integrations routes authenticate with their own bearer secret
  matcher: [
    "/((?!api/auth|api/integrations|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
