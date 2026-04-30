import { auth } from "@/auth";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const path = nextUrl.pathname;

  if (!isLoggedIn && (path.startsWith("/dashboard") || path.startsWith("/customers"))) {
    const u = new URL("/", nextUrl.origin);
    u.searchParams.set("callbackUrl", path + nextUrl.search);
    return Response.redirect(u);
  }

  if (isLoggedIn && (path === "/" || path.startsWith("/login"))) {
    return Response.redirect(new URL("/dashboard", nextUrl.origin));
  }

  if (isLoggedIn && path.startsWith("/setup")) {
    return Response.redirect(new URL("/dashboard", nextUrl.origin));
  }

  return undefined;
});

export const config = {
  matcher: ["/", "/dashboard/:path*", "/customers/:path*", "/login", "/setup"],
};
