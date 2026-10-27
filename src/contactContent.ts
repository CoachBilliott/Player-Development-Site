export const CONTACT_EMAIL = "Repformed@gmail.com";

export const CONTACT_TOPICS = [
  "General training questions",
  "Account and login help",
  "Website or app help",
  "Video review questions",
  "Membership and billing questions",
  "Privacy and account deletion",
] as const;

export function contactEmailLink(topic: string) {
  const selected =
    CONTACT_TOPICS.find((item) => item === topic) || CONTACT_TOPICS[0];
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Repformed — ${selected}`)}`;
}

// These are authored product answers, not generated coaching or account advice.
// Keep this source current before reusing it in any future help assistant.
export const CONTACT_ANSWERS = [
  {
    id: "sports",
    question: "What sports can I train for?",
    answer:
      "American football is our first program. Training is organized around age, position, experience and goals. More sports are planned, but the next sports have not been announced. Sample activities are illustrative and pending qualified coaching review.",
  },
  {
    id: "accounts",
    question: "Is this the same platform for families and individual athletes?",
    answer:
      "Yes. Parents manage family athletes, permissions and practice reviews. Adult athletes manage their own training. These are account setup options within one platform, not separate products. Real under-18 enrollment is not open yet.",
  },
  {
    id: "joining",
    question: "How do I sign up or log in?",
    answer:
      "Public registration is not open yet. If you have an invitation, follow its email instructions to set your password and finish your assigned account setup. Existing members can log in or request a password reset from Account access. Owners, Managers and Coaches use that same login.",
    href: "#account",
    link: "Open account access",
  },
  {
    id: "workouts",
    question: "Where do I find my workouts?",
    answer:
      "Log in and open Today or Workouts. A parent selects the family athlete first; an individual athlete sees their own plan. Only assigned, eligible training appears. If nothing is available, check the selected athlete, refresh and contact the team about your training access.",
    href: "#account",
    link: "Log in to your account",
  },
  {
    id: "memberships",
    question: "Can I buy a membership or a drill review?",
    answer:
      "Checkout, subscriptions and paid review purchases are not active yet. Current review access is enabled separately by an Owner. Creating an account or requesting review access does not charge you or start a subscription. Future membership information is available on the website.",
    href: "#membership",
    link: "View membership information",
  },
  {
    id: "reviews",
    question: "How do private video reviews work?",
    answer:
      "Approved adult accounts with review access can choose a drill, record or select a short clip, preview it and send it through the private review feature. The target is 48 consecutive hours after a complete submission and any required approval. Check your account for status and coaching feedback. Real junior video submissions remain closed. Please use the private review feature for footage rather than general contact email.",
  },
  {
    id: "uploads",
    question: "What should I check if my video will not upload?",
    answer:
      "For an athlete review, use an MP4, MOV or WebM clip up to 60 seconds and 40 MB. Keep the app open during preparation and upload, and wait for confirmation. The iPhone app can prepare a smaller compatible MP4 from a Photos recording. If it fails, keep your original, note the error and email the team with your phone model and app version.",
  },
  {
    id: "demo",
    question: "Does trying the demo create an account?",
    answer:
      "No. The single public demo uses fictional athletes and browser-local practice history. It does not create a real account, import sample players into your account or start billing. Watching a video or recording practice is not proof of improved athletic ability.",
    href: "#demo",
    link: "Try the sample demo",
  },
  {
    id: "privacy",
    question: "How do I get help with privacy or account deletion?",
    answer:
      "Signed-in adults can review the available account-deletion controls under Account. Staff and guardian-managed accounts need assisted review. Read the account help guide for the steps, or email the team from your account email address. Never include passwords, payment details or private player videos in a general support email.",
    href: `${import.meta.env.BASE_URL}account-help.html`,
    link: "Read account and privacy help",
  },
];
