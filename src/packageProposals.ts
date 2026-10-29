import { CONTACT_EMAIL } from "./contactContent";

export const PACKAGE_PROPOSALS = [
  {
    id: "foundation",
    name: "Foundation",
    monthly: "9.99",
    annual: "99",
    focus: "Learn the game before the next rep.",
    cadence: "2 football-IQ videos per week · no drills",
    includes: "Football learning, from the ground up",
    items: [
      "Two football-IQ videos each week, with short lesson quizzes",
      "Rules, terminology, positions, offense, defense and special teams",
      "Progress, badges, a parent dashboard and a learning library",
    ],
  },
  {
    id: "fundamentals",
    name: "Fundamentals",
    monthly: "19.99",
    annual: "199",
    focus: "Turn understanding into purposeful practice.",
    cadence: "2 IQ + 2 fundamental drill videos per week",
    includes: "Everything proposed in Foundation, plus",
    items: [
      "Two fundamental drill videos each week",
      "Stance, starts, catching, ball security and basic blocking",
      "Why-and-how demonstrations, age-appropriate practice and progress tracking",
    ],
  },
  {
    id: "position-development",
    name: "Position Development",
    monthly: "39.99",
    annual: "399",
    focus: "Build a path around one primary position.",
    cadence: "2 IQ videos + 2 adapted drill assignments per week",
    includes: "Everything proposed in Fundamentals, adapted for a position",
    items: [
      "One primary-position guided path with position instruction and responsibilities",
      "Progression and checkpoints matched to age and experience",
      "One monthly group film/coaching session",
    ],
    note: "Position assignments replace or adapt the two fundamental drills. They do not automatically add more weekly drills.",
  },
  {
    id: "elite-coaching",
    name: "Elite Coaching",
    monthly: "69.99",
    annual: "699",
    focus: "Add a closer look at the work.",
    cadence: "Position Development + 2 chosen video reviews per month",
    includes: "Everything proposed in Position Development, plus",
    items: [
      "Two chosen drill-video reviews per month for each subscribed Elite athlete, with up to three minutes of footage per review",
      "Written strengths, corrections and next-practice guidance",
      "Guardian-visible feedback and review history",
    ],
    note: "Proposed feedback target: three business days, not guaranteed. Review features and capacity are being validated.",
  },
] as const;

export function packageInterestLink(id: string) {
  const chosen =
    PACKAGE_PROPOSALS.find((p) => p.id === id)?.name || "Not sure yet";
  const body = `I'm an adult interested in Repformed's proposed packages.\n\nInterested package: ${chosen}\nMy question or feedback: \nAdult contact name (optional): \n\nThis is an expression of interest, not enrollment, payment or a reservation.\nPlease do not include child names, dates of birth, videos or health details.`;
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Repformed proposed package interest")}&body=${encodeURIComponent(body)}`;
}
