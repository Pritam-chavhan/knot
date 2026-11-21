"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { searchPeople } from "./actions";
import type { PersonCardData } from "./directory-queries";
import { PersonCard } from "./person-card";

// Suggestions until you type; live search results as you type.
export function PeopleDirectory({ suggestions, count }: { suggestions: PersonCardData[]; count: number }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonCardData[] | null>(null);
  const [pending, start] = useTransition();
  const latest = useRef("");

  useEffect(() => {
    const q = query.trim();
    latest.current = q;
    if (q.length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => {
      start(async () => {
        const rows = await searchPeople(q);
        if (latest.current === q) setResults(rows);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const searching = query.trim().length >= 2;
  const list = searching ? results : suggestions;

  return (
    <>
      <div role="search" className="sticky top-0 z-20 -mx-5 bg-paper/95 px-5 pt-3 pb-3 backdrop-blur">
        <label htmlFor="people-search" className="sr-only">
          Search people
        </label>
        <div className="flex h-13 items-center gap-2.5 rounded-full border-[1.5px] border-line bg-card px-4 focus-within:border-thread">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" className="shrink-0 text-muted" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
          </svg>
          <input
            id="people-search"
            type="search"
            inputMode="search"
            autoComplete="off"
            enterKeyHint="search"
            maxLength={60}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, programme or interest"
            className="h-12 min-w-0 flex-1 bg-transparent text-[15.5px] placeholder:text-muted/80 focus:outline-none"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-paper">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <h2 className="mt-3 text-[15px] font-bold text-soft" aria-live="polite">
        {searching
          ? pending && !results
            ? "Searching…"
            : `${results?.length ?? 0} ${results?.length === 1 ? "person" : "people"} found`
          : "People you may know"}
      </h2>

      {list && list.length > 0 ? (
        <ul className={`mt-3 grid grid-cols-2 gap-3 transition-opacity ${pending ? "opacity-60" : ""}`}>
          {list.map((p) => (
            <PersonCard key={p.id} person={p} />
          ))}
        </ul>
      ) : searching ? (
        !pending && (
          <p className="mt-6 rounded-[24px] bg-card p-5 text-center text-[15px] text-soft">
            Nobody matches &ldquo;{query.trim()}&rdquo; yet. Try a first name, a programme like &ldquo;CSE&rdquo;, or an interest.
          </p>
        )
      ) : (
        <p className="mt-6 rounded-[24px] bg-card p-5 text-center text-[15px] text-soft">
          {count === 0
            ? "You're one of the first here. Invite your friends, and they'll show up here."
            : "You're connected with everyone we'd suggest. Search to find more people."}
        </p>
      )}
    </>
  );
}
