import { auth } from "@/auth";

export default auth((req) => {
  const { nextUrl } = req;
  /** Must match a real session user — avoids treating empty session objects as logged-in (edge/auth quirks). */
  const isLoggedIn = Boolean(req.auth?.user?.email);
  const path = nextUrl.pathname;

  if (!isLoggedIn && path === "/") {
    return Response.redirect(new URL("/login", nextUrl.origin));
  }

  if (!isLoggedIn && (path.startsWith("/dashboard") || path.startsWith("/customers"))) {
    const u = new URL("/login", nextUrl.origin);
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
