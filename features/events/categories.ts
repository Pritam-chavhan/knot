export const CATEGORIES = [
  { id: "talk", label: "Talks" },
  { id: "workshop", label: "Workshops" },
  { id: "tech", label: "Tech" },
  { id: "sports", label: "Sports" },
  { id: "cultural", label: "Cultural" },
  { id: "music", label: "Music" },
  { id: "games", label: "Games" },
  { id: "study", label: "Study" },
  { id: "club", label: "Clubs" },
  { id: "social", label: "Hangouts" },
  { id: "other", label: "Other" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];
export const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? "Other";

export type Source = "official" | "community" | "student_hosted";
// Institute and club events share one "Campus" tag; plans students start
// keep their own.
export const SOURCE_TAG: Record<Source, "campus" | "student"> = {
  official: "campus",
  community: "campus",
  student_hosted: "student",
};
