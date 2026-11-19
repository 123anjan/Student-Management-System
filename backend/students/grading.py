"""Grading scale. Identical to frontend/assets/js/grading.js so both sides agree."""

BANDS = [("A", 90), ("B", 80), ("C", 70), ("D", 60)]
LETTERS = ["A", "B", "C", "D", "F"]


def percent(score, maximum):
    return (score / maximum) * 100 if maximum > 0 else 0


def letter_for(pct):
    for letter, minimum in BANDS:
        if pct >= minimum:
            return letter
    return "F"
