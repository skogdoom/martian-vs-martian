"""Capture/verify Pixi references against the actual Vite development app."""
import argparse
import hashlib
import json
import platform
import shutil
import tempfile
from importlib.metadata import version
from pathlib import Path

from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[2]
GOLDEN = ROOT / "baselines/pixi"


def overview(output):
    names = ["title-0", "settings-0", "countdown-0", "play-0", "pause-0", "result-0", "tally-0",
             "sudden-death-0", "stress-0", "power-cowRain-0", "season-christmas-0", "season-new-year-2",
             "season-midsummer-0", "season-may4-0", "season-halloween-0", "layout-4x3-0"]
    canvas = Image.new("RGB", (1280, 840), "#101629")
    draw = ImageDraw.Draw(canvas)
    for i, name in enumerate(names):
        image = ImageOps.contain(Image.open(output / f"screens/{name}.png").convert("RGB"), (320, 180))
        x, y = i % 4 * 320, i // 4 * 210
        canvas.paste(image, (x + (320 - image.width) // 2, y))
        draw.text((x + 6, y + 185), name, fill="white")
    canvas.save(output / "overview.png")


def cases():
    result = []

    def add(name, kind, options=None, date="2026-10-11", size=(1280, 720), dpr=1, frames=1):
        result.append(dict(name=name, kind=kind, options=options or {}, date=date,
                           viewport=dict(width=size[0], height=size[1]), dpr=dpr, frames=frames))

    for kind in ["title", "settings", "countdown", "play", "pause", "result", "tally", "sudden-death"]:
        add(kind, kind, {"rounds": 1} if kind in ["tally", "sudden-death"] else
            {"steps": 1} if kind == "countdown" else {}, frames=3 if kind == "play" else 1)
    for length in [60, 90, 120]:
        for rounds in [1, 3, 5, 7]:
            add(f"options-{length}-{rounds}", "title", dict(length=length, rounds=rounds))
    for difficulty in ["easy", "normal", "hard"]:
        add(f"solo-title-{difficulty}", "title", dict(players=1, difficulty=difficulty))
        add(f"solo-play-{difficulty}", "play", dict(players=1, difficulty=difficulty, steps=180), frames=3)
    for name, size in [("16x10", (1440, 900)), ("4x3", (1024, 768)),
                       ("ultrawide", (2000, 720)), ("portrait", (600, 1200))]:
        add(f"layout-{name}", "play", size=size)
    add("layout-4x3-fixed", "play", dict(ratio169=True), size=(1024, 768))
    add("layout-dpr2", "play", dpr=2)
    add("layout-dpr3-capped", "play", dpr=3)
    for power in ["speed", "laser", "triple", "steal", "rocket", "twin", "bomb", "unlimited",
                  "shield", "cowRain", "lambRain", "timeBomb", "parachute"]:
        add(f"power-{power}", "play", dict(power=power, steps=1), frames=3)
    add("stress", "stress", frames=3)
    for name, date in [("christmas", "2026-12-24"), ("new-year", "2026-12-31"),
                       ("midsummer", "2026-06-19"), ("may4", "2026-05-04"), ("halloween", "2026-10-31")]:
        add(f"season-{name}", "title", {"steps": 300} if name in ["new-year", "may4", "halloween"] else {}, date=date, frames=3)
    return result


def open_page(browser, base, case):
    context = browser.new_context(viewport=case["viewport"], device_scale_factor=case["dpr"])
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.add_init_script(path=str(ROOT / "scripts/baseline/init.js"))
    page.goto(f"{base}/?date={case['date']}", wait_until="networkidle")
    page.wait_for_function("!!window.__game", polling=50)
    page.evaluate("async () => { window.baseline = await import('/scripts/baseline/browser.js'); }")
    return context, page, errors


def visual_capture(browser, args, output):
    entries = []
    for case in cases():
        context, page, errors = open_page(browser, args.base_url, case)
        try:
            page.evaluate("c => baseline.prepare(c.kind, c.options)", case)
            for frame in range(case["frames"]):
                if frame:
                    page.evaluate("() => baseline.advance(30)")
                metadata = page.evaluate("() => baseline.inspect()")
                relative = f"screens/{case['name']}-{frame}.png"
                target = output / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(target), animations="disabled", scale="css")
                sha = hashlib.sha256(target.read_bytes()).hexdigest()
                entries.append(dict(file=relative, sha256=sha, case=case, frame=frame,
                                    additionalSteps=frame * 30, metadata=metadata))
            if errors:
                raise RuntimeError(f"{case['name']}: browser errors: {errors}")
            print(f"Captured {case['name']} ({case['frames']} frame(s))", flush=True)
        finally:
            context.close()
    manifest = dict(schema=1, engine="pixi", browser=browser.version, playwright=version("playwright"),
                    pixelPolicy="At most 64 pixels may differ, by at most 1 in any RGB channel; no masks.",
                    screenshotScale="css (backing-store DPI is separately recorded)", captures=entries)
    (output / "visuals.json").write_text(json.dumps(manifest, indent=2) + "\n")
    overview(output)
    if not args.write:
        expected = json.loads((GOLDEN / "visuals.json").read_text())
        if {e["file"] for e in entries} != {e["file"] for e in expected["captures"]}:
            raise RuntimeError("Visual case list changed; review before replacing references")
        goldens = {e["file"]: e for e in expected["captures"]}
        failures, rounding = [], []
        for entry in entries:
            if entry["sha256"] == goldens[entry["file"]]["sha256"]:
                continue
            actual = Image.open(output / entry["file"]).convert("RGB")
            reference = Image.open(GOLDEN / entry["file"]).convert("RGB")
            if actual.size != reference.size:
                failures.append(entry["file"])
                continue
            diff = ImageChops.difference(actual, reference)
            changed = sum(1 for pixel in diff.get_flattened_data() if max(pixel) > 0)
            maximum = max(high for _low, high in diff.getextrema())
            if maximum > 1 or changed > 64:
                failures.append(entry["file"])
            else:
                rounding.append(dict(file=entry["file"], changedPixels=changed, maximumChannelDifference=maximum))
        (output / "verification.json").write_text(json.dumps(dict(failures=failures, rounding=rounding), indent=2) + "\n")
        if failures:
            raise RuntimeError(f"Visual drift in {len(failures)} images: {failures}; artifacts: {output}")
        print(f"Verified all {len(entries)} images ({len(rounding)} within bounded GPU rounding tolerance)", flush=True)


def performance_capture(browser, args, output):
    samples = []
    for profile, date in [("ordinary", "2026-10-11"), ("stress", "2026-10-11"),
                          ("snow", "2026-12-24"), ("fireworks", "2026-12-31")]:
        for repeat in range(args.repeats):
            case = dict(viewport=dict(width=1280, height=720), dpr=1, date=date)
            context, page, errors = open_page(browser, args.base_url, case)
            try:
                sample = page.evaluate("opts => baseline.measure(opts)",
                                       dict(profile=profile, durationMs=args.seconds * 1000))
                sample["repeat"] = repeat + 1
                sample["date"] = date
                if errors:
                    raise RuntimeError(f"{profile}: browser errors: {errors}")
                samples.append(sample)
                print(f"Measured {profile} {repeat + 1}/{args.repeats}: "
                      f"{sample['meanFps']:.1f} rAF fps, p95 CPU {sample['totalCpuMs']['p95']:.2f} ms", flush=True)
                # Persist every completed sample so interrupted runs are identifiable.
                report = dict(schema=1, engine="pixi", browser=browser.version,
                              playwright=version("playwright"), host=dict(system=platform.system(),
                              machine=platform.machine(), cpu=platform.processor()),
                              complete=len(samples) == 4 * args.repeats, samples=samples)
                (output / "performance.json").write_text(json.dumps(report, indent=2) + "\n")
            finally:
                context.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:5174")
    parser.add_argument("--browser", default=shutil.which("chromium"))
    parser.add_argument("--write", action="store_true", help="Explicitly create/replace approved references")
    parser.add_argument("--performance", action="store_true", help="Measure performance instead of verifying images")
    parser.add_argument("--seconds", type=int, default=60)
    parser.add_argument("--repeats", type=int, default=3)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.seconds < 1 or args.repeats < 1:
        parser.error("seconds/repeats must be positive")
    output = args.output or (GOLDEN if args.write else Path(tempfile.mkdtemp(prefix="martian-baseline-")))
    if not args.write and (output.resolve() == GOLDEN.resolve() or GOLDEN.resolve() in output.resolve().parents):
        parser.error("Reference writes require --write")
    output.mkdir(parents=True, exist_ok=True)
    print(f"Artifacts: {output}", flush=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.browser, headless=True,
                                   args=["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader",
                                         "--enable-unsafe-swiftshader", "--enable-precise-memory-info"])
        try:
            if args.performance:
                performance_capture(browser, args, output)
            else:
                visual_capture(browser, args, output)
        finally:
            browser.close()


if __name__ == "__main__":
    main()
