import Link from "next/link";
import { Logo } from "@/components/ui";
import { InstallGuide } from "./install-guide";

export const metadata = {
  title: "Add KNOT to your phone",
  description: "Put KNOT on your home screen so it opens like an app, with notifications.",
};

// A public page, so the link can be shared before people sign up.
export default function InstallPage() {
  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-14">
      <Link href="/" className="inline-flex rounded-xl" aria-label="KNOT home">
        <Logo />
      </Link>
      <h1 className="font-display mt-8 text-[34px] leading-[1.05] font-extrabold">Put KNOT on your home screen</h1>
      <p className="mt-3 text-[16px] text-soft">It opens like an app: full screen, one tap away, with notifications. No app store, nothing to download. Takes 20 seconds.</p>
      <InstallGuide />
    </main>
  );
}
