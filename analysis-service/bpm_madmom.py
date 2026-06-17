#!/usr/bin/env python3
# Band-constrained, genre-aware tempo detection via madmom's RNN beat tracker.
#
#   Usage:  bpm_madmom.py <audio.(wav|...)> [genre]
#   Output: a single integer BPM on stdout (nothing at all on failure).
#
# Why this exists: bpm-tools (our old detector) reliably finds the *period* but
# often emits a metric subharmonic — and crucially can emit ¾-of-tempo values
# (e.g. 124 for a 165 track) that land *inside* any sane range, so no octave
# fold can rescue them. madmom's tempo candidates are clean octave multiples of
# the truth, so constraining its search to the genre's tempo band reliably
# recovers the right one. DJ material clusters in 110–180; hip-hop and
# downtempo get their own bands. Genuinely-sub-110 tracks tagged as generic
# "electronic" will be pushed up — those are corrected with the per-track
# manual override on the client.
import sys


def band_for(genre):
    g = (genre or "").lower()
    if any(k in g for k in ("hip hop", "hip-hop", "rap", "r&b", "rnb", "boom bap")):
        return 80, 115
    if any(k in g for k in ("downtempo", "down-tempo", "midtempo", "mid-tempo",
                            "chill", "lo-fi", "lofi", "ambient")):
        return 85, 110
    # Default: electronic (house/techno/dnb/dubstep/trap/future bass/…).
    return 110, 180


def main():
    if len(sys.argv) < 2:
        return
    wav = sys.argv[1]
    genre = sys.argv[2] if len(sys.argv) > 2 else ""
    lo, hi = band_for(genre)
    try:
        from madmom.features.beats import RNNBeatProcessor
        from madmom.features.tempo import TempoEstimationProcessor
        act = RNNBeatProcessor()(wav)
        tempi = TempoEstimationProcessor(min_bpm=lo, max_bpm=hi, fps=100)(act)
        if len(tempi):
            print(int(round(float(tempi[0][0]))))
    except Exception:
        # Stay silent: the Node caller treats no/garbage output as "no BPM"
        # (null) rather than a wrong number.
        pass


if __name__ == "__main__":
    main()
