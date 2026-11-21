const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/* ---------------- read-aloud ---------------- */
let preferredVoice = null;

function loadVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices();
  preferredVoice =
    voices.find(v => /en[-_]US/i.test(v.lang) && /Samantha|Aria|Zira|Jenny|Google US English/i.test(v.name)) ||
    voices.find(v => /en[-_]GB/i.test(v.lang)) ||
    voices.find(v => /^en/i.test(v.lang)) ||
    null;
}

if ('speechSynthesis' in window) {
  loadVoice();
  speechSynthesis.addEventListener('voiceschanged', loadVoice);
} else {
  document.body.classList.add('no-speech');
}

function say(text) {
  if (!('speechSynthesis' in window) || !text) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.04;
  if (preferredVoice) utterance.voice = preferredVoice;
  speechSynthesis.speak(utterance);
}

function stopSpeech() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

/* ---------------- state ---------------- */
const state = {
  labStage: 0,
  valley: 0,
  valleyDone: false,
  melt: { round: 0, score: 100, done: false, timer: null },
  done: {}
};

function markDone(key) {
  if (state.done[key]) return;
  state.done[key] = true;
  const card = document.querySelector(`.module-card[data-module="${key}"]`);
  if (card) card.classList.add('is-done');
}

/* ---------------- navigation ---------------- */
const screenScripts = {
  lab: 'In the Snow-to-Ice Lab, add snow year after year. Watch fluffy snow get squashed into firn, and then into dense, blue glacier ice.',
  valley: 'Drag the glacier downhill. Watch the heavy ice scrape the rock, steepen the valley, and leave a lake at the bottom.',
  map: 'Tap a glowing dot on the map to visit a glacier. You will hear a fact about that icy place.'
};

function showScreen(name) {
  stopSpeech();
  if (name !== 'melt') clearTimeout(state.melt.timer);
  $$('.screen').forEach(s => s.classList.toggle('is-active', s.id === `screen-${name}`));
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (name === 'lab') renderLab(false);
  if (name === 'valley') setValley(state.valley);
  if (name === 'melt') {
    if (state.melt.done) showMeltResult(false);
    else renderMeltRound();
  }
}

$$('.module-card').forEach(card => {
  card.addEventListener('click', () => showScreen(card.dataset.module));
});

$$('[data-home]').forEach(btn => {
  btn.addEventListener('click', () => showScreen('home'));
});

$$('[data-speak]').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.speak;
    if (key === 'melt') {
      if (state.melt.done) say('You finished the Melt-O-Meter. Tap Play again to try different choices.');
      else say(MELT_QUESTIONS[state.melt.round].q);
      return;
    }
    say(screenScripts[key]);
  });
});

/* ---------------- lab ---------------- */
const LAB_STAGES = [
  {
    year: 'Year 0',
    air: 90,
    next: 'Add 20 more winters',
    text: 'Fresh snow falls on the mountain. It is fluffy and full of air, like a feather pillow.',
    long: 'Fresh snow falls on the mountain. It is fluffy and full of air, like a feather pillow. Lots of air is trapped between the snowflakes.'
  },
  {
    year: 'Year 20',
    air: 60,
    next: 'Wait another 30 winters',
    text: 'More snow piles on top. The snow underneath gets squashed, and air is squeezed out.',
    long: 'More snow piles on top. The snow underneath gets squashed under all that weight, and air is squeezed out.'
  },
  {
    year: 'Year 50',
    air: 25,
    next: 'Wait another 50 winters',
    text: 'After many summers and winters, the packed snow turns into firn: snow that is turning into ice.',
    long: 'After many summers and winters, the packed snow turns into firn. Firn is snow that is slowly turning into ice.'
  },
  {
    year: 'Year 100+',
    air: 2,
    next: null,
    text: 'Now it is glacier ice! It is heavy and dense, with almost no air, so it looks blue.',
    long: 'Now it is glacier ice! It is heavy and dense, with almost no air left, so it looks blue. It is so thick and heavy that it flows slowly downhill like a frozen river.'
  }
];

const WORD_HELP = {
  snow: 'Snow is made of tiny ice crystals that fall from clouds. Fresh snow is fluffy because lots of air is trapped inside.',
  firn: 'Firn is old snow that has been packed down for years. It is in between snow and solid glacier ice.',
  ice: 'Glacier ice is very dense ice with almost no air inside. It is heavy, looks blue, and flows slowly downhill.'
};

function renderLab(announce) {
  const stage = LAB_STAGES[state.labStage];
  $('#iceCore').dataset.stage = state.labStage;
  $('#labScene').dataset.stage = state.labStage;
  $('#labYear').textContent = stage.year;
  $('#labText').textContent = stage.text;
  $('#airBar').style.width = `${stage.air}%`;
  $('#airValue').textContent = `${stage.air}%`;

  $$('#screen-lab .stage-pills .pill').forEach((pill, i) => {
    pill.classList.toggle('is-active', i === state.labStage);
  });

  const next = $('#labNext');
  if (stage.next) {
    next.disabled = false;
    next.textContent = stage.next;
  } else {
    next.disabled = true;
    next.textContent = 'It’s a glacier!';
  }

  if (announce) say(stage.long);
  if (state.labStage === LAB_STAGES.length - 1) markDone('lab');
}

$('#labNext').addEventListener('click', () => {
  if (state.labStage < LAB_STAGES.length - 1) {
    state.labStage += 1;
    renderLab(true);
  }
});

$('#labReset').addEventListener('click', () => {
  state.labStage = 0;
  renderLab(false);
  say('New glacier! Fresh snow is falling again.');
});

$$('.word-btn').forEach(btn => {
  btn.addEventListener('click', () => say(WORD_HELP[btn.dataset.word]));
});

/* ---------------- valley ---------------- */
const valleySvg = $('#valleySvg');
const scratchGroup = $('#scratchGroup');
const iceLinesGroup = $('#iceLines');
const iceLines = [];

for (let i = 0; i < 3; i += 1) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', '#86cde6');
  line.setAttribute('stroke-width', '2.5');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('opacity', '0.7');
  iceLinesGroup.appendChild(line);
  iceLines.push(line);
}

for (let y = 180; y <= 424; y += 16) {
  const t = clamp((y - 150) / 310, 0, 1);
  const xL = 300 - 240 * t;
  const xR = 500 + 240 * t;
  const scratch = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  scratch.setAttribute('x1', xL + 22);
  scratch.setAttribute('x2', xR - 22);
  scratch.setAttribute('y1', y);
  scratch.setAttribute('y2', y);
  scratch.setAttribute('stroke', '#a89173');
  scratch.setAttribute('stroke-width', '2');
  scratch.setAttribute('stroke-linecap', 'round');
  scratch.setAttribute('stroke-dasharray', '7 18');
  scratch.setAttribute('opacity', '0.4');
  scratchGroup.appendChild(scratch);
}

function valleyCaption(p) {
  if (p < 0.04) return 'The glacier waits at the top of the mountain.';
  if (p < 0.35) return 'The heavy ice is dragging rock and soil down the slope.';
  if (p < 0.7) return 'Scrape, scrape! The valley walls are getting steeper.';
  if (p < 0.97) return 'Meltwater is collecting at the bottom of the valley.';
  return 'You made a deep U-shaped valley with a glacial lake!';
}

function setValley(value) {
  const p = clamp(value, 0, 1);
  state.valley = p;

  const y = 130 + 140 * p;
  const w = 150 + 210 * p;
  const h = 100 + 30 * p;
  const x = 400 - w / 2;

  const ice = $('#iceBody');
  ice.setAttribute('x', x);
  ice.setAttribute('y', y);
  ice.setAttribute('width', w);
  ice.setAttribute('height', h);
  ice.setAttribute('rx', h / 2);

  const shadow = $('#iceShadow');
  shadow.setAttribute('cy', (y + h + 10).toFixed(1));
  shadow.setAttribute('rx', (w / 2 + 8).toFixed(1));

  const lineFractions = [0.32, 0.58, 0.82];
  iceLines.forEach((line, i) => {
    const ly = y + h * lineFractions[i];
    line.setAttribute('d',
      `M${(x + 30).toFixed(1)} ${ly.toFixed(1)} ` +
      `Q400 ${(ly + 8).toFixed(1)} ${(x + w - 30).toFixed(1)} ${ly.toFixed(1)}`
    );
  });

  const backY = Math.max(y, 150);
  const t = clamp((backY - 150) / 310, 0, 1);
  const xL = 300 - 240 * t;
  const xR = 500 + 240 * t;
  const d = `M300 150 L500 150 L${xR.toFixed(1)} ${backY.toFixed(1)} L${xL.toFixed(1)} ${backY.toFixed(1)} Z`;
  $('#polishFill').setAttribute('d', d);
  $('#polishClipPath').setAttribute('d', d);

  $('#iceLabel').setAttribute('y', (y + h * 0.58).toFixed(1));

  const lakeT = clamp((p - 0.7) / 0.3, 0, 1);
  const lake = $('#lake');
  lake.setAttribute('rx', (26 + 140 * lakeT).toFixed(1));
  lake.setAttribute('ry', (5 + 11 * lakeT).toFixed(1));
  lake.style.visibility = lakeT > 0.02 ? 'visible' : 'hidden';
  $('#lakeLabel').style.opacity = (0.9 * lakeT).toFixed(2);

  $('#valleyStatus').textContent = valleyCaption(p);
  $('#valleySlider').value = Math.round(p * 100);

  if (p >= 0.98 && !state.valleyDone) {
    state.valleyDone = true;
    markDone('valley');
  }
}

$('#valleySlider').addEventListener('input', e => {
  setValley(Number(e.target.value) / 100);
});

$('#valleyReset').addEventListener('click', () => {
  setValley(0);
  say('Start over! The glacier is back at the top of the mountain.');
});

let dragging = false;

function pointerToValley(event) {
  const rect = valleySvg.getBoundingClientRect();
  const ySvg = ((event.clientY - rect.top) / rect.height) * 470;
  return (ySvg - 185) / 160;
}

valleySvg.addEventListener('pointerdown', event => {
  dragging = true;
  try { valleySvg.setPointerCapture(event.pointerId); } catch { /* synthetic pointers */ }
  setValley(pointerToValley(event));
  event.preventDefault();
});

valleySvg.addEventListener('pointermove', event => {
  if (!dragging) return;
  setValley(pointerToValley(event));
  event.preventDefault();
});

function endDrag() { dragging = false; }
valleySvg.addEventListener('pointerup', endDrag);
valleySvg.addEventListener('pointercancel', endDrag);

/* ---------------- map ---------------- */
const REGIONS = {
  greenland: {
    title: 'Greenland',
    fact: 'Greenland is covered by a huge ice sheet. In places the ice is more than 3 kilometres thick — taller than 10 stacked Eiffel Towers! Huge pieces break off and float away as icebergs.'
  },
  alps: {
    title: 'The Alps — Europe',
    fact: 'The Alps are mountain glaciers in Europe. Long ago, ice carved their sharp peaks and deep valleys. Today people ski and hike there, and these glaciers are shrinking.'
  },
  himalaya: {
    title: 'The Himalayas — Asia',
    fact: 'The Himalayas have thousands of glaciers high in the mountains. Their meltwater feeds mighty rivers, like the Ganges, that millions of people use for drinking water and farming.'
  },
  andes: {
    title: 'The Andes — South America',
    fact: 'The Andes run along South America. Their glaciers give water to farms and cities in mountain areas that get very little rain.'
  },
  antarctica: {
    title: 'Antarctica',
    fact: 'Antarctica is the coldest place on Earth and holds the largest ice sheet. It stores most of the world’s fresh water — all frozen!'
  }
};

const visited = new Set();

function showRegion(key) {
  const region = REGIONS[key];
  if (!region) return;
  $$('.hotspot').forEach(btn => btn.classList.toggle('is-active', btn.dataset.region === key));
  $('#factTitle').textContent = region.title;
  $('#factText').textContent = region.fact;
  say(region.fact);

  if (!visited.has(key)) {
    visited.add(key);
    $('#mapCount').textContent = visited.size === 5
      ? 'All 5 explored — you are a glacier explorer!'
      : `${visited.size} of 5 glacier regions explored`;
    if (visited.size === 5) markDone('map');
  }
}

$$('.hotspot').forEach(btn => {
  btn.addEventListener('click', () => showRegion(btn.dataset.region));
});

$('#mapSpeak').addEventListener('click', () => {
  const title = $('#factTitle').textContent;
  if (REGIONS[Object.keys(REGIONS).find(k => REGIONS[k].title === title)]) {
    say($('#factText').textContent);
  } else {
    say(screenScripts.map);
  }
});

/* ---------------- melt ---------------- */
const MELT_QUESTIONS = [
  {
    q: 'It’s a sunny day. How will you get to the park?',
    options: [
      { text: 'Walk or ride a bike', delta: 0, feedback: 'Yes! Walking keeps the air cleaner.' },
      { text: 'Ask for a car ride on my own', delta: -10, feedback: 'A car for just one person uses lots of fuel. That adds to warming.' }
    ]
  },
  {
    q: 'You leave your bedroom. What happens to the light?',
    options: [
      { text: 'Leave it on all day', delta: -8, feedback: 'Leaving lights on wastes electricity, which mostly comes from burning fuel.' },
      { text: 'Switch it off', delta: 0, feedback: 'Perfect! Switching off saves energy.' }
    ]
  },
  {
    q: 'Lunch is over and there is food left.',
    options: [
      { text: 'Save it for later', delta: 0, feedback: 'Great! Saving food means less waste and less energy used.' },
      { text: 'Throw it in the bin', delta: -7, feedback: 'Wasted food means wasted energy — and more warming.' }
    ]
  },
  {
    q: 'It’s a chilly morning at home.',
    options: [
      { text: 'Turn the heating up and open the window', delta: -9, feedback: 'Heating with the window open wastes lots of energy.' },
      { text: 'Put on a cosy sweater', delta: 0, feedback: 'Cosy! A sweater keeps you warm without extra energy.' }
    ]
  },
  {
    q: 'Your water bottle is empty.',
    options: [
      { text: 'Fill it up again', delta: 0, feedback: 'Nice! Reusing your bottle means less plastic and less waste.' },
      { text: 'Grab a new plastic bottle', delta: -6, feedback: 'New plastic bottles take energy to make and deliver. Refilling is cooler!' }
    ]
  }
];

function updateMeter() {
  const score = state.melt.score;
  $('#iceFill').style.height = `${score}%`;
  $('#icePct').textContent = `${score}%`;
}

function renderMeltRound() {
  const melt = state.melt;
  const question = MELT_QUESTIONS[melt.round];
  $('#roundLabel').textContent = `Round ${melt.round + 1} of 5`;
  $('#qText').textContent = question.q;
  $('#feedback').textContent = '';
  $$('#roundDots i').forEach((dot, i) => dot.classList.toggle('is-on', i < melt.round));

  const choices = $('#choices');
  choices.innerHTML = '';
  question.options.forEach(option => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice';
    btn.textContent = option.text;
    btn.addEventListener('click', () => answerMelt(btn, option));
    choices.appendChild(btn);
  });

  $('#meltPlay').hidden = false;
  $('#meltResult').hidden = true;
}

function answerMelt(chosenBtn, option) {
  const melt = state.melt;
  $$('#choices .choice').forEach(btn => { btn.disabled = true; });
  chosenBtn.classList.add(option.delta === 0 ? 'is-good' : 'is-bad');
  melt.score = clamp(melt.score + option.delta, 0, 100);
  updateMeter();
  $('#feedback').textContent = option.feedback;
  say(option.feedback);

  clearTimeout(melt.timer);
  melt.timer = setTimeout(() => {
    melt.round += 1;
    if (melt.round >= MELT_QUESTIONS.length) showMeltResult(true);
    else renderMeltRound();
  }, 1700);
}

function showMeltResult(announce) {
  const score = state.melt.score;
  let title;
  let text;
  if (score >= 95) {
    title = 'Glacier hero!';
    text = 'Every choice was kind to the ice. Using less energy helps keep ice frozen.';
  } else if (score >= 85) {
    title = 'Cool work!';
    text = 'Most choices were kind to the ice. Small changes add up.';
  } else {
    title = 'Keep the ice strong!';
    text = 'Some choices used lots of energy. Play again and pick the cooler option.';
  }
  $('#resultTitle').textContent = title;
  $('#resultText').textContent = text;
  $('#resultScore').textContent = `${score}%`;
  $('#meltPlay').hidden = true;
  $('#meltResult').hidden = false;
  state.melt.done = true;
  markDone('melt');
  if (announce) say(`${title} Your ice is ${score} percent healthy. ${text}`);
}

$('#meltAgain').addEventListener('click', () => {
  stopSpeech();
  clearTimeout(state.melt.timer);
  state.melt.round = 0;
  state.melt.score = 100;
  state.melt.done = false;
  updateMeter();
  renderMeltRound();
  say('Round one!');
});

/* ---------------- init ---------------- */
renderLab(false);
setValley(0);
updateMeter();
