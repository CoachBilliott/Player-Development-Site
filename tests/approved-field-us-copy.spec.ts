import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { disableBackend } from "./backendFixture";

test.beforeEach(async ({ context }) => disableBackend(context));
test("approved field retains exact source pixels and both endzones across layouts", async ({
  page,
}, info) => {
  const original = readFileSync(
    "design/approved-field/repformed-horizontal-football-field.png",
  );
  expect(createHash("sha256").update(original).digest("hex")).toBe(
    "2403ef999a7d8432dab81cb2ce9e1a9eb969643774837da38e70c3db2201f0df",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./#home");
    const section = page.locator("#about-repformed");
    const image = section.getByRole("img", {
      name: "Repformed-branded football field illustration",
      exact: true,
    });
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((node: HTMLImageElement) => node.decode());
    expect(
      await image.evaluate((node: HTMLImageElement) => [
        node.naturalWidth,
        node.naturalHeight,
      ]),
    ).toEqual([1672, 941]);
    const box = await image.boundingBox();
    expect(Math.abs(box!.width / box!.height - 1672 / 941)).toBeLessThan(0.01);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    await expect(image).toHaveCSS("object-fit", "contain");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await section.screenshot({
      path: info.outputPath(`about-field-${width}.png`),
    });
  }
  const image = page.locator("#about-repformed img");
  const pixels = await image.evaluate(async (node: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = node.naturalWidth;
    canvas.height = node.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(node, 0, 0);
    const hash = await crypto.subtle.digest(
      "SHA-256",
      context.getImageData(0, 0, canvas.width, canvas.height).data,
    );
    return Array.from(new Uint8Array(hash), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join("");
  });
  expect(pixels).toBe(
    "0be832c4e056ea541aa6f227595c36e3eaf0427534a9264602078b4d2141ce3e",
  );
});
test("public English uses Practice without changing approved package terms", async ({
  page,
}) => {
  await page.goto("./#home");
  await expect(
    page.getByText("Practice with purpose.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(page.locator("body")).not.toContainText(/\bpractis(?:e|ing)\b/i);
  await page.goto("./#membership");
  await expect(page.locator("body")).toContainText("USD per athlete");
  for (const amount of ["$9.99", "$19.99", "$39.99", "$69.99"])
    await expect(page.locator("body")).toContainText(amount);
});
