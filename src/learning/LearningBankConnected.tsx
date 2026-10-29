import { useCallback, useMemo } from "react";
import type { SharedState } from "../useSharedContent";
import { StaffService, type RosterCursor } from "../staffService";
import { LearningApi } from "./api";
import { StaffLearning } from "./StaffLearning";
export function LearningBankConnected({ shared }: { shared: SharedState }) {
  const client = shared.service!.client;
  const api = useMemo(() => new LearningApi(client), [client]),
    staff = useMemo(() => new StaffService(client), [client]);
  const loadProfiles = useCallback(
    async (query: string, cursor: RosterCursor | null) => {
      const page = await staff.page(
        { query, filter: "all", age: "", position: "", coach: "" },
        cursor,
        25,
      );
      return {
        rows: page.rows
          .filter((row) => row.athlete_id)
          .map((row) => ({
            id: row.athlete_id!,
            name: row.athlete_name || "Athlete",
          })),
        next_cursor: page.page!.next_cursor,
      };
    },
    [staff],
  );
  return (
    <StaffLearning
      key={shared.session!.user.id + shared.role}
      api={api}
      resources={shared.resources
        .filter((d) => shared.canEditResource(d.id))
        .map((d) => ({ id: d.id, title: d.title }))}
      loadProfiles={loadProfiles}
      owner={shared.role === "owner"}
      approver={shared.role === "owner" || shared.role === "manager"}
    />
  );
}
