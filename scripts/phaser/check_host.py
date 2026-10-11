"""Browser gate for the milestone 1 host; writes evidence outside frozen goldens."""
import argparse
import io
import json
import math
import tempfile
from pathlib import Path
from shutil import which

from PIL import Image
from playwright.sync_api import sync_playwright


LAYOUTS = [(1280, 720), (1440, 900), (1024, 768), (2000, 720), (600, 1200)]


def advance(page, ms=100):
    return page.evaluate("ms => window.__advance(ms)", ms)


def key(page, code):
    page.keyboard.press(code)
    advance(page, 1000 / 60 + 0.000001)


def setup(page, url):
    failures = []
    page.on("pageerror", lambda error: failures.append(str(error)))
    page.on("console", lambda message: failures.append(message.text) if message.type == "error" else None)
    page.add_init_script("""(() => {
      window.__audioContexts = 0;
      const Native = window.AudioContext;
      if (Native) window.AudioContext = class extends Native {
        constructor(...args) { super(...args); window.__audioContexts++; }
      };
    })();""")
    page.goto(url)
    page.wait_for_function('window.__game?.engine === "phaser"')
    assert page.locator("canvas").count() == 1, "more than one engine canvas"
    assert page.evaluate("window.__audioContexts") == 0, "Phaser created an audio context"
    page.evaluate("""() => {
      __game.app.loop.sleep();
      __game.game.frames.reset(0);
      __game.game.loop.reset();
      let now = 0;
      window.__advance = ms => { now += ms; __game.app.step(now, ms); return __game.scene.steps; };
    }""")
    key(page, "Space")
    assert page.evaluate("__game.game.started && !__game.scene.round"), "startup key leaked into preview"
    assert page.locator("#start").count() == 0
    advance(page)
    return failures


def check_layout(page, w, h, fixed, dpr):
    page.set_viewport_size({"width": w, "height": h})
    page.evaluate("""fixed => {
      if (__game.session.ratio169 !== fixed) {
        window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyV'}));
        window.__advance(100);
        window.dispatchEvent(new KeyboardEvent('keyup', {code:'KeyV'}));
      }
      __game.game.fit();
    }""", fixed)
    advance(page, 0)
    details = page.evaluate("""() => {
      const host = __game.game, canvas = __game.app.canvas, camera = host.cameras.main;
      const p = camera.getWorldPoint(camera.x, camera.y);
      return {
        backing:[canvas.width,canvas.height], css:[canvas.getBoundingClientRect().width,canvas.getBoundingClientRect().height],
        dpr:host.dpr, renderer:__game.app.renderer.type, fit:host.fitted,
        camera:[camera.x,camera.y,camera.width,camera.height,camera.zoom], origin:[p.x,p.y],
        layerY:host.layer.y, textResolution:host.muted.style.resolution,
        textLogical:[host.muted.width,host.muted.height], textBacking:[host.muted.canvas.width,host.muted.canvas.height],
        keyboard:!!__game.app.input.keyboard, gamepad:!!__game.app.input.gamepad,
        antialias:__game.app.config.antialias, antialiasGL:__game.app.renderer.gl?.getContextAttributes().antialias ?? null
      };
    }""")
    effective = min(dpr, 2)
    scale = min(w / 1280, h / 720)
    visible = min(h / scale, 720 if fixed else 1080)
    x = math.floor((w - 1280 * scale) / 2 + 0.5)
    y = math.floor((h - visible * scale) / 2 + 0.5)
    assert details["backing"] == [round(w * effective), round(h * effective)], details
    assert details["css"] == [w, h], details
    assert details["dpr"] == effective
    assert abs(details["layerY"] - (visible - 720)) < 1e-6
    assert all(abs(v) < 1e-6 for v in details["origin"]), details
    assert details["textResolution"] == 2 and details["antialias"]
    assert all(abs(backing - logical * 2) <= 1 for backing, logical in zip(details["textBacking"], details["textLogical"]))
    assert not details["keyboard"] and not details["gamepad"]
    assert abs(details["camera"][4] - scale * effective) < 1e-6
    image = Image.open(io.BytesIO(page.screenshot(scale="css"))).convert("RGB")
    assert image.size == (w, h)
    # Scenery deliberately extends outside the visible field. Black pixels here
    # prove real camera clipping, rather than merely drawing smaller scenery.
    if x >= 3:
        assert image.getpixel((1, h // 2)) == (0, 0, 0)
        assert image.getpixel((w - 2, h // 2)) == (0, 0, 0)
    if y >= 3:
        assert image.getpixel((w // 2, 1)) == (0, 0, 0)
        assert image.getpixel((w // 2, h - 2)) == (0, 0, 0)
    ground_pixel = image.getpixel((round(x + 640 * scale), round(y + (visible - 20) * scale)))
    assert ground_pixel == (35, 59, 44), {"viewport": [w, h], "fixed": fixed, "pixel": ground_pixel, "details": details}
    return details, image


def interactions(page):
    key(page, "Space")
    assert page.evaluate("!!__game.scene.round")
    page.evaluate("""() => {
      window.__renders = 0;
      const render = __game.scene.render;
      __game.scene.render = () => { window.__renders++; render(); };
    }""")
    advance(page)
    assert page.evaluate("window.__renders") == 1, "presentation ran more than once in a multi-step frame"
    for _ in range(31):
        advance(page)
    assert page.evaluate('__game.scene.round.phase === "play"')
    # A tap before a multi-step frame fires once, even after keyup.
    ammo = page.evaluate("__game.scene.round.world.weapons.red.ammo")
    page.keyboard.press("Space")
    advance(page)
    assert page.evaluate("__game.scene.round.world.weapons.red.ammo") == ammo - 1
    key(page, "p")
    before = page.evaluate("[__game.scene.steps,__game.scene.elapsed,__game.scene.round.timeLeft]")
    for _ in range(10):
        advance(page)
    assert page.evaluate("[__game.scene.steps,__game.scene.elapsed,__game.scene.round.timeLeft]") == before
    page.evaluate("window.__renders = 0")
    key(page, "v")  # menu input remains active while simulation is frozen
    assert page.evaluate("window.__renders") == 1, "refitting advanced presentation twice"
    assert page.evaluate("[__game.scene.steps,__game.scene.elapsed,__game.scene.round.timeLeft]") == before
    key(page, "p")
    advance(page)
    assert page.evaluate("__game.scene.steps") > before[0]
    page.evaluate("() => { Object.assign(__game.scene.round.world.saucers.red, {y:-1000,vy:0}); }")
    advance(page)
    assert page.evaluate("__game.scene.round.world.saucers.red.y") == -330, "extra sky flight boundary changed"
    # Existing pad poller participates in the same fixed-step pipeline.
    page.evaluate("""() => {
      window.__padButtons = Array.from({length:16}, () => ({pressed:false,value:0}));
      Object.defineProperty(navigator, 'getGamepads', {configurable:true, value:() => [
        {index:0,id:'Host test pad',connected:true,mapping:'standard',axes:[0,0],buttons:window.__padButtons}
      ]});
    }""")
    advance(page)
    page.evaluate("window.__padButtons[9] = {pressed:true,value:1}")
    advance(page)
    assert page.evaluate("__game.scene.paused")
    page.evaluate("window.__padButtons[9] = {pressed:false,value:0}")
    advance(page)
    page.evaluate("window.__padButtons[9] = {pressed:true,value:1}")
    advance(page)
    assert not page.evaluate("__game.scene.paused")
    page.evaluate("window.__padButtons[9] = {pressed:false,value:0}")
    advance(page)
    # Focus/visibility resets Phaser delta; the separate timestamp clock still
    # advances at most six fixed steps on return, just as the original ticker.
    count = page.evaluate("__game.scene.steps")
    page.evaluate("__game.app.events.emit('hidden'); __game.app.events.emit('visible'); __game.app.events.emit('focus')")
    advance(page, 5000)
    assert page.evaluate("__game.scene.steps") - count == 6
    key(page, "r")
    assert page.evaluate('__game.scene.round.phase === "countdown"')
    key(page, "t")
    assert not page.evaluate("!!__game.scene.round")
    return {"startup_consumed": True, "shot_once": True, "render_once": True, "extra_sky_flight_top": -330, "pause_frozen": True, "pad_pause": True, "tab_return_steps": 6, "restart_and_title": True}


def recovery(page, failures):
    page.evaluate("() => { __game.scene.update = () => {throw new Error('host gate expected recovery')}; }")
    page.keyboard.press("Space")
    advance(page)
    assert not page.evaluate("!!__game.scene.round")
    assert page.evaluate("__game.game.loop.remainder") == 0
    assert page.evaluate("__game.game.errorLabel.visible")
    advance(page)
    assert not page.evaluate("!!__game.scene.round"), "recovery leaked the pending input edge"
    for _ in range(3):
        page.evaluate("() => { __game.scene.render = () => {throw new Error('host gate expected recovery')}; }")
        advance(page)
    assert page.evaluate("__game.game.halted && !__game.app.loop.running")
    assert page.evaluate("__game.game.errorLabel.text").endswith("Please reload the page.")
    expected = [message for message in failures if "host gate expected recovery" in message]
    assert len(expected) == 4, failures
    assert len(failures) == 4, failures
    return {"recover_to_title": True, "accumulator_reset": True, "repeated_errors_halt": True}


def disposal(page, failures):
    page.evaluate("""() => {
      const host = __game.game, app = __game.app;
      window.__disposedHost = host;
      app.destroy(true);
      app.step(100000, 0); // pending destruction completes even with a halted loop
      window.dispatchEvent(new Event('resize'));
    }""")
    assert page.evaluate("!window.__game && __disposedHost.disposed && __disposedHost.disposers.length === 0")
    assert page.locator("canvas").count() == 0
    assert len(failures) == 4, failures
    return {"canvas_removed": True, "debug_handle_removed": True, "host_subscriptions_removed": True}


def pixi_visibility(browser, base):
    page = browser.new_page()
    page.goto(base)
    page.wait_for_function("window.__game?.app?.ticker")
    page.evaluate("""() => {
      __game.app.ticker.stop();
      __game.app.ticker.lastTime = 100;
      window.__observed = [];
      __game.app.ticker.add(ticker => __observed.push({delta:ticker.deltaMS,raw:ticker.elapsedMS}));
      document.dispatchEvent(new Event('visibilitychange'));
      __game.app.ticker.update(5100);
    }""")
    observed = page.evaluate("({minFPS:__game.app.ticker.minFPS,frames:window.__observed})")
    assert observed["frames"] == [{"delta": 100, "raw": 5000}], observed
    page.close()
    return observed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:5174/")
    parser.add_argument("--browser", choices=["chromium", "firefox", "webkit"], default="chromium")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    output = args.output or Path(tempfile.mkdtemp(prefix="martian-host-"))
    frozen = Path(__file__).resolve().parents[2] / "baselines" / "pixi"
    if output.resolve().is_relative_to(frozen):
        raise ValueError("Host evidence must not overwrite frozen Pixi references")
    output.mkdir(parents=True, exist_ok=True)
    report = {"browser": args.browser, "base_url": args.base_url, "cases": [], "complete": False}
    (output / "checks.json").write_text(json.dumps(report, indent=2) + "\n")
    with sync_playwright() as playwright:
        options = {}
        if args.browser == "chromium":
            options = {"executable_path": which("chromium"), "args": ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]}
        browser = getattr(playwright, args.browser).launch(**options)
        report["version"] = browser.version
        report["pixi_stalled_frame"] = pixi_visibility(browser, args.base_url)
        for renderer in ["auto", "canvas"]:
            for dpr in [1, 2, 3]:
                context = browser.new_context(viewport={"width": 1280, "height": 720}, device_scale_factor=dpr)
                page = context.new_page()
                url = args.base_url + "?engine=phaser" + ("&renderer=canvas" if renderer == "canvas" else "")
                failures = setup(page, url)
                layouts = []
                for w, h in LAYOUTS:
                    for fixed in [False, True]:
                        details, image = check_layout(page, w, h, fixed, dpr)
                        name = f"{renderer}-dpr{dpr}-{w}x{h}-{'fixed' if fixed else 'sky'}"
                        image.save(output / f"{name}.png")
                        layouts.append({"name": name, **details})
                flow = interactions(page)
                assert not failures, failures
                errors = recovery(page, failures)
                disposed = disposal(page, failures)
                report["cases"].append({"renderer": renderer, "dpr": dpr, "layouts": layouts, "flow": flow, "recovery": errors, "disposal": disposed})
                (output / "checks.json").write_text(json.dumps(report, indent=2) + "\n")
                print(f"Passed {args.browser}: {renderer}, DPR {dpr}, 10 layouts, input/pause/recovery", flush=True)
                context.close()
        browser.close()
    report["complete"] = True
    (output / "checks.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"Host gate passed; evidence: {output}")


if __name__ == "__main__":
    main()
