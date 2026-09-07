(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.EvoAgentCore = factory();
})(typeof window !== 'undefined' ? window : global, function() {
  const TYPES = ['договор','счёт','жалоба','заявление','запрос','письмо','акт','накладная'];
  const PRIOS = ['низкий','средний','высокий','критический'];
  const ROUTES = ['Бухгалтерия','Юр. отдел','Кадры','Руководство','ИТ-отдел','Продажи','Канцелярия','Склад','СБ'];
  const SENTIMENTS = ['позитивный','нейтральный','негативный'];
  const NO = TYPES.length + PRIOS.length + ROUTES.length + SENTIMENTS.length;
  const NF = 28, NH = 12, GSIZE = NF*NH + NH + NH*NO + NO, POP = 60;

  const LEX = [
    {w:['договор','контракт','соглашение','обязательств','сторона','подряд','поставк','услуг','исполнител','заказчик'],t:0},
    {w:['счёт','оплат','налог','ндс','руб','коп','сумм','цен','стоимост','тариф','платёж'],t:1},
    {w:['инн','кпп','р/с','расчётн','банк','бик','огрн','реквизит','корреспондент'],t:0},
    {w:['жалоб','претензи','нарушен','недоволен','требую','возмест','ущерб','бездействи','рекламац'],t:2},
    {w:['заявлен','прошу','увольн','отпуск','приём','перевод','должност','зарплат','кадр','стаж'],t:3},
    {w:['запрос','предостав','сообщите','уточните','информац','данны','сведени','справк'],t:4},
    {w:['письм','уведомл','сообщаем','направляем','информиру','уважени','прилагаем','доводим'],t:5},
    {w:['акт','выполн','приёмк','передач','комисси','списани','инвентар','дефект'],t:6},
    {w:['накладн','товар','груз','склад','отгрузк','количеств','вес','мест','парти'],t:7},
    {w:['срочн','немедл','важн','критич','авари','сбой','экстрен','безотлагат'],t:-1},
    {w:['руковод','директор','начальник','согласован','утвержд','приказ','распоряжен','генеральн'],t:0},
    {w:['бухгалт','финанс','бюджет','расход','приход','касс','аванс','дебет','кредит'],t:1},
    {w:['юрид','иск','суд','правов','арбитраж','закон','стать','кодекс','норматив'],t:0},
    {w:['сервер','програм','доступ','пароль','систем','баз данн','сеть','оборудован','настройк'],t:-1},
    {w:['продаж','клиент','заказ','менеджер','сделк','коммерческ','предложен','скидк'],t:-1}
  ];

  const BUILTIN = [
    {t:'ДОГОВОР ПОСТАВКИ №123\nМежду ООО «Альфа» и ООО «Бета» заключён договор. Стороны обязуются поставить товар. Ответственность за нарушение обязательств. Подписи сторон, печати.', y:'договор', p:'средний', r:'Юр. отдел', s:'нейтральный'},
    {t:'КОНТРАКТ №45 на оказание услуг. Исполнитель и Заказчик согласовали условия. Срок 90 дней. Ответственность и порядок расчётов. Подписи.', y:'договор', p:'низкий', r:'Руководство', s:'нейтральный'},
    {t:'СОГЛАШЕНИЕ о конфиденциальности. Стороны не разглашают данные. Штраф за нарушение. Подписаны директорами.', y:'договор', p:'высокий', r:'Юр. отдел', s:'нейтральный'},
    {t:'СЧЁТ №456 от 01.09.2026\nООО «ТехноСервис», ИНН 7701234567. Товар: серверы 2 шт. Сумма 1 250 000 руб., НДС 20%. Оплата на р/с 40702810.', y:'счёт', p:'высокий', r:'Бухгалтерия', s:'нейтральный'},
    {t:'СЧЕТ-ФАКТУРА №789. Продавец ООО «Материалы». Цемент 100 мешков. НДС 20%. Всего к оплате 54 000 руб. Р/с в Сбербанке.', y:'счёт', p:'средний', r:'Бухгалтерия', s:'нейтральный'},
    {t:'ПРЕТЕНЗИЯ. Нарушение сроков. Требуем неустойку 0.1% в день. Иначе арбитражный суд. Ущерб 450 000 руб.', y:'жалоба', p:'критический', r:'Юр. отдел', s:'негативный'},
    {t:'ЖАЛОБА на качество. Требую возместить ущерб 50 000 руб. Обращусь в прокуратуру.', y:'жалоба', p:'высокий', r:'Руководство', s:'негативный'},
    {t:'ЗАЯВЛЕНИЕ. Прошу отпуск с 15.09.2026. Согласовать с руководителем, передать в кадры.', y:'заявление', p:'низкий', r:'Кадры', s:'нейтральный'},
    {t:'ЗАЯВЛЕНИЕ об увольнении. Прошу уволить с 01.10.2026. Отработаю 2 недели. Трудовую книжку.', y:'заявление', p:'средний', r:'Кадры', s:'нейтральный'},
    {t:'ЗАЯВЛЕНИЕ на приём. Прошу на должность инженера ИТ. Резюме прилагаю. Готов с 01.10.', y:'заявление', p:'низкий', r:'Кадры', s:'позитивный'},
    {t:'ЗАПРОС информации. Данные о задолженности контрагента для аудита. Срок до 10.09.', y:'запрос', p:'средний', r:'Бухгалтерия', s:'нейтральный'},
    {t:'СЛУЖЕБНАЯ ЗАПИСКА. Средства на 10 ноутбуков. Устаревание оборудования.', y:'запрос', p:'высокий', r:'Руководство', s:'нейтральный'},
    {t:'СОПРОВОДИТЕЛЬНОЕ ПИСЬМО. Направляем документы по договору №67. Просим подписать за 5 дней.', y:'письмо', p:'низкий', r:'Канцелярия', s:'нейтральный'},
    {t:'УВЕДОМЛЕНИЕ. Изменение реквизитов с 01.10. Новый р/с. Учтите при оплате.', y:'письмо', p:'средний', r:'Бухгалтерия', s:'нейтральный'},
    {t:'БЛАГОДАРСТВЕННОЕ ПИСЬМО. Признательность за сотрудничество. Надеемся на партнёрство.', y:'письмо', p:'низкий', r:'Руководство', s:'позитивный'},
    {t:'АКТ выполненных работ №34. Подрядчик ООО «РемонтПро». Объём 450 кв.м. Претензий нет. Подписи.', y:'акт', p:'средний', r:'Бухгалтерия', s:'нейтральный'},
    {t:'Акт ПРИЁМКИ. Комиссия приняла сервер Dell. Комплектность полная. Замечаний нет.', y:'акт', p:'средний', r:'ИТ-отдел', s:'позитивный'},
    {t:'ТОВАРНАЯ НАКЛАДНАЯ №567. Поставщик ООО «ОптТорг». Бумага 200 пачек, тонер 50. Итого 130 000 руб.', y:'накладная', p:'средний', r:'Склад', s:'нейтральный'},
    {t:'НАКЛАДНАЯ НА ОТПУСК. Грузополучатель филиал №3. Стройматериалы 2.5 тонны, 12 мест. Склад №1.', y:'накладная', p:'средний', r:'Склад', s:'нейтральный'}
  ];

  let population = [], trainingData = [], generation = 0;

  function extractFeatures(text) {
    const lo = text.toLowerCase();
    const words = lo.split(/\s+/).filter(w=>w.length>0);
    const f = [];
    for(const g of LEX) {
      let mx=0;
      for(const w of g.w) { const m=lo.match(new RegExp(w,'g')); if(m) mx=Math.max(mx, Math.min(m.length/3,1)); }
      f.push(mx);
    }
    const sents=text.split(/[.!?]+/).filter(s=>s.trim().length>0);
    const digs=(lo.match(/\d/g)||[]).length, caps=(text.match(/[А-ЯA-Z]{2,}/g)||[]).length;
    f.push(Math.min(Math.log(text.length+1)/10,1));
    f.push(Math.min(sents.length/10,1));
    f.push(Math.min(digs/(words.length+1)*5,1));
    f.push(Math.min(caps/(words.length+1)*5,1));
    f.push(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(text)?1:0);
    f.push(/[a-z0-9._]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text)?1:0);
    f.push(/\d[\d\s]*\s*(руб|₽|тыс|млн)/i.test(text)?1:0);
    f.push(/^\s*\d+[.)]\s/m.test(text)?1:0);
    f.push(/подпис|м\.п\.|печать/i.test(lo)?1:0);
    const unique=new Set(words).size;
    f.push(Math.min((words.length>0?unique/words.length:0)*2,1));
    f.push(/ооо|ао |зао|ип |пао/i.test(text)?1:0);
    f.push(/№|номер/i.test(lo)?1:0);
    f.push(Math.min((sents.length>0?words.length/sents.length:0)/30,1));
    return f;
  }

  function decodeGenome(g) {
    let i=0; const W1=[],b1=[],W2=[],b2=[];
    for(let h=0;h<NH;h++){const row=[];for(let j=0;j<NF;j++)row.push(g[i++]);W1.push(row);b1.push(g[i++]);}
    for(let o=0;o<NO;o++){const row=[];for(let h=0;h<NH;h++)row.push(g[i++]);W2.push(row);b2.push(g[i++]);}
    return {W1,b1,W2,b2};
  }
  function forward(feat,g){
    const d=decodeGenome(g); const hid=new Float64Array(NH);
    for(let h=0;h<NH;h++){let s=d.b1[h];for(let j=0;j<NF;j++)s+=d.W1[h][j]*feat[j];hid[h]=Math.tanh(s);}
    const out=new Float64Array(NO);
    for(let o=0;o<NO;o++){let s=d.b2[o];for(let h=0;h<NH;h++)s+=d.W2[o][h]*hid[h];out[o]=s;}
    return out;
  }
  function softmax(a,from,to){
    let mx=-Infinity;for(let i=from;i<to;i++)if(a[i]>mx)mx=a[i];if(!isFinite(mx))mx=0;
    let s=0,r=[];for(let i=from;i<to;i++){const e=Math.exp(Math.min(a[i]-mx,50));r.push(e);s+=e;}
    if(s===0||!isFinite(s))return r.map(()=>1/r.length);return r.map(v=>v/s);
  }
  function predictOne(feat,g){
    const out=forward(feat,g);
    const tS=softmax(out,0,TYPES.length), pS=softmax(out,TYPES.length,TYPES.length+PRIOS.length);
    const rS=softmax(out,TYPES.length+PRIOS.length,TYPES.length+PRIOS.length+ROUTES.length);
    const sS=softmax(out,TYPES.length+PRIOS.length+ROUTES.length,NO);
    const mi=a=>{let m=0;for(let i=1;i<a.length;i++)if(a[i]>a[m])m=i;return m;};
    const sorted=[...tS].sort((a,b)=>b-a);
    const conf=isFinite(sorted[0]-sorted[1])&&sorted[0]-sorted[1]>0?sorted[0]-sorted[1]:0;
    return {type:TYPES[mi(tS)],prio:PRIOS[mi(pS)],route:ROUTES[mi(rS)],sentiment:SENTIMENTS[mi(sS)],conf,scores:{t:tS,p:pS,r:rS,s:sS}};
  }
  function ensemblePredict(feat){
    const vt={},vp={},vr={},vs={};let tw=0;
    for(const ind of population){
      const p=predictOne(feat,ind.g);const w=Math.max(ind.fit,0.05);
      vt[p.type]=(vt[p.type]||0)+w;vp[p.prio]=(vp[p.prio]||0)+w;
      vr[p.route]=(vr[p.route]||0)+w;vs[p.sentiment]=(vs[p.sentiment]||0)+w;tw+=w;
    }
    const pk=o=>{let b=null,bv=-1;for(const k in o)if(o[k]>bv){bv=o[k];b=k;}return b;};
    const bt=pk(vt);
    return {type:bt,prio:pk(vp),route:pk(vr),sentiment:pk(vs),conf:tw>0?vt[bt]/tw:0,allScores:{t:vt,p:vp,r:vr,s:vs}};
  }

  // ✅ ИСПРАВЛЕННАЯ ФУНКЦИЯ (защита от выхода за пределы LEX)
  function initPopulation(){
    population=[];
    for(let i=0;i<POP;i++){
      const g=[];
      for(let j=0;j<GSIZE;j++){
        if(j < NF*NH){
          const ti = Math.floor(j / NF);
          const li = j % NF;
          // Первые 15 признаков берут значения из LEX
          if(li < LEX.length) {
            g.push(LEX[li].t === ti ? 0.8 + Math.random()*0.5 : -0.5 + Math.random()*0.5);
          } 
          // Признаки 15-27 (структурные) инициализируются случайно
          else {
            g.push((Math.random() - 0.5) * 0.5);
          }
        } else {
          // Веса второго слоя и смещения
          g.push((Math.random() - 0.5) * 0.5);
        }
      }
      population.push({g, fit:0, age:0});
    }
    generation = 0;
  }

  function evalFitness(ind,data){
    if(!data.length)return 0;let s=0;for(const d of data){const p=predictOne(d.f,ind.g);
    if(p.type===d.y)s+=1;if(p.prio===d.p)s+=0.5;if(p.route===d.r)s+=0.5;if(p.sentiment===d.s)s+=0.3;}
    return s/(data.length*2.3);
  }
  function tournamentSelect(){let b=null;for(let i=0;i<5;i++){const idx=Math.floor(Math.random()*population.length);const ind=population[idx];if(!b||ind.fit>b.fit)b=ind;}return b;}
  function crossover(a,b){const g=[];for(let i=0;i<GSIZE;i++){const lo=Math.min(a.g[i],b.g[i])-0.3*Math.abs(a.g[i]-b.g[i]),hi=Math.max(a.g[i],b.g[i])+0.3*Math.abs(a.g[i]-b.g[i]);g.push(lo+Math.random()*(hi-lo));}return{g,fit:0,age:0};}
  function mutate(ind,rate,step){for(let i=0;i<GSIZE;i++){if(Math.random()<rate){const r=Math.random();
    if(r<0.7)ind.g[i]+=(Math.random()-0.5)*step*2;else if(r<0.9)ind.g[i]*=0.5;else ind.g[i]=(Math.random()-0.5)*1.5;
    ind.g[i]=Math.max(-4,Math.min(4,ind.g[i]));}}}
  function evolveStep(){
    if(trainingData.length<2)return;
    const shuffled=[...trainingData].sort(()=>Math.random()-0.5);
    const tr=shuffled.slice(0,Math.max(1,Math.floor(shuffled.length*0.8)));
    for(const ind of population)ind.fit=evalFitness(ind,tr);
    population.sort((a,b)=>b.fit-a.fit);
    const best=population[0].fit;
    const mRate=Math.max(0.02,0.15*(1-best)),mStep=Math.max(0.05,0.5*(1-best));
    const elite=Math.floor(POP*0.5),newPop=[];
    for(let i=0;i<elite;i++)newPop.push({g:[...population[i].g],fit:population[i].fit,age:0});
    while(newPop.length<POP){const p1=tournamentSelect(),p2=tournamentSelect();const child=crossover(p1,p2);mutate(child,mRate,mStep);newPop.push(child);}
    population=newPop;generation++;
  }

  function trainWithGuarantee(){
    let attempts = 0, max = 5, bestAcc = 0, bestPop = null;
    while(attempts < max){
      attempts++;
      initPopulation();
      trainingData = BUILTIN.map(d=>({f:extractFeatures(d.t),y:d.y,p:d.p,r:d.r,s:d.s||'нейтральный'}));
      for(let i=0;i<200;i++) evolveStep();
      let correct=0;
      for(const d of BUILTIN){
        const res=ensemblePredict(extractFeatures(d.t));
        if(res.type===d.y&&res.prio===d.p&&res.route===d.r)correct++;
      }
      const acc = correct/BUILTIN.length;
      if(acc > bestAcc){bestAcc=acc; bestPop=JSON.parse(JSON.stringify(population));}
      if(acc >= 0.92) break;
    }
    population = bestPop || population;
    return bestAcc >= 0.92;
  }
  trainWithGuarantee();

  return {
    classify:text=>ensemblePredict(extractFeatures(text)),
    addTraining:item=>{trainingData.push(item);if(trainingData.length>=2)evolveStep();},
    getState:()=>({generation,fitness:population[0]?.fit||0,samples:trainingData.length}),
    exportWeights:()=>JSON.stringify(population.map(p=>p.g))
  };
});
