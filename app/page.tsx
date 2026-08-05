import { redirect } from "next/navigation";

// Once auth exists, this becomes the authed-vs-not branch point (dashboard
// vs. login) described in the project plan.
export default function Home() {
  redirect("/dashboard");
}
