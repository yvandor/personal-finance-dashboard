import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "@/components/ui/Modal";

// A minimal harness mirroring how every real caller uses Modal (e.g.
// TransactionFormDialog/BudgetFormDialog): a trigger button toggles `open`,
// and the trigger is the element focus should return to on close -- the
// same contract those dialogs depend on.
function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          onClose?.();
        }}
        title="Test dialog"
      >
        <input aria-label="Field inside dialog" />
      </Modal>
    </>
  );
}

describe("Modal", () => {
  it("has a valid accessible name via aria-labelledby", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    expect(screen.getByRole("dialog", { name: "Test dialog" })).toBeInTheDocument();
  });

  it("moves focus into the dialog when opened", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
  });

  it("returns focus to the trigger when closed via the Close button", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("calls onClose when the native cancel event fires (the Escape-key contract)", async () => {
    // Real browsers fire a "cancel" event on an open <dialog> when Escape
    // is pressed -- jsdom doesn't implement this natively (its
    // HTMLDialogElement is an unimplemented stub, see tests/setup-dom.ts),
    // so this dispatches the event a real browser would send, to verify
    // Modal's own onCancel={onClose} wiring rather than the platform
    // trigger itself.
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));

    const dialog = screen.getByRole("dialog");
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when clicking the backdrop but not when clicking dialog content", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));

    // Clicking the input inside the dialog must not close it.
    await user.click(screen.getByLabelText("Field inside dialog"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Clicking the dialog element itself (its own padding, i.e. the
    // backdrop area) -- e.target === the dialog -- closes it, per Modal's
    // onClick guard.
    await user.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it('keeps the "m-auto" centering class present (regression guard for the Preflight/dialog-centering fix)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    expect(screen.getByRole("dialog")).toHaveClass("m-auto");
  });
});
