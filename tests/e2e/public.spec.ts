import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const path of ["/", "/auth/verify?email=ab.cd@iitgn.ac.in"]) {
  test(`${path} has no accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });
}

test("pages send security headers and a nonce-based CSP", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("scripts run under the CSP without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("Your college email").fill("someone@caa.iitgn.ac.in");
  // The fixed "@iitgn.ac.in" ending hides once a full email is typed.
  await expect(page.locator("#email + span")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("rejects an outside email before sending anything", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Your college email").fill("someone@gmail.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText("Use your @iitgn.ac.in email.")).toBeVisible();
});

test("signed-out visitors are sent to the landing page", async ({ page }) => {
  await page.goto("/discover");
  await expect(page).toHaveURL(/\/$/);
});

test("the landing demos respond to taps", async ({ page }) => {
  await page.goto("/");
  const going = page.getByRole("button", { name: "I'm going" });
  await going.click();
  await expect(page.getByRole("button", { name: "You're going" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("15", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Ask to join" }).click();
  await expect(page.getByText("Rohan let you in. See you on court at 6.")).toBeVisible();

  await page.getByRole("button", { name: /Wave at Ananya/ }).click();
  await expect(page.getByText("Ananya waved back")).toBeVisible();

  await page.getByRole("switch", { name: "Show me as going" }).click();
  await expect(page.getByText("One more person is going")).toBeVisible();
});
