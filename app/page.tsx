import { redirect } from "next/navigation";

// Transactions is the only real page in the app right now. Once auth
// exists, this becomes the authed-vs-not branch point (dashboard vs.
// login) described in the project plan.
export default function Home() {
  redirect("/transactions");
}
