import { expect, it } from "vitest";
import { reviewClipSelectionError as error } from "./reviewClipSelection";

it("accepts three 60-second clips as one review without implying paid credits", () => {
  expect(error([60, 60, 60], 3)).toBe("");
  expect(error([59.9], 1)).toBe("");
  expect(error([30, 45], 2)).toBe("");
});
it("rejects unsupported individual or empty footage instead of trusting totals", () => {
  for (const clips of [
    [],
    [180],
    [60.001],
    [0],
    [-1],
    [NaN],
    [Infinity],
    [1, 1, 1, 1],
  ])
    expect(error(clips, 5)).not.toBe("");
});
it("requires actual storage capacity even if a package includes more reviews", () => {
  expect(error([60, 60, 60], 2)).toContain("not enough stored-clip spaces");
  expect(error([1], 0)).not.toBe("");
  for (const slots of [-1, NaN, Infinity, 1.5])
    expect(error([1], slots)).toContain("could not be confirmed");
});
