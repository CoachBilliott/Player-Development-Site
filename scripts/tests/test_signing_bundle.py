import base64
import importlib.util
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("bundle", ROOT / "scripts/prepare_signing_bundle.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
CONFIG = {"teamId": "4T6V3S3CZL", "bundleId": "com.coachbilliott.playerdevelopment"}
FIXTURE = {"version": 1, **CONFIG, "certificatePassword": "fictional-fixture-password-long-enough", "certificateP12Base64": base64.b64encode(b'fictional-p12').decode(), "profileBase64": base64.b64encode(b'fictional-profile').decode()}


class SigningBundleTests(unittest.TestCase):
    def test_private_payload_decodes_to_only_the_required_fixed_files(self):
        files = MODULE.decode_bundle(json.dumps(FIXTURE), CONFIG)
        self.assertEqual(files["distribution.p12"], b"fictional-p12")
        self.assertEqual(files["distribution.mobileprovision"], b"fictional-profile")
        self.assertEqual(files["certificate-password.txt"], FIXTURE["certificatePassword"].encode())
        self.assertEqual(len(files), 3)

    def test_other_team_or_app_payload_is_rejected(self):
        for change in [{"teamId": "OTHERTEAM1"}, {"bundleId": "unrelated.app"}, {"version": 2}]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                MODULE.decode_bundle(json.dumps({**FIXTURE, **change}), CONFIG)

    def test_malformed_or_unsafe_payload_is_rejected(self):
        for change in [{"certificatePassword": "short"}, {"certificatePassword": "x" * 40 + '\n'}, {"profileBase64": "invalid!"}, {"certificateP12Base64": ""}]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                MODULE.decode_bundle(json.dumps({**FIXTURE, **change}), CONFIG)
        with self.assertRaises(ValueError):
            MODULE.decode_bundle('x' * (48 * 1024 + 1), CONFIG)


if __name__ == "__main__":
    unittest.main()
