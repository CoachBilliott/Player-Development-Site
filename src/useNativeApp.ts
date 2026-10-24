import { useEffect } from "react";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import type { PluginListenerHandle } from "@capacitor/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nativeApp } from "./mobile";

export function useNativeApp(client?: SupabaseClient) {
  useEffect(() => {
    if (!nativeApp()) return;
    void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
    let stopped = false;
    const listeners: PluginListenerHandle[] = [];
    const keep = (handle: PluginListenerHandle) => {
      if (stopped) void handle.remove();
      else listeners.push(handle);
    };
    if (client) {
      client.auth.startAutoRefresh();
      void App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          client.auth.startAutoRefresh();
          window.dispatchEvent(new Event("focus"));
        } else client.auth.stopAutoRefresh();
      }).then(keep);
    }
    void App.addListener("backButton", ({ canGoBack }) => {
      const dialog = document.querySelector("dialog[open]");
      if (dialog)
        dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
      else if (canGoBack) window.history.back();
      else window.location.hash = "app";
    }).then(keep);
    return () => {
      stopped = true;
      for (const listener of listeners) void listener.remove();
      client?.auth.stopAutoRefresh();
    };
  }, [client]);
}
