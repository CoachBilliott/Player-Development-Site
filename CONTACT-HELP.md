# Contact and public help

The website Contact page is `#contact`, linked from public desktop/mobile navigation and the footer. The app help source also links to the public Contact page. The published contact address is **Repformed@gmail.com**, explicitly supplied for publication by the Owner. It does not rename the platform or change authentication settings.

`src/contactContent.ts` owns the address, supported message topics and authored FAQ answers. Changing an email topic only prepares an encoded `mailto:` subject; **Open email app** opens the visitor's email client. The visitor writes and sends there. The website does not submit, store or claim delivery of a contact message. No SMTP service or email credentials are needed for that link, and no test emails are sent by browser checks.

FAQ search runs in the browser and does not send queries to an AI provider. Answers describe current registration, payment, junior-access and video-review limits. Keep those answers current as features launch. This is a working FAQ, not an AI chatbot. A future AI assistant should use approved help content, identify itself clearly, hand off unanswered/account-specific questions to the team and keep private account data out of its public context. No AI service, API key, payment or chat integration was configured.

Public signup, real junior enrollment and paid checkout are unchanged. The website email link does not configure automatic invitations, verification/reset messages or review notifications; those still require the separate sending setup. Published changes to app help become available in the native binary only in a subsequent app release.
