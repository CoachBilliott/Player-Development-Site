# Hero control design check

Source candidate `7900940ab584c062753bfe741b361ec24dfda0f4`, PR #23. Local rendered screenshots, not production or an installed iPhone. The supplied Library screenshot was not accessible in this worker; the actual existing source and before/after local phone render were inspected.

The prominent “Pause video” text button is removed from the marketing copy. A compact 44-pixel icon control sits at the lower corner with a keyboard-operable accessible Pause/Resume name, title and pressed state. Reduced-motion mode continues to show the static poster and omits autoplay/control. Existing branding, copy, package definitions and content are unchanged.

Eight final affected desktop/phone browser cases passed, including 320/375/390/768-pixel separation and overflow, keyboard pause/resume, skip link and privacy return. Earlier 20 focused motion/fallback/reduced-motion/public cases also passed; these overlapping counts are not added. CI on the exact final candidate remains the release gate. No production deployment or native release is implied by these pictures.
