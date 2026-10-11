// Milestone 1 calibration scene. Original artwork and menus are ported later.
import { WIDTH, HEIGHT, ARENA, PAUSE_KEY } from '../config.js';
import { menuLift, layout, setFixed169 } from '../layout.js';
import { wasPressed, playerInput } from '../input.js';
import { createRound, stepRound } from '../logic/round.js';
import { handleEvents, setAudioPaused, stopVoices } from '../audio.js';
import { onUnexpectedExit } from '../fullscreen.js';

export function createPreview(host, playing = false) {
  const scene = host;
  const text = host.text.bind(host);
  const view = scene.add.container();
  const field = scene.add.graphics();
  const markers = scene.add.graphics();
  const heading = text('PHASER HOST PREVIEW', 36, '#ffffff').setOrigin(0.5);
  const description = text('Space / Enter: start a test round\nV: toggle 16:9   M: sound   F: full screen', 20, '#cfd6ff').setOrigin(0.5);
  const status = text('', 20, '#ffd76a').setOrigin(0.5, 0);
  view.add([field, markers, heading, description, status]);
  const round = playing ? createRound(7, 90) : null;
  let paused = false;
  let elapsed = 0;
  let steps = 0;
  let eventCount = 0;
  function pause(on) {
    paused = on;
    setAudioPaused(on);
  }
  const stopFullscreen = onUnexpectedExit(() => {
    if (round) pause(true);
  });

  return {
    view,
    round,
    get paused() {
      return paused;
    },
    get steps() {
      return steps;
    },
    get elapsed() {
      return elapsed;
    },
    get eventCount() {
      return eventCount;
    },
    update(dt) {
      if (wasPressed('KeyV')) {
        host.session.ratio169 = !layout.fixed169;
        setFixed169(host.session.ratio169);
      }
      if (!round) {
        if (wasPressed('Space') || wasPressed('Enter') || wasPressed('PadConfirm')) host.go(createPreview, true);
        return;
      }
      if (wasPressed('KeyT')) {
        host.go(createPreview);
        return;
      }
      if (wasPressed('KeyR')) {
        host.go(createPreview, true);
        return;
      }
      if (wasPressed(PAUSE_KEY) || wasPressed('Escape') || wasPressed('PadPause')) {
        pause(!paused);
        return;
      }
      if (paused || round.phase === 'over') return;
      elapsed += dt;
      steps++;
      stepRound(round, { red: playerInput('red'), blue: playerInput('blue') }, dt);
      eventCount += round.events.length;
      handleEvents(round.events);
    },
    render() {
      field
        .clear()
        .fillStyle(0x101c3d)
        .fillRect(-400, -720, WIDTH + 800, HEIGHT + 1440);
      field.lineStyle(2, 0x41577d).strokeRect(1, -layout.extra + 1, WIDTH - 2, HEIGHT + layout.extra - 2);
      field.fillStyle(0x233b2c).fillRect(0, ARENA.groundY, WIDTH, HEIGHT - ARENA.groundY);
      field.lineStyle(2, 0xd86161).strokeRect(0, 580, 180, 80);
      field.lineStyle(2, 0x6ba0f5).strokeRect(1100, 580, 180, 80);
      heading.setPosition(WIDTH / 2, 160 + menuLift());
      description.setPosition(WIDTH / 2, 250 + menuLift());
      status.setPosition(WIDTH / 2, 12 - layout.extra);
      markers.clear();
      if (round) {
        description.setText('WASD / arrows: move   Space / Enter: shoot\nP / Esc: pause   R: restart   T: preview title   V: 16:9');
        for (const animal of round.world.animals) {
          if (!animal.gone) markers.fillStyle(animal.kind === 'cow' ? 0xf8e9cb : 0xc5cce5).fillCircle(animal.x, animal.y - 10, 7);
        }
        for (const side of ['red', 'blue']) {
          const s = round.world.saucers[side];
          markers.fillStyle(side === 'red' ? 0xd86161 : 0x6ba0f5).fillEllipse(s.x, s.y, 68, 28);
        }
        for (const shot of round.world.projectiles) {
          if (!shot.gone) markers.fillStyle(0xffd76a).fillCircle(shot.x, shot.y, 4);
        }
        status.setText(
          paused ? 'PAUSED — P / Esc: resume   R: restart   T: preview title' : `${round.phase.toUpperCase()}  ${Math.ceil(round.timeLeft)}s`,
        );
      } else {
        status.setText(`Extra sky: ${Math.round(layout.extra)}px — original graphics and menus are pending`);
      }
    },
    destroy() {
      stopFullscreen();
      setAudioPaused(false);
      stopVoices();
    },
  };
}
