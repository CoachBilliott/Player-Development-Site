# Google Sheets quiz import

This is a draft feature, not enabled on production. Athletes answer inside Repformed; they do not need Google accounts. Staff prepare questions in Google Sheets and upload a CSV. No Google OAuth or live spreadsheet sync is required.

1. Download `repformed-quiz-blank.csv` (or the clearly fictional example) from Training → Quizzes.
2. Open it in Google Sheets. Keep the exact header row.
3. Add one question per row. Do not share the spreadsheet/answer key with athletes.
4. Choose **File → Download → Comma-separated values (.csv)** for that sheet.
5. Upload, review every question and answer key, then publish an immutable version. A malformed import never partially publishes.

Exact columns, in this order:

`question_id,order,type,question,option_a,option_b,option_c,option_d,correct_answer,points,explanation`

| Column | Requirement |
| --- | --- |
| question_id | Unique 1–64 characters: letters, numbers, underscore or hyphen. Stable IDs such as q1. |
| order | Consecutive whole numbers starting at 1. |
| type | `multiple_choice`, `true_false`, or `written`. |
| question | 1–2000 characters. |
| option_a … option_d | Multiple choice: 2–4 distinct consecutive choices, at most 400 characters each. True/false: True, False, blank, blank (or leave choices blank; importer supplies canonical choices). Written: all blank. |
| correct_answer | Multiple choice: A/B/C/D. True/false: TRUE/FALSE. Written: blank; staff grade it. |
| points | Whole number 1–100 per question. |
| explanation | Optional, at most 2000 characters. Staff-only import material; not included in learner question payloads. |

Limits: 1–100 questions, UTF-8 CSV, maximum 256 KB. Google Sheets quotes commas, quotes and multiline text when exporting. Do not convert to a PDF or paste a spreadsheet sharing URL. The example is a format demonstration, not coaching-reviewed curriculum.

Objective scoring runs on the server. Clients submit answers, never a trusted score. Written responses remain awaiting staff grading; submitted work counts as learner participation while grading is pending. Attempts retain the exact quiz version. Staff corrections add a new grade revision; earlier grades remain in history. Retrying starts a separate attempt (initial safety cap 10 per learner/quiz/release, subject to review).
