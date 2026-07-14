# App Store Connect metadata draft

## Product page

- **Name:** Row Echelon
- **Subtitle:** Solve matrices. Climb daily.
- **Primary category:** Games — Puzzle
- **Secondary category:** Education
- **Keywords:** linear algebra,matrix,row reduction,RREF,math,puzzle,brain,education,leaderboard
- **Promotional text:** Turn row reduction into a satisfying daily puzzle. Solve matrices efficiently, build your lifetime solved total, and climb the daily leaderboard.

### Description

Row Echelon turns reduced row echelon form into a focused puzzle game.

Swap, scale, and combine rows to transform each augmented matrix into its
solved form. Every move and second matters: efficient solutions earn more
points and move you higher on the daily leaderboard.

Features:

- Satisfying animated row operations and solution reveals
- An interactive introduction to equations, matrices, and RREF
- Increasingly challenging generated levels
- Daily point rankings with lifetime solved totals
- Native iPhone haptics and carefully synchronized sound
- Offline game launch; internet is only needed for profiles and leaderboard data
- No ads and no cross-app tracking

Choose a username and start reducing.

## URLs

- **Support URL:** https://github.com/Netiyiy/row-echelon/issues
- **Privacy policy URL:** Replace with the deployed HTTPS address of `privacy.html`
- **Marketing URL:** Optional; use the hosted Row Echelon website if desired

## App Review notes

Row Echelon is an interactive matrix puzzle game. All gameplay code, graphics,
animations, and audio are bundled in the binary and work without downloading a
website. The app uses native SwiftUI/WebKit integration for loading and recovery,
native haptic feedback, and explicit media suspension when the app backgrounds
or the device locks.

Internet access is used only for the optional username session and daily
leaderboard at the Supabase endpoint. No email, password, payment, or external
account is required. On first launch, tap **Begin**, watch or skip the intro,
then create any available non-vulgar username. Reviewers may end the session
from the Settings menu when finished.

## App privacy answers

- **Tracking:** No
- **User ID:** Collected, linked to the user, used for App Functionality
  (the public username/profile identifier)
- **Product Interaction:** Collected, linked to the user, used for App
  Functionality (points, levels solved, steps, and completion time)
- **Advertising:** None
- **Data sold:** None

These answers must remain synchronized with `RowEchelon/PrivacyInfo.xcprivacy`
and the public privacy policy.
