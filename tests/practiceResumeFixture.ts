type Row = Record<string, unknown>;
/** Fictional persistence only; production authorization is exercised by PostgreSQL policy tests. */
export function practiceResumeFixture() {
  const rows = new Map<string, Row>();
  return {
    rows,
    complete(actor: string, profile: unknown, session: unknown) {
      const key = `${actor}:${profile}`;
      if (rows.get(key)?.session_id === session) rows.delete(key);
    },
    handle(
      path: string,
      body: Row,
      actor: string,
    ): { data: unknown; status: number } | undefined {
      const key = `${actor}:${body.target_profile}`;
      if (path.endsWith("/rpc/load_practice_resume"))
        return { data: rows.get(key) || null, status: 200 };
      if (path.endsWith("/rpc/save_practice_resume")) {
        const previous = rows.get(key);
        if (previous && previous.version !== body.expected_version)
          return {
            data: { message: "Fictional resume conflict" },
            status: 400,
          };
        const row = {
          profile_id: body.target_profile,
          session_id: body.session,
          resource_ids: body.resources,
          resource_versions: body.resource_versions,
          current_index: body.current_position,
          workout_id: body.expected_workout,
          workout_version: body.expected_workout_version,
          assignment_version: 0,
          permission_version: 0,
          version: Number(previous?.version || 0) + 1,
          updated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        };
        rows.set(key, row);
        return { data: row, status: 200 };
      }
      if (path.endsWith("/rpc/discard_practice_resume")) {
        const previous = rows.get(key);
        if (previous && previous.version !== body.expected_version)
          return {
            data: { message: "Fictional resume conflict" },
            status: 400,
          };
        rows.delete(key);
        return { data: {}, status: 200 };
      }
    },
  };
}
