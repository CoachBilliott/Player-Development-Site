import importlib.util
import json
import pathlib
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("csr", ROOT / "scripts/create_apple_csr.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class AppleCertificateRequestTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = pathlib.Path(self.folder.name)
        (self.root / "ios").mkdir()
        (self.root / "ios/testflight.json").write_text(json.dumps({"teamId": "4T6V3S3CZL", "bundleId": "com.coachbilliott.playerdevelopment"}))

    def test_request_verifies_while_only_public_material_is_exported(self):
        details = MODULE.prepare(self.root)
        request = self.root / "public/apple-signing" / details["filename"]
        self.assertTrue(request.read_text().startswith("-----BEGIN CERTIFICATE REQUEST-----"))
        key = self.root / "ios-signing/private/apple-distribution.encrypted.pem"
        self.assertTrue(key.read_text().startswith("-----BEGIN ENCRYPTED PRIVATE KEY-----"))
        self.assertEqual(key.stat().st_mode & 0o777, 0o600)
        self.assertEqual(len(list((self.root / "public/apple-signing").iterdir())), 1)

    def test_retry_reuses_the_same_key_and_request(self):
        first = MODULE.prepare(self.root)
        key = self.root / "ios-signing/private/apple-distribution.encrypted.pem"
        before = key.read_bytes()
        self.assertEqual(MODULE.prepare(self.root), first)
        self.assertEqual(key.read_bytes(), before)

    def test_missing_key_does_not_silently_replace_a_published_request(self):
        MODULE.prepare(self.root)
        (self.root / "ios-signing/private/apple-distribution.encrypted.pem").unlink()
        with self.assertRaises(ValueError):
            MODULE.prepare(self.root)


if __name__ == "__main__":
    unittest.main()
