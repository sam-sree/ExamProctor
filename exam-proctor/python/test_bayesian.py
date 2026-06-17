import unittest
from bayesian_scoring import BayesianScoringAgent

class TestBayesianScoringAgent(unittest.TestCase):
    def setUp(self):
        self.agent = BayesianScoringAgent()

    def test_clean_session(self):
        # No warnings or shortcuts
        res = self.agent.calculate_integrity_score([], [], {})
        self.assertGreater(res["trustworthinessScore"], 90.0)
        self.assertEqual(res["classification"], "approved")

    def test_minor_warnings(self):
        # A single gaze deviation
        res = self.agent.calculate_integrity_score(
            [{"type": "GAZE_DEVIATION"}],
            [],
            {}
        )
        self.assertLess(res["trustworthinessScore"], 90.0)
        self.assertEqual(res["classification"], "approved")

    def test_suspect_warnings(self):
        # Multiple different warnings (e.g. GAZE_DEVIATION + WINDOW_BLUR)
        res = self.agent.calculate_integrity_score(
            [{"type": "GAZE_DEVIATION"}, {"type": "WINDOW_BLUR"}],
            [],
            {}
        )
        self.assertLess(res["trustworthinessScore"], 70.0)
        self.assertEqual(res["classification"], "review_required")

    def test_flagged_warnings(self):
        # High suspicion events like PASTE_DETECTED + WINDOW_BLUR + SHORTCUT_ATTEMPT
        res = self.agent.calculate_integrity_score(
            [{"type": "WINDOW_BLUR"}, {"type": "PASTE_DETECTED"}],
            [{"shortcut": "Ctrl+C"}],
            {}
        )
        self.assertLess(res["trustworthinessScore"], 30.0)
        self.assertEqual(res["classification"], "flagged")

    def test_event_capping(self):
        # Capping at 3: 10 gaze deviations should yield same score as 3 gaze deviations
        res_3 = self.agent.calculate_integrity_score(
            [{"type": "GAZE_DEVIATION"}] * 3,
            [],
            {}
        )
        res_10 = self.agent.calculate_integrity_score(
            [{"type": "GAZE_DEVIATION"}] * 10,
            [],
            {}
        )
        self.assertEqual(res_3["trustworthinessScore"], res_10["trustworthinessScore"])
        self.assertEqual(res_3["classification"], res_10["classification"])

    def test_bluetooth_and_fullscreen_disqualifies(self):
        # One BLUETOOTH_CONNECTED event plus one FULLSCREEN_EXIT event should exceed 0.85 P(C|E)
        res = self.agent.calculate_integrity_score(
            [{"type": "BLUETOOTH_CONNECTED"}, {"type": "FULLSCREEN_EXIT"}],
            [],
            {}
        )
        self.assertGreater(res["cheatProbability"], 85.0)
        self.assertEqual(res["classification"], "flagged")

    def test_three_background_audio_does_not_disqualify(self):
        # Three BACKGROUND_AUDIO events should NOT cross the 0.85 P(C|E) threshold
        res = self.agent.calculate_integrity_score(
            [{"type": "BACKGROUND_AUDIO"}] * 3,
            [],
            {}
        )
        self.assertLessEqual(res["cheatProbability"], 85.0)
        self.assertIn(res["classification"], ["approved", "review_required"])

if __name__ == '__main__':
    unittest.main()
