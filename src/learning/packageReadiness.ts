// Draft-preview aid only. The database independently validates every allocation.
export type LessonKind = "iq" | "movement" | "position";
export type LessonAllocation = { kind?: LessonKind; quiz_version_id?: string };
export type LessonAllocations = Record<string, LessonAllocation>;
export function packageRequirements(packages: readonly string[]) {
  const classes = [
    ...new Set(
      packages.map((p) =>
        p === "foundation"
          ? "foundation"
          : p === "fundamentals"
            ? "fundamentals"
            : p === "position-development" || p === "elite-coaching"
              ? "position"
              : p === "private_test"
                ? "test"
                : "invalid",
      ),
    ),
  ];
  if (classes.length !== 1 || classes[0] === "invalid")
    return {
      mode: "invalid" as const,
      message:
        "Choose one weekly workload. Position Development and Elite may share a plan; other levels need separate plans.",
    };
  if (classes[0] === "test")
    return {
      mode: "test" as const,
      message:
        "Private test content is not package-completeness certification.",
    };
  return {
    mode: "package" as const,
    iq: 2,
    quizzes: 2,
    movement: classes[0] === "foundation" ? 0 : 2,
    position: classes[0] === "position" ? 2 : 0,
  };
}
export function pairedQuizIds(
  resources: readonly string[],
  allocations: LessonAllocations,
) {
  return [
    ...new Set(
      resources
        .map((id) => allocations[id])
        .filter((a) => a?.kind === "iq" && a.quiz_version_id)
        .map((a) => a.quiz_version_id!),
    ),
  ];
}
