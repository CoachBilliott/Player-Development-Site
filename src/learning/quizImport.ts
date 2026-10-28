/** Staff import validation only. Learner payloads never contain `keys`. */
export const QUIZ_COLUMNS = [
  "question_id",
  "order",
  "type",
  "question",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_answer",
  "points",
  "explanation",
] as const;
export type QuizQuestion = {
  id: string;
  order: number;
  type: "multiple_choice" | "true_false" | "written";
  question: string;
  options: string[];
  points: number;
};
export type QuizKey = {
  id: string;
  correct: number | null;
  explanation: string;
};
export type QuizImport = {
  questions: QuizQuestion[];
  keys: QuizKey[];
  totalPoints: number;
};
export type ImportIssue = { row: number; column: string; message: string };
export const BLANK_QUIZ_CSV = QUIZ_COLUMNS.join(",") + "\r\n";
export const EXAMPLE_QUIZ_CSV =
  BLANK_QUIZ_CSV +
  'sample_1,1,multiple_choice,"Which marker says START?",START,FINISH,,,A,1,"Fictional format example only."\r\nsample_2,2,true_false,"This is a sample quiz, not a coaching assessment.",True,False,,,TRUE,1,"This demonstrates the upload format."\r\nsample_3,3,written,"Describe the sample marker in one sentence.",,,,,,2,"Staff review is required for written answers."\r\n';
function rowsOf(input: string): string[][] {
  if (new TextEncoder().encode(input).length > 256 * 1024)
    throw Error("Keep the quiz CSV below 256 KB.");
  if (
    input.includes("\0") ||
    input.includes("\uFFFD") ||
    input.charCodeAt(0) === 0xfffe
  )
    throw Error("Export a UTF-8 comma-separated CSV file.");
  const text = input.replace(/^\uFEFF/, ""),
    rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  const cell = () => {
    row.push(field);
    field = "";
    closed = false;
  };
  const line = () => {
    cell();
    if (row.some((c) => c.trim())) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else if (c === "\r") {
        if (text[i + 1] === "\n") i++;
        field += "\n";
      } else field += c;
      continue;
    }
    if (c === ",") {
      cell();
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      line();
      continue;
    }
    if (closed) {
      if (c === " " || c === "\t") continue;
      throw Error(
        `Unexpected character after a quote near row ${rows.length + 1}.`,
      );
    }
    if (c === '"') {
      if (field.trim())
        throw Error(`Unexpected quote near row ${rows.length + 1}.`);
      field = "";
      quoted = true;
    } else field += c;
  }
  if (quoted) throw Error("A quoted cell is missing its closing quote.");
  if (field.length || row.length || closed) line();
  return rows;
}
export function parseQuizCsv(text: string): {
  quiz: QuizImport | null;
  issues: ImportIssue[];
} {
  const issues: ImportIssue[] = [];
  let rows: string[][];
  try {
    rows = rowsOf(text);
  } catch (e) {
    return {
      quiz: null,
      issues: [{ row: 0, column: "file", message: (e as Error).message }],
    };
  }
  if (
    !rows.length ||
    rows[0].map((x) => x.trim()).join(",") !== QUIZ_COLUMNS.join(",")
  )
    return {
      quiz: null,
      issues: [
        {
          row: 1,
          column: "headers",
          message: `Use these exact columns: ${QUIZ_COLUMNS.join(", ")}.`,
        },
      ],
    };
  if (rows.length < 2 || rows.length > 101)
    return {
      quiz: null,
      issues: [
        {
          row: 0,
          column: "file",
          message: "Include between 1 and 100 questions.",
        },
      ],
    };
  const questions: QuizQuestion[] = [],
    keys: QuizKey[] = [],
    ids = new Set<string>(),
    orders = new Set<number>();
  rows.slice(1).forEach((cells, index) => {
    const row = index + 2;
    const issue = (column: string, message: string) =>
      issues.push({ row, column, message });
    if (cells.length !== QUIZ_COLUMNS.length) {
      issue(
        "row",
        "Each row must have exactly 11 cells; quote commas and newlines.",
      );
      return;
    }
    const [
      id,
      orderRaw,
      type,
      question,
      a,
      b,
      c,
      d,
      correct,
      pointsRaw,
      explanation,
    ] = cells.map((x) => x.trim());
    const order = Number(orderRaw),
      points = Number(pointsRaw);
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || ids.has(id))
      issue(
        "question_id",
        "Use a unique ID with letters, numbers, underscores or hyphens.",
      );
    ids.add(id);
    if (
      !Number.isInteger(order) ||
      order < 1 ||
      order > 100 ||
      orders.has(order)
    )
      issue("order", "Use unique whole-number order values starting at 1.");
    orders.add(order);
    if (!["multiple_choice", "true_false", "written"].includes(type))
      issue("type", "Use multiple_choice, true_false or written.");
    if (!question || question.length > 2000)
      issue("question", "Use 1–2000 characters.");
    if (!Number.isInteger(points) || points < 1 || points > 100)
      issue("points", "Use a whole number from 1 to 100.");
    if (explanation.length > 2000)
      issue("explanation", "Keep explanations below 2001 characters.");
    let options = [a, b, c, d].filter(Boolean),
      answer: number | null = null;
    if (type === "multiple_choice") {
      if (
        !a ||
        !b ||
        (!c && !!d) ||
        options.some((x) => x.length > 400) ||
        new Set(options).size !== options.length
      )
        issue(
          "option_a",
          "Provide 2–4 distinct, consecutive choices of at most 400 characters.",
        );
      answer = "ABCD".indexOf(correct.toUpperCase());
      if (correct.length !== 1 || answer < 0 || answer >= options.length)
        issue(
          "correct_answer",
          "Choose A, B, C or D matching an existing option.",
        );
    } else if (type === "true_false") {
      if (
        (a && a.toLowerCase() !== "true") ||
        (b && b.toLowerCase() !== "false") ||
        c ||
        d
      )
        issue(
          "option_a",
          "True/false choices must be True and False; C/D stay blank.",
        );
      options = ["True", "False"];
      answer =
        correct.toUpperCase() === "TRUE"
          ? 0
          : correct.toUpperCase() === "FALSE"
            ? 1
            : null;
      if (answer === null) issue("correct_answer", "Use TRUE or FALSE.");
    } else if (type === "written") {
      if (a || b || c || d || correct)
        issue(
          "correct_answer",
          "Written questions have no choices or automatic answer key; staff enter the grade.",
        );
      options = [];
    }
    questions.push({
      id,
      order,
      type: type as QuizQuestion["type"],
      question,
      options,
      points,
    });
    keys.push({ id, correct: answer, explanation });
  });
  if ([...orders].sort((a, b) => a - b).some((n, i) => n !== i + 1))
    issues.push({
      row: 0,
      column: "order",
      message: "Question order must be consecutive from 1 without gaps.",
    });
  if (issues.length) return { quiz: null, issues: issues.slice(0, 25) };
  questions.sort((a, b) => a.order - b.order);
  return {
    quiz: {
      questions,
      keys,
      totalPoints: questions.reduce((n, q) => n + q.points, 0),
    },
    issues: [],
  };
}
