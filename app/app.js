/* KuriK — инструкция курьера. Роутер и рендер экранов. */
(function () {
  "use strict";

  const D = window.KURIK_DATA;
  const STORE_KEY = "kurik.progress.v2";
  const view = document.getElementById("view");
  const app = document.getElementById("app");
  const topbar = document.getElementById("topbar");
  const topTitle = document.getElementById("topTitle");
  const toastEl = document.getElementById("toast");
  const stepbar = document.getElementById("stepbar");

  /* ---------- состояние ---------- */
  const emptyState = () => ({ done: {}, docs: {} });
  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      return {
        done: parsed && typeof parsed.done === "object" && parsed.done ? parsed.done : {},
        docs: parsed && typeof parsed.docs === "object" && parsed.docs ? parsed.docs : {}
      };
    } catch (e) {
      return emptyState();
    }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) { /* приватный режим — просто не сохраняем */ }
  }

  const totalSteps = D.steps.length;
  const doneSteps = () => D.steps.filter((s) => state.done[s.id]).length;
  const allDocs = () => D.documents.reduce((acc, g) => acc.concat(g.items), []);
  const doneDocs = () => allDocs().filter((d) => state.docs[d.id]).length;
  const nextStep = () => D.steps.find((s) => !state.done[s.id]) || null;

  /* ---------- утилиты ---------- */
  function esc(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function hostOf(url) {
    try { return new URL(url).host.replace(/^www\./, ""); } catch (e) { return url; }
  }
  function icon(id, cls) {
    return '<svg class="ico ' + (cls || "") + '"><use href="#' + id + '"/></svg>';
  }

  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1900);
  }

  function ring(percent) {
    const r = 26;
    const c = 2 * Math.PI * r;
    const off = c * (1 - Math.max(0, Math.min(1, percent / 100)));
    return (
      '<div class="ring">' +
        '<svg viewBox="0 0 62 62" aria-hidden="true">' +
          '<circle class="track" cx="31" cy="31" r="' + r + '"/>' +
          '<circle class="bar" cx="31" cy="31" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/>' +
        "</svg>" +
        "<span>" + Math.round(percent) + "%</span>" +
      "</div>"
    );
  }

  /* ---------- экраны ---------- */
  function renderHome() {
    const done = doneSteps();
    const percent = (done / totalSteps) * 100;
    const next = nextStep();

    const stepsHtml = D.steps.map((s) => {
      const isDone = !!state.done[s.id];
      const isNext = next && next.id === s.id;
      return (
        '<a class="step-card ' + (isDone ? "done " : "") + (isNext ? "next" : "") + '" href="#/step/' + s.id + '">' +
          '<span class="num">' + (isDone ? icon("i-check") : s.n) + "</span>" +
          '<span class="step-card-body">' +
            '<span class="step-card-title"><span>' + esc(s.title) + "</span></span>" +
            '<span class="step-card-sub">' + esc(s.short) + " · " + esc(s.time) + "</span>" +
          "</span>" +
          '<span class="mark">' + icon("i-check") + "</span>" +
        "</a>"
      );
    }).join("");

    return (
      '<section class="hero">' +
        '<div class="hero-top">' +
          "<div>" +
            '<div class="hero-eyebrow">Инструкция · курьер</div>' +
            "<h1 class=\"h1\">Аккаунт в Яндекс Еде за 7 шагов</h1>" +
            '<p class="lead">От требований и документов до первой смены — по порядку и без лишних вопросов.</p>' +
          "</div>" +
          ring(percent) +
        "</div>" +
        '<div class="hero-actions">' +
          '<a class="btn-white" href="' + (next ? "#/step/" + next.id : "#/step/" + D.steps[0].id) + '">' +
            (done === 0 ? "Начать" : done === totalSteps ? "Повторить" : "Продолжить") + icon("i-arrow") +
          "</a>" +
        "</div>" +
      "</section>" +

      '<div class="section">' +
        '<div class="section-head"><span class="h2">Шаги оформления</span><span class="count">' + done + " из " + totalSteps + "</span></div>" +
        '<div class="steps">' + stepsHtml + "</div>" +
      "</div>" +

      '<div class="section">' +
        '<div class="section-head"><span class="h2">Полезное</span></div>' +
        '<a class="link-row" href="#/docs">' + icon("i-docs") +
          '<span class="txt">Чек-лист документов<span class="host">' + doneDocs() + " из " + allDocs().length + " собрано</span></span>" +
          icon("i-arrow") +
        "</a>" +
        '<a class="link-row" href="#/faq">' + icon("i-faq") +
          '<span class="txt">Частые вопросы<span class="host">медкнижка, налоги, возраст, выплаты</span></span>' +
          icon("i-arrow") +
        "</a>" +
        '<a class="link-row" href="' + D.meta.officialUrl + '" target="_blank" rel="noopener">' + icon("i-link") +
          '<span class="txt">Официальная анкета<span class="host">' + hostOf(D.meta.officialUrl) + '</span></span>' +
          icon("i-arrow") +
        "</a>" +
      "</div>" +

      '<p class="disclaimer"><b>Важно.</b> ' + esc(D.meta.disclaimer) + "</p>" +
      '<p class="footer-note">KuriK Instrukt · офлайн-инструкция в кармане</p>'
    );
  }

  function renderStep(id) {
    const step = D.steps.find((s) => s.id === id);
    if (!step) return renderNotFound();

    const actions = step.actions.map((a, i) => (
      '<div class="action">' +
        '<span class="idx">' + (i + 1) + "</span>" +
        "<div>" +
          '<div class="t">' + esc(a.t) + "</div>" +
          '<div class="d">' + esc(a.d) + "</div>" +
        "</div>" +
      "</div>"
    )).join("");

    const facts = step.facts ? (
      '<div class="facts">' + step.facts.map((f) => (
        '<div class="fact"><div class="k">' + esc(f.k) + '</div><div class="v">' + esc(f.v) + "</div></div>"
      )).join("") + "</div>"
    ) : "";

    const mock = step.mock ? (
      '<div class="mock">' +
        '<div class="mock-screen">' +
          '<div class="mock-status"><span>12:34</span><span class="dots"><i></i><i></i><i></i></span></div>' +
          '<div class="mock-cap">' + esc(step.mock.title) + "</div>" +
          step.mock.lines.map((l) => {
            if (l.kind === "head") return '<div class="mock-head">' + esc(l.text) + "</div>";
            if (l.kind === "field") return '<div class="mock-line field">' + esc(l.text) + "</div>";
            if (l.kind === "cta") return '<div class="mock-line cta">' + esc(l.text) + "</div>";
            if (l.kind === "image") return '<div class="mock-line image">' + esc(l.text) + "</div>";
            return '<div class="mock-line row"><span>' + esc(l.text) + '</span><span class="ok ' + (l.ok ? "" : "no") + '">✓</span></div>';
          }).join("") +
        "</div>" +
      "</div>" +
      '<p class="footer-note" style="margin-top:8px">Схема экрана — как это выглядит в приложении</p>'
    ) : "";

    const linkRow = step.link ? (
      '<a class="link-row" href="' + step.link.url + '" target="_blank" rel="noopener">' + icon("i-link") +
        '<span class="txt">' + esc(step.link.label) + '<span class="host">' + hostOf(step.link.url) + "</span></span>" +
        icon("i-arrow") +
      "</a>"
    ) : "";

    const tip = step.tip ? '<div class="note tip"><span class="glyph">💡</span><div><b>Совет</b>' + esc(step.tip) + "</div></div>" : "";
    const warn = step.warn ? '<div class="note warn"><span class="glyph">⚠️</span><div><b>Частая ошибка</b>' + esc(step.warn) + "</div></div>" : "";

    return (
      '<section class="step-hero">' +
        '<div class="kicker">Шаг ' + step.n + " из " + totalSteps + " · " + esc(step.tag) + "</div>" +
        "<h1>" + esc(step.title) + "</h1>" +
        '<p class="intro">' + esc(step.intro) + "</p>" +
        '<div class="step-meta">' +
          '<span class="chip">' + icon("i-clock") + esc(step.time) + "</span>" +
          '<span class="chip brand">' + esc(step.tag) + "</span>" +
        "</div>" +
      "</section>" +

      '<div class="section">' +
        '<div class="section-head"><span class="h2">Что делать</span></div>' +
        '<div class="actions">' + actions + "</div>" +
        facts +
      "</div>" +

      (tip || warn ? '<div class="section">' + tip + warn + "</div>" : "") +
      (mock ? '<div class="section"><div class="section-head"><span class="h2">Экран в приложении</span></div>' + mock + "</div>" : "") +
      linkRow
    );
  }

  function renderStepbar(step) {
    const idx = D.steps.indexOf(step);
    const nextStepObj = D.steps[idx + 1] || null;
    const isDone = !!state.done[step.id];
    return (
      '<button class="btn btn-done" type="button" data-toggle-step="' + step.id + '" aria-pressed="' + isDone + '">' +
        (isDone ? "Готово ✓" : "Отметить") +
      "</button>" +
      '<a class="btn btn-primary" href="' + (nextStepObj ? "#/step/" + nextStepObj.id : "#/home") + '">' +
        (nextStepObj ? "Дальше" : "К шагам") + icon("i-arrow") +
      "</a>"
    );
  }

  function renderDocs() {
    const total = allDocs().length;
    const done = doneDocs();
    const percent = total ? (done / total) * 100 : 0;

    const groups = D.documents.map((g) => {
      const gDone = g.items.filter((i) => state.docs[i.id]).length;
      return (
        '<div class="doc-group">' +
          '<div class="doc-group-head"><span>' + esc(g.group) + "</span><span>" + gDone + "/" + g.items.length + "</span></div>" +
          g.items.map((item) => (
            '<div class="doc-item ' + (state.docs[item.id] ? "checked" : "") + '" role="checkbox" tabindex="0" aria-checked="' + (!!state.docs[item.id]) + '" data-doc="' + item.id + '">' +
              '<span class="box">' + icon("i-check") + "</span>" +
              '<span><span class="t">' + esc(item.t) + '</span><span class="d">' + esc(item.d) + "</span></span>" +
            "</div>"
          )).join("") +
        "</div>"
      );
    }).join("");

    const forms = D.forms.map((f) => (
      '<div class="form-card">' +
        '<div class="top"><h3>' + esc(f.title) + '</h3><span class="chip brand">' + esc(f.badge) + "</span></div>" +
        '<p class="best">Кому подходит: ' + esc(f.best) + "</p>" +
        '<ul class="plist">' +
          f.plus.map((p) => '<li class="plus"><span class="s">+</span><span>' + esc(p) + "</span></li>").join("") +
          f.minus.map((m) => '<li class="minus"><span class="s">−</span><span>' + esc(m) + "</span></li>").join("") +
        "</ul>" +
      "</div>"
    )).join("");

    return (
      '<div class="section" style="margin-top:10px">' +
        '<div class="section-head"><span class="h2">Чек-лист документов</span><span class="count">' + done + " из " + total + "</span></div>" +
        '<div class="card">' +
          '<p class="small" style="color:var(--ink-2)">Отмечай то, что уже готово — прогресс сохраняется на устройстве.</p>' +
          '<div class="progress-line" style="margin-top:12px"><i style="width:' + percent.toFixed(1) + '%"></i></div>' +
        "</div>" +
        groups +
      "</div>" +

      '<div class="section">' +
        '<div class="section-head"><span class="h2">Формы сотрудничества</span></div>' +
        '<p class="small muted" style="margin:0 2px 4px">Выбери схему до подачи анкеты — от неё зависит налог и способ выплат.</p>' +
        forms +
      "</div>" +

      '<p class="disclaimer"><b>Список может отличаться.</b> Набор документов зависит от города, формата доставки и гражданства. Точный список покажет приложение при регистрации.</p>'
    );
  }

  function renderFaq() {
    const qa = D.faq.map((f, i) => (
      "<details class=\"qa\"" + (i === 0 ? " open" : "") + ">" +
        "<summary>" + esc(f.q) + '<span class="plus">+</span></summary>' +
        '<div class="a">' + esc(f.a) + "</div>" +
      "</details>"
    )).join("");

    return (
      '<div class="section" style="margin-top:10px">' +
        '<div class="section-head"><span class="h2">Частые вопросы</span><span class="count">' + D.faq.length + "</span></div>" +
        '<div class="faq">' + qa + "</div>" +
      "</div>" +

      '<div class="section">' +
        '<div class="section-head"><span class="h2">Куда обратиться</span></div>' +
        '<a class="link-row" href="' + D.meta.officialUrl + '" target="_blank" rel="noopener">' + icon("i-link") +
          '<span class="txt">Анкета и поддержка<span class="host">' + hostOf(D.meta.officialUrl) + "</span></span>" +
          icon("i-arrow") +
        "</a>" +
        '<a class="link-row" href="https://lknpd.nalog.ru/" target="_blank" rel="noopener">' + icon("i-shield") +
          '<span class="txt">Самозанятость — «Мой налог»<span class="host">lknpd.nalog.ru</span></span>' +
          icon("i-arrow") +
        "</a>" +
      "</div>" +

      '<p class="disclaimer"><b>Дисклеймер.</b> ' + esc(D.meta.disclaimer) + "</p>" +
      '<p class="footer-note">Прогресс хранится только на этом устройстве</p>'
    );
  }

  function renderNotFound() {
    return (
      '<div class="section" style="margin-top:40px;text-align:center">' +
        '<h1 class="h1">Такого шага нет</h1>' +
        '<p class="small muted" style="margin-top:8px">Вернись к списку шагов оформления.</p>' +
        '<a class="btn btn-primary" style="margin-top:18px;display:inline-flex" href="#/home">К шагам</a>' +
      "</div>"
    );
  }

  /* ---------- роутинг ---------- */
  let currentTab = "home";

  function parseRoute() {
    const hash = (location.hash || "#/home").replace(/^#\/?/, "");
    const [seg, arg] = hash.split("/");
    if (seg === "step" && arg) return { screen: "step", id: arg };
    if (seg === "docs") return { screen: "docs" };
    if (seg === "faq") return { screen: "faq" };
    return { screen: "home" };
  }

  function render(scrollTop) {
    const route = parseRoute();
    const screen = route.screen;

    app.dataset.screen = screen;
    topbar.classList.toggle("scrolled", screen !== "home");

    if (screen === "step") {
      const step = D.steps.find((s) => s.id === route.id);
      topTitle.textContent = step ? "Шаг " + step.n + " · " + step.title : D.meta.title;
      view.innerHTML = renderStep(route.id);
      stepbar.innerHTML = step ? renderStepbar(step) : "";
    } else if (screen === "docs") {
      topTitle.textContent = "Документы";
      view.innerHTML = renderDocs();
    } else if (screen === "faq") {
      topTitle.textContent = "Вопросы";
      view.innerHTML = renderFaq();
    } else {
      topTitle.textContent = D.meta.title;
      view.innerHTML = renderHome();
    }

    if (screen !== "step") stepbar.innerHTML = "";
    currentTab = screen === "docs" ? "docs" : screen === "faq" ? "faq" : "home";
    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.tab === currentTab);
    });

    if (scrollTop !== false) view.scrollTop = 0;
  }

  function updateTabbar() {
    const tabbar = document.getElementById("tabbar");
    tabbar.style.display = app.dataset.screen === "step" ? "none" : "";
  }

  /* ---------- события ---------- */
  document.getElementById("btnBack").addEventListener("click", () => {
    if (history.length > 1) history.back();
    else location.hash = "#/home";
  });

  document.getElementById("btnReset").addEventListener("click", () => {
    if (!confirm("Сбросить весь прогресс?")) return;
    state = emptyState();
    save();
    render();
    toast("Прогресс сброшен");
  });

  app.addEventListener("click", (e) => {
    const stepBtn = e.target.closest("[data-toggle-step]");
    if (stepBtn) {
      const id = stepBtn.getAttribute("data-toggle-step");
      state.done[id] = !state.done[id];
      save();
      const y = view.scrollTop;
      render(false);
      view.scrollTop = y;
      toast(state.done[id] ? "Шаг отмечен — так держать" : "Отметка снята");
      return;
    }

    const docItem = e.target.closest("[data-doc]");
    if (docItem) {
      const id = docItem.getAttribute("data-doc");
      state.docs[id] = !state.docs[id];
      save();
      const y = view.scrollTop;
      render(false);
      view.scrollTop = y;
      if (state.docs[id]) {
        const done = doneDocs();
        const total = allDocs().length;
        toast(done === total ? "Все документы собраны 🎉" : "Отмечено: " + done + " из " + total);
      }
    }
  });

  view.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-doc]")) {
      e.preventDefault();
      e.target.click();
    }
  });

  window.addEventListener("hashchange", () => {
    render();
    updateTabbar();
  });

  /* ---------- старт ---------- */
  render();
  updateTabbar();

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
