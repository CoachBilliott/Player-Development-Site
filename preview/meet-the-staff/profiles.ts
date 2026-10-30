export type PublicStaffProfile = {
  id: string;
  name: string;
  title: string;
  bio: string;
  experience: string[];
  photo?: { src: string; alt: string };
};

// Public content only. Claims are self-reported in Devyn’s submitted form,
// not independently verified. This entire entry point remains unpublished.
export const previewProfiles: PublicStaffProfile[] = [
  {
    id: "devyn-billiott",
    name: "Devyn Billiott",
    title: "Co-Owner",
    bio: "Devyn Billiott brings four years of varsity Texas high school coaching experience and currently coaches at Cypress Creek High School. A former All-State center at La Marque High School, he specializes in offensive and defensive line development, blocking, pass rush, and strength and conditioning. He helped start Repformed to make quality coaching more accessible to young athletes and families. His approach emphasizes understanding the “why” behind each technique, building confidence, and developing accountability, consistency, and a love for improvement.",
    experience: [],
  },
  {
    id: "partner-pending",
    name: "Partner profile pending",
    title: "Public title pending approval",
    bio: "This unpublished preview slot is reserved for the partner’s submitted biography and headshot. No name or experience has been added.",
    experience: [],
  },
];
