#!/usr/bin/env python3
# Repeating chord-loop detection for SoundCloud tracks, via madmom (CNN chord
# features + CRF recognition — the same library we already bundle for BPM).
#
#   Usage:  chords_madmom.py <audio.wav> [camelot]
#   Output: a JSON array of the loop's chords in cyclic order, spelled to the
#           track's key and rotated to start on the tonic, e.g.
#               ["Db","Ab","Eb","Bbm"]
#           or the literal `null` when there's no clear repeating loop
#           (busy / percussive / tooly tracks).
#
# We detect the *loop* (the N chords, in order), not a timeline: collapse
# madmom's chord timeline, keep the core chords covering ~85% of the time, then
# reconstruct the cyclic order from the most-common chord-to-chord transitions
# (robust to a stray passing chord). The optional camelot (our keyfinder result)
# only picks the starting rotation + flat/sharp spelling — the cycle itself is
# key-independent.
import sys, json
from collections import Counter

SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
# camelot -> (tonic pitch-class, mode, use_flats)
CAM = {
 '8B':(0,'maj',False),'9B':(7,'maj',False),'10B':(2,'maj',False),'11B':(9,'maj',False),
 '12B':(4,'maj',False),'1B':(11,'maj',False),'2B':(6,'maj',False),'3B':(1,'maj',True),
 '4B':(8,'maj',True),'5B':(3,'maj',True),'6B':(10,'maj',True),'7B':(5,'maj',True),
 '8A':(9,'min',False),'9A':(4,'min',False),'10A':(11,'min',False),'11A':(6,'min',False),
 '12A':(1,'min',False),'1A':(8,'min',False),'2A':(3,'min',True),'3A':(10,'min',True),
 '4A':(5,'min',True),'5A':(0,'min',True),'6A':(7,'min',True),'7A':(2,'min',True),
}

def parse(label):  # "C#:maj" -> (pitch-class, is_minor)
    n, q = label.split(':')
    pc = SHARP.index(n) if n in SHARP else (FLAT.index(n) if n in FLAT else None)
    return pc, (q == 'min')

def name(pc, is_min, use_flats):
    return (FLAT if use_flats else SHARP)[pc] + ('m' if is_min else '')

def collapse(segs, min_dur=0.8):
    seq = []
    for s, e, l in segs:
        if l == 'N' or (e - s) < min_dur:
            continue
        if not seq or seq[-1] != l:
            seq.append(l)
    return seq

def dedup(s):
    out = []
    for c in s:
        if not out or out[-1] != c:
            out.append(c)
    return out

def core_chords(seq, cover=0.85, cap=6):
    cnt = Counter(seq); total = len(seq); cum = 0; core = []
    for c, n in cnt.most_common():
        core.append(c); cum += n
        if cum / total >= cover or len(core) >= cap:
            break
    return core, sum(cnt[c] for c in core) / total

def loop_order(seq, core):
    cs = set(core); sf = dedup([c for c in seq if c in cs])
    trans = Counter(zip(sf, sf[1:]))
    start = Counter(sf).most_common(1)[0][0]; cyc = [start]; cur = start
    while len(cyc) < len(cs):
        cand = [(nx, n) for (a, nx), n in trans.items() if a == cur and nx not in cyc]
        if not cand:
            break
        cur = max(cand, key=lambda x: x[1])[0]; cyc.append(cur)
    return cyc

def rotate(cyc, tonic, mode):
    want = (mode == 'min')
    for i, l in enumerate(cyc):
        pc, m = parse(l)
        if pc == tonic and m == want:
            return cyc[i:] + cyc[:i]
    for i, l in enumerate(cyc):
        pc, _ = parse(l)
        if pc == tonic:
            return cyc[i:] + cyc[:i]
    return cyc

def main():
    if len(sys.argv) < 2:
        print("null"); return
    wav = sys.argv[1]
    info = CAM.get(sys.argv[2] if len(sys.argv) > 2 else "")
    use_flats = info[2] if info else False
    try:
        from madmom.features.chords import CNNChordFeatureProcessor, CRFChordRecognitionProcessor
        raw = CRFChordRecognitionProcessor()(CNNChordFeatureProcessor()(wav))
        segs = [(float(s), float(e), (l.decode() if isinstance(l, bytes) else str(l)))
                for s, e, l in raw]
    except Exception:
        print("null"); return
    seq = collapse(segs)
    if not seq:
        print("null"); return
    core, cov = core_chords(seq)
    if len(core) > 5 or cov < 0.6:   # busy / no clear loop
        print("null"); return
    cyc = loop_order(seq, core)
    if info:
        cyc = rotate(cyc, info[0], info[1])
    print(json.dumps([name(*parse(l), use_flats) for l in cyc]))

main()
