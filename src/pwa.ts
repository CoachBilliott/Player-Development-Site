import { useEffect, useRef, useState } from "react";
import { nativeApp } from "./mobile";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
export function usePwa() {
  const [online, setOnline] = useState(navigator.onLine);
  const [installed, setInstalled] = useState(
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      nativeApp() ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
  );
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [offlineReady, setOfflineReady] = useState(
    () =>
      nativeApp() ||
      ("serviceWorker" in navigator &&
        Boolean(navigator.serviceWorker.controller)),
  );
  const [waiting, setWaiting] = useState(false);
  const [reloadReady, setReloadReady] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState("");
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const requestedReload = useRef(false);
  // The worker that controlled this document's running JavaScript. A newer
  // controller in another tab does not replace this document until it reloads.
  const documentController = useRef(
    "serviceWorker" in navigator ? navigator.serviceWorker.controller : null,
  );
  useEffect(() => {
    const connection = () => setOnline(navigator.onLine);
    const installPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const installedEvent = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    window.addEventListener("beforeinstallprompt", installPrompt);
    window.addEventListener("appinstalled", installedEvent);
    let stopped = false;
    let worker: ServiceWorker | null = null;
    const workerState = () => {
      if (
        !stopped &&
        worker?.state === "installed" &&
        navigator.serviceWorker.controller
      )
        setWaiting(true);
      if (!stopped && worker?.state === "activated") {
        setWaiting(Boolean(registration.current?.waiting));
        setOfflineReady(true);
      }
      if (!stopped && worker?.state === "redundant") {
        setWaiting(Boolean(registration.current?.waiting));
        if (requestedReload.current) {
          requestedReload.current = false;
          setUpdating(false);
          setMessage("The update could not finish. Check for updates again.");
        }
      }
    };
    const updateFound = () => {
      worker?.removeEventListener("statechange", workerState);
      worker = registration.current?.installing || null;
      worker?.addEventListener("statechange", workerState);
    };
    const controllerChange = () => {
      if (stopped) return;
      const controller = navigator.serviceWorker.controller;
      setWaiting(Boolean(registration.current?.waiting));
      setOfflineReady(Boolean(controller));
      if (requestedReload.current) {
        window.location.reload();
      } else if (!documentController.current) {
        // A first installation claiming this already-current page is not an
        // update. Never prompt or reload merely because setup completed.
        documentController.current = controller;
      } else if (controller && controller !== documentController.current) {
        setReloadReady(true);
        setMessage("");
      }
    };
    if (!nativeApp() && import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        controllerChange,
      );
      void navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`, {
          scope: import.meta.env.BASE_URL,
          updateViaCache: "none",
        })
        .then((reg) => {
          if (stopped) return;
          registration.current = reg;
          setWaiting(Boolean(reg.waiting));
          if (reg.active) setOfflineReady(true);
          reg.addEventListener("updatefound", updateFound);
          updateFound();
        })
        .catch(() => {
          if (!stopped && !navigator.serviceWorker.controller)
            setMessage(
              "Offline setup could not finish. The website still works while connected; reopen it online to try again.",
            );
        });
    }
    return () => {
      stopped = true;
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      window.removeEventListener("beforeinstallprompt", installPrompt);
      window.removeEventListener("appinstalled", installedEvent);
      worker?.removeEventListener("statechange", workerState);
      registration.current?.removeEventListener("updatefound", updateFound);
      if ("serviceWorker" in navigator)
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          controllerChange,
        );
    };
  }, []);
  return {
    online,
    installed,
    offlineReady,
    waiting,
    reloadReady,
    updating,
    message,
    canInstall: Boolean(prompt),
    async install() {
      if (!prompt) return;
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        setMessage(
          choice.outcome === "accepted"
            ? "Follow your browser’s installation steps."
            : "Installation canceled. You can keep using the website.",
        );
      } catch {
        setMessage(
          "Installation is unavailable here. Use your browser’s Add to Home Screen option.",
        );
      }
      setPrompt(null);
    },
    async checkForUpdates() {
      setMessage("");
      try {
        await registration.current?.update();
        setMessage(
          "Update check requested. Any available update will appear here when it is ready.",
        );
      } catch {
        setMessage(
          "Could not check for updates. Connect to the internet and try again.",
        );
      }
    },
    update() {
      if (requestedReload.current) return;
      const next = registration.current?.waiting;
      const controller =
        "serviceWorker" in navigator
          ? navigator.serviceWorker.controller
          : null;
      if (next) {
        requestedReload.current = true;
        setUpdating(true);
        setMessage("");
        try {
          next.postMessage({ type: "SKIP_WAITING" });
        } catch {
          requestedReload.current = false;
          setUpdating(false);
          setWaiting(false);
          setMessage("The update could not finish. Check for updates again.");
        }
      } else if (
        reloadReady ||
        (controller &&
          documentController.current &&
          controller !== documentController.current)
      ) {
        // The confirmation also works if another tab activated the worker
        // after this tab opened its update dialog. No forced cross-tab reload.
        requestedReload.current = true;
        setUpdating(true);
        window.location.reload();
      } else {
        setWaiting(false);
        setMessage(
          "No app update is waiting. You can check for updates again.",
        );
      }
    },
  };
}
export type PwaState = ReturnType<typeof usePwa>;
