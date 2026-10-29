import type { SharedState } from "./useSharedContent";
import { Workspace } from "./Workspaces";
export function MobileStaffHome({ shared }: { shared: SharedState }) {
  return (
    <div className="app-staff-home">
      <Workspace shared={shared} />
    </div>
  );
}
