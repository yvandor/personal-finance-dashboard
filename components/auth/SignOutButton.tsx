import { signOut } from "@/server/auth";
import { Button } from "@/components/ui/Button";

interface SignOutButtonProps {
  className?: string;
}

// A Server Component -- no client JS needed. `signOut` (server/auth.ts) is
// Auth.js's Server Action for this app; calling it from an inline `"use
// server"` action deletes the database Session row (see server/auth.ts's
// `session: { strategy: "database" }` comment) as part of the same request
// that submits the form, then redirects to the sign-in page. No
// useActionState -- sign-out has no pending/error state worth showing
// before the redirect takes over.
//
// Not `action={signOut}` directly: `signOut`'s declared signature takes an
// optional `options` object (`{ redirectTo?, redirect? }`), which
// TypeScript won't structurally accept where a `(formData: FormData) =>
// ...` is expected, even though the options are all optional. Wrapping in
// an inline `"use server"` closure sidesteps the mismatch and is the
// pattern Auth.js's own docs use for this exact case.
export function SignOutButton({ className = "" }: SignOutButtonProps) {
  return (
    <form
      action={async () => {
        "use server";
        await signOut();
      }}
      className={className}
    >
      <Button type="submit" variant="ghost" className="w-full justify-start">
        {/* Decorative -- aria-hidden, matching the nav icon convention in
            lib/navigation.tsx; the button's own accessible name is still
            just "Sign out". */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4 shrink-0"
          aria-hidden="true"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5M21 12H9" />
        </svg>
        Sign out
      </Button>
    </form>
  );
}
