import { NextResponse } from "next/server";

// A minimal liveness check for uptime monitoring (e.g. Vercel's own health
// checks, or an external monitor once this is actually deployed) --
// confirms the process is up and able to respond, nothing more. Doesn't
// touch the database: a DB hiccup shouldn't make an external monitor
// conclude the whole app is down when it's really a separate, more
// specific failure worth its own alert. server/env.ts's module-level
// validation already means this route couldn't be serving traffic at all
// if the server environment were misconfigured.
//
// No user data, no auth check needed -- nothing here to protect.
export async function GET() {
  return NextResponse.json(
    { status: "ok" },
    {
      headers: {
        // Never cache a liveness check -- a stale "ok" from a now-dead
        // process defeats the entire point.
        "Cache-Control": "no-store",
      },
    },
  );
}
