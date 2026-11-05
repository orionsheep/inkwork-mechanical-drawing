"""Subset the plate's fonts to the characters the app actually uses.

Usage:
    python scripts/subset-fonts.py <dir with the source fonts>

Source fonts (SIL OFL):
    NotoSerifSC-Regular.otf / -SemiBold.otf / -Black.otf
        https://github.com/notofonts/noto-cjk/tree/main/Serif/SubsetOTF/SC
    CormorantGaramond[wght].ttf, CormorantGaramond-Italic[wght].ttf
        https://github.com/google/fonts/tree/main/ofl/cormorantgaramond

Writes woff2 files to public/fonts/. Re-run after adding Chinese text.
"""
import pathlib
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "fonts"


def used_text() -> str:
    chars = set(chr(c) for c in range(0x20, 0x7F))
    chars |= set("·—–×°→←↑↓↗●○…“”‘’「」《》〈〉、。，：；！？（）【】％＋－～")
    for path in [ROOT / "index.html", *ROOT.glob("src/**/*.ts"), *ROOT.glob("src/**/*.tsx"), *ROOT.glob("src/**/*.css")]:
        chars |= set(path.read_text(encoding="utf-8"))
    return "".join(sorted(c for c in chars if c >= " "))


def write(font: TTFont, text: str, name: str) -> None:
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    sub = subset.Subsetter(options)
    sub.populate(text=text)
    sub.subset(font)
    font.flavor = "woff2"
    target = OUT / name
    font.save(target)
    print(f"{name}: {target.stat().st_size // 1024} KB")


def main() -> None:
    src = pathlib.Path(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    text = used_text()
    latin = "".join(c for c in text if ord(c) < 0x2E80)
    for weight, file in [(400, "Regular"), (600, "SemiBold"), (900, "Black")]:
        write(TTFont(src / f"NotoSerifSC-{file}.otf"), text, f"noto-serif-sc-{weight}.woff2")
    for weight in (500, 600):
        font = instancer.instantiateVariableFont(TTFont(src / "CormorantGaramond[wght].ttf"), {"wght": weight})
        write(font, latin, f"cormorant-{weight}.woff2")
    font = instancer.instantiateVariableFont(TTFont(src / "CormorantGaramond-Italic[wght].ttf"), {"wght": 500})
    write(font, latin, "cormorant-500-italic.woff2")


if __name__ == "__main__":
    main()
