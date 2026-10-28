import { useEffect, useMemo, useState } from "react";
import type { SharedState } from "../useSharedContent";
import { StaffService } from "../staffService";
import { LearningApi } from "./api";
import { StaffLearning } from "./StaffLearning";
export function LearningBankConnected({ shared }: { shared: SharedState }) {
  const client = shared.service!.client;
  const api = useMemo(() => new LearningApi(client), [client]);
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    if (["owner", "manager", "coach"].includes(shared.role || ""))
      void new StaffService(client)
        .roster()
        .then((r) => {
          if (live)
            setProfiles(
              r.rows
                .filter((row) => row.athlete_id)
                .map((row) => ({
                  id: row.athlete_id!,
                  name: row.athlete_name || "Athlete",
                })),
            );
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    return () => {
      live = false;
    };
  }, [client, shared.role]);
  return (
    <>
      {error && <p role="alert">Group roster unavailable: {error}</p>}
      <StaffLearning
        key={shared.session!.user.id + shared.role}
        api={api}
        resources={shared.resources
          .filter((d) => shared.canEditResource(d.id))
          .map((d) => ({ id: d.id, title: d.title }))}
        profiles={profiles}
        owner={shared.role === "owner"}
        approver={shared.role === "owner" || shared.role === "manager"}
      />
    </>
  );
}
