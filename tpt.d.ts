type Rating = "g"|"s"|"q"|"e";
type Single<T extends object|object[]> = T extends object[] ? T[number] : T;

type RequestName = "wiki"|"artist"|"tag"|"alias"|"url"|"post"|"count";

type RequestDefinition<Resp extends object> = {
    url: string,
    fields: string,
    params: (requests: string[]) => UrlParams,
    matches: (response: Single<Resp>, request: string) => boolean,
    filter?: (responses: Resp) => Resp,
    limit?: number,
}
type ResponseWiki = {
    title: string,
    other_names: string[],
    tag: { category: number },
}
type ResponseArtist = {
    id: number,
    name: string,
    is_banned: boolean,
    other_names: string[],
    urls: Array<{ url: string, is_active: boolean }>,
}
type ResponseTag = {
    name: string,
    post_count: number,
    category: number,
}
type ResponseTagAlias = {
    antecedent_name: string,
    consequent_tag: { name: string, category: number, post_count: number },
}
type ResponseUrl = ResponseArtist & { is_deleted: boolean };
type MediaAssetVariant = {
    type: string,
    url: string,
    width: number,
    height: number,
    file_ext: string,
}
type MediaAsset = {
    id: number,
    file_ext: string,
    file_size: number,
    duration: number|null,
    image_width: number,
    image_height: number,
    variants: MediaAssetVariant[],
}
type ResponsePosts = {
    id: number,
    created_at: string,
    source: string,
    rating: Rating,
    parent_id: number|null,
    is_pending: boolean,
    is_flagged: boolean,
    is_deleted: boolean,
    is_banned: boolean,
    has_visible_children: boolean,
    tag_string_general: string,
    tag_string_character: string,
    tag_string_copyright: string,
    tag_string_artist: string,
    tag_string_meta: string,
    media_asset: MediaAsset,
}
type ResponseCount = { counts: { posts: number} };
type ResponseEntity<N> = N extends "wiki" ? ResponseWiki :
    N extends "artist" ? ResponseArtist :
    N extends "tag" ? ResponseTag :
    N extends "alias" ? ResponseTagAlias :
    N extends "url" ? ResponseUrl :
    N extends "post" ? ResponsePosts :
    N extends "count" ? ResponseCount :
    never;
type DBResponse<N> = N extends "count" ? ResponseCount : ResponseEntity<N>[];

type TranslatedArtist = ResponseArtist & {
    prettyName: string,
    escapedName: string,
    encodedName: string,
}


type TagPosition = {
    insertTag: ($container: JQuery, $elem: JQuery) => void,
    findTag: ($container: JQuery) => JQuery,
    getTagContainer: ($elem: JQuery) => JQuery,
}


declare global {
    type Setting = { name: string, defValue: any, descr: string, type: string, values: Record<string,string> };
    type UrlParams = { [k: string]: string|number|boolean|string[]|UrlParams};
    type ResponseArtist = {
        id: number,
        name: string,
        is_banned: boolean,
        other_names: string[],
        urls: Array<{ url: string, is_active: boolean }>,
    }
    type TranslatedTag = {
        name:string,
        prettyName:string,
        category:number,
    }
    type TooltipInstance = {tooltip: HTMLElement, content: HTMLElement, target: HTMLElement};
    type TranslationOptions = {
        mode: "tag" | "artist" | "artistByName",
        ruleName: string,
        asyncMode?: boolean,
        requiredAttributes?: string|null,
        predicate?: string | ((el:HTMLElement) => boolean) | null,
        toProfileUrl?: (el:HTMLElement) => string | string[] | null,
        toTagName?: (el:HTMLElement) => string | string[] | null,
        tagPosition?: TagPosition,
        classes?: string,
        css?: string,
        onadded?: (($el:JQuery, options: Required<TranslationOptions>) => void) | null,
    }
    type TranslationOptionsFull = Required<TranslationOptions>;
    type ApPost = {
        id: number;
        md5: string;
        md5_pixels: string;
        width: number;
        height: number;
        pubtime: string; // YMDHMSw.d format,
        datetime: string; // YMDHMSw.d format,
        score: number; // deprecated?
        score_number: number; // star number
        size: number; // file size
        download_count: number;
        erotics: 0 | 1 | 2 | 3; // no erotic, light erotic, [medium] erotic, hard erotic
        color: [number, number, number]; // average color, RGB format
        ext: ".jpg" | ".jpeg" | ".png" | ".gif";
        status: 0 | -2 | 1 | 2; // new|pre|published|banned
        status_type: number;
        redirect_id: number | null;
        spoiler: boolean; // presense of the spoiler tag
        have_alpha: boolean; // presence the alpha channel
        tags_count: number;
    }

    const SETTINGS_SCHEMA: Setting[];
    const MAX_NETWORK_RETRIES: number;
    const DISPLAY_NETWORK_ERRORS: boolean;
    const BOORU: string;
    const DEBUG: boolean;
    const ARTIST_POST_PREVIEW_LIMIT: number;
    const SHOW_PREVIEW_RATING: number;
    const DOMAIN_USES_CSP: boolean;
    const TAG_POSITIONS: Record<string, TagPosition>;
    const ARTIST_TOOLTIP_CSS: string;

    var debuglog: (...args: any[]) => void;
    var memoizeKey: (...args: any[]) => string;
    /**
     * Tag function for template literals to remove newlines and leading spaces
     */
    var noIndents: (strings: TemplateStringsArray, ...values: (string|number)[]) => string
    /**
     * For safe ways to use regexp in a single line of code
     * @param string
     * @param regex
     * @param group default - 0
     * @param defaultValue default - ""
     */
    var safeMatchMemoized: (string: string, regex: RegExp, group?: number, defaultValue?: string) => string;
    /**
     * Get a resource url
     * TM always returns the resource as base64 while other script managers use blob by default.
     * Although blob is more efficient, it is affected by CORS.
     * @param name The `@resource` name
     * @param asBase64 Force base64 format - default false
     */
    var getResourceUrl: (name:string, asBase64?: boolean) => string;
    /**
     * Checks whether the number of failed requests to the domain reached the limit
     * @param domain The domain to check
     * @param logError Increase the number of errors - default false
     */
    var tooManyNetworkErrors: (domain: string, logError?: boolean) => boolean;
    /**
     * Converts URLs to the same format used by the URL column on Danbooru
     * @param profileUrl
     * @param depth default - 0
     */
    var normalizeProfileURL: (profileUrl: string, depth?: number) => string;
    /**
     * @param type - type of query
     * @param query - the query itself
     */
    var queueNetworkRequestMemoized: <T>(type: T, query: string) => Promise<DBResponse<T>>;
    /**
     * Attach the artist's translation to the target element
     * @param $target The target element to attach the translation
     * @param rawArtist The artist data
     * @param options Translation options
     */
    var addDanbooruArtist: ($target: JQuery, rawArtist: ResponseArtist, options: TranslationOptionsFull) => void;
    var renderedTagsCache: Record<string, JQuery>;
    var addTooltip: (target: HTMLElement, contentProvider: (tip: TooltipInstance) => void) => void;
    /**
     * Get a color similar to the background under the element and theme type
     * @param $element The target element
     */
    var chooseBackgroundColorScheme:  ($element: JQuery) => { theme:"dark"|"light", adjustedColor:string};
    /**
     * Fills the artist tooltip with a content
     * @param artist The artist data
     * @param tip The tooltip instance
     */
    var buildArtistTooltip: (artist: TranslatedArtist, tip: TooltipInstance) => void;
    /**
     * Get the image as blob-link in CORS-safe way
     * @param imageUrl
     */
    var getImage: (imageUrl: string) => Promise<string>
    /**
     * Universal method to add a content as Shadow DOM
     * @param $target Container for the Shadow DOM
     * @param $content The Shadow DOM content
     * @param css The Shadow DOM CSS
     */
    var attachShadow: ($target: JQuery, $content: JQuery, css: string) => void;
    /**
     * Open the setting window
     */
    var showSettings: () => void;
    /**
     * Format time in relative form
     * @param time Timestamp
     */
    var timeToAgo: (time: number|string) => string;
    /**
     * Format file size in CI units
     * @param bytes file size in bytes
     * @see https://stackoverflow.com/questions/15900485
     */
    var formatBytes: (bytes: number) => string
    /**
     * Add translations to the matched elements
     * @param mode Method of translating the element
     * @param selector Simple selector of the translated element.
     *  Max example: `div.class#id[attr][attr2=val], *[attr3~="part"][attr4='val']`
     * @param options Extra options for translating
     */
    var findAndTranslate: <T extends TranslationOptions["mode"]>(
        mode: T,
        selector: string|HTMLElement,
        options: T extends "artist" ? Omit<TranslationOptions, "mode"|"toTagName"> : Omit<TranslationOptions, "mode"|"toProfileUrl">
    ) => void;

    var $messageContainer: JQuery;
    var renderedArtistsCache: Record<string, JQuery>;
}
export {}