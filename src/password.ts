export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_REQUIREMENTS =
  "Use 8 or more characters, including an uppercase letter, a lowercase letter, a number and a special character.";

// Matches Supabase's supported letters + digits + symbols policy.
const symbols = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~";
export function passwordIssue(password: string): string {
  return password.length >= PASSWORD_MIN_LENGTH &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    Array.from(password).some((character) => symbols.includes(character))
    ? ""
    : PASSWORD_REQUIREMENTS;
}
