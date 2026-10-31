import { Modal } from "./components";
import { nativeApp } from "./mobile";

// Shared verbatim adult-pilot disclosure from the existing profile setup flow.
export function ProfilePrivacy({
  lifecycleEnabled,
  onClose,
}: {
  lifecycleEnabled: boolean;
  onClose: () => void;
}) {
  return (
    <Modal title="Your profile privacy" onClose={onClose}>
      <p>
        Repformed stores the adult’s email and login credentials through
        Supabase Auth. Member records store your account type, acknowledgment
        time, and each player’s nickname, age group, football position,
        experience and goal. Do not enter full names, birth dates, school
        details, health information or photos.
      </p>
      <p>
        Profiles are private to their household and explicitly linked individual
        athlete. Coaches do not receive general profile access; optional video
        review is limited to the assigned coach. Real under-18 enrollment and
        junior logins remain closed. Adult status and guardianship are
        self-attested; verified guardian consent and identity checks still
        require separate launch work.
      </p>
      <p>
        {nativeApp()
          ? "Your login session is saved in the iOS Keychain."
          : "Your login session is saved in this browser."}{" "}
        Profile details are fetched online and are not saved into demo storage
        or the app’s offline cache. The fictional demo remains separate.{" "}
        {lifecycleEnabled
          ? "Customer account deletion includes the email login, owned profiles/history and private clips after password confirmation. Staff content and guardian-managed closure use assisted review. Other households keep their own records with your reporter identity removed. A minimal receipt retains the request ID, status, counts and dates without your email. Provider backups and already-downloaded copies follow their applicable retention rules."
          : "Profile deletion is available in your account; provider backup retention and complete email-login erasure require the project owner."}
      </p>
      <p>
        This is the adult pilot disclosure,{" "}
        {lifecycleEnabled
          ? "version adult-pilot-lifecycle-2026-10"
          : "version profile-pilot-2026-10"}
        . A reviewed privacy policy, verified parental-consent process, support
        contact and retention policy are still required before public enrollment
        of children.
      </p>
      <button className="button" onClick={() => onClose()}>
        Close privacy details
      </button>
    </Modal>
  );
}
