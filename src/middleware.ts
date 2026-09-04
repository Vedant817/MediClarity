import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const unprotectedRoute = createRouteMatcher([
    '/',
    '/login(.*)',
    '/signup(.*)',
    '/contact',
    '/pricing',
    '/privacy',
    '/terms',
    '/share(.*)',
    '/api/share/(.*)',
    '/api/v1(.*)',
    '/api/webhooks(.*)', //? This is the unprotected api route for the webhook integration using third party services.
    // Exact service-to-service endpoint; it authenticates the Cloudflare Worker
    // with a timestamped, single-use HMAC request inside the route.
    '/api/voice/context',
])

// These APIs enforce Clerk auth in the route itself so callers receive a
// machine-readable 401 instead of a middleware rewrite to a 404 page.
const routeAuthenticatedApi = createRouteMatcher([
    '/api/user-data',
    '/api/upload',
    '/api/ocr',
    '/api/summaries',
    '/api/translate',
    '/api/availability',
    '/api/reports(.*)',
    '/api/chat(.*)',
    '/api/chatbot(.*)',
    '/api/appointment/scheduler(.*)',
    '/api/labs',
    '/api/triage',
    '/api/meds(.*)',
    '/api/education',
    '/api/settings',
    '/api/billing(.*)',
    '/api/share',
    '/api/api-keys(.*)',
    '/api/lab-brand(.*)',
    '/api/providers',
    // Keep this exact: all other voice endpoints remain protected by default.
    '/api/voice/session',
])

export default clerkMiddleware(async (auth, req) => {
    if (!unprotectedRoute(req) && !routeAuthenticatedApi(req)) await auth.protect();
});

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        // '/(api|trpc)(.*)',
    ],
};
