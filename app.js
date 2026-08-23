/* ==============================================================
   UniNote — app.js
   Architecture:
   - TelegramService  : thin wrapper around window.Telegram.WebApp
   - Store            : local persistence (localStorage today, swappable for a
                         remote API/database later — see Store.remote stub)
   - DataService      : the ONLY layer screens talk to. Every function here
                         is written so it can become `await fetch(...)`
                         without any UI code changing.
   - UI               : rendering + event wiring per screen
   - Router            : screen navigation / history
   ============================================================== */

(function () {
  "use strict";

  /* ============================================================
     0. TELEGRAM WEBAPP INTEGRATION
     ============================================================ */
  const TelegramService = (() => {
    const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

    function init() {
      if (!tg) return;
      tg.ready();
      tg.expand();
      try { tg.setHeaderColor("secondary_bg_color"); } catch (e) {}
      try { tg.setBackgroundColor(getComputedBg()); } catch (e) {}
      tg.BackButton.onClick(() => Router.back());
      document.body.dataset.tgPlatform = tg.platform || "unknown";
    }

    function getComputedBg() {
      return getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#F4F5FA";
    }

    function haptic(style) {
      if (!tg || !tg.HapticFeedback) return;
      try {
        if (style === "success" || style === "error" || style === "warning") {
          tg.HapticFeedback.notificationOccurred(style);
        } else {
          tg.HapticFeedback.impactOccurred(style || "light");
        }
      } catch (e) {}
    }

    function setBackButtonVisible(visible) {
      if (!tg) return;
      try { visible ? tg.BackButton.show() : tg.BackButton.hide(); } catch (e) {}
    }

    function getUser() {
      if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        const u = tg.initDataUnsafe.user;
        return { name: u.first_name || "Студент", handle: u.username ? "@" + u.username : "" };
      }
      return null;
    }

    function isAvailable() { return !!tg; }

    return { init, haptic, setBackButtonVisible, getUser, isAvailable };
  })();

  /* ============================================================
     1. STORE — persistence layer (swap-ready for a backend)
     ============================================================ */
  const Store = (() => {
    const KEY = "uninote_state_v1";

    function load() {
      try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    }

    function save(state) {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    }

    // Stub for a future real backend / Telegram cloud storage / DB sync.
    // DataService calls `Store.remote.*` nowhere yet — kept here so the
    // migration path is obvious: implement these, then swap DataService's
    // internals to call them instead of the in-memory arrays.
    const remote = {
      async fetchState() { throw new Error("remote backend not configured yet"); },
      async pushEvent(_event) { /* no-op placeholder */ },
    };

    return { load, save, remote };
  })();

  /* ============================================================
     2. MOCK DATA (seed) — matches the provided design reference
     ============================================================ */
  const SUBJECT_COLORS = {
    violet: { bg: "#EDEBFE", fg: "#7C6EF6" },
    orange: { bg: "#FFF1E6", fg: "#FF9500" },
    green:  { bg: "#E8F8ED", fg: "#34C759" },
    blue:   { bg: "#E7F3FF", fg: "#2E9BFF" },
    purple: { bg: "#F1E9FE", fg: "#9B59F6" },
    yellow: { bg: "#FFF8E1", fg: "#E6B800" },
    red:    { bg: "#FFEDEC", fg: "#FF3B30" },
    teal:   { bg: "#E4FBF6", fg: "#12B8A0" },
  };

  function seed() {
    const subjects = [
      { id: "math",  name: "Математика",       icon: "ƒx", color: "violet" },
      { id: "hist",  name: "История",          icon: "🏛", color: "orange" },
      { id: "eng",   name: "Английский язык",  icon: "Aa", color: "green" },
      { id: "cs",    name: "Информатика",      icon: "💻", color: "blue" },
      { id: "phys",  name: "Физика",           icon: "⚛",  color: "purple" },
      { id: "econ",  name: "Экономика",        icon: "📈", color: "yellow" },
    ];

    const notes = [
      {
        id: "n1", subjectId: "math", title: "Интегралы. Лекция 4", date: "2026-08-22",
        tags: ["#интегралы", "#лекция", "#формулы"], favorite: true,
        attachedFile: { name: "Интегралы_лекция_4.pdf", size: "1.2 МБ" },
        body: `<h3>Определение неопределённого интеграла</h3>
        <p>Неопределённым интегралом от функции f(x) называется множество всех первообразных этой функции и обозначается:</p>
        <div class="math">∫ f(x) dx = F(x) + C</div>
        <h3>Свойства интегралов</h3>
        <ol>
          <li>∫ (f(x) + g(x)) dx = ∫ f(x) dx + ∫ g(x) dx</li>
          <li>∫ k·f(x) dx = k ∫ f(x) dx</li>
          <li>∫ f'(x) dx = f(x) + C</li>
        </ol>
        <h3>Таблица основных интегралов</h3>
        <div class="math">∫ xⁿ dx = xⁿ⁺¹⁄(n+1) + C&nbsp;&nbsp;&nbsp;&nbsp;∫ sin x dx = −cos x + C</div>
        <div class="math">∫ 1⁄x dx = ln|x| + C&nbsp;&nbsp;&nbsp;&nbsp;∫ cos x dx = sin x + C</div>
        <div class="math">∫ eˣ dx = eˣ + C&nbsp;&nbsp;&nbsp;&nbsp;∫ 1⁄cos²x dx = tan x + C</div>
        <h3>Примеры</h3>
        <p>1. ∫ (3x² + 2x) dx = 3∫x²dx + 2∫x dx = x³ + x² + C</p>`,
      },
      {
        id: "n2", subjectId: "math", title: "Методы интегрирования", date: "2026-08-18",
        tags: ["#замена-переменной", "#по-частям"], favorite: false, attachedFile: null,
        body: `<h3>Основные методы вычисления интегралов</h3><p>Замена переменной, интегрирование по частям, разложение на простые дроби — три опорных приёма для взятия сложных интегралов.</p><h3>Замена переменной</h3><p>Если u = φ(x) — дифференцируемая функция, то ∫ f(φ(x))·φ'(x) dx = ∫ f(u) du.</p>`,
      },
      {
        id: "n3", subjectId: "math", title: "Практическая работа №4", date: "2026-08-15",
        tags: ["#практика"], favorite: false, attachedFile: null,
        body: `<h3>Задание</h3><p>Вычислить интегралы:</p><ol><li>∫ x³ dx</li><li>∫ sin(x) dx</li></ol>`,
      },
      {
        id: "n4", subjectId: "hist", title: "Вторая мировая война", date: "2026-08-21",
        tags: ["#XX-век", "#война"], favorite: true, attachedFile: { name: "Хронология_событий.docx", size: "340 КБ" },
        body: `<h3>Причины и предпосылки</h3><p>Версальская система, экономический кризис 1929 года и рост тоталитарных режимов в Европе создали условия для крупнейшего военного конфликта XX века.</p><h3>Основные этапы</h3><ol><li>1939–1941 — начало войны в Европе</li><li>1941–1943 — расширение конфликта, коренной перелом</li><li>1944–1945 — освобождение и капитуляция</li></ol>`,
      },
      {
        id: "n5", subjectId: "hist", title: "Курсовая работа", date: "2026-08-10",
        tags: ["#курсовая"], favorite: false, attachedFile: null,
        body: `<h3>Тема</h3><p>Внешняя политика периода холодной войны: ключевые события и последствия.</p>`,
      },
      {
        id: "n6", subjectId: "eng", title: "Conditionals в английском", date: "2026-08-21",
        tags: ["#грамматика"], favorite: true, attachedFile: null,
        body: `<h3>Types of Conditionals</h3><p>Zero, First, Second and Third Conditionals describe different degrees of reality and probability.</p><ul><li>Zero — general truths</li><li>First — real future possibility</li><li>Second — unreal present/future</li><li>Third — unreal past</li></ul>`,
      },
      {
        id: "n7", subjectId: "cs", title: "Алгоритмы сортировки", date: "2026-08-19",
        tags: ["#алгоритмы"], favorite: false, attachedFile: { name: "sort_examples.py", size: "4 КБ" },
        body: `<h3>Сортировка пузырьком</h3><p>Простейший алгоритм сортировки со сложностью O(n²), удобен для учебных примеров, но неэффективен на больших массивах.</p>`,
      },
      {
        id: "n8", subjectId: "phys", title: "Законы Ньютона", date: "2026-08-17",
        tags: ["#механика"], favorite: false, attachedFile: null,
        body: `<h3>Три закона</h3><p>Первый закон Ньютона описывает инерцию, второй связывает силу и ускорение (F = ma), третий — принцип действия и противодействия.</p>`,
      },
      {
        id: "n9", subjectId: "econ", title: "Спрос и предложение", date: "2026-08-14",
        tags: ["#микроэкономика"], favorite: false, attachedFile: null,
        body: `<h3>Закон спроса</h3><p>При прочих равных условиях снижение цены товара ведёт к росту величины спроса на него.</p>`,
      },
    ];

    const files = [
      { id: "f1", subjectId: "math", name: "Таблица интегралов.pdf", size: "1.2 МБ", type: "pdf", favorite: false },
      { id: "f2", subjectId: "math", name: "Формулы интегралов.jpg", size: "450 КБ", type: "img", favorite: false },
      { id: "f3", subjectId: "math", name: "Доп. материалы. Интегралы.docx", size: "230 КБ", type: "doc", favorite: true },
      { id: "f4", subjectId: "hist", name: "Карта фронтов 1943.jpg", size: "1.8 МБ", type: "img", favorite: false },
      { id: "f5", subjectId: "hist", name: "Хронология_событий.docx", size: "340 КБ", type: "doc", favorite: false },
      { id: "f6", subjectId: "eng", name: "Irregular verbs.pdf", size: "180 КБ", type: "pdf", favorite: true },
      { id: "f7", subjectId: "cs", name: "sort_examples.py", size: "4 КБ", type: "code", favorite: false },
    ];

    const tasks = [
      { id: "t1", title: "Курсовая работа", subjectId: "hist", due: "2026-08-24", done: false },
      { id: "t2", title: "Практическая работа №4", subjectId: "math", due: "2026-08-26", done: false },
      { id: "t3", title: "Эссе", subjectId: "eng", due: "2026-08-28", done: false },
      { id: "t4", title: "Проект по информатике", subjectId: "cs", due: "2026-09-10", done: false },
      { id: "t5", title: "Реферат", subjectId: "phys", due: "2026-09-15", done: false },
      { id: "t6", title: "Лабораторная работа №2", subjectId: "phys", due: "2026-08-05", done: true },
      { id: "t7", title: "Контрольная работа", subjectId: "math", due: "2026-08-01", done: true },
      { id: "t8", title: "Домашнее задание №3", subjectId: "econ", due: "2026-07-29", done: true },
    ];

    // Demo "today" — fixed so the seeded schedule/tasks read naturally, à la the design mock.
    const today = new Date("2026-08-23T09:00:00");

    const lessonColor = { math: "violet", hist: "orange", eng: "green", cs: "blue", phys: "purple", econ: "yellow" };
    function L(subjectId, start, end, room, teacher) {
      return { subjectId, start, end, room, teacher, color: lessonColor[subjectId] };
    }
    const schedule = {
      1: [ L("math", "09:00", "10:30", "204", "Иванова Е. П."), L("cs", "10:45", "12:15", "312", "Козлов Д. И.") ],
      2: [ L("phys", "09:00", "10:30", "118", "Сергеев В. Н."), L("econ", "11:00", "12:30", "220", "Фомина Т. А.") ],
      3: [ L("math", "09:00", "10:30", "204", "Иванова Е. П."), L("hist", "11:00", "12:30", "105", "Петров А. С."), L("eng", "13:30", "15:00", "301", "Смирнова О. И.") ],
      4: [ L("cs", "09:00", "10:30", "312", "Козлов Д. И."), L("eng", "11:00", "12:30", "301", "Смирнова О. И.") ],
      5: [ L("math", "09:00", "10:30", "204", "Иванова Е. П."), L("phys", "10:45", "12:15", "118", "Сергеев В. Н."), L("econ", "13:00", "14:30", "220", "Фомина Т. А.") ],
      6: [ L("hist", "10:00", "11:30", "105", "Петров А. С.") ],
      7: [],
    };

    const dayNotes = {
      "2026-08-23": "Не забыть распечатать материалы по истории и подготовиться к практической по математике.",
    };

    return { subjects, notes, files, tasks, schedule, dayNotes, today: today.toISOString() };
  }

  /* ============================================================
     3. DATA SERVICE — the only API the UI is allowed to call
     ============================================================ */
  const DataService = (() => {
    let state = Store.load();
    if (!state) { state = seed(); Store.save(state); }
    // Always keep "today" pinned to the design's reference date for a coherent demo,
    // even across reloads of a previously-saved state shape.
    if (!state.today) state.today = seed().today;

    function persist() { Store.save(state); }

    function today() { return new Date(state.today); }

    // ---- subjects ----
    function getSubjects() {
      return state.subjects.map(s => ({
        ...s,
        notesCount: state.notes.filter(n => n.subjectId === s.id).length,
        filesCount: state.files.filter(f => f.subjectId === s.id).length,
      }));
    }
    function getSubject(id) { return state.subjects.find(s => s.id === id); }
    function addSubject({ name, icon, color }) {
      const id = "s_" + Date.now();
      state.subjects.push({ id, name, icon: icon || name.slice(0, 2).toUpperCase(), color: color || "violet" });
      persist();
      return id;
    }

    // ---- notes ----
    function getNotesBySubject(subjectId) {
      return state.notes.filter(n => n.subjectId === subjectId).sort((a, b) => b.date.localeCompare(a.date));
    }
    function getNote(id) { return state.notes.find(n => n.id === id); }
    function toggleNoteFavorite(id) {
      const n = getNote(id); if (!n) return;
      n.favorite = !n.favorite; persist(); return n.favorite;
    }
    function getRecentNotes(limit = 3) {
      return [...state.notes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
    }

    // ---- files ----
    function getFilesBySubject(subjectId) { return state.files.filter(f => f.subjectId === subjectId); }
    function toggleFileFavorite(id) {
      const f = state.files.find(x => x.id === id); if (!f) return;
      f.favorite = !f.favorite; persist(); return f.favorite;
    }

    // ---- favorites ----
    function getFavorites() {
      return {
        notes: state.notes.filter(n => n.favorite),
        files: state.files.filter(f => f.favorite),
      };
    }

    // ---- tasks ----
    function getTasks() { return [...state.tasks].sort((a, b) => a.due.localeCompare(b.due)); }
    function addTask({ title, subjectId, due }) {
      const id = "t_" + Date.now();
      state.tasks.push({ id, title, subjectId, due, done: false });
      persist(); return id;
    }
    function toggleTaskDone(id) {
      const t = state.tasks.find(x => x.id === id); if (!t) return;
      t.done = !t.done; persist(); return t.done;
    }
    function getUpcomingTasks(limit = 3) {
      return getTasks().filter(t => !t.done).slice(0, limit);
    }

    // ---- schedule ----
    function getWeekOf(date) {
      const d = new Date(date);
      const dow = (d.getDay() + 6) % 7; // 0=Mon
      const monday = new Date(d); monday.setDate(d.getDate() - dow);
      return Array.from({ length: 7 }, (_, i) => { const x = new Date(monday); x.setDate(monday.getDate() + i); return x; });
    }
    function getLessonsForWeekday(isoWeekday) { return state.schedule[isoWeekday] || []; }
    function getLessonsForDate(date) {
      const dow = ((new Date(date).getDay() + 6) % 7) + 1;
      return getLessonsForWeekday(dow);
    }
    function getDayNote(dateKey) { return state.dayNotes[dateKey] || ""; }
    function saveDayNote(dateKey, text) { state.dayNotes[dateKey] = text; persist(); }

    // ---- search ----
    function searchAll(query) {
      const q = query.trim().toLowerCase();
      if (!q) return { notes: [], files: [], subjects: [], tasks: [] };
      const strip = html => html.replace(/<[^>]+>/g, " ");
      return {
        notes: state.notes.filter(n => n.title.toLowerCase().includes(q) || strip(n.body).toLowerCase().includes(q) || n.tags.some(t => t.toLowerCase().includes(q))),
        files: state.files.filter(f => f.name.toLowerCase().includes(q)),
        subjects: state.subjects.filter(s => s.name.toLowerCase().includes(q)),
        tasks: state.tasks.filter(t => t.title.toLowerCase().includes(q)),
      };
    }

    return {
      today, getSubjects, getSubject, addSubject,
      getNotesBySubject, getNote, toggleNoteFavorite, getRecentNotes,
      getFilesBySubject, toggleFileFavorite,
      getFavorites,
      getTasks, addTask, toggleTaskDone, getUpcomingTasks,
      getWeekOf, getLessonsForWeekday, getLessonsForDate, getDayNote, saveDayNote,
      searchAll,
    };
  })();

  /* ============================================================
     4. HELPERS
     ============================================================ */
  const $ = sel => document.querySelector(sel);
  const $all = sel => Array.from(document.querySelectorAll(sel));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const WEEKDAYS_FULL = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];
  const WEEKDAYS_SHORT = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

  function fmtDate(d) { return `${d.getDate()} ${MONTHS[d.getMonth()]}`; }
  function fmtDateShort(d) { return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`; }
  function dateKey(d) { return d.toISOString().slice(0, 10); }
  function daysUntil(dueStr, from) {
    const due = new Date(dueStr + "T00:00:00");
    const f = new Date(dateKey(from) + "T00:00:00");
    return Math.round((due - f) / 86400000);
  }
  function dueLabel(dueStr, from) {
    const n = daysUntil(dueStr, from);
    if (n < 0) return { text: "Просрочено", tone: "overdue" };
    if (n === 0) return { text: "Сегодня", tone: "today" };
    if (n === 1) return { text: "Завтра", tone: "soon" };
    if (n <= 4) return { text: `Через ${n} дн.`, tone: "soon" };
    const d = new Date(dueStr + "T00:00:00");
    return { text: fmtDateShort(d) + ".", tone: "later" };
  }
  function dueColors(tone) {
    switch (tone) {
      case "overdue": return { bg: "var(--danger-soft)", fg: "var(--danger)" };
      case "today": return { bg: "var(--danger-soft)", fg: "var(--danger)" };
      case "soon": return { bg: "var(--warn-soft)", fg: "var(--warn)" };
      default: return { bg: "var(--blue-soft)", fg: "var(--blue)" };
    }
  }
  function subjColor(colorKey) { return SUBJECT_COLORS[colorKey] || SUBJECT_COLORS.violet; }
  function fileEmoji(type) { return { pdf: "📕", doc: "📘", img: "🖼", code: "💻" }[type] || "📄"; }
  function escapeHtml(s) { return s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
  function highlight(text, q) {
    if (!q) return escapeHtml(text);
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return escapeHtml(text);
    return escapeHtml(text.slice(0, idx)) + "<mark style='background:var(--accent-soft);color:var(--accent);border-radius:3px;'>" + escapeHtml(text.slice(idx, idx + q.length)) + "</mark>" + escapeHtml(text.slice(idx + q.length));
  }

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }

  /* ============================================================
     5. ROUTER
     ============================================================ */
  const Router = (() => {
    const titles = {
      home: "UniNote", subjects: "Предметы", "subject-detail": "Предмет", "note-detail": "Конспект",
      search: "Поиск", schedule: "Расписание", tasks: "Задания", favorites: "Избранное", settings: "Настройки",
    };
    const navMap = { home: "home", subjects: "subjects", search: "search", schedule: "schedule" };
    let stack = ["home"];
    let params = {};

    function current() { return stack[stack.length - 1]; }

    function go(screen, p, opts) {
      opts = opts || {};
      params = p || {};
      if (!opts.replace) stack.push(screen); else stack[stack.length - 1] = screen;
      render();
    }

    function back() {
      if (stack.length > 1) { stack.pop(); render(); }
    }

    function render() {
      const screen = current();
      $all(".screen").forEach(s => s.classList.toggle("active", s.dataset.screen === screen));
      $("#topbarTitle").textContent = titles[screen] || "UniNote";
      const showBack = stack.length > 1;
      $("#topbarBack").hidden = !showBack;
      TelegramService.setBackButtonVisible(showBack);

      $all(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.nav === (navMap[screen] || (["tasks","favorites","settings"].includes(screen) ? "more" : ""))));

      UI.onScreenShown(screen, params);
      $(".screens").scrollTop = 0;
      const activeEl = document.querySelector(".screen.active");
      if (activeEl) activeEl.scrollTop = 0;
    }

    return { go, back, current, render, get params() { return params; } };
  })();

  /* ============================================================
     6. UI — rendering per screen
     ============================================================ */
  const UI = {
    onScreenShown(screen, params) {
      switch (screen) {
        case "home": this.renderHome(); break;
        case "subjects": this.renderSubjects(); break;
        case "subject-detail": this.renderSubjectDetail(params.id); break;
        case "note-detail": this.renderNoteDetail(params.id); break;
        case "search": this.renderSearch(); break;
        case "schedule": this.renderSchedule(); break;
        case "tasks": this.renderTasks(); break;
        case "favorites": this.renderFavorites(); break;
        case "settings": break;
      }
    },

    /* ---------- HOME ---------- */
    renderHome() {
      const today = DataService.today();
      $("#todayDate").textContent = `Сегодня, ${fmtDate(today)}`;
      const lessons = DataService.getLessonsForDate(today);
      const schedBox = $("#homeScheduleList");
      schedBox.innerHTML = "";
      if (!lessons.length) {
        schedBox.appendChild(el("div", "empty-state small", "Сегодня пар нет 🎉"));
      } else {
        lessons.forEach(ls => {
          const c = subjColor(ls.color);
          const subj = DataService.getSubject(ls.subjectId);
          schedBox.appendChild(el("div", "lesson-row", `
            <div class="lesson-time">${ls.start}</div>
            <div class="lesson-bar" style="background:${c.fg}"></div>
            <div class="lesson-info">
              <div class="lesson-name">${subj.name}</div>
              <div class="lesson-meta">Ауд. ${ls.room} · ${ls.teacher}</div>
            </div>`));
        });
      }

      const taskBox = $("#homeTasksList");
      taskBox.innerHTML = "";
      const upcoming = DataService.getUpcomingTasks(3);
      if (!upcoming.length) {
        taskBox.appendChild(el("div", "empty-state small", "Активных заданий нет"));
      } else {
        upcoming.forEach(t => {
          const subj = DataService.getSubject(t.subjectId);
          const due = dueLabel(t.due, today);
          const dc = dueColors(due.tone);
          taskBox.appendChild(el("div", "task-row", `
            <div class="task-dot" style="background:${subjColor(subj.color).fg}"></div>
            <div class="task-info"><div class="task-name">${escapeHtml(t.title)}</div><div class="task-sub">${escapeHtml(subj.name)}</div></div>
            <div class="task-due" style="background:${dc.bg};color:${dc.fg}">${due.text}</div>`));
        });
      }

      const notesBox = $("#homeNotesList");
      notesBox.innerHTML = "";
      DataService.getRecentNotes(3).forEach(n => notesBox.appendChild(noteCardEl(n)));

      const tgUser = TelegramService.getUser();
      if (tgUser) {
        $("#userName").textContent = tgUser.name;
        $("#userAvatar").textContent = tgUser.name.charAt(0).toUpperCase();
      }
    },

    /* ---------- SUBJECTS ---------- */
    renderSubjects() {
      const box = $("#subjectList");
      box.innerHTML = "";
      DataService.getSubjects().forEach(s => {
        const c = subjColor(s.color);
        const row = el("button", "subject-row", `
          <div class="subject-icon" style="background:${c.bg};color:${c.fg}">${s.icon}</div>
          <div style="flex:1;min-width:0;text-align:left;">
            <div class="subject-name">${escapeHtml(s.name)}</div>
            <div class="subject-meta">Конспекты: ${s.notesCount} · Файлы: ${s.filesCount}</div>
          </div>
          <span class="subject-chevron">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>`);
        row.addEventListener("click", () => Router.go("subject-detail", { id: s.id }));
        box.appendChild(row);
      });
    },

    /* ---------- SUBJECT DETAIL ---------- */
    renderSubjectDetail(id) {
      const s = DataService.getSubject(id);
      if (!s) { Router.back(); return; }
      const c = subjColor(s.color);
      const notes = DataService.getNotesBySubject(id);
      const files = DataService.getFilesBySubject(id);
      $("#subjectDetailHero").innerHTML = `
        <div class="subject-icon" style="background:${c.bg};color:${c.fg}">${s.icon}</div>
        <div><h1>${escapeHtml(s.name)}</h1><div class="subject-meta">Конспекты: ${notes.length} · Файлы: ${files.length}</div></div>`;

      const notesPanel = $("#subjectNotesPanel");
      notesPanel.innerHTML = "";
      if (!notes.length) notesPanel.appendChild(el("div", "empty-state small", "Пока нет конспектов по этому предмету."));
      notes.forEach(n => notesPanel.appendChild(noteCardEl(n)));

      const filesPanel = $("#subjectFilesPanel");
      filesPanel.innerHTML = "";
      const nonImgFiles = files.filter(f => f.type !== "img");
      if (!nonImgFiles.length) filesPanel.appendChild(el("div", "empty-state small", "Файлов пока нет."));
      nonImgFiles.forEach(f => filesPanel.appendChild(fileRowEl(f)));

      const photosPanel = $("#subjectPhotosPanel");
      const imgFiles = files.filter(f => f.type === "img");
      photosPanel.innerHTML = "";
      if (!imgFiles.length) {
        photosPanel.appendChild(el("div", "empty-state small", "Фото пока нет."));
      } else {
        const grid = el("div", "photo-grid");
        imgFiles.forEach(f => {
          const ph = el("div", "ph", "🖼");
          ph.style.background = c.bg; ph.style.color = c.fg;
          grid.appendChild(ph);
        });
        photosPanel.appendChild(grid);
      }

      const fab = $("#fabSubjectDetail");
      fab.onclick = () => toast("Создание конспекта скоро будет доступно");
      // reset to first tab
      switchTabs("#subjectTabs", "notes");
    },

    /* ---------- NOTE DETAIL ---------- */
    renderNoteDetail(id) {
      const n = DataService.getNote(id);
      if (!n) { Router.back(); return; }
      const subj = DataService.getSubject(n.subjectId);
      $("#noteDetailTitle").textContent = n.title;
      $("#noteDetailSubject").textContent = subj.name;
      $("#noteDetailTags").innerHTML = n.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("");
      $("#noteDetailBody").innerHTML = n.body;

      const fileBox = $("#noteAttachedFile");
      if (n.attachedFile) {
        fileBox.hidden = false;
        fileBox.innerHTML = `
          <div class="file-icon" style="background:var(--danger-soft);color:var(--danger)">${fileEmoji("pdf")}</div>
          <div style="flex:1;min-width:0;">
            <div class="file-name">${escapeHtml(n.attachedFile.name)}</div>
            <div class="file-meta">${escapeHtml(n.attachedFile.size)}</div>
          </div>
          <span class="file-download"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 4v11m0 0l4-4m-4 4l-4-4M5 19h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
      } else { fileBox.hidden = true; }

      const filesList = $("#noteDetailFiles");
      const relatedFiles = DataService.getFilesBySubject(n.subjectId).slice(0, 3);
      filesList.innerHTML = "";
      relatedFiles.forEach(f => filesList.appendChild(fileRowEl(f)));

      const favBtn = $("#noteFavBtn");
      favBtn.classList.toggle("active", !!n.favorite);
      favBtn.onclick = () => {
        const isFav = DataService.toggleNoteFavorite(n.id);
        favBtn.classList.toggle("active", isFav);
        TelegramService.haptic("light");
        toast(isFav ? "Добавлено в избранное" : "Убрано из избранного");
      };
      $("#noteShareBtn").onclick = () => { TelegramService.haptic("light"); toast("Ссылка скопирована"); };
      $("#noteExportBtn").onclick = () => openModal("exportModal");
      $("#doExportBtn").onclick = () => {
        const fmt = $("#formatList .format-opt.active").dataset.format;
        closeModal("exportModal");
        toast(`Конспект сохранён как .${fmt}`);
      };

      switchTabs("#noteTabs", "content");
    },

    /* ---------- SEARCH ---------- */
    renderSearch(rerunQuery) {
      const input = $("#searchInput");
      const q = rerunQuery !== undefined ? rerunQuery : input.value;
      const activeFilter = $("#searchTabs .tab.active").dataset.filter;
      const results = $("#searchResults");
      const empty = $("#searchEmpty");
      results.innerHTML = "";

      if (!q.trim()) { empty.hidden = false; return; }
      empty.hidden = true;
      const r = DataService.searchAll(q);

      const groups = [
        { key: "notes", label: "Конспекты", items: r.notes, render: n => searchNoteRow(n, q) },
        { key: "files", label: "Файлы", items: r.files, render: f => fileRowEl(f) },
        { key: "subjects", label: "Предметы", items: r.subjects, render: s => searchSubjectRow(s) },
        { key: "tasks", label: "Задания", items: r.tasks, render: t => searchTaskRow(t) },
      ];

      let any = false;
      groups.forEach(g => {
        if (activeFilter !== "all" && activeFilter !== g.key) return;
        if (!g.items.length) return;
        any = true;
        const wrap = el("div", "result-group");
        wrap.appendChild(el("div", "result-group-head", `<span>${g.label}</span><b>Найдено: ${g.items.length}</b>`));
        g.items.forEach(item => wrap.appendChild(g.render(item)));
        results.appendChild(wrap);
      });

      if (!any) results.appendChild(el("div", "empty-state small", "Ничего не найдено. Попробуйте другой запрос."));

      function searchNoteRow(n, query) {
        const subj = DataService.getSubject(n.subjectId);
        const c = subjColor(subj.color);
        const snippet = n.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 70) + "…";
        const row = el("div", "note-card", `
          <div class="note-icon" style="background:${c.bg};color:${c.fg}">📝</div>
          <div style="flex:1;min-width:0;">
            <div class="note-title">${highlight(n.title, query)}</div>
            <div class="note-meta">${escapeHtml(subj.name)} · ${escapeHtml(snippet)}</div>
          </div>`);
        row.addEventListener("click", () => Router.go("note-detail", { id: n.id }));
        return row;
      }
      function searchSubjectRow(s) {
        const c = subjColor(s.color);
        const row = el("div", "subject-row", `
          <div class="subject-icon" style="background:${c.bg};color:${c.fg}">${s.icon}</div>
          <div><div class="subject-name">${escapeHtml(s.name)}</div><div class="subject-meta">Конспекты: ${DataService.getNotesBySubject(s.id).length}</div></div>`);
        row.style.marginBottom = "10px";
        row.addEventListener("click", () => Router.go("subject-detail", { id: s.id }));
        return row;
      }
      function searchTaskRow(t) {
        const subj = DataService.getSubject(t.subjectId);
        const due = dueLabel(t.due, DataService.today());
        const dc = dueColors(due.tone);
        const row = el("div", "task-item", `
          <div class="task-checkbox ${t.done ? "checked" : ""}" style="background:${t.done ? "" : "transparent"}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M4 12l6 6L20 6" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <div class="task-item-info"><div class="task-item-name ${t.done ? "done" : ""}">${escapeHtml(t.title)}</div><div class="task-item-sub">${escapeHtml(subj.name)}</div></div>
          <div class="task-item-due" style="background:${dc.bg};color:${dc.fg}">${due.text}</div>`);
        return row;
      }
    },

    /* ---------- SCHEDULE ---------- */
    scheduleSelectedDate: null,
    renderSchedule() {
      const today = DataService.today();
      if (!this.scheduleSelectedDate) this.scheduleSelectedDate = new Date(today);
      const selected = this.scheduleSelectedDate;
      const week = DataService.getWeekOf(selected);

      const strip = $("#weekStrip");
      strip.innerHTML = "";
      week.forEach((d, i) => {
        const isSel = dateKey(d) === dateKey(selected);
        const cell = el("button", "week-day" + (isSel ? " selected" : ""), `
          <span class="wd-name">${WEEKDAYS_SHORT[i]}</span><span class="wd-num">${d.getDate()}</span>`);
        cell.addEventListener("click", () => { UI.scheduleSelectedDate = d; UI.renderSchedule(); });
        strip.appendChild(cell);
      });

      const dow = (selected.getDay() + 6) % 7;
      $("#scheduleDayTitle").textContent = `${WEEKDAYS_FULL[dow][0].toUpperCase()}${WEEKDAYS_FULL[dow].slice(1)}, ${fmtDate(selected)}`;

      const list = $("#scheduleLessonList");
      list.innerHTML = "";
      const lessons = DataService.getLessonsForDate(selected);
      if (!lessons.length) {
        list.appendChild(el("div", "empty-state small", "В этот день пар нет."));
      } else {
        lessons.forEach(ls => {
          const c = subjColor(ls.color);
          const subj = DataService.getSubject(ls.subjectId);
          const row = el("div", "lesson-row", `
            <div class="lesson-card-inner">
              <div class="lesson-bar" style="background:${c.fg}"></div>
              <div class="lesson-card-body">
                <div class="lesson-time-range">${ls.start} – ${ls.end}</div>
                <div class="lesson-name">${escapeHtml(subj.name)}</div>
                <div class="lesson-bottom"><span class="lesson-room">Ауд. ${ls.room}</span><span class="lesson-teacher">${escapeHtml(ls.teacher)}</span></div>
              </div>
            </div>`);
          list.appendChild(row);
        });
      }

      const note = $("#dayNotesInput");
      note.value = DataService.getDayNote(dateKey(selected));
      note.oninput = () => DataService.saveDayNote(dateKey(selected), note.value);

      $("#fabSchedule").onclick = () => toast("Добавление пары скоро будет доступно");
    },

    /* ---------- TASKS ---------- */
    renderTasks() {
      const filter = $("#taskFilter .seg.active").dataset.filter;
      const today = DataService.today();
      let tasks = DataService.getTasks();
      if (filter === "active") tasks = tasks.filter(t => !t.done);
      if (filter === "done") tasks = tasks.filter(t => t.done);

      const box = $("#taskGroups");
      box.innerHTML = "";

      if (filter !== "done") {
        const active = tasks.filter(t => !t.done);
        const soon = active.filter(t => daysUntil(t.due, today) <= 4);
        const later = active.filter(t => daysUntil(t.due, today) > 4);
        if (soon.length) { box.appendChild(el("div", "task-group-title", "Скоро дедлайн")); soon.forEach(t => box.appendChild(taskItemEl(t))); }
        if (later.length) { box.appendChild(el("div", "task-group-title", "Позже")); later.forEach(t => box.appendChild(taskItemEl(t))); }
        if (!active.length && filter === "active") box.appendChild(el("div", "empty-state small", "Активных заданий нет — можно выдохнуть 🎉"));
      }
      if (filter !== "active") {
        const done = tasks.filter(t => t.done);
        if (done.length) {
          box.appendChild(el("div", "task-group-title", `Выполненные (${done.length})`));
          done.forEach(t => box.appendChild(taskItemEl(t)));
        } else if (filter === "done") {
          box.appendChild(el("div", "empty-state small", "Выполненных заданий пока нет."));
        }
      }

      function taskItemEl(t) {
        const subj = DataService.getSubject(t.subjectId);
        const due = dueLabel(t.due, today);
        const dc = dueColors(due.tone);
        const row = el("div", "task-item", `
          <div class="task-checkbox ${t.done ? "checked" : ""}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M4 12l6 6L20 6" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <div class="task-item-info"><div class="task-item-name ${t.done ? "done" : ""}">${escapeHtml(t.title)}</div><div class="task-item-sub">${escapeHtml(subj.name)}</div></div>
          <div class="task-item-due" style="background:${dc.bg};color:${dc.fg}">${t.done ? "Готово" : due.text}</div>`);
        const cb = row.querySelector(".task-checkbox");
        cb.style.background = t.done ? "var(--success)" : "";
        cb.style.borderColor = t.done ? "var(--success)" : "";
        cb.addEventListener("click", (e) => {
          e.stopPropagation();
          DataService.toggleTaskDone(t.id);
          TelegramService.haptic("success");
          UI.renderTasks();
          UI.renderHome();
        });
        return row;
      }

      $("#fabTasks").onclick = () => openAddTaskModal();
      $("#addTaskBtn").onclick = () => openAddTaskModal();
    },

    /* ---------- FAVORITES ---------- */
    renderFavorites() {
      const filter = $("#favTabs .tab.active").dataset.filter;
      const { notes, files } = DataService.getFavorites();
      const box = $("#favList");
      box.innerHTML = "";
      let any = false;
      if (filter !== "files" && notes.length) { any = true; notes.forEach(n => box.appendChild(noteCardEl(n))); }
      if (filter !== "notes" && files.length) { any = true; files.forEach(f => box.appendChild(fileRowEl(f))); }
      $("#favEmpty").hidden = any;
    },
  };

  /* ============================================================
     7. SHARED ELEMENT BUILDERS
     ============================================================ */
  function noteCardEl(n) {
    const subj = DataService.getSubject(n.subjectId);
    const c = subjColor(subj.color);
    const d = new Date(n.date + "T00:00:00");
    const card = el("div", "note-card", `
      <div class="note-icon" style="background:${c.bg};color:${c.fg}">📝</div>
      <div style="flex:1;min-width:0;">
        <div class="note-title">${escapeHtml(n.title)}</div>
        <div class="note-meta">${escapeHtml(subj.name)} · ${d.toLocaleDateString("ru-RU")}</div>
      </div>
      <span class="note-bookmark ${n.favorite ? "active" : ""}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="${n.favorite ? "currentColor" : "none"}"><path d="M6 3.5h12a1 1 0 011 1V21l-7-4-7 4V4.5a1 1 0 011-1z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
      </span>`);
    card.addEventListener("click", (e) => {
      if (e.target.closest(".note-bookmark")) {
        DataService.toggleNoteFavorite(n.id);
        TelegramService.haptic("light");
        Router.render();
        return;
      }
      Router.go("note-detail", { id: n.id });
    });
    return card;
  }

  function fileRowEl(f) {
    const colorByType = { pdf: { bg: "var(--danger-soft)", fg: "var(--danger)" }, doc: { bg: "var(--blue-soft)", fg: "var(--blue)" }, img: { bg: "var(--success-soft)", fg: "var(--success)" }, code: { bg: "var(--accent-soft)", fg: "var(--accent)" } };
    const c = colorByType[f.type] || colorByType.doc;
    const row = el("div", "file-row", `
      <div class="file-icon" style="background:${c.bg};color:${c.fg}">${fileEmoji(f.type)}</div>
      <div style="flex:1;min-width:0;"><div class="file-name">${escapeHtml(f.name)}</div><div class="file-meta">${escapeHtml(f.size)}</div></div>
      <span class="file-download"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 4v11m0 0l4-4m-4 4l-4-4M5 19h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`);
    row.addEventListener("click", () => toast("Скачивание файлов скоро будет доступно"));
    return row;
  }

  /* ============================================================
     8. TABS / SEGMENTS
     ============================================================ */
  function switchTabs(scopeSel, tabKey) {
    const scope = $(scopeSel);
    if (!scope) return;
    $all(scopeSel + " .tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tabKey));
    const parent = scope.closest(".screen");
    parent.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.dataset.panel === tabKey));
  }

  function wireTabGroup(scopeSel, onChange) {
    $all(scopeSel + " .tab").forEach(btn => {
      btn.addEventListener("click", () => {
        $all(scopeSel + " .tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        if (btn.dataset.tab) {
          const parent = btn.closest(".screen");
          parent.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.dataset.panel === btn.dataset.tab));
        }
        if (onChange) onChange(btn);
      });
    });
  }

  function wireSegGroup(scopeSel, onChange) {
    $all(scopeSel + " .seg").forEach(btn => {
      btn.addEventListener("click", () => {
        $all(scopeSel + " .seg").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        onChange && onChange(btn);
      });
    });
  }

  /* ============================================================
     9. MODALS & SHEET
     ============================================================ */
  function openModal(id) { $("#modalBackdrop").classList.add("open"); $("#" + id).classList.add("open"); }
  function closeModal(id) { $("#modalBackdrop").classList.remove("open"); $("#" + id).classList.remove("open"); }

  function openAddTaskModal() {
    const sel = $("#newTaskSubject");
    sel.innerHTML = DataService.getSubjects().map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
    $("#newTaskName").value = "";
    const today = DataService.today();
    $("#newTaskDate").value = dateKey(today);
    openModal("addTaskModal");
  }

  /* ============================================================
     10. INIT / EVENT WIRING
     ============================================================ */
  function init() {
    TelegramService.init();

    // bottom nav
    $all(".nav-item").forEach(btn => {
      btn.addEventListener("click", () => {
        TelegramService.haptic("light");
        const target = btn.dataset.nav;
        if (target === "more") { openMoreSheet(); return; }
        if (Router.current() !== target) Router.go(target, {}, { replace: true });
      });
    });

    // generic [data-nav] links (home cards etc.)
    document.addEventListener("click", (e) => {
      const navBtn = e.target.closest("[data-nav]");
      if (navBtn && !navBtn.classList.contains("nav-item") && !navBtn.closest(".sheet")) {
        Router.go(navBtn.dataset.nav);
      }
    });

    // "more" sheet items
    $all(".sheet-item").forEach(btn => btn.addEventListener("click", () => {
      closeMoreSheet();
      Router.go(btn.dataset.nav, {}, { replace: true });
    }));
    $("#moreBackdrop").addEventListener("click", closeMoreSheet);

    function openMoreSheet() { $("#moreBackdrop").classList.add("open"); $("#moreSheet").classList.add("open"); }
    function closeMoreSheet() { $("#moreBackdrop").classList.remove("open"); $("#moreSheet").classList.remove("open"); }
    window.closeMoreSheet = closeMoreSheet;

    // topbar back
    $("#topbarBack").addEventListener("click", () => Router.back());
    $("#topbarAction").addEventListener("click", () => Router.go("settings"));

    // FAB on home -> add subject shortcut menu (goes to subjects add)
    $("#fabHome").addEventListener("click", () => openAddTaskModal());
    $("#fabSubjects").addEventListener("click", () => openAddSubjectModal());
    $("#addSubjectBtn").addEventListener("click", () => openAddSubjectModal());

    // tabs / segments
    wireTabGroup("#subjectTabs");
    wireTabGroup("#noteTabs");
    wireTabGroup("#searchTabs", () => UI.renderSearch());
    wireTabGroup("#favTabs", () => UI.renderFavorites());
    wireSegGroup("#taskFilter", () => UI.renderTasks());
    wireSegGroup("#scheduleView", (btn) => {
      if (btn.dataset.view !== "week") toast("Этот вид расписания скоро будет доступен");
    });

    // search input
    const searchInput = $("#searchInput");
    searchInput.addEventListener("input", () => {
      $("#searchClear").hidden = !searchInput.value;
      UI.renderSearch();
    });
    $("#searchClear").addEventListener("click", () => { searchInput.value = ""; $("#searchClear").hidden = true; searchInput.focus(); UI.renderSearch(); });

    // modal backdrop + close buttons
    $("#modalBackdrop").addEventListener("click", () => $all(".modal.open").forEach(m => closeModal(m.id)));
    $all("[data-close-modal]").forEach(btn => btn.addEventListener("click", () => closeModal(btn.dataset.closeModal)));

    // add subject modal
    buildSubjectIconGrid();
    $("#saveSubjectBtn").addEventListener("click", () => {
      const name = $("#newSubjectName").value.trim();
      if (!name) { toast("Введите название предмета"); return; }
      const chosen = $("#subjectIconGrid .icon-opt.selected");
      const colorKey = chosen ? chosen.dataset.color : "violet";
      DataService.addSubject({ name, icon: name.slice(0, 2).toUpperCase(), color: colorKey });
      closeModal("addSubjectModal");
      $("#newSubjectName").value = "";
      toast("Предмет добавлен");
      if (Router.current() === "subjects") UI.renderSubjects();
    });

    // add task modal
    $("#saveTaskBtn").addEventListener("click", () => {
      const title = $("#newTaskName").value.trim();
      const subjectId = $("#newTaskSubject").value;
      const due = $("#newTaskDate").value;
      if (!title || !due) { toast("Заполните название и дедлайн"); return; }
      DataService.addTask({ title, subjectId, due });
      closeModal("addTaskModal");
      toast("Задание добавлено");
      TelegramService.haptic("success");
      if (Router.current() === "tasks") UI.renderTasks();
      if (Router.current() === "home") UI.renderHome();
    });

    // export format picker
    $all("#formatList .format-opt").forEach(btn => btn.addEventListener("click", () => {
      $all("#formatList .format-opt").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    }));

    // settings: theme
    const savedTheme = localStorage.getItem("uninote_theme") || "system";
    applyTheme(savedTheme);
    $all(".theme-opt").forEach(btn => {
      if (btn.dataset.theme === savedTheme) btn.classList.add("active"); else btn.classList.remove("active");
      btn.addEventListener("click", () => {
        $all(".theme-opt").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        applyTheme(btn.dataset.theme);
        localStorage.setItem("uninote_theme", btn.dataset.theme);
      });
    });

    // settings: notifications persistence
    ["toggleLessons", "toggleDeadlines", "toggleNews"].forEach(id => {
      const cb = $("#" + id);
      const saved = localStorage.getItem("uninote_" + id);
      if (saved !== null) cb.checked = saved === "1";
      cb.addEventListener("change", () => localStorage.setItem("uninote_" + id, cb.checked ? "1" : "0"));
    });

    $("#connectTelegramRow").addEventListener("click", () => {
      const user = TelegramService.getUser();
      if (user) toast(`Уже подключено как ${user.handle || user.name}`);
      else toast(TelegramService.isAvailable() ? "Подключение аккаунта…" : "Откройте приложение в Telegram, чтобы подключить аккаунт");
    });
    $("#exportAllRow").addEventListener("click", () => toast("Экспорт всех конспектов скоро будет доступен"));
    $("#editProfileBtn").addEventListener("click", () => toast("Редактирование профиля скоро будет доступно"));

    // apply telegram profile into settings screen if available
    const tgUser = TelegramService.getUser();
    if (tgUser) {
      $("#settingsName").textContent = tgUser.name;
      $("#settingsHandle").textContent = (tgUser.handle || "") + (tgUser.handle ? " · " : "") + "Экономический факультет";
      $("#settingsAvatar").textContent = tgUser.name.charAt(0).toUpperCase();
      $("#tgStatus").textContent = "Подключён";
    }

    function applyTheme(mode) {
      if (mode === "system") {
        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
      } else {
        document.documentElement.setAttribute("data-theme", mode);
      }
    }

    function buildSubjectIconGrid() {
      const grid = $("#subjectIconGrid");
      grid.innerHTML = "";
      Object.keys(SUBJECT_COLORS).forEach((key, i) => {
        const c = SUBJECT_COLORS[key];
        const opt = el("button", "icon-opt" + (i === 0 ? " selected" : ""), "●");
        opt.style.background = c.bg; opt.style.color = c.fg;
        opt.dataset.color = key;
        opt.addEventListener("click", () => {
          $all("#subjectIconGrid .icon-opt").forEach(o => o.classList.remove("selected"));
          opt.classList.add("selected");
        });
        grid.appendChild(opt);
      });
    }

    function openAddSubjectModal() { $("#newSubjectName").value = ""; openModal("addSubjectModal"); }
    window.openAddSubjectModal = openAddSubjectModal;

    // initial render
    Router.render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
