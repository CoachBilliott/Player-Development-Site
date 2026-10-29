import { describe, expect, it } from "vitest";
import { BLANK_QUIZ_CSV, EXAMPLE_QUIZ_CSV, parseQuizCsv } from "./quizImport";
describe("Google Sheets CSV import", () => {
  it("imports every example type and keeps keys separate", () => {
    const r = parseQuizCsv(EXAMPLE_QUIZ_CSV);
    expect(r.issues).toEqual([]);
    expect(r.quiz?.questions).toHaveLength(3);
    expect(r.quiz?.totalPoints).toBe(4);
    expect(r.quiz?.questions[0]).not.toHaveProperty("correct");
    expect(r.quiz?.keys[0].correct).toBe(0);
  });
  it("accepts UTF8 BOM, quoted commas, escaped quotes and multiline cells", () => {
    const csv =
      "\uFEFF" +
      BLANK_QUIZ_CSV +
      'q1,1,multiple_choice,"Which, ""sample""?\nChoose.",First,Second,,,B,2,"Example"\r\n';
    expect(parseQuizCsv(csv).quiz?.questions[0].question).toBe(
      'Which, "sample"?\nChoose.',
    );
  });
  it.each([
    ["duplicate IDs", EXAMPLE_QUIZ_CSV.replace("sample_2", "sample_1")],
    ["duplicate order", EXAMPLE_QUIZ_CSV.replace("sample_2,2", "sample_2,1")],
    ["bad key", EXAMPLE_QUIZ_CSV.replace(",,,A,1", ",,,D,1")],
    ["bad points", EXAMPLE_QUIZ_CSV.replace(",,,A,1", ",,,A,-1")],
    ["missing quote", BLANK_QUIZ_CSV + '"missing'],
    ["wrong columns", "wrong,headers"],
    ["blank file", BLANK_QUIZ_CSV],
    ["encoding", "\0" + EXAMPLE_QUIZ_CSV],
    ["size", "x".repeat(256 * 1024 + 1)],
  ])("rejects %s atomically", (_, csv) => {
    const r = parseQuizCsv(csv);
    expect(r.quiz).toBeNull();
    expect(r.issues.length).toBeGreaterThan(0);
  });
  it("rejects written answer keys and missing MC choices", () => {
    expect(
      parseQuizCsv(EXAMPLE_QUIZ_CSV.replace(",,,,,,2", ",,,,,A,2")).quiz,
    ).toBeNull();
    expect(
      parseQuizCsv(EXAMPLE_QUIZ_CSV.replace("START,FINISH", "START,")).quiz,
    ).toBeNull();
  });
});
