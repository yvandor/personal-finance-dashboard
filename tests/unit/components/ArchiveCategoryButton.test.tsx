import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArchiveCategoryButton } from "@/components/categories/ArchiveCategoryButton";
import { archiveCategoryAction, unarchiveCategoryAction } from "@/server/actions/categories";

vi.mock("@/server/actions/categories", () => ({
  archiveCategoryAction: vi.fn(),
  unarchiveCategoryAction: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(archiveCategoryAction).mockReset();
  vi.mocked(unarchiveCategoryAction).mockReset();
});

describe("ArchiveCategoryButton (active category)", () => {
  it("requires an explicit confirm -- opening the dialog alone never calls the action", async () => {
    const user = userEvent.setup();
    render(<ArchiveCategoryButton id="c1" name="Groceries" isArchived={false} transactionCount={0} />);

    await user.click(screen.getByRole("button", { name: "Archive Groceries" }));
    expect(screen.getByRole("dialog", { name: "Archive category?" })).toBeInTheDocument();
    expect(archiveCategoryAction).not.toHaveBeenCalled();
  });

  it("mentions the transaction count in the confirm description when in use", async () => {
    const user = userEvent.setup();
    render(<ArchiveCategoryButton id="c1" name="Groceries" isArchived={false} transactionCount={3} />);

    await user.click(screen.getByRole("button", { name: "Archive Groceries" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("3 transactions");
    expect(screen.getByRole("dialog")).toHaveTextContent("nothing is deleted");
  });

  it("clicking Cancel closes the dialog without calling the action", async () => {
    const user = userEvent.setup();
    render(<ArchiveCategoryButton id="c1" name="Groceries" isArchived={false} transactionCount={0} />);

    await user.click(screen.getByRole("button", { name: "Archive Groceries" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(archiveCategoryAction).not.toHaveBeenCalled();
  });

  it("clicking the confirm button calls archiveCategoryAction with the category id", async () => {
    const user = userEvent.setup();
    vi.mocked(archiveCategoryAction).mockResolvedValueOnce({ ok: true, data: undefined });
    render(<ArchiveCategoryButton id="c1" name="Groceries" isArchived={false} transactionCount={0} />);

    await user.click(screen.getByRole("button", { name: "Archive Groceries" }));
    await user.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(archiveCategoryAction).toHaveBeenCalledWith("c1", null));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows the error and keeps the dialog open when the action fails", async () => {
    const user = userEvent.setup();
    vi.mocked(archiveCategoryAction).mockResolvedValueOnce({ ok: false, error: "Something went wrong." });
    render(<ArchiveCategoryButton id="c1" name="Groceries" isArchived={false} transactionCount={0} />);

    await user.click(screen.getByRole("button", { name: "Archive Groceries" }));
    await user.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong."));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("ArchiveCategoryButton (archived category)", () => {
  it("shows a Restore button with no confirmation step", async () => {
    const user = userEvent.setup();
    vi.mocked(unarchiveCategoryAction).mockResolvedValueOnce({ ok: true, data: undefined });
    render(<ArchiveCategoryButton id="c1" name="Groceries" isArchived={true} transactionCount={0} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restore" }));

    await waitFor(() => expect(unarchiveCategoryAction).toHaveBeenCalledWith("c1", null));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows an error if unarchiving fails", async () => {
    const user = userEvent.setup();
    vi.mocked(unarchiveCategoryAction).mockResolvedValueOnce({ ok: false, error: "Something went wrong." });
    render(<ArchiveCategoryButton id="c1" name="Groceries" isArchived={true} transactionCount={0} />);

    await user.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong."));
  });
});
