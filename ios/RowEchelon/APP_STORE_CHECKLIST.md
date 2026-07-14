# App Store submission checklist

## Required before upload

- [ ] Join the Apple Developer Program and accept current agreements.
- [ ] Create the App Store Connect record for **Row Echelon**.
- [ ] Set the target's Apple Developer team in Signing & Capabilities.
- [ ] Confirm that `com.netiyiy.rowechelon` is available, or replace it in the
      target settings and App Store Connect.
- [ ] Host `privacy.html` publicly and enter that HTTPS URL as the privacy
      policy URL in App Store Connect.
- [ ] Enter app privacy answers matching `PrivacyInfo.xcprivacy`: username and
      gameplay interaction data are linked to the profile for app functionality;
      there is no tracking.
- [ ] Supply a support URL and monitored support contact.
- [ ] Prepare iPhone screenshots, description, subtitle, keywords, category,
      copyright, and the current age-rating questionnaire. A starting draft is
      in `APP_STORE_METADATA.md`.
- [ ] Add App Review notes explaining that gameplay is bundled offline, while
      accounts and the daily leaderboard use the Supabase service.
- [ ] Provide a reviewer username workflow: usernames are temporary sessions,
      require no email or password, and can be created from the intro flow.

## Device testing

- [ ] Test the intro and both intro SFX on a physical iPhone with Sound enabled.
- [ ] Lock the phone during music and confirm all audio stops immediately.
- [ ] Background and restore the app during a level.
- [ ] Test on Wi-Fi, cellular, offline, and an IPv6-only network.
- [ ] Verify username moderation, session timeout, score submission, daily
      leaderboard reset, and lifetime solved count.
- [ ] Test the smallest and largest supported iPhone screen sizes.
- [ ] Verify the app icon has no transparency and the launch screen has no jump.

## Archive and submission

- [ ] Increment `CURRENT_PROJECT_VERSION` for every upload.
- [ ] Use Xcode 26 or later and the iOS 26 SDK or later.
- [ ] Run Analyze and a Release build with no warnings that affect submission.
- [ ] Archive, validate, and upload from Xcode Organizer.
- [ ] Test the uploaded build in TestFlight before submitting for review.
