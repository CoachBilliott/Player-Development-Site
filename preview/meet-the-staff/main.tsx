import { createRoot } from "react-dom/client";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import { MeetTheStaff } from "./MeetTheStaff";
import { previewProfiles } from "./profiles";
import "./staff.css";
const root = createRoot(document.getElementById("root")!);
export function renderGrowthFixture() {
  root.render(
    <MeetTheStaff
      profiles={Array.from({ length: 6 }, (_, i) => ({
        ...previewProfiles[i % 2],
        id: `fixture-${i}`,
        name: `Preview profile ${i + 1}`,
      }))}
    />,
  );
}
root.render(<MeetTheStaff profiles={previewProfiles} />);
