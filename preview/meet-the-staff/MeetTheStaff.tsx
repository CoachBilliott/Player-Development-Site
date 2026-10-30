import { MeetTheStaff as StaffPage } from "../../src/MeetTheStaff";
import type { PublicStaffProfile } from "../../src/staffProfiles";
export function MeetTheStaff({ profiles }: { profiles: PublicStaffProfile[] }) {
  return (
    <>
      <aside className="review-banner">PROFILE REVIEW · Not published</aside>
      <header className="staff-header">
        <div className="staff-brand">
          <img src="./brand/repformed-mark.svg" width="48" height="40" alt="" />
          <div>
            REPFORMED<small>ATHLETE DEVELOPMENT</small>
          </div>
        </div>
      </header>
      <StaffPage profiles={profiles} />
    </>
  );
}
