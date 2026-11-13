#!/usr/bin/env python3
"""Zählt, wie oft ein Text (von stdin) in einer Datei vorkommt.

Aufruf:
  python3 -I zaehle.py <datei> [--norm] <<'EOF'
  zu suchender Text (darf mehrzeilig sein; ein abschließender Zeilenumbruch wird entfernt)
  EOF

--norm  vergleicht mit zusammengefassten Leerräumen (Zeilenumbrüche, Mehrfachleerzeichen,
        geschützte Leerzeichen gelten als ein Leerzeichen) und ohne Markdown-Zitatzeichen „> “.
"""
import re
import sys


def normalize(text: str) -> str:
    text = re.sub(r"(?m)^>\s?", "", text)
    text = text.replace(" ", " ").replace(" ", " ")
    return re.sub(r"\s+", " ", text).strip()


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        sys.exit(__doc__)
    needle = sys.stdin.read()
    if needle.endswith("\n"):
        needle = needle[:-1]
    haystack = open(args[0], encoding="utf-8").read()
    if "--norm" in sys.argv:
        needle, haystack = normalize(needle), normalize(haystack)
    if not needle:
        sys.exit("leerer Suchtext")
    print(haystack.count(needle))


if __name__ == "__main__":
    main()
