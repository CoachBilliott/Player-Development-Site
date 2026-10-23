import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  connectSharedContent,
  parseSharedConfig,
  type SharedContent,
} from "./sharedContent";
import type { Drill } from "./model";

export function useSharedContent() {
  const [service, setService] = useState<SharedContent | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [resources, setResources] = useState<Drill[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let stopped = false;
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      try {
        const response = await fetch(
          `${import.meta.env.BASE_URL}content-config.json`,
          { cache: "no-store" },
        );
        if (!response.ok)
          throw new Error(
            "Shared-publishing configuration is unavailable. Local demo publishing still works.",
          );
        const config = parseSharedConfig(await response.json());
        if (!config || stopped) return;
        const connection = await connectSharedContent(config);
        if (stopped) return;
        setService(connection);
        const subscription = connection.client.auth.onAuthStateChange(
          (_event, current) => {
            if (!stopped) setSession(current);
          },
        );
        unsubscribe = () => subscription.data.subscription.unsubscribe();
        const current = await connection.client.auth.getSession();
        if (!stopped) setSession(current.data.session);
        const list = await connection.list();
        if (!stopped) setResources(list);
      } catch (e) {
        if (!stopped)
          setError(
            e instanceof Error
              ? e.message
              : "Shared content is unavailable. Built-in and local demo content still work.",
          );
      }
    })();
    return () => {
      stopped = true;
      unsubscribe?.();
    };
  }, []);
  useEffect(() => {
    let stopped = false;
    if (!service || !session) return;
    void service
      .isCoach()
      .then((allowed) => {
        if (!stopped) {
          setCoachId(allowed ? session.user.id : null);
          if (!allowed)
            setError(
              "This account is not approved to publish. Ask the project owner to grant coach access.",
            );
        }
      })
      .catch((e) => {
        if (!stopped)
          setError(
            e instanceof Error
              ? e.message
              : "Coach access could not be verified.",
          );
      });
    return () => {
      stopped = true;
    };
  }, [service, session]);
  async function refresh() {
    if (!service) return;
    setChecking(true);
    setError("");
    try {
      setResources(await service.list());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not refresh shared resources.",
      );
    } finally {
      setChecking(false);
    }
  }
  return {
    configured: Boolean(service),
    signedIn: Boolean(session),
    coach: Boolean(session && session.user.id === coachId),
    checking,
    resources,
    error,
    message,
    refresh,
    async signIn(email: string, password: string) {
      if (!service) throw new Error("Shared publishing is not connected.");
      setCoachId(null);
      setError("");
      const { error } = await service.client.auth.signInWithPassword({
        email,
        password,
      });
      if (error)
        throw new Error(
          "Sign-in failed. Check your coach email/password and connection, then try again.",
        );
    },
    async signOut() {
      if (!service) return;
      const { error } = await service.client.auth.signOut({ scope: "local" });
      if (error)
        throw new Error("Could not sign out. Reconnect and try again.");
      setCoachId(null);
      setSession(null);
      setError("");
    },
    async publish(drill: Drill, file: File) {
      if (!service) throw new Error("Shared publishing is not connected.");
      const saved = await service.publish(drill, file);
      setResources((current) => [
        saved,
        ...current.filter((d) => d.id !== saved.id),
      ]);
    },
    async update(drill: Drill, file?: File) {
      if (!service) throw new Error("Shared publishing is not connected.");
      const saved = await service.update(drill, file);
      setResources((current) =>
        current.map((d) => (d.id === saved.id ? saved : d)),
      );
    },
    async remove(drill: Drill) {
      if (!service) throw new Error("Shared publishing is not connected.");
      const warning = await service.remove(drill);
      setResources((current) => current.filter((d) => d.id !== drill.id));
      setMessage(warning);
    },
  };
}
export type SharedState = ReturnType<typeof useSharedContent>;
