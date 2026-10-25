import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  connectSharedContent,
  finishAuthRedirect,
  parseSharedConfig,
  type SharedContent,
} from "./sharedContent";
import type { Drill } from "./model";
import { isStaff, type AccountRole } from "./roles";
import { clearStaffDrafts } from "./staffDrafts";

export function useSharedContent() {
  const [serviceTrackingEnabled, setServiceTrackingEnabled] = useState(false);
  const [accountLifecycleEnabled, setAccountLifecycleEnabled] = useState(false);
  const [accountNotice, setAccountNotice] = useState("");
  const [service, setService] = useState<SharedContent | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<{
    userId: string;
    role: AccountRole | null;
    error: string;
  }>({ userId: "", role: null, error: "" });
  const [checking, setChecking] = useState(false);
  const [resources, setResources] = useState<Drill[]>([]);
  const [libraryOwner, setLibraryOwner] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [membersEnabled, setMembersEnabled] = useState(false);
  const [signupEnabled, setSignupEnabled] = useState(false);
  const [connectionError, setConnectionError] = useState("");
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
        const raw = await response.json();
        const config = parseSharedConfig(raw);
        if (!config || stopped) return;
        const connection = await connectSharedContent(config);
        if (stopped) return;
        setService(connection);
        setAccountLifecycleEnabled(raw.accountLifecycleEnabled === true);
        setServiceTrackingEnabled(raw.serviceTrackingEnabled === true);
        setMembersEnabled(raw.membersEnabled === true);
        setSignupEnabled(raw.membersSignupEnabled !== false);
        let previousUser = "";
        const subscription = connection.client.auth.onAuthStateChange(
          (_event, current) => {
            if (current) setAccountNotice("");
            if (!current || (previousUser && previousUser !== current.user.id))
              void clearStaffDrafts().catch(() => {
                if (!stopped)
                  setMessage(
                    "Signed-out device drafts could not be cleared. Clear this app's site data on a shared device.",
                  );
              });
            previousUser = current?.user.id || "";
            if (!stopped) setSession(current);
          },
        );
        unsubscribe = () => subscription.data.subscription.unsubscribe();
        await finishAuthRedirect(connection);
        const current = await connection.client.auth.getSession();
        if (!stopped) setSession(current.data.session);
      } catch (e) {
        if (!stopped)
          setConnectionError(
            e instanceof Error
              ? e.message
              : "The account service could not be connected.",
          );
        if (!stopped)
          setError(
            e instanceof Error
              ? e.message
              : "Shared content is unavailable. Built-in and local demo content still work.",
          );
      } finally {
        if (!stopped) setLoading(false);
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
    const refresh = () =>
      void service
        .getAccess()
        .then((result) => {
          if (!stopped) {
            setAccess({
              userId: session.user.id,
              role: result?.role || null,
              error: "",
            });
            if (!isStaff(result?.role || null))
              setError(
                "This account is not approved to publish. Ask the project owner to grant coach access.",
              );
          }
        })
        .catch((e: Error) => {
          if (!stopped) {
            setAccess({
              userId: session.user.id,
              role: null,
              error: e.message,
            });
            setError(e.message);
          }
        });
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      stopped = true;
      window.removeEventListener("focus", refresh);
    };
  }, [service, session]);
  const role =
    session && session.user.id === access.userId ? access.role : null;
  const libraryKey = `${session?.user.id || "public"}:${role || "none"}`;
  useEffect(() => {
    if (!service) return;
    let stopped = false;
    void service
      .list()
      .then((list) => {
        if (!stopped) {
          setResources(list);
          setLibraryOwner(libraryKey);
        }
      })
      .catch((e: Error) => {
        if (!stopped) {
          setResources([]);
          setLibraryOwner(libraryKey);
          setError(e.message);
        }
      });
    return () => {
      stopped = true;
    };
  }, [service, libraryKey]);
  async function refreshAccess() {
    if (!service || !session) return;
    try {
      const result = await service.getAccess();
      setAccess({
        userId: session.user.id,
        role: result?.role || null,
        error: "",
      });
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Account access could not be verified.";
      setAccess({ userId: session.user.id, role: null, error: message });
      throw new Error(message);
    }
  }
  async function refresh() {
    if (!service) return;
    setChecking(true);
    setError("");
    try {
      setResources(await service.list());
      setLibraryOwner(libraryKey);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not refresh shared resources.",
      );
    } finally {
      setChecking(false);
    }
  }
  return {
    service,
    accountLifecycleEnabled,
    serviceTrackingEnabled,
    accountNotice,
    setAccountNotice,
    session,
    loading,
    membersEnabled,
    signupEnabled,
    connectionError,
    clearConnectionError: () => setConnectionError(""),
    configured: Boolean(service),
    signedIn: Boolean(session),
    role,
    accessReady: !session || session.user.id === access.userId,
    accessError:
      session && session.user.id === access.userId ? access.error : "",
    refreshAccess,
    coach: isStaff(role),
    canEditResource: (id: string) =>
      role === "owner" ||
      role === "manager" ||
      (role === "coach" &&
        service?.resourceAuthors.get(id) === session?.user.id),
    checking,
    libraryReady: libraryOwner === libraryKey,
    resources: libraryOwner === libraryKey ? resources : [],
    error,
    message,
    refresh,
    async signIn(email: string, password: string) {
      if (!service) throw new Error("Shared publishing is not connected.");
      setAccess({ userId: "", role: null, error: "" });
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
      setAccess({ userId: "", role: null, error: "" });
      setSession(null);
      setResources([]);
      setLibraryOwner("");
      setMessage("");
      setError("");
    },
    uploadProgress,
    async publish(drill: Drill, file: File) {
      if (!service) throw new Error("Shared publishing is not connected.");
      setUploadProgress(0);
      let saved: Drill;
      try {
        saved = await service.publish(drill, file, ({ loaded, total }) =>
          setUploadProgress(total ? loaded / total : 0),
        );
      } finally {
        setUploadProgress(null);
      }
      setLibraryOwner(libraryKey);
      setResources((current) => [
        saved,
        ...current.filter((d) => d.id !== saved.id),
      ]);
    },
    async update(drill: Drill, file?: File) {
      if (!service) throw new Error("Shared publishing is not connected.");
      setUploadProgress(file ? 0 : null);
      let saved: Drill;
      try {
        saved = await service.update(drill, file, ({ loaded, total }) =>
          setUploadProgress(total ? loaded / total : 0),
        );
      } finally {
        setUploadProgress(null);
      }
      setLibraryOwner(libraryKey);
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
