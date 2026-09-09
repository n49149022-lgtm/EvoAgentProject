(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.EvoAgent = factory();
})(typeof window !== 'undefined' ? window : global, function() {
  'use strict';

  const TYPES = ['договор','счёт','жалоба','заявление','запрос','письмо','акт','накладная'];
  const PRIOS = ['низкий','средний','высокий','критический'];
  const ROUTES = ['Бухгалтерия','Юр. отдел','Кадры','Руководство','ИТ-отдел','Продажи','Канцелярия','Склад','СБ'];
  const SENTIMENTS = ['позитивный','нейтральный','негативный'];
  const NO = 37, NF = 66, NH = 32;

  // Веса встраиваются при сборке (scripts/build-client.js)
  const WEIGHTS = __WEIGHTS_PLACEHOLDER__;
  const { W1, b1, W2, b2 } = WEIGHTS;

  // LEX, BIGRAMS, POS_WORDS — из core/features.js
  const LEX = [
    {w:['договор','контракт','соглашение','обязательств','сторона','подряд','поставк','услуг','исполнител','заказчик']},
    {w:['счёт','оплат','налог','ндс','руб','коп','сумм','цен','стоимост','тариф','платёж']},
    {w:['инн','кпп','р/с','расчётн','банк','бик','огрн','реквизит','корреспондент']},
    {w:['жалоб','претензи','нарушен','недоволен','требую','возмест','ущерб','бездействи','рекламац']},
    {w:['заявлен','прошу','увольн','отпуск','приём','перевод','должност','зарплат','кадр','стаж']},
    {w:['запрос','предостав','сообщите','уточните','информац','данны','сведени','справк']},
    {w:['письм','уведомл','сообщаем','направляем','информиру','уважени','прилагаем','доводим']},
    {w:['акт','выполн','приёмк','передач','комисси','списани','инвентар','дефект']},
    {w:['накладн','товар','груз','склад','отгрузк','количеств','вес','мест','парти']},
    {w:['срочн','немедл','важн','критич','авари','сбой','экстрен','безотлагат']},
    {w:['руковод','директор','начальник','согласован','утвержд','приказ','распоряжен','генеральн']},
    {w:['бухгалт','финанс','бюджет','расход','приход','касс','аванс','дебет','кредит']},
    {w:['юрид','иск','суд','правов','арбитраж','закон','стать','кодекс','норматив']},
    {w:['сервер','програм','доступ','пароль','систем','баз данн','сеть','оборудован','настройк']},
    {w:['продаж','клиент','заказ','менеджер','сделк','коммерческ','предложен','скидк']}
  ];

  const BIGRAMS = ['до','сч','ак','на','за','пи','пр','от','по','об','вы','пе','ус','ра','та','ко','ин','ре'];
  const POS_WORDS = ['договор','счёт','жалоба','заявление','запрос','письмо','акт','накладная','претензия','уведомление','соглашение','контракт','инн','руб','подпис','печать','прошу','требуем','сообщаем','направляем'];

  const FEAT_NAMES = [
    ...LEX.map(g => `Лексика: ${g.w[0]}…`),
    'Длина текста','Кол-во предложений','Плотность цифр','Плотность CAPS',
    'Наличие даты','Наличие email','Сумма (руб)','Нумерованный список',
    'Подпись/печать','Разнообразие слов','Форма организации','Номер (№)','Ср. длина предложения',
    ...BIGRAMS.map(b => `Биграма «${b}»`),
    ...POS_WORDS.map(w => `Позиция: «${w}»`)
  ];

  function extract(text) {
    if (typeof text !== 'string') throw new TypeError('Text must be string');
    const lo = text.toLowerCase();
    const words = lo.split(/\s+/).filter(w => w.length > 0);
    const f = new Float64Array(NF);
    let idx = 0;

    for (const g of LEX) {
      let mx = 0;
      for (const w of g.w) {
        const m = lo.match(new RegExp(w, 'g'));
        if (m) mx = Math.max(mx, Math.min(m.length / 3, 1));
      }
      f[idx++] = mx;
    }

    const sents = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const digs = (lo.match(/\d/g) || []).length;
    const caps = (text.match(/[А-ЯA-Z]{2,}/g) || []).length;
    f[idx++] = Math.min(Math.log(text.length + 1) / 10, 1);
    f[idx++] = Math.min(sents.length / 10, 1);
    f[idx++] = Math.min(digs / (words.length + 1) * 5, 1);
    f[idx++] = Math.min(caps / (words.length + 1) * 5, 1);
    f[idx++] = /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(text) ? 1 : 0;
    f[idx++] = /[a-z0-9._]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text) ? 1 : 0;
    f[idx++] = /\d[\d\s]*\s*(руб|₽|тыс|млн)/i.test(text) ? 1 : 0;
    f[idx++] = /^\s*\d+[.)]\s/m.test(text) ? 1 : 0;
    f[idx++] = /подпис|м\.п\.|печать/i.test(lo) ? 1 : 0;
    const unique = new Set(words).size;
    f[idx++] = Math.min((words.length > 0 ? unique / words.length : 0) * 2, 1);
    f[idx++] = /ооо|ао |зао|ип |пао/i.test(text) ? 1 : 0;
    f[idx++] = /№|номер/i.test(lo) ? 1 : 0;
    f[idx++] = Math.min((sents.length > 0 ? words.length / sents.length : 0) / 30, 1);

    for (const bg of BIGRAMS) {
      const c = (lo.match(new RegExp(bg, 'g')) || []).length;
      f[idx++] = Math.min(c / 5, 1);
    }

    const first100 = lo.substring(0, 100);
    const last100 = lo.substring(Math.max(0, lo.length - 100));
    for (const pw of POS_WORDS) {
      const fp = first100.indexOf(pw) !== -1 ? 1 : 0;
      const lp = last100.indexOf(pw) !== -1 ? 1 : 0;
      f[idx++] = (fp + lp) / 2;
    }

    return Array.from(f);
  }

  function forward(feat) {
    const hid = new Float64Array(NH);
    for (let h = 0; h < NH; h++) {
      let s = b1[h];
      for (let j = 0; j < NF; j++) s += W1[h][j] * feat[j];
      hid[h] = Math.tanh(s);
    }
    const out = new Float64Array(NO);
    for (let o = 0; o < NO; o++) {
      let s = b2[o];
      for (let h = 0; h < NH; h++) s += W2[o][h] * hid[h];
      out[o] = s;
    }
    return { hid, out };
  }

  function softmax(a, from, to) {
    let mx = -Infinity;
    for (let i = from; i < to; i++) if (a[i] > mx) mx = a[i];
    if (!isFinite(mx)) mx = 0;
    let s = 0; const r = [];
    for (let i = from; i < to; i++) {
      const e = Math.exp(Math.min(a[i] - mx, 50));
      r.push(e); s += e;
    }
    if (s === 0 || !isFinite(s)) return r.map(() => 1 / r.length);
    return r.map(v => v / s);
  }

  function classify(text) {
    const feat = extract(text);
    const { out } = forward(feat);
    const tS = softmax(out, 0, TYPES.length);
    const pS = softmax(out, TYPES.length, TYPES.length + PRIOS.length);
    const rS = softmax(out, TYPES.length + PRIOS.length, TYPES.length + PRIOS.length + ROUTES.length);
    const sS = softmax(out, TYPES.length + PRIOS.length + ROUTES.length, NO);
    const mi = a => { let m = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[m]) m = i; return m; };
    const sorted = [...tS].sort((a, b) => b - a);
    const conf = isFinite(sorted[0] - sorted[1]) && sorted[0] - sorted[1] > 0 ? sorted[0] - sorted[1] : 0;
    return {
      type: TYPES[mi(tS)],
      prio: PRIOS[mi(pS)],
      route: ROUTES[mi(rS)],
      sentiment: SENTIMENTS[mi(sS)],
      confidence: +conf.toFixed(4),
      scores: { types: tS, prios: pS, routes: rS, sentiments: sS }
    };
  }

  function explain(text) {
    const feat = extract(text);
    const pred = classify(text);
    const lo = text.toLowerCase();
    const reasons = [];

    for (const g of LEX) {
      for (const w of g.w) {
        if (lo.includes(w)) {
          reasons.push(`🔤 Найдено: «${w}» → лексический маркер`);
          break;
        }
      }
    }
    if (/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(text)) reasons.push('📅 Обнаружена дата');
    if (/№|номер/i.test(lo)) reasons.push('🔢 Есть номер документа');
    if (/руб|₽|тыс|млн/i.test(text)) reasons.push('💰 Указана сумма');
    if (/подпис|м\.п\.|печать/i.test(lo)) reasons.push('✍️ Упоминание подписи/печати');
    if (/ооо|ао |зао|ип |пао/i.test(text)) reasons.push('🏢 Указана организация');

    const imp = [];
    for (let j = 0; j < NF; j++) {
      let v = 0;
      for (let h = 0; h < NH; h++) v += Math.abs(W1[h][j] * feat[j]);
      imp.push({ j, v });
    }
    imp.sort((a, b) => b.v - a.v);
    const top3 = imp.slice(0, 3).map(x => FEAT_NAMES[x.j] || `#${x.j}`).join(', ');
    reasons.push(`📊 Ключевые факторы: ${top3}`);

    return { prediction: pred, reasons: reasons.slice(0, 10) };
  }

  return { classify, explain, extract, TYPES, PRIOS, ROUTES, SENTIMENTS, NF, NH, NO, FEAT_NAMES };
});
