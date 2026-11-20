import { requireMember } from "@/lib/auth";
import { WelcomeTour } from "./welcome-tour";

export const metadata = { title: "Welcome to KNOT" };

// New students land here first. Anyone can replay it from their profile.
export default async function Welcome() {
  const { profile } = await requireMember({ allowNotOnboarded: true });
  const returning = !!profile.onboarded_at;
  return <WelcomeTour finishHref={returning ? "/discover" : "/onboarding"} finishLabel={returning ? "Back to KNOT" : "Set up my profile"} />;
}
