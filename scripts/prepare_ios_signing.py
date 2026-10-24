"""Validate a dedicated App Store profile and prepare a manual export.

The caller decodes Apple's signed mobileprovision with `security cms` first.
Only public identifiers are emitted; this script never reads private keys.
"""
import datetime
import json
import pathlib
import plistlib
import sys
import uuid


def export_options(profile, config, now=None, certificate=None):
    now = now or datetime.datetime.now(datetime.timezone.utc)
    entitlements = profile.get("Entitlements", {})
    if config["teamId"] not in profile.get("TeamIdentifier", []):
        raise ValueError("Provisioning profile belongs to a different Apple team.")
    expected = f'{config["teamId"]}.{config["bundleId"]}'
    if entitlements.get("application-identifier") != expected:
        raise ValueError("Provisioning profile does not match the Player Development app.")
    expiry = profile.get("ExpirationDate")
    if not isinstance(expiry, datetime.datetime) or expiry.replace(tzinfo=datetime.timezone.utc) <= now:
        raise ValueError("Provisioning profile is expired or has no valid expiration.")
    if entitlements.get("get-task-allow") is not False or "ProvisionedDevices" in profile or profile.get("ProvisionsAllDevices"):
        raise ValueError("An App Store distribution profile is required, not a development, ad-hoc or enterprise profile.")
    if "iOS" not in profile.get("Platform", []):
        raise ValueError("An iOS provisioning profile is required.")
    profile_uuid = profile.get("UUID", "")
    if not isinstance(profile_uuid, str) or str(uuid.UUID(profile_uuid)).lower() != profile_uuid.lower():
        raise ValueError("Invalid provisioning profile UUID.")
    if certificate is not None and certificate not in profile.get("DeveloperCertificates", []):
        raise ValueError("Provisioning profile does not include the imported signing certificate.")
    return {
        "method": "app-store-connect",
        "destination": "export",
        "signingStyle": "manual",
        "teamID": config["teamId"],
        "signingCertificate": "Apple Distribution",
        "provisioningProfiles": {config["bundleId"]: profile_uuid},
        "manageAppVersionAndBuildNumber": False,
        "uploadSymbols": True,
    }


def main():
    config = json.loads((pathlib.Path(__file__).resolve().parents[1] / "ios/testflight.json").read_text())
    with open(sys.argv[1], "rb") as handle:
        profile = plistlib.load(handle)
    certificate = pathlib.Path(sys.argv[3]).read_bytes() if len(sys.argv) > 3 else None
    options = export_options(profile, config, certificate=certificate)
    with open(sys.argv[2], "wb") as handle:
        plistlib.dump(options, handle)
    print(f'team_id={config["teamId"]}')
    print(f'bundle_id={config["bundleId"]}')
    print(f'profile_uuid={options["provisioningProfiles"][config["bundleId"]]}')


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError, plistlib.InvalidFileException) as error:
        sys.exit(f"Signing setup stopped: {error}")
