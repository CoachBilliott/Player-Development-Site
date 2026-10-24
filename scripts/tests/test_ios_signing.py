import copy
import datetime
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("signing", ROOT / "scripts/prepare_ios_signing.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
CONFIG = {"teamId": "4T6V3S3CZL", "bundleId": "com.coachbilliott.playerdevelopment"}
PROFILE = {
    "UUID": "10000000-0000-4000-8000-000000000001",
    "TeamIdentifier": [CONFIG["teamId"]],
    "Platform": ["iOS"],
    "ExpirationDate": datetime.datetime(2099, 1, 1),
    "Entitlements": {"application-identifier": f'{CONFIG["teamId"]}.{CONFIG["bundleId"]}', "get-task-allow": False},
}


class SigningProfileTests(unittest.TestCase):
    def test_valid_profile_exports_only_the_dedicated_team_and_app(self):
        options = MODULE.export_options(PROFILE, CONFIG)
        self.assertEqual(options["method"], "app-store-connect")
        self.assertEqual(options["provisioningProfiles"], {CONFIG["bundleId"]: PROFILE["UUID"]})
        self.assertFalse(options["manageAppVersionAndBuildNumber"])

    def test_other_teams_apps_and_wildcard_profiles_are_rejected(self):
        for team, identifier in [("OTHERTEAM1", "OTHERTEAM1.app"), (CONFIG["teamId"], f'{CONFIG["teamId"]}.another.app'), (CONFIG["teamId"], f'{CONFIG["teamId"]}.*')]:
            profile = copy.deepcopy(PROFILE)
            profile["TeamIdentifier"] = [team]
            profile["Entitlements"]["application-identifier"] = identifier
            with self.subTest(team=team, identifier=identifier), self.assertRaises(ValueError):
                MODULE.export_options(profile, CONFIG)

    def test_expired_or_non_store_profiles_are_rejected(self):
        for change in [{"ExpirationDate": datetime.datetime(2000, 1, 1)}, {"ProvisionedDevices": ["fictional-device"]}, {"ProvisionsAllDevices": True}, {"Platform": ["tvOS"]}, {"UUID": "invalid"}]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                MODULE.export_options({**PROFILE, **change}, CONFIG)
        profile = copy.deepcopy(PROFILE)
        profile["Entitlements"]["get-task-allow"] = True
        with self.assertRaises(ValueError):
            MODULE.export_options(profile, CONFIG)


if __name__ == "__main__":
    unittest.main()
