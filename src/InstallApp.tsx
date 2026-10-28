import { useState } from "react";
import {
  ArrowRight,
  Check,
  Download,
  RefreshCw,
  Smartphone,
  WifiOff,
} from "lucide-react";
import { Modal, Notice, Tag } from "./components";
import type { PwaState } from "./pwa";

export function InstallApp({ app }: { app: PwaState }) {
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  return (
    <main className="page narrow install-page">
      <div className="page-intro">
        <Tag>YOUR PRACTICE, WITH YOU</Tag>
        <h1 tabIndex={-1}>Add it to your phone.</h1>
        <p>
          Open your Repformed account from your home screen. Account access is
          by invitation while programs prepare for launch.
        </p>
        <a className="button" href="?source=app#app">
          Open the member app <ArrowRight size={18} />
        </a>
      </div>
      <section className="panel install-status">
        <Smartphone size={34} />
        <div>
          <h2>
            {app.installed
              ? "Repformed is installed."
              : "Your next rep. One tap away."}
          </h2>
          <p>
            {app.installed
              ? "Website improvements also reach this app. Check here when an update is available."
              : "No app-store account or payment is needed to add the web app."}
          </p>
        </div>
        {app.canInstall && !app.installed && (
          <button className="button" onClick={() => void app.install()}>
            <Download size={18} />
            Install app
          </button>
        )}
      </section>
      <div className="install-grid">
        <section className="panel">
          <span className="eyebrow">IPHONE & IPAD</span>
          <h2>Add from Safari</h2>
          <ol className="instruction-list">
            <li>
              Open this website in Safari. If you opened it inside another app,
              choose Open in Safari first.
            </li>
            <li>
              Open Safari’s Share menu, then choose Add to Home Screen. On some
              versions this is under More.
            </li>
            <li>Turn on Open as Web App if offered, then tap Add.</li>
            <li>Tap the new Repformed icon on your home screen.</li>
          </ol>
        </section>
        <section className="panel">
          <span className="eyebrow">ANDROID & DESKTOP</span>
          <h2>Add from your browser</h2>
          <ol className="instruction-list">
            <li>
              Open this website in Chrome or another browser that supports web
              apps.
            </li>
            <li>
              Choose Install app above when offered, or open the browser menu
              and choose Install app or Add to Home screen.
            </li>
            <li>Confirm the installation, then open the new icon.</li>
          </ol>
          <p>
            Menu names vary by browser. If installation is unavailable, the
            website still works.
          </p>
        </section>
      </div>
      <section className="panel">
        <h2>
          <WifiOff size={21} /> Connection & saved practice
        </h2>
        <p role="status" className="app-cache-status">
          {app.offlineReady ? (
            <>
              <Check size={18} /> Saved app screens are ready for offline use on
              this browser.
            </>
          ) : (
            "Open the published website online first and allow offline setup to finish."
          )}
        </p>
        <p>
          Sign-in, private profiles, new training, uploads and updates need an
          internet connection. Saved fictional previews can reopen offline;
          media may not be available without a connection.
        </p>
        <Notice>
          Installing does not create an account or start a subscription.
          Approved account records use the private account service; fictional
          preview progress stays on this device. Browser and home-screen storage
          may differ on some devices.
        </Notice>
        {app.waiting && (
          <div className="success">
            <RefreshCw size={22} />
            <div>
              <strong>An app update is ready.</strong>
              <p>Save any work before reloading.</p>
              <button className="button" onClick={() => setConfirmUpdate(true)}>
                Update app
              </button>
            </div>
          </div>
        )}
        <button
          className="button secondary"
          disabled={!app.online}
          onClick={() => void app.checkForUpdates()}
        >
          <RefreshCw size={17} />
          Check for updates
        </button>
        {app.message && <p role="status">{app.message}</p>}
      </section>
      <a href="#account" className="button">
        Log in to your account
        <ArrowRight size={18} />
      </a>
      {confirmUpdate && (
        <Modal
          title="Reload to update the app?"
          onClose={() => setConfirmUpdate(false)}
        >
          <p>
            Finish or save your work before updating. Unsaved device work may be
            lost when the app reloads. Saved fictional preview progress stays on
            this device.
          </p>
          <div className="actions">
            <button className="button" onClick={() => app.update()}>
              Reload and update
            </button>
            <button
              className="button secondary"
              onClick={() => setConfirmUpdate(false)}
            >
              Keep current version
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
