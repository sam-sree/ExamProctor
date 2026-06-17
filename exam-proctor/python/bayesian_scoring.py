from typing import List, Dict, Any, Optional

class BayesianScoringAgent:
    def __init__(self):
        # Prior probability of cheating P(C)
        self.prior_cheat = 0.05
        self.prior_honest = 0.95
        
        # Likelihood parameters: P(E | C) and P(E | H)
        self.params = {
            "GAZE_DEVIATION":        {"cheat": 0.60, "honest": 0.15},
            "FACE_ABSENT":           {"cheat": 0.50, "honest": 0.05},
            "MULTIPLE_FACES":        {"cheat": 0.80, "honest": 0.01},
            "HEAD_POSE_VIOLATION":   {"cheat": 0.50, "honest": 0.10},
            "BACKGROUND_AUDIO":      {"cheat": 0.40, "honest": 0.12},
            "WINDOW_BLUR":           {"cheat": 0.70, "honest": 0.08},
            "PASTE_DETECTED":        {"cheat": 0.90, "honest": 0.01},
            "SHORTCUT_ATTEMPT":      {"cheat": 0.75, "honest": 0.05},
            "FULLSCREEN_EXIT":       {"cheat": 0.85, "honest": 0.02},
            "BLUETOOTH_CONNECTED":   {"cheat": 0.95, "honest": 0.01}
        }

    def calculate_integrity_score(
        self,
        warning_log: List[Dict[str, Any]],
        shortcut_log: List[Dict[str, Any]],
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Calculates the trustworthiness score as a percentage (1 - P(C | E)) * 100
        using Naive Bayes update on observed warnings.
        """
        # Count occurrences per event type
        counts: Dict[str, int] = {k: 0 for k in self.params.keys()}

        # 1. Parse standard warning logs
        for warning in warning_log:
            w_type = warning.get("type")
            if w_type in counts:
                counts[w_type] += 1
            # Special case for legacy keys
            elif w_type == 'BLUETOOTH_CONNECTED':
                counts['BLUETOOTH_CONNECTED'] += 1

        # 2. Parse shortcut attempts
        counts["SHORTCUT_ATTEMPT"] = len(shortcut_log)

        # 3. Parse explicit flags in metadata
        if metadata.get("bluetoothDeviceDetected"):
            counts["BLUETOOTH_CONNECTED"] = max(counts["BLUETOOTH_CONNECTED"], 1)
        
        # 4. Cap count of each event type at 3 to avoid extreme bias from a single noisy sensor
        for k in counts:
            counts[k] = min(counts[k], 3)

        # Start with prior odds: Odds(C) = P(C) / P(H)
        odds = self.prior_cheat / self.prior_honest

        # Multiply by likelihood ratios for each observed event instance
        for event_type, count in counts.items():
            if count > 0:
                p_c = self.params[event_type]["cheat"]
                p_h = self.params[event_type]["honest"]
                likelihood_ratio = p_c / p_h
                # Odds update: Odds(C | E) = Odds(C) * (Likelihood Ratio)^count
                odds *= (likelihood_ratio ** count)

        # Convert odds back to posterior probability: P(C | E) = Odds / (1 + Odds)
        p_cheating = odds / (1.0 + odds)
        
        # Trustworthiness score is the probability of integrity: 1.0 - P(C | E)
        trustworthiness = (1.0 - p_cheating) * 100.0

        # Classification based on threshold
        if p_cheating <= 0.50:
            status = "approved"
        elif p_cheating <= 0.85:
            status = "review_required"
        else:
            status = "flagged"

        return {
            "trustworthinessScore": round(trustworthiness, 1),
            "classification": status,
            "cheatProbability": round(p_cheating * 100.0, 1),
            "eventCounts": counts
        }
