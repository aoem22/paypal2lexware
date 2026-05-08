/* Bank2Lexware live chat loader.
   Set DEFAULT_CRISP_WEBSITE_ID to the Website ID from the Crisp inbox settings.
   The Crisp client is loaded only after the visitor clicks the launcher. */
(function () {
    var DEFAULT_CRISP_WEBSITE_ID = "d9f828fe-92d9-430b-b01b-65d41f5f4198";
    var config = window.B2L_LIVE_CHAT || {};
    var websiteId = (config.crispWebsiteId || DEFAULT_CRISP_WEBSITE_ID || "").trim();
    var placeholderIds = ["YOUR_CRISP_WEBSITE_ID", "REPLACE_WITH_CRISP_WEBSITE_ID"];

    if (!websiteId || placeholderIds.indexOf(websiteId) !== -1) {
        if (window.location.hostname === "localhost" || window.location.protocol === "file:") {
            console.warn("Crisp live chat disabled: set DEFAULT_CRISP_WEBSITE_ID in shared/live-chat.js.");
        }
        return;
    }

    var isLoaded = false;
    var locale = (config.locale || document.documentElement.lang || "de").slice(0, 2);
    var label = config.label || "Chat starten";
    var loadingLabel = config.loadingLabel || "Chat wird geladen";
    var mode = config.load || "interaction";

    function setupCrisp() {
        window.$crisp = window.$crisp || [];
        window.CRISP_WEBSITE_ID = websiteId;
        window.CRISP_RUNTIME_CONFIG = window.CRISP_RUNTIME_CONFIG || {};
        window.CRISP_RUNTIME_CONFIG.locale = locale;
    }

    function openChat() {
        window.$crisp = window.$crisp || [];
        window.$crisp.push(["do", "chat:open"]);
    }

    function loadCrisp(shouldOpen) {
        setupCrisp();

        if (shouldOpen) {
            openChat();
        }

        if (isLoaded || document.querySelector("script[data-b2l-crisp]")) {
            return;
        }

        isLoaded = true;

        var script = document.createElement("script");
        script.src = "https://client.crisp.chat/l.js";
        script.async = true;
        script.setAttribute("data-b2l-crisp", "true");
        document.head.appendChild(script);
    }

    function createLauncher() {
        if (document.querySelector(".b2l-chat-launcher")) {
            return;
        }

        var button = document.createElement("button");
        button.type = "button";
        button.className = "b2l-chat-launcher";
        button.setAttribute("aria-label", label);
        button.title = label;
        button.innerHTML = [
            '<svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">',
            '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 1 1 21 11.5Z" />',
            '</svg>',
            '<span class="b2l-chat-launcher__tooltip">',
            label,
            '</span>'
        ].join("");

        button.addEventListener("click", function () {
            button.setAttribute("aria-label", loadingLabel);
            button.title = loadingLabel;
            button.classList.add("is-loading");
            loadCrisp(true);
            setTimeout(function () {
                button.classList.add("is-hidden");
            }, 450);
        });

        document.body.appendChild(button);
    }

    function init() {
        if (mode === "immediate") {
            loadCrisp(false);
            return;
        }

        createLauncher();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
