"""Decode a private repository signing secret without logging its contents."""
import base64
import json
import os
import pathlib
import sys


def decode_bundle(raw, config):
    if len(raw.encode()) > 48 * 1024:
        raise ValueError("Signing bundle exceeds the repository secret size limit.")
    data = json.loads(raw)
    if not isinstance(data, dict) or data.get("version") != 1 or data.get("teamId") != config["teamId"] or data.get("bundleId") != config["bundleId"]:
        raise ValueError("Signing bundle is not for this team and app.")
    password = data.get("certificatePassword", "")
    if not isinstance(password, str) or not 32 <= len(password) <= 512 or any(ord(c) < 32 for c in password):
        raise ValueError("A strong, single-line certificate password is required.")
    files = {}
    for key, name in [("certificateP12Base64", "distribution.p12"), ("profileBase64", "distribution.mobileprovision")]:
        value = data.get(key)
        if not isinstance(value, str):
            raise ValueError("Signing bundle is missing a required file.")
        decoded = base64.b64decode(''.join(value.split()), validate=True)
        if not decoded:
            raise ValueError("Signing bundle contains an empty file.")
        files[name] = decoded
    files["certificate-password.txt"] = password.encode()
    return files


def main():
    root = pathlib.Path(__file__).resolve().parents[1]
    config = json.loads((root / "ios/testflight.json").read_text())
    files = decode_bundle(os.environ["PD_IOS_SIGNING_BUNDLE_JSON"], config)
    folder = pathlib.Path(sys.argv[1])
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    folder.chmod(0o700)
    for name, value in files.items():
        descriptor = os.open(folder / name, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(value)
        (folder / name).chmod(0o600)
    if os.environ.get("GITHUB_ACTIONS") == "true":
        password = files["certificate-password.txt"].decode().replace('%', '%25')
        print("::add-mask::" + password)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError) as error:
        sys.exit(f"Signing bundle setup stopped: {error}")
