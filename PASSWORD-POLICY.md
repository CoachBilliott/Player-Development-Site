# Account password requirements

New passwords for account activation, signup, recovery and password changes require:

- At least **8 characters**.
- At least one uppercase letter (A–Z).
- At least one lowercase letter (a–z).
- At least one number (0–9).
- At least one special character, such as `!`, `@`, `#` or `?`.

The website and native app share this validation. The same rule is enforced by the dedicated Supabase Auth project. Existing passwords are unchanged, and sign-in does not apply the new-password checks to existing accounts. Signup and junior enrollment gates remain unchanged.
