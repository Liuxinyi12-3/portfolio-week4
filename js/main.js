// ============================================================
// Alex Rivera — Warm Personal Website
// Nav toggle, year, reveal-on-scroll, friendly contact form
// ============================================================

(function () {
  "use strict";

  // ---- Current year in footer ----
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---- Mobile nav toggle ----
  var burger = document.getElementById("navBurger");
  var menu = document.getElementById("navMenu");
  if (burger && menu) {
    var toggleMenu = function (open) {
      var isOpen = open !== undefined ? open : !menu.classList.contains("is-open");
      menu.classList.toggle("is-open", isOpen);
      burger.classList.toggle("is-open", isOpen);
      burger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    };
    burger.addEventListener("click", function () { toggleMenu(); });
    menu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () { toggleMenu(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") toggleMenu(false);
    });
  }

  // ---- Reveal on scroll ----
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var delay = parseInt(entry.target.getAttribute("data-delay") || "0", 10);
          setTimeout(function () { entry.target.classList.add("is-in"); }, delay);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-in"); });
  }

  // ---- Friendly contact form (no backend — just a warm confirmation) ----
  var form = document.getElementById("contactForm");
  var note = document.getElementById("formNote");
  if (form && note) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.querySelector("#name");
      var email = form.querySelector("#email");
      var message = form.querySelector("#message");

      var missing = [];
      if (name && !name.value.trim()) missing.push("your name");
      if (email && !email.value.trim()) missing.push("an email");
      if (message && !message.value.trim()) missing.push("a message");

      if (missing.length) {
        note.style.color = "var(--coral-dark)";
        note.textContent = "Mind adding " + missing.join(", ") + "? 🌷";
        return;
      }

      note.style.color = "#2A8C5A";
      var who = name.value.trim().split(" ")[0];
      note.textContent = "Thanks, " + who + "! Your note is on its way. I'll write back soon. 💛";
      form.reset();
    });
  }
})();

// ============================================================
// To-Do List App — on Projects page
// Backed by Supabase (todos table). Add, complete, edit, delete.
// Schema: id bigint (DB-generated), task text, date, is_complete bool,
// created_at timestamptz. Optional prio text column (probed at init).
// ============================================================
(function () {
  "use strict";

  var form = document.getElementById("todoForm");
  if (!form) return;

  var input = document.getElementById("todoInput");
  var dateEl = document.getElementById("todoDate");
  var list = document.getElementById("todoList");
  var empty = document.getElementById("todoEmpty");
  var count = document.getElementById("todoCount");
  var statusEl = document.getElementById("todoStatus");
  var prioGroup = document.querySelector(".todo__prio-group");
  // New: toolbar, progress, search, filters, clear
  var toolbar = document.getElementById("todoToolbar");
  var searchInput = document.getElementById("todoSearch");
  var statusFilters = document.querySelectorAll("[data-filter]");
  var prioFilters = document.querySelectorAll("[data-prio-filter]");
  var clearBtn = document.getElementById("todoClear");
  var progress = document.getElementById("todoProgress");
  var progressBar = document.getElementById("todoProgressBar");
  var progressText = document.getElementById("todoProgressText");
  var emojiGroup = document.getElementById("todoEmojiGroup");
  var dateShortcuts = document.querySelectorAll("[data-days]");

  // ---- Supabase config ----
  var SUPA_URL = "https://gmpoesrzzwdcyhvokhpg.supabase.co";
  var SUPA_KEY = "sb_publishable_dGW0B86hWz3LzOGGR7TfIQ_lAAlhTEI";
  var TABLE = "todos";
  var client = (window.supabase && window.supabase.createClient)
    ? window.supabase.createClient(SUPA_URL, SUPA_KEY)
    : null;
  var useLocal = !client; // true when Supabase is unavailable — fallback to localStorage

  // ---- Local storage fallback for tasks ----
  var LOCAL_KEY = "todoTasksV1";
  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]") || []; }
    catch (e) { return []; }
  }
  function saveLocal() {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(items)); } catch (e) {}
  }
  var localSeq = 0;
  function genLocalId() { return "local-" + Date.now() + "-" + (++localSeq); }

  var selectedPrio = "medium";
  var hasPrio = false; // probed at init; true if todos.prio column exists
  var PRIO = {
    low:    { emoji: "🟢", label: "Low" },
    medium: { emoji: "🟡", label: "Medium" },
    high:   { emoji: "🔴", label: "High" }
  };

  // ---- Emoji icon picker ----
  var EMOJIS = ["✨", "⭐", "📚", "💼", "🎯", "💡", "🛒", "🍽️", "🏃", "💊",
                "🧹", "🏠", "📞", "✉️", "🎉", "🎵", "🐶", "💰", "🎁", "✈️"];
  var DEFAULT_EMOJI = "✨";
  var selectedEmoji = DEFAULT_EMOJI;
  var hasEmoji = false; // probed at init; true if todos.emoji column exists
  // Local fallback so icons survive reloads even without a DB column
  var EMOJI_STORE_KEY = "todoEmojiV1";
  function loadEmojiStore() {
    try { return JSON.parse(localStorage.getItem(EMOJI_STORE_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  var emojiStore = loadEmojiStore();
  function saveEmojiStore() {
    try { localStorage.setItem(EMOJI_STORE_KEY, JSON.stringify(emojiStore)); } catch (e) {}
  }
  function itemEmoji(item) {
    return item.emoji || emojiStore[item.id] || DEFAULT_EMOJI;
  }
  function getDateState(iso, done) {
    if (!iso || done) return "";
    var p = String(iso).split("T")[0].split("-");
    if (p.length !== 3) return "";
    var due = new Date(+p[0], +p[1] - 1, +p[2]);
    var t = new Date();
    var today0 = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    var diff = Math.round((due - today0) / 86400000);
    if (diff === 0) return "today";
    if (diff < 0) return "overdue";
    return "";
  }
  var EMPTY_MSG = "🌱 Nothing here yet — add your first task above.";
  var FILTERED_EMPTY_MSG = "🔍 No tasks match these filters.";
  var SEARCH_EMPTY_MSG = "🔎 No tasks contain \"{query}\".";

  // New: filter + search state
  var statusFilter = "all";   // all | active | done
  var prioFilter = "all";    // all | low | medium | high
  var searchTerm = "";

  // Default the calendar to today
  var now = new Date();
  var pad = function (n) { return String(n).padStart(2, "0"); };
  dateEl.value = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());

  var items = [];

  // ---- helpers ----
  async function columnExists(col) {
    if (!client) return false;
    try {
      var res = await client.from(TABLE).select(col).limit(1);
      return !res.error;
    } catch (e) { return false; }
  }
  function formatDate(iso) {
    if (!iso) return "";
    var p = String(iso).split("T")[0].split("-");
    if (p.length !== 3) return iso;
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function normalizeRow(r) {
    return {
      id: String(r.id),
      text: r.task || "",
      date: r.date || "",
      prio: PRIO[r.prio] ? r.prio : "medium",
      emoji: r.emoji || "",
      done: !!r.is_complete
    };
  }
  var statusTimer = null;
  function setStatus(msg, isError) {
    if (!statusEl) return;
    if (!msg) { statusEl.hidden = true; statusEl.textContent = ""; return; }
    statusEl.hidden = false;
    statusEl.textContent = msg;
    statusEl.classList.toggle("todo__status--ok", !isError);
    statusEl.classList.toggle("todo__status--err", !!isError);
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { statusEl.hidden = true; }, 4000);
  }

  // ---- helpers: filtering ----
  function getVisibleItems() {
    var term = searchTerm.trim().toLowerCase();
    return items.filter(function (i) {
      if (statusFilter === "active" && i.done) return false;
      if (statusFilter === "done" && !i.done) return false;
      if (prioFilter !== "all" && (i.prio || "medium") !== prioFilter) return false;
      if (term && i.text.toLowerCase().indexOf(term) === -1) return false;
      return true;
    });
  }

  function updateProgress(done, total) {
    if (!progress) return;
    if (!total) {
      progress.hidden = true;
      return;
    }
    progress.hidden = false;
    var pct = Math.round((done / total) * 100);
    if (progressBar) progressBar.style.width = pct + "%";
    if (progressText) progressText.textContent = pct + "%";
    var track = progress.querySelector("[role='progressbar']");
    if (track) track.setAttribute("aria-valuenow", String(pct));
  }

  // ---- render ----
  function render() {
    list.innerHTML = "";

    var doneCount = 0;
    items.forEach(function (i) { if (i.done) doneCount++; });
    var total = items.length;

    updateProgress(doneCount, total);

    // Count chip — based on ALL items (not the filtered subset)
    if (total) {
      count.hidden = false;
      var all = doneCount === total;
      count.classList.toggle("todo__count--done", all);
      var icon = all ? "🎉" : (doneCount === 0 ? "📋" : "⏳");
      var suffix = all ? " — nice work!" : "";
      count.textContent = icon + " " + doneCount + " of " + total +
        " task" + (total === 1 ? "" : "s") + " completed" + suffix;
    } else {
      count.hidden = true;
      count.classList.remove("todo__count--done");
    }

    // Toolbar + progress only make sense once there's at least one task
    if (toolbar) toolbar.hidden = !total;
    if (clearBtn) clearBtn.disabled = doneCount === 0;

    // Truly empty list — show the "add your first task" empty state
    if (!total) {
      empty.style.display = "";
      empty.textContent = EMPTY_MSG;
      empty.classList.remove("todo__empty--filtered");
      return;
    }

    var visible = getVisibleItems();

    // Tasks exist but none match the current filters / search
    if (!visible.length) {
      empty.style.display = "";
      empty.classList.add("todo__empty--filtered");
      if (searchTerm.trim()) {
        empty.textContent = SEARCH_EMPTY_MSG.replace("{query}", searchTerm.trim());
      } else {
        empty.textContent = FILTERED_EMPTY_MSG;
      }
      return;
    }
    empty.style.display = "none";
    empty.classList.remove("todo__empty--filtered");

    visible.forEach(function (item) {
      var p = PRIO[item.prio] || PRIO.medium;
      var dateState = getDateState(item.date, item.done);
      var li = document.createElement("li");
      li.className = "todo__item" + (item.done ? " todo__item--done" : "");
      li.dataset.id = item.id;
      li.dataset.prio = item.prio || "medium";
      li.innerHTML =
        '<label class="todo__check">' +
          '<input type="checkbox" class="todo__checkbox"' + (item.done ? " checked" : "") +
          ' aria-label="Mark task complete">' +
          '<span class="todo__box" aria-hidden="true"></span>' +
        '</label>' +
        '<span class="todo__emoji-badge" aria-hidden="true">' + itemEmoji(item) + '</span>' +
        '<div class="todo__content">' +
          '<p class="todo__text" title="Click to edit">' + escapeHtml(item.text) + '</p>' +
          '<div class="todo__meta">' +
            '<span class="todo__date' + (dateState ? ' todo__date--' + dateState : '') + '">📅 ' +
              escapeHtml(formatDate(item.date)) +
              (dateState === "today" ? ' · Today' : dateState === "overdue" ? ' · Overdue' : '') +
            '</span>' +
            '<span class="todo__prio-tag todo__prio-tag--' + (item.prio || "medium") + '">' +
              p.emoji + ' ' + p.label + '</span>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="todo__del" aria-label="Delete task">×</button>';
      list.appendChild(li);
    });
  }

  // ---- Supabase ops ----
  async function load() {
    if (useLocal) {
      items = loadLocal().map(function (r) {
        return {
          id: String(r.id), text: r.task || r.text || "", date: r.date || "",
          prio: PRIO[r.prio] ? r.prio : "medium", emoji: r.emoji || "",
          done: !!r.is_complete
        };
      });
      return;
    }
    try {
      var res = await client.from(TABLE).select("*").order("created_at", { ascending: false });
      if (res.error) throw res.error;
      items = (res.data || []).map(normalizeRow);
    } catch (e) {
      // Supabase unreachable — fall back to localStorage
      useLocal = true;
      items = loadLocal().map(function (r) {
        return {
          id: String(r.id), text: r.task || r.text || "", date: r.date || "",
          prio: PRIO[r.prio] ? r.prio : "medium", emoji: r.emoji || "",
          done: !!r.is_complete
        };
      });
    }
  }

  async function add(text, date, prio, emoji) {
    emoji = emoji || DEFAULT_EMOJI;
    if (useLocal) {
      var localItem = {
        id: genLocalId(), text: text, date: date, prio: prio,
        emoji: emoji, done: false
      };
      emojiStore[localItem.id] = emoji;
      saveEmojiStore();
      items.unshift(localItem);
      saveLocal();
      render();
      setStatus("✅ Task saved (local)", false);
      return;
    }
    var payload = { task: text, date: date, is_complete: false };
    if (hasPrio) payload.prio = prio;
    if (hasEmoji) payload.emoji = emoji;
    try {
      var res = await client.from(TABLE).insert([payload]).select().single();
      if (res.error) throw res.error;
    } catch (e) {
      // Supabase unreachable — fall back to localStorage
      useLocal = true;
      var fbItem = {
        id: genLocalId(), text: text, date: date, prio: prio,
        emoji: emoji, done: false
      };
      emojiStore[fbItem.id] = emoji;
      saveEmojiStore();
      items.unshift(fbItem);
      saveLocal();
      render();
      setStatus("✅ Task saved (local)", false);
      return;
    }
    var item = normalizeRow(res.data);
    if (!hasPrio) item.prio = prio;
    emojiStore[item.id] = emoji;
    saveEmojiStore();
    if (!item.emoji) item.emoji = emoji;
    items.unshift(item);
    render();
    setStatus("✅ Task saved", false);
  }

  async function toggle(id) {
    var item = items.find(function (i) { return i.id === String(id); });
    if (!item) return;
    item.done = !item.done;
    render();
    if (useLocal) { saveLocal(); return; }
    try {
      var res = await client.from(TABLE).update({ is_complete: item.done }).eq("id", id);
      if (res.error) throw res.error;
    } catch (e) {
      // Supabase unreachable — keep local change, no rollback needed
      useLocal = true;
      saveLocal();
    }
  }

  async function removeTask(id) {
    items = items.filter(function (i) { return i.id !== String(id); });
    delete emojiStore[id];
    saveEmojiStore();
    render();
    if (useLocal) { saveLocal(); setStatus("🗑️ Task deleted", false); return; }
    try {
      var res = await client.from(TABLE).delete().eq("id", id);
      if (res.error) throw res.error;
      setStatus("🗑️ Task deleted", false);
    } catch (e) {
      useLocal = true;
      saveLocal();
      setStatus("🗑️ Task deleted (local)", false);
    }
  }

  async function editText(id, newText) {
    var item = items.find(function (i) { return i.id === String(id); });
    if (!item) return;
    var prev = item.text;
    item.text = newText;
    render();
    if (useLocal) { saveLocal(); return; }
    try {
      var res = await client.from(TABLE).update({ task: newText }).eq("id", id);
      if (res.error) throw res.error;
    } catch (e) {
      useLocal = true;
      saveLocal();
    }
  }

  // ---- inline edit ----
  function startEdit(li, id) {
    var item = items.find(function (i) { return i.id === String(id); });
    if (!item) return;
    var p = li.querySelector(".todo__text");
    p.innerHTML = '<input type="text" class="todo__edit" maxlength="140" autocomplete="off" />';
    var editInput = p.querySelector(".todo__edit");
    editInput.value = item.text;
    editInput.focus();
    editInput.select();

    var settled = false;
    var commit = function () {
      if (settled) return;
      settled = true;
      var val = editInput.value.trim();
      if (!val || val === item.text) { render(); return; }
      editText(id, val);
    };
    var cancel = function () {
      if (settled) return;
      settled = true;
      render();
    };

    editInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { e.preventDefault(); cancel(); }
    });
    editInput.addEventListener("blur", commit);
  }

  // ---- build emoji picker ----
  if (emojiGroup) {
    EMOJIS.forEach(function (em) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "todo__emoji-btn" + (em === selectedEmoji ? " is-active" : "");
      b.dataset.emoji = em;
      b.textContent = em;
      b.setAttribute("aria-label", "Icon " + em);
      emojiGroup.appendChild(b);
    });
    emojiGroup.addEventListener("click", function (e) {
      var btn = e.target.closest(".todo__emoji-btn");
      if (!btn) return;
      selectedEmoji = btn.dataset.emoji;
      emojiGroup.querySelectorAll(".todo__emoji-btn").forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
      });
    });
  }

  // ---- quick date chips: Today / Tomorrow / Next week ----
  dateShortcuts.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var d = new Date();
      d.setDate(d.getDate() + parseInt(btn.dataset.days, 10));
      dateEl.value = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
      dateEl.focus();
    });
  });

  // ---- events ----
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    var date = dateEl.value;
    if (!text || !date) return;
    add(text, date, selectedPrio, selectedEmoji);
    input.value = "";
    // Reset icon picker to default for the next task
    selectedEmoji = DEFAULT_EMOJI;
    if (emojiGroup) {
      emojiGroup.querySelectorAll(".todo__emoji-btn").forEach(function (b) {
        b.classList.toggle("is-active", b.dataset.emoji === DEFAULT_EMOJI);
      });
    }
    input.focus();
  });

  if (prioGroup) {
    prioGroup.addEventListener("click", function (e) {
      var btn = e.target.closest(".todo__prio");
      if (!btn) return;
      selectedPrio = btn.dataset.prio;
      prioGroup.querySelectorAll(".todo__prio").forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
      });
    });
  }

  list.addEventListener("click", function (e) {
    var li = e.target.closest(".todo__item");
    if (!li) return;
    var id = li.dataset.id;
    if (e.target.classList.contains("todo__checkbox")) {
      toggle(id);
    } else if (e.target.classList.contains("todo__del")) {
      li.style.opacity = "0";
      li.style.transform = "translateX(14px)";
      setTimeout(function () { removeTask(id); }, 180);
    } else {
      var textEl = e.target.closest(".todo__text");
      if (textEl && !textEl.querySelector(".todo__edit")) startEdit(li, id);
    }
  });

  // ---- search + filter + clear events ----
  if (searchInput) {
    var searchTimer = null;
    searchInput.addEventListener("input", function (e) {
      searchTerm = e.target.value || "";
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { render(); }, 140);
    });
  }

  if (statusFilters && statusFilters.length) {
    statusFilters.forEach(function (btn) {
      btn.addEventListener("click", function () {
        statusFilter = btn.dataset.filter;
        statusFilters.forEach(function (b) { b.classList.toggle("is-active", b === btn); });
        render();
      });
    });
  }

  if (prioFilters && prioFilters.length) {
    prioFilters.forEach(function (btn) {
      btn.addEventListener("click", function () {
        prioFilter = btn.dataset.prioFilter;
        prioFilters.forEach(function (b) { b.classList.toggle("is-active", b === btn); });
        render();
      });
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", async function () {
      var doneIds = items.filter(function (i) { return i.done; }).map(function (i) { return i.id; });
      if (!doneIds.length) return;
      // Optimistically remove locally
      items = items.filter(function (i) { return !i.done; });
      render();
      setStatus("🧹 Cleared " + doneIds.length + " completed task" + (doneIds.length === 1 ? "" : "s"), false);
      if (useLocal) { saveLocal(); return; }
      var failed = [];
      for (var idx = 0; idx < doneIds.length; idx++) {
        try {
          var res = await client.from(TABLE).delete().eq("id", doneIds[idx]);
          if (res.error) failed.push(doneIds[idx]);
        } catch (e) { failed.push(doneIds[idx]); }
      }
      if (failed.length) {
        // Supabase failed — switch to local mode, tasks already removed from memory
        useLocal = true;
        saveLocal();
        setStatus("🧹 Cleared " + doneIds.length + " (local)", false);
      }
    });
  }

  // ---- init ----
  empty.style.display = "";
  empty.textContent = "⏳ Loading your tasks…";
  (async function init() {
    try {
      var results = await Promise.all([columnExists("prio"), columnExists("emoji")]);
      hasPrio = results[0];
      hasEmoji = results[1];
    } catch (e) {
      // Supabase probe failed — will fall back to localStorage in load()
    }
    await load();
    render();
  })();
})();
