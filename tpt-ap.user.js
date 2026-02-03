/* spell-checker: disable */
// ==UserScript==
// @name         Translate Pixiv Tags for Anime-Pictures
// @author       7nik, evazion, BrokenEagle, hdk5
// @version      20251117092513
// @description  Translates tags on Pixiv, Nijie, NicoSeiga, Tinami, and BCY to Danbooru tags.
// @homepageURL  https://github.com/7nik/tpt-ap
// @supportURL   https://github.com/7nik/tpt-ap/issues
// @updateURL    https://github.com/7nik/tpt-ap/raw/master/tpt-ap.user.js
// @downloadURL  https://github.com/7nik/tpt-ap/raw/master/tpt-ap.user.js
// @match        *://*.artstation.com/*
// @match        *://baraag.net/*
// @match        *://bsky.app/*
// @match        *://ci-en.net/*
// @match        *://ci-en.dlsite.com/*
// @match        *://*.deviantart.com/*
// @match        *://*.fanbox.cc/*
// @match        *://fantia.jp/*
// @match        *://*.hentai-foundry.com/*
// @match        *://misskey.art/*
// @match        *://misskey.design/*
// @match        *://misskey.io/*
// @match        *://nijie.info/*
// @match        *://pawoo.net/*
// @match        *://dic.pixiv.net/*
// @match        *://www.pixiv.net/*
// @match        *://saucenao.com/*
// @match        *://seiga.nicovideo.jp/*
// @match        *://skeb.jp/*
// @match        *://www.tinami.com/*
// @match        *://twitter.com/*
// @match        *://mobile.twitter.com/*
// @match        *://tweetdeck.twitter.com/*
// @match        *://m.weibo.cn/*
// @match        *://www.weibo.com/*
// @match        *://x.com/*
// @match        *://www.xiaohongshu.com/*
// @match        *://danbooru.donmai.us/posts*
// @match        *://danbooru.donmai.us/artists/*
// @grant        GM_getResourceText
// @grant        GM_getResourceURL
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_addElement
// @grant        GM.setClipboard
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/psl/1.9.0/psl.min.js
// @require      https://raw.githubusercontent.com/rafaelw/mutation-summary/421110f84178aa9e4098b38df83f727e5aea3d97/src/mutation-summary.js
// @require      https://cdn.jsdelivr.net/npm/@floating-ui/core@1.0.3/dist/floating-ui.core.umd.min.js
// @require      https://cdn.jsdelivr.net/npm/@floating-ui/dom@1.0.8/dist/floating-ui.dom.umd.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.9.1/underscore.js
// @require      https://github.com/evazion/translate-pixiv-tags/raw/lib-20221207/lib/tooltip.js
// @require      https://github.com/evazion/translate-pixiv-tags/raw/lib-20250707/lib/jquery-gm-shim.js
// @require      https://github.com/evazion/translate-pixiv-tags/raw/master/translate-pixiv-tags.user.js?v=3
// @resource     danbooru_icon https://github.com/evazion/translate-pixiv-tags/raw/resource-20190903/resource/danbooru-icon.ico
// @resource     settings_icon https://github.com/evazion/translate-pixiv-tags/raw/resource-20190903/resource/settings-icon.svg
// @resource     globe_icon https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/svgs/solid/globe.svg
// @resource     sound_icon https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/svgs/solid/volume-high.svg
// @resource     ap_icon https://anime-pictures.net/favicon.ico
// @connect      donmai.us
// @connect      donmai.moe
// @connect      raw.githubusercontent.com
// @connect      icons.duckduckgo.com
// @connect      anime-pictures.net
// @noframes
// ==/UserScript==

/* spell-checker: enable */
// cSpell:ignoreRegExp [-\.#]\w+

/* globals _ $ */
/* globals SETTINGS_SCHEMA MAX_NETWORK_RETRIES DISPLAY_NETWORK_ERRORS BOORU DEBUG TAG_POSITIONS
    ARTIST_TOOLTIP_CSS ARTIST_POST_PREVIEW_LIMIT SHOW_PREVIEW_RATING DOMAIN_USES_CSP
    debuglog memoizeKey noIndents getResourceUrl tooManyNetworkErrors normalizeProfileURL
    queueNetworkRequestMemoized addDanbooruArtist addTooltip buildArtistTooltip findAndTranslate
    chooseBackgroundColorScheme showSettings attachShadow timeToAgo formatBytes getImage
    $messageContainer renderedTagsCache, renderedArtistsCache */

// @ts-expect-error - it has no exports or import but types are get correctly
/** @typedef {import("./node_modules/mutation-summary/src/mutation-summary")} */

"use strict";

/** @type {Setting} */ (SETTINGS_SCHEMA.find((item) => item.name === "show_preview_rating"))
    .values = {
        g: "General / No erotic",
        s: "Sensitive / Light erotic",
        q: "Questionable / Erotic",
        e: "Explicit / Hard erotic", // eslint-disable-line id-blacklist
    };

const AP_SITE = "https://anime-pictures.net";
const AP_API = "https://api.anime-pictures.net";

const PROGRAM_CSS2 = /* CSS */`
:root, .tpt-light, .tpt-auto {
    --tpt-ap-artist: darkorange;
}
.tpt-dark {
}
@media (prefers-color-scheme: dark) {
    .tpt-auto {
    }
}

.ex-artist-tag.ap a:first-child:not(#id) {
    color: var(--tpt-ap-artist) !important;
}
.ex-artist-tag.ap a:first-child::after {
    content: none;
}
.ex-artist-tag::before,
.ex-artist-tag a+a::before,
.ex-translated-tags .ap::before{
    content: "";
    display: inline-block;
    background-image: url(${getResourceUrl("danbooru_icon", true)});
    background-repeat: no-repeat;
    background-size: 0.8em;
    width: 0.8em;
    height: 0.8em;
    vertical-align: middle;
}
.ex-artist-tag.ap::before,
.ex-translated-tags .ap::before {
    background-image: url(${getResourceUrl("ap_icon", true)});
}
.ex-translated-tags {
    position: relative;
}

.ex-translated-tags:not(:hover) .ap {
    display: none !important;
}
.ex-translated-tags .ap {
    display: inline-block;
    position: absolute;
    left: 100%;
    padding: 0.4em !important;
}
`;

// OVERWRITES
/**
 * Display a message
 * @param {string} msg the message to display
 * @param {string} key the message id
 */
function showMessage (msg, key) {
    if ($messageContainer) {
        const msgCtn = $messageContainer.find("#msg");
        let msgElem = msgCtn;
        if (key) {
            msgElem = msgCtn.find(`[data-key="${key}"]`);
            if (msgElem.length === 0) {
                msgElem = $(`<span data-key="${key}"></span>`);
                msgCtn.append(msgElem);
            }
        }
        if (msgElem.text() === msg) return;
        msgElem.text(msg);
        $messageContainer.toggleClass("hide", !msgCtn.text());
        return;
    }
    if (!$messageContainer && !msg) return;

    const $shadowContainer = $("<div id=ex-message>").appendTo("body");

    const styles = /* CSS */`
        #ui-message {
            width: 100vw;
            height: 0;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            position: relative;
            z-index: 3100000;
        }
        .container {
            font-family: Verdana, Helvetica, sans-serif;
            padding: 20px;
            font-size: 12px;
            opacity: 1;
            transform: translateY(20px);
            transition: all 0.5s;
            box-shadow: 0 0 50px #f00;
        }
        .hide .container {
            opacity: 0;
            transform: translateY(-100%);
        }
        .tip-light .container {
            background-color: #fff;
            border: 1px solid #888;
            color: #222;
        }
        .tip-dark .container {
            background-color: #222;
            border: 1px solid #888;
            color: #fff;
        }
        .container h2 {
            margin: auto;
        }
        input[type="button"] {
            margin: 0 5px;
        }

        .settings-icon {
            position:absolute;
            top: 5px;
            right: 5px;
            width: 16px;
            height: 16px;
            cursor: pointer;
        }
        .settings-icon path {
            fill: #888;
        }
    `;
    // eslint-disable-next-line no-global-assign
    $messageContainer = $(noIndents/* HTML */`
        <div id="ui-message" class="hide">
            <div class="container">
                Translate Pixiv Tags: <span id="msg"></span>
                <input class="close" type="button" value="Close" />
                ${GM_getResourceText("settings_icon")}
            </div>
        </div>
    `);

    $messageContainer.find(".settings-icon").click(showSettings);
    $messageContainer.find(".close").click(() => $messageContainer.addClass("hide"));

    const { theme } = chooseBackgroundColorScheme($("body"));
    $messageContainer.addClass(`tip-${theme}`);

    attachShadow($shadowContainer, $messageContainer, styles);

    showMessage(msg, key);
}

// OVERWRITES
/**
 * @param {string} method
 * @param {string} url
 * @param {UrlParams} data
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
async function makeRequest (method, url, data) {
    const domain = new URL(url).hostname;
    const sleep = () => new Promise((resolve) => {
        setTimeout(resolve, domain === "api.anime-pictures.net" ? 10_000 : 500);
    });
    if (tooManyNetworkErrors(domain)) {
        throw new Error(`${domain} had too many network errors`);
    }
    let status = -1;
    let statusText = "";
    let errorMsg;

    for (let i = 0; i < MAX_NETWORK_RETRIES; i++) {
        try {
            // eslint-disable-next-line no-await-in-loop
            const resp = await $.ajax(url, {
                dataType: "json",
                data,
                method,
                // Do not use the failed and cached first try
                cache: i === 0,
            });
            showMessage("", "");
            return resp;
        } catch (error) {
            tooManyNetworkErrors(domain, true);
            ({ status, statusText } = /** @type {XMLHttpRequest} */(error));
            console.error(
                "[TPT]: Failed try #",
                i + 1,
                "\nURL:",
                url,
                "\nParameters:",
                data,
                "\nHTTP Error:",
                status,
                statusText,
            );
            errorMsg = (!status || statusText?.startsWith("NetworkError"))
                ? `Failed to connect to ${domain}`
                : (status >= 500
                    ? `Bad response from ${domain}: ${status} ${statusText}`
                    : `Invalid response from ${domain}: ${status} ${statusText}`);
            if (DISPLAY_NETWORK_ERRORS) {
                showMessage(errorMsg, domain);
            }
            // eslint-disable-next-line no-await-in-loop
            await sleep();
        }
    }
    throw new Error(errorMsg);
}

// OVERWRITES
/**
 * Attaches translations to the target element
 * @param {JQuery} $target The element to attach the translation
 * @param {TranslatedTag[]} tags Translated tags
 * @param {TranslationOptionsFull} options Translation options
 */
// eslint-disable-next-line no-unused-vars
function addDanbooruTags ($target, tags, options) {
    if (tags.length === 0) return;

    const {
        onadded = null,
        tagPosition: {
            insertTag = TAG_POSITIONS.afterend.insertTag,
            findTag = TAG_POSITIONS.afterend.findTag,
        } = {},
        ruleName,
    } = options;
    let { classes = "" } = options;
    classes = `ex-translated-tags ${classes}`;

    const key = tags.map((tag) => tag.name).join("");
    if (!(key in renderedTagsCache)) {
        renderedTagsCache[key] = $(noIndents/* HTML */`
            <span class="${classes}">
                ${tags.map((tag) => noIndents/* HTML */`
                        <a class="ex-translated-tag-category-${tag.category}"
                           href="${BOORU}/posts?tags=${encodeURIComponent(tag.name)}"
                           target="_blank">
                                ${_.escape(tag.prettyName)}
                        </a>
                        <a class="ap"
                           href="${AP_SITE}/posts?search_tag=${encodeURIComponent(tag.prettyName)}"
                           target="_blank"
                        ></a>
                    </a>
                `)
                .join(", ")}
            </span>
        `);
    }
    const $tagsContainer = renderedTagsCache[key].clone().prop("className", classes);

    const $duplicates = findTag($target)
        .filter((i, el) => el.textContent?.trim() === $tagsContainer.text().trim());
    if ($duplicates.length > 0) {
        return;
    }

    if (DEBUG) $tagsContainer.attr("rulename", ruleName || "");
    insertTag($target, $tagsContainer);

    if (onadded) onadded($tagsContainer, options);
}

/**
 * @typedef {object} APTag
 * @prop {number} id
 * @prop {string} tag
 * @prop {string|null} tag_ru
 * @prop {string|null} tag_jp
 * @prop {number} type
 * @prop {string} description_en
 * @prop {string} description_ru
 * @prop {string} description_jp
 * @prop {number|null} alias
 * @prop {number|null} parent
 */

/**
 * Source artists on Anime-Pictures
 * @param {string} profileUrl The artist's urls to translate
 * @returns {Promise<APTag[]>}
 */
async function findAnimePictureArtistByUrl (profileUrl) {
    // FIXME some links are still HTTP
    const url = profileUrl.replace(/^https?/, "");
    /**
     * @type {{tags:APTag[]}}
     */
    const artists = await makeRequest("GET", `${AP_API}/api/v3/tags`, {
        "description:smart_like": url,
        type: 4, // artist
    });
    return Promise.all(artists.tags
        .filter((tag) => tag.description_en.split(/\n|\r/).some((line) => (
            line.toLowerCase().replace(/^https?/, "") === url
        )))
        .map((tag) => (tag.alias
            ? makeRequest("GET", `${AP_API}/api/v3/tags/${tag.alias}`, {}).then((data) => data.tag)
            : tag
        )));
}

const findAnimePictureArtistByUrlMemoized = _.memoize(findAnimePictureArtistByUrl, memoizeKey);

/**
 * Source artists on Anime-Pictures
 * @param {string} name The artist's name to translate
 * @returns {Promise<APTag[]>}
 */
async function findAnimePictureArtistByName (name) {
    /**
     * @type {{tags:APTag[]}}
     */
    const artists = await makeRequest("GET", `${AP_API}/api/v3/tags`, {
        "tag:smart": name,
    });
    return Promise.all(artists.tags
        .filter((tag) => tag.type === 4 /* artist */)
        .map((tag) => (tag.alias
            ? makeRequest("GET", `${AP_API}/api/v3/tags/${tag.alias}`, {}).then((data) => data.tag)
            : tag
        )));
}

const findAnimePictureArtistByNameMemoized = _.memoize(findAnimePictureArtistByName, memoizeKey);

/**
 * Add the artist to the page
 * @param {APTag[]} apArtists AP's artists
 * @param {ResponseArtist[]} dbArtists DB's artists
 * @param {JQuery} $element The element to attach the translations
 * @param {TranslationOptionsFull} options Translation options
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
function addArtists (apArtists, dbArtists, $element, options) {
    const common = new Set(apArtists.map((t) => t.tag.replaceAll(" ", "_")))
        .intersection(new Set(dbArtists.map((t) => t.name)));

    for (const apArtist of apArtists) {
        const name = apArtist.tag.replaceAll(" ", "_");
        const dbArtist = common.has(name)
            ? dbArtists.find((t) => t.name === name)
            : null;
        addAnimePictureArtist($element, apArtist, dbArtist, options);
    }
    for (const artist of dbArtists) {
        if (!common.has(artist.name)) addDanbooruArtist($element, artist, options);
    }
}

// OVERWRITES
/**
 * Translate an artist on the given element using the url to their profile
 * @param {HTMLElement} element The element to attach the translations
 * @param {string} profileUrl The artist's urls to translate
 * @param {TranslationOptionsFull} options Translation options
 */
// eslint-disable-next-line no-unused-vars
function translateArtistByURL (element, profileUrl, options) {
    // DMZ is still bound to the original function, so do this hack
    Promise.resolve().then(async () => {
        if (!profileUrl) return;

        const normalizedUrl = normalizeProfileURL(profileUrl);
        if (!normalizedUrl) return;

        const [apArtists, dbArtists] = await Promise.all([
            findAnimePictureArtistByUrlMemoized(normalizedUrl),
            queueNetworkRequestMemoized("url", normalizedUrl),
        ]);

        if (apArtists.length === 0 && dbArtists.length === 0) {
            const urls = Array.isArray(profileUrl) ? profileUrl.join(", ") : profileUrl;
            debuglog(`No artist at "${urls}", rule "${options.ruleName}"`);
            return;
        }

        addArtists(apArtists, dbArtists, $(element), options);
    });
}

// OVERWRITES
/**
 * Translate an artist on the given element using the their name
 * @param {HTMLElement} element The element to attach the translations
 * @param {string} artistName The artist name
 * @param {TranslationOptionsFull} options Translation options
 */
// eslint-disable-next-line no-unused-vars
function translateArtistByName (element, artistName, options) {
    // DMZ is still bound to the original function, so do this hack
    Promise.resolve().then(async () => {
        if (!artistName) return;

        const [apArtists, dbArtists] = await Promise.all([
            findAnimePictureArtistByNameMemoized(artistName),
            queueNetworkRequestMemoized("artist", artistName.replaceAll(" ", "_")),
        ]);

        if (apArtists.length === 0 && dbArtists.length === 0) {
            debuglog(`No artist "${artistName}", rule "${options.ruleName}"`);
            return;
        }

        addArtists(apArtists, dbArtists, $(element), options);
    });
}

/**
 * Attach the artist's translation to the target element
 * @param {JQuery} $target The target element to attach the translation
 * @param {APTag} apArtist The artist data
 * @param {ResponseArtist|null|undefined} dbArtist The artist data
 * @param {TranslationOptionsFull} options Translation options
 */
function addAnimePictureArtist ($target, apArtist, dbArtist, options) {
    const {
        onadded = null,
        tagPosition: {
            insertTag = TAG_POSITIONS.afterend.insertTag,
            findTag = TAG_POSITIONS.afterend.findTag,
        } = {},
        ruleName,
    } = options;
    let { classes = "ex-artist-tag" } = options;
    classes += " ex-artist-tag ap";
    if (dbArtist?.is_banned) classes += " ex-banned-artist-tag";

    const escapedName = encodeURIComponent(apArtist.tag).replaceAll("%20", "+");

    const $duplicates = findTag($target)
        .filter(".ap")
        .filter((i, el) => el.textContent?.trim() === apArtist.tag);
    if ($duplicates.length > 0) {
        return;
    }

    if (!(apArtist.id in renderedArtistsCache)) {
        renderedArtistsCache[apArtist.id] = $(noIndents/* HTML */`
            <div class="${classes}">
                <a href="${AP_SITE}/posts?search_tag=${escapedName}" target="_blank">
                    ${apArtist.tag}
                </a>
                ${dbArtist ? `<a href="${BOORU}/artists/${dbArtist.id}" target="_blank"></a>` : ""}
            </div>
        `);
    }
    const $tag = renderedArtistsCache[apArtist.id].clone().prop("className", classes);
    $tag.click((ev) => {
        if (ev.target === $tag[0]) {
            GM.setClipboard(apArtist.tag, "text");
        }
    });
    if (DEBUG) $tag.attr("rulename", ruleName || "");
    insertTag($target, $tag);
    addTooltip(
        $tag.children().first()[0],
        (tip) => buildApArtistTooltip(apArtist, tip),
    );
    if (dbArtist) {
        addTooltip(
            $tag.children().last()[0],
            (tip) => buildArtistTooltip({
                ...dbArtist,
                prettyName: dbArtist.name.replaceAll("_", " "),
                escapedName: _.escape(dbArtist.name.replaceAll("_", " ")),
                encodedName: encodeURIComponent(dbArtist.name),
            }, tip),
        );
    }

    if (onadded) onadded($tag, options);
}

/** @type {Record<string, Promise<JQuery>>} */
const renderedApTipsCache = {};

/**
 * Fills the artist tooltip with a content
 * @param {APTag} artist The artist data
 * @param {TooltipInstance} tip The tooltip instance
 */
async function buildApArtistTooltip (artist, { tooltip, content, target }) {
    if (!(artist.tag in renderedApTipsCache)) {
        renderedApTipsCache[artist.tag] = buildApArtistTooltipContent(artist);
    }

    if (
        !tooltip.classList.contains("tip-dark")
        && !tooltip.classList.contains("tip-light")
    ) {
        // Select theme and background color based upon the background of surrounding elements
        const { theme, adjustedColor } = chooseBackgroundColorScheme($(target));
        content.classList.add(`tip-content-${theme}`);
        tooltip.classList.add(`tip-${theme}`);
        tooltip.style.setProperty("--bg", adjustedColor);
    }

    target.classList.add("loading-data");
    let $tipContent = await renderedApTipsCache[artist.tag];
    // For correct work of CORS images must not be cloned at first displaying
    if ($tipContent.parent().length > 0) $tipContent = $tipContent.clone(true, true);
    // eslint-disable-next-line no-use-before-define
    attachShadow($(content), $tipContent, ARTIST_TOOLTIP_CSS2);
    target.classList.remove("loading-data");
}

const ARTIST_TOOLTIP_CSS2 = /* CSS */`
    ${ARTIST_TOOLTIP_CSS}
    :host(*) {
        color: #000;
    }
    a:link, a:visited, a:hover {
        color: #676767;
        text-decoration: none;
    }
    a:hover {
        text-decoration: underline;
    }
    a.tag-category-artist, a.tag-category-artist:hover {
        color: darkorange;
    }
    :host(.tip-content-dark) {
        color: #ddd;
    }
    :host(.tip-content-dark) a:link,
    :host(.tip-content-dark) a:visited,
    :host(.tip-content-dark) a:hover {
        color: #d86a48;
        text-decoration: none;
    }
    :host(.tip-content-dark) a.tag-category-artist,
    :host(.tip-content-dark) a.tag-category-artist:hover {
        color: darkorange;
    }
    .erotic-1 {
        color: #f0f;
    }
    .erotic-2 {
        color: #f90;
    }
    .erotic-3 {
        color: red;
    }
`;
/**
 * Builds artist tooltip content
 * @param {APTag} artist The artist data
 */
async function buildApArtistTooltipContent (artist) {
    const encodedName = encodeURIComponent(artist.tag).replaceAll("%20", "+");
    const {
        posts,
        posts_count: postsCount,
        max_pages: lastPage,
    } = await makeRequest("GET", `${AP_API}/api/v3/posts`, {
        page: 0,
        search_tag: artist.tag,
        posts_per_page: ARTIST_POST_PREVIEW_LIMIT,
    });

    const otherNames = /** @type {string[]} */([artist.tag_ru, artist.tag_jp])
        .filter(Boolean)
        .sort()
        .map((otherName) => noIndents/* HTML */`
            <li>
                <a href="${AP_SITE}/posts?page=0&search_tag=${encodeURIComponent(otherName)}"
                   target="_blank">
                    ${_.escape(otherName)}
                </a>
            </li>
        `)
        .join("");

    const nextBtnClass = postsCount <= ARTIST_POST_PREVIEW_LIMIT ? "disabled" : "";
    const $content = $(noIndents/* HTML */`
        <article class="container" part="container">
            ${GM_getResourceText("settings_icon")}
            <section class="header">
                <a class="artist-name tag-category-artist"
                   href="${AP_SITE}/posts?page=0&search_tag=${encodedName}"
                   target="_blank">
                    ${_.escape(artist.tag)}
                </a>
                <span class="post-count">${postsCount}</span>

                <ul class="other-names scrollable" part="other-names">
                    ${otherNames}
                </ul>
            </section>
            <section class="urls">
                <h2>
                    URLs
                    (<a href="${AP_SITE}/tags?search_text=${encodedName}" target="_blank">edit</a>)
                </h2>
                <div class="scrollable" part="url-list"></div>
            </section>
            <section class="posts">
                <h2>
                    Posts
                    <a href="${AP_SITE}/posts?page=0&search_tag=${encodedName}" target="_blank">
                        »
                    </a>
                </h2>
                <div class="post-pager"
                    data-tag="${encodedName}"
                    data-page="0"
                    data-last-page="${lastPage}"
                >
                    <div class="btn disabled">&lt;</div>
                    <div class="post-list scrollable" part="post-list"></div>
                    <div class="btn ${nextBtnClass}">&gt;</div>
                </div>
            </section>
        </article>
    `);
    $content.find(".urls > div").append(...buildApArtistUrls(artist));
    $content.find(".post-list")
        // prevent width change on posts pagination
        .css("width", `${Math.min(postsCount, ARTIST_POST_PREVIEW_LIMIT, 3) * 194 - 8}px`)
        .append(...posts.map(buildApPostPreview));
    $content.find(".settings-icon").click(showSettings);
    $content.find(".btn").click(loadNextApPage);
    return $content;
}

/**
 * Format artist urls
 * @param {APTag} artist The artist data
 */
function buildApArtistUrls (artist) {
    return artist.description_en.split(/\n|\r/).filter(Boolean).map((line) => {
        const regexp = /(?:\[url=)?(https?:\/\/[^\s\]]*[^\s"(),.;<>\]{}])(?:](.*?)\[\/url])?/gi;
        const item = $(`<div class="artist-url-active"></div>`);

        /** @type {RegExpExecArray|null} */
        let match;
        let start = 0;
        // eslint-disable-next-line no-cond-assign
        while (match = regexp.exec(line)) {
            // bare text
            item.append(line.slice(start, match.index));
            item.append(
                match[2]
                    ? noIndents`<a href="${match[1]}" target="_blank">${match[2]}</a>`
                    : noIndents`<a href="${match[1]}" target="_blank">${match[1]}</a>`,
            );
            start = regexp.lastIndex;
        }

        return item;
    });
}

/**
 * Load a neighbor page of posts
 * @param {JQuery.Event} ev Event of pressing the button
 */
async function loadNextApPage (ev) {
    const $btn = $(ev.target);
    const $container = $btn.parent();
    if ($container.is(".loading")) return;

    const tag = $container.data("tag");
    let page = +$container.data("page");
    const lastPage = +$container.data("lastPage");
    const dir = $btn.is(":first-child") ? -1 : +1;
    page += dir;
    if (page < 0 || page > lastPage) return;

    $container.find(".btn.disabled").removeClass("disabled");
    if (page === 1) $container.find(".btn:first-child").addClass("disabled");
    if (page === lastPage) $container.find(".btn:last-child").addClass("disabled");

    $container.data("page", page).addClass("loading");

    const { posts } = await makeRequest("GET", `${AP_API}/api/v3/posts`, {
        page,
        search_tag: tag,
        posts_per_page: ARTIST_POST_PREVIEW_LIMIT,
    });
    $container.removeClass("loading");
    $container.find(".post-list").empty().append(...posts.map(buildApPostPreview));
}

const AP_IMAGES = `https://opreviews.anime-pictures.net`;
/**
 * @param {ApPost} post
 * @param {"sp"|"cp"|"bp"} size
 */
function genPreviewUrlAvif (post, size) {
    const folder = post.md5.slice(0, 3);
    return `${AP_IMAGES}/${folder}/${post.md5}_${size}.avif`;
}

/**
 * Extract the post preview info
 * @param {ApPost} post The post data
 */
function getApPostPreview (post) {
    const scale = 180 / Math.max(post.width, post.height);

    const info = {
        url: genPreviewUrlAvif(post, "cp"),
        safeUrl: /** @type {Promise<string>|null} */(null),
        width: post.width * scale,
        height: post.height * scale,
    };

    if (DOMAIN_USES_CSP) {
        info.safeUrl = getImage(info.url);
        // transparent 1x1 image
        info.url = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    }
    return info;
}

/**
 * Build the post preview
 * @param {ApPost} post The post data
 */
function buildApPostPreview (post) {
    const erotic = ["no erotic", "light erotic", "erotic", "hard erotic"][post.erotics];
    const maxErotic = /** @type {number!} */({
        g: 0,
        s: 1,
        q: 2,
        e: 3, // eslint-disable-line id-blacklist
    }[SHOW_PREVIEW_RATING]);
    let previewClass = "post-preview";
    if (post.status === 0)           previewClass += " post-status-pending";
    if (post.status === 2)            previewClass += " post-status-banned";
    if (post.erotics > maxErotic) {
        previewClass += " blur-post";
    }

    const preview = getApPostPreview(post);

    const $preview = $(noIndents/* HTML */`
        <article itemscope
                 itemtype="http://schema.org/ImageObject"
                 class="${previewClass}" >
            <a class="post-link" href="${AP_SITE}/posts/${post.id}" target="_blank">
                <img width="${preview.width}"
                     height="${preview.height}"
                     src="${preview.url}"
                     referrerpolicy="origin">
            </a>
            <p>${formatBytes(post.size)} ${post.ext}, ${post.width}x${post.height}</p>
            <p><span class="erotic-${post.erotics}">${erotic}</span></p>
            <p>${timeToAgo(post.pubtime)}</p>
        </article>
    `);

    preview.safeUrl?.then((url) => {
        $preview.find("img").prop("src", url);
    });

    return $preview;
}

// OVERWRITES
// eslint-disable-next-line no-unused-vars
function initializeSauceNAO () {
    // http://saucenao.com/search.php?db=999&url=https%3A%2F%2Fraikou4.donmai.us%2Fpreview%2F5e%2F8e%2F5e8e7a03c49906aaad157de8aeb188e4.jpg
    // http://saucenao.com/search.php?db=999&url=https%3A%2F%2Fraikou4.donmai.us%2Fpreview%2Fad%2F90%2Fad90ad1cc3407f03955f22b427d21707.jpg
    // https://saucenao.com/search.php?db=999&url=http%3A%2F%2Fmedibangpaint.com%2Fwp-content%2Fuploads%2F2015%2F05%2Fgallerylist-04.jpg
    // https://saucenao.com/search.php?db=999&url=http%3A%2F%2Fpastyle.net%2FPLFG-0001_MelangelicTone%2Fimage%2Fartwork_MelangelicTone.jpg
    findAndTranslate("artist", "a", {
        predicate: [
            "strong:contains('Member:')+a",
            "strong:contains('Author:')+a",
            "strong:contains('Twitter:')+a",
            "strong:contains('User ID:')+a",
        ].join(","),
        classes: "inline",
        ruleName: "artist by link",
        asyncMode: true,
        toProfileUrl: (el) => {
            const a = /** @type {HTMLAnchorElement} */(el);
            if (!a.href.startsWith("https://twitter.com/")) return a.href;
            return [
                `https://twitter.com/${a.textContent?.slice(1)}`,
                `https://twitter.com/intent/user?user_id=${a.href.match(/\d+/)?.[0]}`,
            ];
        },
    });

    /**
     * Get text of the following text node
     * @param {HTMLElement} el
     */
    function getFollowingText (el) {
        const node = el.nextSibling;
        // if not a text node
        if (!node || node.nodeType !== 3) return null;
        return node.textContent?.trim() ? node.textContent.split(",") : null;
    }

    /**
     * @param {JQuery} $el
     */
    function cleanUpFollowingText ($el) {
        const node = $el[0].nextSibling;
        // if not a text node
        if (!node || node.nodeType !== 3) return;
        node.textContent = node.textContent
            ?.replace($el[0].textContent, "")
            .replace(/(, ){2,}/, ", ")
            .replace(/^, |, $/, "")
            ?? "";
    }

    findAndTranslate("artistByName", "strong", {
        predicate: ".resulttitle strong",
        tagPosition: TAG_POSITIONS.afterend,
        toTagName: getFollowingText,
        onadded: cleanUpFollowingText,
        asyncMode: true,
        classes: "inline comma",
        css: /* CSS */`
            .ex-artist-tag + .target {
                display: none;
            }
            .ex-artist-tag.comma::after {
              content: ", ";
            }
        `,
        ruleName: "artist by name",
    });

    findAndTranslate("tag", "strong", {
        predicate: ".resultcontentcolumn strong",
        tagPosition: TAG_POSITIONS.afterend,
        toTagName: getFollowingText,
        onadded: cleanUpFollowingText,
        asyncMode: true,
        classes: "no-brackets comma",
        css: /* CSS */`
            .ex-translated-tags {
                margin: 0;
            }
            .ex-translated-tags + .target {
                display: none;
            }
            .ex-translated-tags.comma::after {
              content: ", ";
            }
        `,
        ruleName: "tags strong",
    });

    findAndTranslate("tag", "br", {
        predicate: ".resultcontentcolumn br",
        tagPosition: TAG_POSITIONS.afterend,
        toTagName: getFollowingText,
        onadded: ($el) => $el[0].nextSibling?.remove(),
        asyncMode: true,
        classes: "no-brackets",
        css: /* CSS */`
            .ex-translated-tags {
                margin: 0;
            }
            .ex-translated-tags + .target {
                display: none;
            }
        `,
        ruleName: "tags br",
    });
}

GM_addStyle(PROGRAM_CSS2);

// special handling

async function initializeDanbooru () {
    if (window.location.pathname.startsWith("/posts/")) {
        $("#tag-list .artist-tag-list .search-tag").each(async (_, el) => {
            const [artist] = await findAnimePictureArtistByName(el.textContent);
            if (!artist) return;
            addAnimePictureArtist($(el), artist, null, { classes: "inline" });
            if (el.textContent === artist.tag) {
                el.nextElementSibling.firstElementChild.textContent = "";
            }
        });
    } else if (window.location.pathname === "/posts") {
        if (!$("#post-sections a[href^='/artists/']").length) return;
        const [el] = $("#excerpt > div > h6 + ul > :first-child > a:last-child");
        if (!el) return;
        const [artist] = await findAnimePictureArtistByUrl(el.href);
        if (!artist) return;
        addAnimePictureArtist($(el), artist, null, { classes: "inline" });
    } else if (window.location.pathname.startsWith("/artists/")) {
        const [el] = $("#c-artists > #a-show > div > h6 + ul > :first-child > a:last-child");
        if (!el) return;
        const [artist] = await findAnimePictureArtistByUrl(el.href);
        if (!artist) return;
        addAnimePictureArtist($(el), artist, null, { classes: "inline" });
    }
}

if (window.location.host.endsWith(".donmai.us")) {
    if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", initializeDanbooru);
    } else {
        initializeDanbooru();
    }
}
