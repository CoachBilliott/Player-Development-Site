import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.coachbilliott.playerdevelopment",
  appName: "Player Development",
  webDir: "dist",
  backgroundColor: "#101010",
  ios: {
    contentInset: "never",
    backgroundColor: "#101010",
    preferredContentMode: "mobile",
  },
  plugins: {
    StatusBar: { style: "DARK" },
  },
};

export default config;
