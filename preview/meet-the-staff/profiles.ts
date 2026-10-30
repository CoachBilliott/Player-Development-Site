export type PublicStaffProfile = {
  id: string;
  name: string;
  title: string;
  bio: string;
  experience: string[];
  photo?: { src: string; alt: string };
};

// Review fixtures only. Never connect this list to account records or production.
export const previewProfiles: PublicStaffProfile[] = [1, 2].map((number) => ({
  id: `preview-${number}`,
  name: `Profile ${number} · name pending`,
  title: "Public title pending approval",
  bio: "A short introduction will describe this person’s work at Repformed, their approach to supporting athletes, and what families can expect from them.",
  experience: [
    "Relevant experience will appear here after verification and approval.",
  ],
}));
