# Row Echelon for iOS

This Xcode project packages the game inside the app bundle and presents it in a
native SwiftUI/WebKit container. The website is not downloaded at launch. The
only required network feature is the Supabase-backed account and leaderboard.

Native integration includes:

- iPhone haptic feedback for controls and successful solves.
- Explicit media suspension when the app backgrounds or the phone locks.
- Persistent WebKit storage for the player session.
- A native loading/error state and automatic WebKit process recovery.
- App Store icon, launch color, and privacy manifest.

## Open and run

1. Open `RowEchelon.xcodeproj` in Xcode 26.6 or later.
2. Select the `RowEchelon` target, then **Signing & Capabilities**.
3. Confirm the preselected Apple Developer team `NKW339XDW3`.
4. Confirm or replace the bundle identifier `com.netiyiy.rowechelon`.
5. Select an iPhone simulator or connected iPhone and press Run.

The `Bundle Web Game` build phase copies the current web game and assets into
the app. Web changes therefore appear in the next Xcode build without keeping a
second copy of the game files.

## Regenerate the project

The checked-in project is ready to open. If its generator needs to be rerun:

```bash
gem install --user-install xcodeproj --no-document
ruby scripts/generate_project.rb
```

## Archive

After configuring signing, select **Any iOS Device (arm64)** and choose
**Product > Archive**. Validate the archive in Organizer before uploading to
App Store Connect.

Use `APP_STORE_METADATA.md` as the product-page and App Review notes draft, and
work through `APP_STORE_CHECKLIST.md` before uploading the archive.
