const storageKey = 'spotlight3.topicWords.v1';
const modules = spotlightModules;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
  modules.forEach(module => module.topics.forEach((topic, i) => {
    const words = saved?.[`${module.id}:${i}`];
    if (Array.isArray(words)) topic.words.push(...words.filter(word => Array.isArray(word) && word.length === 2 && word.every(value => typeof value === 'string' && value.trim() && value.length <= 100)));
  }));
} catch { /* Storage may be unavailable or contain invalid data. */ }
const excluded = new Set();
const wordKey = word => JSON.stringify(word.slice(0, 2));
const ui = Object.fromEntries([...document.querySelectorAll('[id]')].map(element => [element.id, element]));
const canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
let round = [], results = [], index = 0, locked = false;
const normalize = value => value.trim().toLowerCase().replace(/\s+/g, ' ');

function selectedWords(includeExcluded = false) {
  const module = modules.find(item => item.id === ui.moduleSelector.value);
  const topics = ui.topicSelector.value === 'all' ? module.topics : [module.topics[Number(ui.topicSelector.value)]];
  const unique = new Map();
  topics.flatMap(topic => topic.words).forEach(word => unique.set(normalize(word[0]) + ':' + normalize(word[1]), word));
  return [...unique.values()].filter(word => includeExcluded || !excluded.has(wordKey(word)));
}

function speak(text) {
  if (!canSpeak) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-GB';
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}

function renderDictionary() {
  const words = selectedWords(true);
  ui.dictionary.replaceChildren();
  updateSelection();
  ui.quizPanel.hidden = true;
  ui.studyPanel.hidden = false;
  locked = true;
  if (canSpeak) window.speechSynthesis.cancel();
  if (!words.length) {
    const item = document.createElement('li');
    item.textContent = 'Здесь пока нет слов. Добавь первое слово ниже.';
    ui.dictionary.append(item);
  }
  words.forEach(word => {
    const item = document.createElement('li');
    item.style.setProperty('--order', Math.min(ui.dictionary.children.length, 12));
    item.classList.toggle('excluded', excluded.has(wordKey(word)));
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !excluded.has(wordKey(word));
    checkbox.onchange = () => {
      if (checkbox.checked) excluded.delete(wordKey(word)); else excluded.add(wordKey(word));
      item.classList.toggle('excluded', !checkbox.checked);
      updateSelection();
    };
    const text = document.createElement('span');
    text.textContent = `${word[0]} — ${word.slice(1).join(' / ')}`;
    label.append(checkbox, text);
    item.append(label);
    if (canSpeak) {
      const button = document.createElement('button');
      button.className = 'secondary';
      button.textContent = 'Слушать';
      button.setAttribute('aria-label', `Послушать: ${word[1]}`);
      button.onclick = () => speak(word[1]);
      item.append(button);
    }
    ui.dictionary.append(item);
  });
}

function updateSelection() {
  const count = selectedWords().length;
  ui.selectionInfo.textContent = `Выбрано ${count} из ${selectedWords(true).length} слов и выражений`;
  ui.startBtn.disabled = count === 0;
  ui.startBtn.textContent = count ? `Начать тренировку · ${count}` : 'Выбери хотя бы одно слово';
}

function changeModule() {
  const module = modules.find(item => item.id === ui.moduleSelector.value);
  ui.topicSelector.replaceChildren(new Option('Все темы модуля', 'all'));
  module.topics.forEach((topic, i) => ui.topicSelector.add(new Option(topic.title, String(i))));
  ui.addTopic.replaceChildren();
  module.topics.forEach((topic, i) => ui.addTopic.add(new Option(topic.title, String(i))));
  renderDictionary();
}

function startRound(words) {
  round = [...words];
  for (let i = round.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [round[i], round[j]] = [round[j], round[i]];
  }
  if (!round.length) return;
  results = [];
  index = 0;
  ui.studyPanel.hidden = true;
  ui.quizPanel.hidden = false;
  ui.finalPanel.hidden = true;
  ui.question.hidden = false;
  showWord();
}

function showWord() {
  locked = false;
  ui.ruWord.textContent = round[index][0];
  ui.ruWord.getAnimations().forEach(animation => animation.cancel());
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    ui.ruWord.animate([{ opacity: 0, transform: 'translateY(15px) scale(.96)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 350, easing: 'ease-out' });
  }
  ui.answer.value = '';
  ui.answer.disabled = false;
  ui.answer.className = '';
  ui.answer.removeAttribute('aria-invalid');
  ui.result.textContent = '';
  ui.result.className = 'result';
  ui.checkBtn.hidden = false;
  ui.nextBtn.hidden = true;
  ui.counter.textContent = `Слово ${index + 1} из ${round.length} · Правильно: ${results.filter(Boolean).length}`;
  ui.progress.max = round.length;
  ui.progress.value = index;
  ui.answer.focus();
}

function checkAnswer() {
  if (locked || !round[index]) return;
  const answer = normalize(ui.answer.value);
  if (!answer) { ui.result.textContent = 'Сначала напиши перевод.'; return; }
  locked = true;
  const correct = round[index].slice(1).some(value => normalize(value) === answer);
  results[index] = correct;
  ui.answer.className = correct ? 'correct' : 'wrong';
  ui.answer.setAttribute('aria-invalid', String(!correct));
  ui.answer.disabled = true;
  ui.result.className = correct ? 'result correct' : 'result wrong';
  ui.result.textContent = correct ? 'Правильно! Так держать.' : `Запомни: ${round[index].slice(1).join(' / ')}`;
  ui.checkBtn.hidden = true;
  ui.nextBtn.hidden = false;
  ui.nextBtn.textContent = index === round.length - 1 ? 'Посмотреть результат' : 'Дальше';
  ui.nextBtn.focus();
}

function finishRound() {
  ui.question.hidden = true;
  ui.result.textContent = '';
  ui.finalPanel.hidden = false;
  ui.progress.value = round.length;
  const score = results.filter(Boolean).length;
  ui.counter.textContent = 'Тренировка завершена';
  ui.finalScore.textContent = `Правильно: ${score} из ${round.length}`;
  ui.catImg.src = score === round.length ? 'cat-happy.png' : score / round.length >= 0.7 ? 'cat-ok.png' : 'cat-sad.png';
  ui.finalWords.replaceChildren();
  round.forEach((word, i) => {
    const item = document.createElement('li');
    item.className = results[i] ? 'correct' : 'wrong';
    item.textContent = `${results[i] ? 'Верно' : 'Повтори'}: ${word[0]} — ${word[1]}`;
    ui.finalWords.append(item);
  });
  ui.repeatBtn.hidden = score === round.length;
  ui.finalScore.focus();
}

modules.forEach(module => ui.moduleSelector.add(new Option(module.title, module.id)));
ui.moduleSelector.onchange = changeModule;
ui.topicSelector.onchange = () => {
  if (ui.topicSelector.value !== 'all') ui.addTopic.value = ui.topicSelector.value;
  renderDictionary();
};
ui.selectAllBtn.onclick = () => { selectedWords(true).forEach(word => excluded.delete(wordKey(word))); renderDictionary(); };
ui.clearAllBtn.onclick = () => { selectedWords(true).forEach(word => excluded.add(wordKey(word))); renderDictionary(); };
ui.learnBtn.onclick = renderDictionary;
ui.startBtn.onclick = () => startRound(selectedWords());
ui.restartBtn.onclick = () => startRound(selectedWords());
ui.repeatBtn.onclick = () => startRound(round.filter((_, i) => !results[i]));
ui.checkBtn.onclick = checkAnswer;
ui.nextBtn.onclick = () => {
  if (!locked || ui.question.hidden) return;
  index++;
  if (index < round.length) showWord(); else finishRound();
};
ui.answer.onkeydown = event => {
  if (event.key === 'Enter' && !event.repeat) { event.preventDefault(); checkAnswer(); }
};
ui.speakBtn.disabled = !canSpeak;
ui.speechNotice.hidden = canSpeak;
ui.speakBtn.onclick = () => { if (round[index]) speak(round[index][1]); };
ui.addForm.onsubmit = event => {
  event.preventDefault();
  const word = [ui.newRu.value.trim().replace(/\s+/g, ' '), normalize(ui.newEn.value)];
  if (word.some(value => !value || value.length > 100)) return;
  const module = modules.find(item => item.id === ui.moduleSelector.value);
  const topic = module.topics[Number(ui.addTopic.value)];
  if (topic.words.some(item => normalize(item[0]) === normalize(word[0]) && normalize(item[1]) === word[1])) {
    ui.addMsg.textContent = 'Это слово уже есть в выбранной теме.';
    return;
  }
  topic.words.push(word);
  let persisted = true;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    const key = `${module.id}:${ui.addTopic.value}`;
    const next = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    next[key] = [...(Array.isArray(next[key]) ? next[key] : []), word];
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch { persisted = false; }
  ui.addMsg.textContent = persisted ? `Добавлено в тему «${topic.title}». Слово сохранено в браузере.` : 'Слово добавлено на эту сессию. Браузер не разрешил сохранить его после закрытия.';
  ui.addForm.reset();
  if (ui.quizPanel.hidden) renderDictionary();
};
changeModule();
