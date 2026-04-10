# Watch DNA Identity Rules

Watch DNA now follows a strict account boundary.

- Anonymous tracking stays enabled while no one is signed in.
- Existing-account sign-ins may merge the current browser's anonymous Watch DNA history into that same account.
- Newly created accounts always start with a clean Watch DNA and do not inherit anonymous browsing history from before account creation.
- Logging out clears the browser's buffered anonymous Watch DNA events and resets the anonymous browser identity.

Why this exists:

- It keeps Watch DNA tied to the actual signed-in account rather than to a reused browser.
- It prevents signed-out browsing after logout from seeding the next account created in the same browser.
- It makes QA and manual testing deterministic without requiring localStorage cleanup between account flows.
