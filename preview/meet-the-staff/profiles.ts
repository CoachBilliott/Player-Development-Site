export type PublicStaffProfile = {
  id: string;
  name: string;
  title: string;
  bio: string;
  experience: string[];
  photo?: { src: string; alt: string; objectPosition?: string };
};

// Public content only. Claims are self-reported in the submitted staff forms,
// not independently verified. This entire entry point remains unpublished.
export const previewProfiles: PublicStaffProfile[] = [
  {
    id: "victor-bennett",
    name: "Victor Bennett",
    title: "Owner",
    bio: "Victor Bennett brings more than 20 years of experience training and developing young athletes. A former college football player and high school offensive coordinator, he specializes in position-specific training, game understanding, and athlete development. He also operates a youth basketball league that emphasizes confidence, teamwork, and sportsmanship. Victor helped start Repformed to help athletes understand their roles, make smarter decisions, and take ownership of their progress. His coaching centers on accountability, discipline, and developing the person first, building skills and character that last beyond sports.",
    experience: [],
  },
  {
    id: "devyn-billiott",
    photo: {
      src: "./staff/devyn-billiott.webp",
      alt: "Devyn Billiott wearing a coaching headset on the football sideline",
      objectPosition: "center 56%",
    },
    name: "Devyn Billiott",
    title: "Co-Owner",
    bio: "Devyn Billiott brings four years of varsity Texas high school coaching experience and currently coaches at Cypress Creek High School. A former All-State center at La Marque High School, he specializes in offensive and defensive line development, blocking, pass rush, and strength and conditioning. He helped start Repformed to make quality coaching more accessible to young athletes and families. His approach emphasizes understanding the “why” behind each technique, building confidence, and developing accountability, consistency, and a love for improvement.",
    experience: [],
  },
];
