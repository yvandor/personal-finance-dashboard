import { signIn } from "@/server/auth";
import { Button } from "@/components/ui/Button";

type SearchParams = Record<string, string | string[] | undefined>;

const DEFAULT_CALLBACK_URL = "/dashboard";

// Auth.js's default sign-in-error handling (no custom `pages.error` is set
// in server/auth.ts) appends one of these codes to `?error=` on redirect
// back here. This is a personal/few-user app, not a polished multi-tenant
// product (see the v1.5 plan), so the mapping is a short, plain-text
// sentence per code rather than a separate error page/route -- anything
// unrecognized falls back to a generic message.
const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "This GitHub account isn't authorized to sign in to this app.",
  Configuration: "Sign-in is misconfigured. Contact the app owner.",
  Verification: "That sign-in link is invalid or has expired.",
};

function toSingle(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Guards against an open redirect via a crafted `callbackUrl` query param --
// proxy.ts always sends a same-origin relative path, but this page also
// renders straight from the URL an unauthenticated visitor typed, so it
// can't assume that. Only a path starting with a single "/" is honored;
// "//evil.com" (browsers treat this as protocol-relative) and any
// absolute/external URL fall back to the default landing page instead.
function safeCallbackUrl(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return DEFAULT_CALLBACK_URL;
  }
  return raw;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(toSingle(params.callbackUrl));
  const errorCode = toSingle(params.error);
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] ?? "Something went wrong signing in. Please try again.") : undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6">
        <h1 className="text-lg font-semibold text-foreground">Sign in</h1>
        <p className="mt-1 text-sm text-muted">Personal finance dashboard</p>

        {errorMessage && (
          <p role="alert" aria-live="polite" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {errorMessage}
          </p>
        )}

        {/* Inline "use server" action, not a bound `signIn` reference:
            `signIn`'s declared signature takes an optional
            authorizationParams argument that TypeScript won't structurally
            accept where a `(formData: FormData) => ...` form action is
            expected. This is the pattern Auth.js's own docs use for
            exactly this case. */}
        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: callbackUrl });
          }}
          className="mt-6"
        >
          <Button type="submit" className="w-full">
            Sign in with GitHub
          </Button>
        </form>
      </div>
    </div>
  );
}
