(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const state = {
    data: { posts: [], topics: [] },
    idToken: sessionStorage.getItem("ms_token") || "",
    user: readStoredUser(),
    pendingCredential: ""
  };

  function readStoredUser() {
    try {
      return JSON.parse(localStorage.getItem("ms_user") || "null");
    } catch (error) {
      console.warn("Stored user data is invalid.", error);
      localStorage.removeItem("ms_user");
      return null;
    }
  }

  function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = String(value ?? "");
    return element.innerHTML;
  }

  function refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function toggleTheme() {
    document.documentElement.classList.toggle("dark");
    localStorage.setItem(
      "ms_dark",
      String(document.documentElement.classList.contains("dark"))
    );
  }

  function switchView(name) {
    $$('[data-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.panel !== name;
    });

    $$('[data-view]').forEach((button) => {
      button.classList.toggle("active", button.dataset.view === name);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function roleBadge(role) {
    if (role === "secretariat") return " 🟠";
    if (role === "humanities_operator" || role === "science_operator") {
      return " 🟢";
    }
    if (role === "member") return " 🔴";
    return "";
  }

  function formatDate(value) {
    if (!value) return "";

    try {
      return new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(value));
    } catch (error) {
      return String(value);
    }
  }

  function postHtml(post) {
    const avatar = post.role === "secretariat" ? window.C.logo : "";
    const handle = String(post.gasshoId || "").replace("-", "");
    const body = escapeHtml(post.body || "").replace(
      /#([^#\n]{1,40})#/g,
      '<span class="tag">#$1#</span>'
    );

    return `
      <article class="post ${post.role === "secretariat" ? "central" : ""}"
               data-role="${escapeHtml(post.role || "user")}">
        <div class="postbody">
          <span class="avatar">
            ${avatar ? `<img src="${avatar}" alt="">` : ""}
          </span>
          <div>
            <div class="author">
              ${escapeHtml(post.penName || "利用者")}${roleBadge(post.role)}
            </div>
            <div class="meta">
              @${escapeHtml(handle)} · ${escapeHtml(formatDate(post.createdAt))}
            </div>
            <div class="text">${body}</div>
          </div>
        </div>
        <div class="postactions">
          <button type="button">↻ 共有</button>
          <button type="button">○ 返信</button>
          <button type="button">♡ いいね</button>
          <button type="button">▣ 保存</button>
        </div>
      </article>`;
  }

  function renderPublicData() {
    const posts = state.data.posts || [];
    const topics = state.data.topics || [];

    $("#posts").innerHTML = posts.length
      ? posts.map(postHtml).join("")
      : '<section class="card empty">まだ発信はありません。</section>';

    const officialPosts = posts.filter(
      (post) =>
        post.role === "secretariat" ||
        post.role === "humanities_operator" ||
        post.role === "science_operator"
    );

    $("#official").innerHTML = officialPosts.length
      ? officialPosts.map(postHtml).join("")
      : '<div class="empty">同志通信はありません。</div>';

    $("#topics").innerHTML = topics
      .map(
        (topic, index) => `
          <li>
            <b>${index + 1}</b>
            <span>#${escapeHtml(topic.name)}#</span>
            <small>${Number(topic.count || 0)}</small>
          </li>`
      )
      .join("");

    $("#topicgrid").innerHTML = topics
      .map(
        (topic, index) => `
          <div class="tile">
            <b>${index + 1}. #${escapeHtml(topic.name)}#</b>
            <small>${Number(topic.count || 0)}件</small>
          </div>`
      )
      .join("");
  }

  async function loadPublicData() {
    try {
      const response = await fetch(`data/public.json?v=${Date.now()}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`public.json HTTP ${response.status}`);
      }

      state.data = await response.json();
      renderPublicData();
    } catch (error) {
      console.error("公開タイムラインの読込に失敗しました。", error);
      showNotice(
        `公開タイムラインを読み込めませんでした。\n${error.message}`,
        false
      );
    }
  }

  function buildApiError(action, httpStatus, result, rawText) {
    const lines = [
      `操作: ${action}`,
      `HTTP状態: ${httpStatus}`,
      `公開エラー: ${result?.error || "なし"}`,
      `エラーコード: ${result?.code || "なし"}`,
      `診断コード: ${result?.diagnosticCode || "なし"}`,
      `内部名: ${result?.debug?.name || "なし"}`,
      `内部メッセージ: ${result?.debug?.message || "なし"}`
    ];

    if (result?.debug?.stack) {
      lines.push(`スタック:\n${result.debug.stack}`);
    }

    if (!result && rawText) {
      lines.push(`GAS応答本文:\n${rawText.slice(0, 1500)}`);
    }

    return lines.join("\n");
  }

  async function api(payload) {
    const action = payload.action || "unknown";
    let response;
    let rawText = "";

    try {
      response = await fetch(window.C.gas, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload),
        redirect: "follow"
      });

      rawText = await response.text();

      let result;
      try {
        result = JSON.parse(rawText);
      } catch (parseError) {
        throw new Error(
          [
            `GASからJSON以外の応答が返されました。`,
            `操作: ${action}`,
            `HTTP状態: ${response.status}`,
            `応答先: ${response.url}`,
            `本文: ${rawText.slice(0, 1500)}`
          ].join("\n")
        );
      }

      console.group(`[Meisho Social API] ${action}`);
      console.log("HTTP status:", response.status);
      console.log("Request:", {
        ...payload,
        idToken: payload.idToken ? "[ID_TOKEN_PRESENT]" : "[NONE]",
        nonce: payload.nonce ? "[NONCE_PRESENT]" : "[NONE]",
        inviteCode: payload.inviteCode ? "[INVITE_PRESENT]" : "[NONE]"
      });
      console.log("Response:", result);
      console.groupEnd();

      if (!response.ok || !result.ok) {
        const detail = buildApiError(action, response.status, result, rawText);
        const error = new Error(detail);
        error.apiResult = result;
        throw error;
      }

      return result;
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(
          [
            `GASへの通信に失敗しました。`,
            `操作: ${action}`,
            `対象URL: ${window.C.gas}`,
            `ブラウザ詳細: ${error.message}`,
            `確認事項: GASの公開範囲、/exec URL、デプロイの最新版を確認してください。`
          ].join("\n")
        );
      }

      throw error;
    }
  }

  function showNotice(message, success = false) {
    const notice = $("#notice");
    if (!notice) return;

    notice.hidden = false;
    notice.textContent = message;
    notice.style.whiteSpace = "pre-wrap";
    notice.style.wordBreak = "break-word";
    notice.style.background = success ? "#eaf8ef" : "#fff0f0";
    notice.style.color = success ? "#168244" : "#d43838";
  }

  function updateAuthUi() {
    const loggedIn = Boolean(state.user);

    $("#loginbar").hidden = loggedIn;
    $("#account").textContent = loggedIn ? state.user.penName : "ログイン";
    $("#pname").textContent = loggedIn ? state.user.penName : "ゲスト";
    $("#pid").textContent = loggedIn
      ? `@${String(state.user.gasshoId || "").replace("-", "")}`
      : "ログインして参加";
    $("#session").textContent = loggedIn
      ? `${state.user.penName}として接続中`
      : "ログアウト中";
    $("#logout").disabled = !loggedIn;

    const operatorRoles = [
      "secretariat",
      "humanities_operator",
      "science_operator"
    ];

    $("#adminNav").hidden = !(
      loggedIn && operatorRoles.includes(state.user.role)
    );

    if (loggedIn) {
      $("#profile").innerHTML = `
        <h1>私</h1>
        <h2>${escapeHtml(state.user.penName)}${roleBadge(state.user.role)}</h2>
        <p>@${escapeHtml(
          String(state.user.gasshoId || "").replace("-", "")
        )}</p>
        <p>利用開始日：${escapeHtml(state.user.startDate || "")}</p>`;
    }
  }

  function openLogin() {
    $("#loginmodal").hidden = false;
  }

  async function processGoogleCredential(credential) {
    const status = $("#googleStatus");

    state.pendingCredential = credential;
    state.idToken = credential;
    sessionStorage.setItem("ms_token", credential);

    if (status) {
      status.textContent = "Google認証完了。Meisho Socialへ接続しています…";
    }

    try {
      const result = await api({
        action: "session",
        idToken: credential
      });

      state.user = result.data.user;
      localStorage.setItem("ms_user", JSON.stringify(state.user));
      $("#loginmodal").hidden = true;
      updateAuthUi();
      showNotice("ログインしました。", true);
    } catch (error) {
      /* sessionが失敗した場合は未登録の可能性があるため登録画面を開く。 */
      console.warn("Session lookup failed; opening registration.", error);
      $("#loginmodal").hidden = true;
      $("#registermodal").hidden = false;

      const explanation = $("#registermodal .modalbrand p");
      if (explanation) {
        explanation.textContent =
          "Google認証は完了しました。初回プロフィールを設定してください。";
      }

      /* 診断内容を登録画面にも表示する。 */
      let diagnostics = $("#registerDiagnostics");
      if (!diagnostics) {
        diagnostics = document.createElement("pre");
        diagnostics.id = "registerDiagnostics";
        diagnostics.style.whiteSpace = "pre-wrap";
        diagnostics.style.wordBreak = "break-word";
        diagnostics.style.fontSize = "11px";
        diagnostics.style.color = "var(--m)";
        diagnostics.style.maxHeight = "180px";
        diagnostics.style.overflow = "auto";
        diagnostics.style.marginTop = "12px";
        $("#registermodal .modal").appendChild(diagnostics);
      }
      diagnostics.textContent =
        "既存アカウント照会結果:\n" + error.message;
    }
  }

  /* index.htmlのGoogle Identity Servicesから呼ばれるイベントを受け取る。 */
  window.addEventListener("meisho-google-credential", (event) => {
    processGoogleCredential(event.detail);
  });

  window.addEventListener("meisho-google-error", (event) => {
    const status = $("#googleStatus");
    if (status) status.textContent = event.detail;
    showNotice(event.detail, false);
  });

  async function registerAccount() {
    const penName = $("#pen").value.trim();
    const inviteCode = $("#invite").value.trim();
    const button = $("#register");

    if (!penName) {
      alert("ペンネームを入力してください。");
      return;
    }

    if (!state.pendingCredential && !state.idToken) {
      alert("Google認証情報がありません。もう一度Googleログインしてください。");
      $("#registermodal").hidden = true;
      openLogin();
      return;
    }

    button.disabled = true;
    button.textContent = "登録しています…";

    try {
      const result = await api({
        action: "register",
        idToken: state.pendingCredential || state.idToken,
        penName,
        avatarUrl: "",
        inviteCode
      });

      state.user = result.data.user;
      localStorage.setItem("ms_user", JSON.stringify(state.user));
      $("#registermodal").hidden = true;
      updateAuthUi();
      showNotice("Meisho Socialの利用を開始しました。", true);
    } catch (error) {
      console.error("Account registration failed.", error);

      let diagnostics = $("#registerDiagnostics");
      if (!diagnostics) {
        diagnostics = document.createElement("pre");
        diagnostics.id = "registerDiagnostics";
        diagnostics.style.whiteSpace = "pre-wrap";
        diagnostics.style.wordBreak = "break-word";
        diagnostics.style.fontSize = "11px";
        diagnostics.style.color = "#d43838";
        diagnostics.style.maxHeight = "240px";
        diagnostics.style.overflow = "auto";
        diagnostics.style.marginTop = "12px";
        $("#registermodal .modal").appendChild(diagnostics);
      }

      diagnostics.textContent =
        "登録処理の詳細:\n" + error.message;

      alert(
        "登録に失敗しました。登録画面下部に詳細を表示しました。"
      );
    } finally {
      button.disabled = false;
      button.textContent = "利用を開始する";
    }
  }

  async function publishPost() {
    if (!state.user) {
      openLogin();
      return;
    }

    const body = $("#text").value.trim();
    if (!body) {
      showNotice("発信内容を入力してください。", false);
      return;
    }

    try {
      const session = await api({
        action: "session",
        idToken: state.idToken
      });

      const result = await api({
        action: "createPost",
        idToken: state.idToken,
        nonce: session.data.nonce,
        body,
        replyTo: ""
      });

      $("#text").value = "";
      $("#count").textContent = "2000";
      showNotice(
        `安全検査を通過しました。\n投稿ID: ${
          result.data?.postId || "発行済み"
        }\n次回同期時に公開されます。`,
        true
      );
    } catch (error) {
      showNotice(error.message, false);
    }
  }

  function logout() {
    state.idToken = "";
    state.pendingCredential = "";
    state.user = null;
    sessionStorage.removeItem("ms_token");
    localStorage.removeItem("ms_user");
    updateAuthUi();
    switchView("home");
    showNotice("ログアウトしました。", true);
  }

  window.addEventListener("DOMContentLoaded", () => {
    $$(".logo").forEach((image) => {
      image.src = window.C.logo;
    });

    if (localStorage.getItem("ms_dark") === "true") {
      document.documentElement.classList.add("dark");
    }

    refreshIcons();

    $("#theme").onclick = toggleTheme;
    $("#theme2").onclick = toggleTheme;

    $$('[data-view]').forEach((button) => {
      button.onclick = () => switchView(button.dataset.view);
    });

    $$(".login").forEach((button) => {
      button.onclick = openLogin;
    });

    $("#account").onclick = () => {
      if (state.user) switchView("profile");
      else openLogin();
    };

    $$('[data-close]').forEach((button) => {
      button.onclick = () => {
        $(`#${button.dataset.close}`).hidden = true;
      };
    });

    $("#compose").onclick = () => {
      switchView("home");
      $("#text").focus();
    };

    $("#text").oninput = () => {
      $("#count").textContent = String(2000 - $("#text").value.length);
    };

    $("#publish").onclick = publishPost;
    $("#register").onclick = registerAccount;
    $("#logout").onclick = logout;

    updateAuthUi();
    loadPublicData();
  });
})();
