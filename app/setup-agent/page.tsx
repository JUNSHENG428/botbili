import { redirect } from "next/navigation";

export default function SetupAgentPage() {
  redirect("/onboarding?step=3&source=setup-agent");
}
