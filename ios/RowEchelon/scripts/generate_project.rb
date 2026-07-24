#!/usr/bin/env ruby

require "fileutils"
require "xcodeproj"

root = File.expand_path("..", __dir__)
project_path = File.join(root, "RowEchelon.xcodeproj")
FileUtils.rm_rf(project_path)

project = Xcodeproj::Project.new(project_path)
project.root_object.attributes["LastSwiftUpdateCheck"] = "2660"
project.root_object.attributes["LastUpgradeCheck"] = "2660"

app_group = project.main_group.new_group("RowEchelon", "RowEchelon")
source_files = %w[
  RowEchelonApp.swift
  GameContainerView.swift
  GameWebView.swift
].map { |name| app_group.new_file(name) }

info_plist = app_group.new_file("Info.plist")
privacy_manifest = app_group.new_file("PrivacyInfo.xcprivacy")
asset_catalog = app_group.new_file("Assets.xcassets")

target = project.new_target(:application, "RowEchelon", :ios, "17.0")
target.product_reference.name = "RowEchelon.app"
target.add_file_references(source_files)
target.resources_build_phase.add_file_reference(privacy_manifest, true)
target.resources_build_phase.add_file_reference(asset_catalog, true)

common_settings = {
  "ASSETCATALOG_COMPILER_APPICON_NAME" => "AppIcon",
  "CLANG_ENABLE_MODULES" => "YES",
  "CODE_SIGN_STYLE" => "Automatic",
  "CURRENT_PROJECT_VERSION" => "6",
  "DEVELOPMENT_TEAM" => "NKW339XDW3",
  "DEVELOPMENT_ASSET_PATHS" => "",
  "ENABLE_USER_SCRIPT_SANDBOXING" => "NO",
  "GENERATE_INFOPLIST_FILE" => "NO",
  "INFOPLIST_FILE" => "RowEchelon/Info.plist",
  "IPHONEOS_DEPLOYMENT_TARGET" => "17.0",
  "LD_RUNPATH_SEARCH_PATHS" => "$(inherited) @executable_path/Frameworks",
  "MARKETING_VERSION" => "1.0",
  "PRODUCT_BUNDLE_IDENTIFIER" => "com.netiyiy.rowechelon",
  "PRODUCT_NAME" => "$(TARGET_NAME)",
  "SDKROOT" => "iphoneos",
  "SUPPORTED_PLATFORMS" => "iphoneos iphonesimulator",
  "SUPPORTS_MACCATALYST" => "NO",
  "SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD" => "NO",
  "SUPPORTS_XR_DESIGNED_FOR_IPHONE_IPAD" => "NO",
  "SWIFT_EMIT_LOC_STRINGS" => "YES",
  "SWIFT_STRICT_CONCURRENCY" => "complete",
  "SWIFT_VERSION" => "6.0",
  "TARGETED_DEVICE_FAMILY" => "1",
}

target.build_configurations.each do |configuration|
  common_settings.each { |key, value| configuration.build_settings[key] = value }
  if configuration.name == "Debug"
    configuration.build_settings["SWIFT_ACTIVE_COMPILATION_CONDITIONS"] = "DEBUG $(inherited)"
  else
    configuration.build_settings["VALIDATE_PRODUCT"] = "YES"
  end
end

project.build_configurations.each do |configuration|
  configuration.build_settings["IPHONEOS_DEPLOYMENT_TARGET"] = "17.0"
  configuration.build_settings["SDKROOT"] = "iphoneos"
end

bundle_phase = target.new_shell_script_build_phase("Bundle Web Game")
bundle_phase.shell_path = "/bin/bash"
bundle_phase.shell_script = <<~'SCRIPT'
  set -euo pipefail

  WEB_SOURCE="${SRCROOT}/../.."
  WEB_DEST="${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/Web"

  rm -rf "${WEB_DEST}"
  mkdir -p "${WEB_DEST}"
  cp "${WEB_SOURCE}/index.html" "${WEB_DEST}/index.html"
  cp "${WEB_SOURCE}/styles.css" "${WEB_DEST}/styles.css"
  cp "${WEB_SOURCE}/app.js" "${WEB_DEST}/app.js"
  cp "${WEB_SOURCE}/manifest.webmanifest" "${WEB_DEST}/manifest.webmanifest"
  cp "${WEB_SOURCE}/sw.js" "${WEB_DEST}/sw.js"
  if [[ -f "${WEB_SOURCE}/privacy.html" ]]; then
    cp "${WEB_SOURCE}/privacy.html" "${WEB_DEST}/privacy.html"
  fi
  ditto "${WEB_SOURCE}/assets" "${WEB_DEST}/assets"
SCRIPT

bundle_phase.input_paths = [
  "$(SRCROOT)/../../index.html",
  "$(SRCROOT)/../../styles.css",
  "$(SRCROOT)/../../app.js",
  "$(SRCROOT)/../../manifest.webmanifest",
  "$(SRCROOT)/../../sw.js",
  "$(SRCROOT)/../../assets",
]
bundle_phase.output_paths = [
  "$(TARGET_BUILD_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)/Web/index.html",
  "$(TARGET_BUILD_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)/Web/assets",
]

scheme = Xcodeproj::XCScheme.new
scheme.configure_with_targets(target, nil)
scheme.save_as(project_path, "RowEchelon", true)

project.save
puts "Generated #{project_path}"
