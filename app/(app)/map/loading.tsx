// The map's backdrop while the page loads.
export default function Loading() {
  return <main className="fixed inset-x-0 top-0 bottom-0 mx-auto w-full max-w-md animate-pulse bg-[#e8e4da] motion-reduce:animate-none" aria-busy="true" aria-label="Loading map" />;
}
