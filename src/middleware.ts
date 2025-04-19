import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const unprotectedRoute = createRouteMatcher([
    '/',
    '/login(.*)',
    '/signup(.*)',
    '/contact',
    '/pricing',
    '/privacy',
    '/terms',
    '/api/webhooks(.*)', //? This is the unprotected api route for the webhook integration using third party services.
])

export default clerkMiddleware(async (auth, req) => {
    if (!unprotectedRoute(req)) await auth.protect();
});

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        // '/(api|trpc)(.*)',
    ],
};