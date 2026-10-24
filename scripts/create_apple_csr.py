"""Prepare/reuse an encrypted local key and a public Apple certificate request.

The caller must have owner authorization before running this command. Private
material stays in the ignored ios-signing/private directory, never tool output.
"""
import hashlib
import json
import os
import pathlib
import secrets
import subprocess
import sys


def openssl(*arguments):
    result = subprocess.run(["openssl", *map(str, arguments)], capture_output=True)
    if result.returncode:
        raise ValueError("OpenSSL could not prepare or verify the signing request.")
    return result.stdout


def prepare(root):
    root = pathlib.Path(root)
    config = json.loads((root / "ios/testflight.json").read_text())
    private = root / "ios-signing/private"
    public = root / "public/apple-signing"
    private.mkdir(parents=True, exist_ok=True, mode=0o700)
    private.chmod(0o700)
    key = private / "apple-distribution.encrypted.pem"
    password = private / "key-passphrase.txt"
    metadata = private / "request.json"
    existing = [p.exists() for p in [key, password, metadata]]
    if any(existing):
        if not all(existing):
            raise ValueError("Signing material is incomplete. Existing keys will not be overwritten.")
        details = json.loads(metadata.read_text())
        if details["teamId"] != config["teamId"] or details["bundleId"] != config["bundleId"]:
            raise ValueError("Existing signing request belongs to different project settings.")
        filename = details["filename"]
        if pathlib.Path(filename).name != filename:
            raise ValueError("Invalid certificate request filename.")
        request = public / filename
    else:
        if public.exists() and list(public.glob("*.certSigningRequest")):
            raise ValueError("A public request exists without its private key. Do not create its Apple certificate until the key is recovered or a replacement request is prepared.")
        descriptor = os.open(password, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w") as handle:
            handle.write(secrets.token_urlsafe(48) + "\n")
        openssl("genpkey", "-algorithm", "RSA", "-aes-256-cbc", "-pass", f"file:{password}", "-pkeyopt", "rsa_keygen_bits:2048", "-out", key)
        key.chmod(0o600)
        request = private / "pending.certSigningRequest"
        openssl("req", "-new", "-sha256", "-key", key, "-passin", f"file:{password}", "-subj", f'/CN=Player Development Distribution/OU={config["teamId"]}', "-out", request)
        public_key = openssl("req", "-in", request, "-pubkey", "-noout")
        fingerprint = hashlib.sha256(public_key).hexdigest()
        filename = f'PlayerDevelopment-{fingerprint[:12]}.certSigningRequest'
        public.mkdir(parents=True, exist_ok=True)
        target = public / filename
        target.write_bytes(request.read_bytes())
        target.chmod(0o644)
        request.unlink()
        request = target
        details = {**config, "filename": filename, "publicKeySHA256": fingerprint, "appleCertificateCreated": False}
        descriptor = os.open(metadata, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w") as handle:
            json.dump(details, handle, indent=2)
    openssl("req", "-in", request, "-verify", "-noout")
    public_key = openssl("req", "-in", request, "-pubkey", "-noout")
    if hashlib.sha256(public_key).hexdigest() != details["publicKeySHA256"]:
        raise ValueError("The public request has changed.")
    if public_key != openssl("pkey", "-in", key, "-passin", f"file:{password}", "-pubout"):
        raise ValueError("Certificate request does not match the encrypted private key.")
    return details


if __name__ == "__main__":
    try:
        print(json.dumps(prepare(pathlib.Path(__file__).resolve().parents[1]), indent=2))
    except (ValueError, OSError, KeyError, json.JSONDecodeError) as error:
        sys.exit(f"Certificate request setup stopped: {error}")
