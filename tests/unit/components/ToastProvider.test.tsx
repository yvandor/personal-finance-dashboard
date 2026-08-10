import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "@/components/ui/ToastProvider";

// The undo-promise-resolution/timeout/flushSync-inside-a-pending-transition
// behavior is exercised thoroughly by the three Delete*Button test files
// (real-world callers); this file covers ToastProvider's own contract in
// isolation: rendering multiple toasts at once, and the action-less notice.

function ToastTrigger() {
  const { showToast, showNotice } = useToast();
  return (
    <>
      <button type="button" onClick={() => showToast({ message: "First deleted" })}>
        Trigger first
      </button>
      <button type="button" onClick={() => showToast({ message: "Second deleted" })}>
        Trigger second
      </button>
      <button type="button" onClick={() => showNotice("Something failed")}>
        Trigger notice
      </button>
    </>
  );
}

describe("ToastProvider", () => {
  it("renders multiple concurrent toasts, each with its own Undo button", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Trigger first" }));
    await user.click(screen.getByRole("button", { name: "Trigger second" }));

    await waitFor(() => expect(screen.getByText("First deleted")).toBeInTheDocument());
    expect(screen.getByText("Second deleted")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Undo" })).toHaveLength(2);
  });

  it("dismissing one toast's Undo leaves the other toast alone", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Trigger first" }));
    await user.click(screen.getByRole("button", { name: "Trigger second" }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Undo" })).toHaveLength(2));

    await user.click(screen.getAllByRole("button", { name: "Undo" })[0]);

    expect(screen.queryByText("First deleted")).not.toBeInTheDocument();
    expect(screen.getByText("Second deleted")).toBeInTheDocument();
  });

  it("showNotice renders a plain message with no action button", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Trigger notice" }));

    await waitFor(() => expect(screen.getByText("Something failed")).toBeInTheDocument());
    const notice = screen.getByText("Something failed").closest('[role="status"]');
    expect(notice).not.toBeNull();
    expect(notice?.querySelector("button")).toBeNull();
  });

  it("throws a clear error when useToast is called outside a ToastProvider", () => {
    function Broken() {
      useToast();
      return null;
    }
    // React logs this to console.error too; suppressing isn't necessary for
    // the test to pass, but render() itself will throw synchronously here.
    expect(() => render(<Broken />)).toThrow("useToast must be used within a ToastProvider");
  });
});
