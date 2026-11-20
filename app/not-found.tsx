import { ButtonLink, KnotMark, Logo } from "@/components/ui";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-6 pb-10">
      <Logo />
      <div className="my-auto">
        <KnotMark size={96} className="text-thread" />
        <h1 className="font-display mt-6 text-[36px] leading-[1.02] font-extrabold">This page doesn&apos;t exist</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-soft">
          The link may be old, or the event may have been removed by its host.
        </p>
        <ButtonLink href="/discover" className="mt-8 h-14 w-full">
          Go to Discover
        </ButtonLink>
      </div>
    </main>
  );
}
