import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.coachbilliott.playerdevelopment",
  appName: "Repformed",
  webDir: "dist",
  backgroundColor: "#181818",
  ios: {
    contentInset: "never",
    backgroundColor: "#181818",
    preferredContentMode: "mobile",
  },
  plugins: {
    StatusBar: { style: "DARK" },
  },
};

export default config;
