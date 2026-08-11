import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { signOut } from "@/server/auth";

// server/auth.ts imports "server-only" and pulls in the real NextAuth
// config -- neither of which can load in this jsdom component-test config
// (see vitest.config.components.mts's comment on why it's separate from
// the main suite). Mocking the module boundary here matches every other
// component test that renders a form bound to a Server Action, e.g.
// tests/unit/components/DeleteBudgetButton.test.tsx mocking
// @/server/actions/budgets.
vi.mock("@/server/auth", () => ({
  signOut: vi.fn(),
}));

describe("SignOutButton", () => {
  it("renders a submit button inside a form bound to the signOut action", async () => {
    const user = userEvent.setup();
    render(<SignOutButton />);

    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button.closest("form")).not.toBeNull();

    await user.click(button);

    expect(signOut).toHaveBeenCalled();
  });

  it("applies the passed className to the wrapping form", () => {
    render(<SignOutButton className="text-muted" />);

    const form = screen.getByRole("button", { name: "Sign out" }).closest("form");
    expect(form).toHaveClass("text-muted");
  });
});
