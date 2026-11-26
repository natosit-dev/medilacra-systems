const sections = {
    blog: "Blog",
    disco: "DiScO",
    medilacra: "Medilacra",
    experiments: "Experiments",
    data: "Data",
    "other-tools": "Other Tools",
    writing: "Writing"
};

const content = document.getElementById("content");
const navigation = document.getElementById("navigation");
const params = new URLSearchParams(window.location.search);

function element(tag, text, parent) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (parent) parent.append(node);
    return node;
}

function link(text, href, parent) {
    const node = element("a", text, parent);
    node.href = href;
    return node;
}

function renderNavigation() {
    for (const [id, label] of Object.entries(sections)) {
        link(label, `?section=${id}`, navigation);
    }
}

function renderCatalog(catalog, section) {
    content.replaceChildren();

    const heading = section
        ? sections[section]
        : "All material";

    element("h2", heading, content);

    const entries = catalog
        .filter(item =>
            !section || item.sections.includes(section))
        .sort((a, b) =>
            (b.date || "").localeCompare(a.date || ""));

    if (!entries.length) {
        element("p", "Nothing in this pile yet.", content);
        return;
    }

    const list = element("ul", "", content);

    for (const item of entries) {
        const row = element("li", "", list);

        link(
            item.title,
            `?doc=${encodeURIComponent(item.id)}`,
            row
        );

        const metadata = element(
            "div",
            [item.date, item.type].filter(Boolean).join(" · "),
            row
        );

        metadata.className = "metadata";
    }
}

async function renderDocument(item) {
    content.replaceChildren();
    document.title = `${item.title} | Medilacra Systems`;

    const path = item.path.split("/")
        .map(encodeURIComponent).join("/");

    const rawUrl =
        `https://raw.githubusercontent.com/` +
        `${item.repo}/${item.branch}/${path}`;

    const sourceUrl =
        `https://github.com/${item.repo}/blob/` +
        `${item.branch}/${path}`;

    const article = element(
        "article", "Loading document...", content
    );

    element("hr", "", content);
    link("View original on GitHub", sourceUrl, content);

    try {
        const { default: MarkdownIt } =
            await import("./vendor/markdown-it.mjs");

        const renderer = new MarkdownIt({
            html: false,
            typographer: false
        });

        const response = await fetch(rawUrl);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const markdown = await response.text();

        const template = document.createElement("template");
        template.innerHTML = renderer.render(markdown);

        // Resolve relative links against the original repository.
        for (const node of template.content.querySelectorAll("a[href]")) {
            const href = node.getAttribute("href");

            if (!href.startsWith("#")) {
                node.href = new URL(href, sourceUrl).href;
            }
        }

        // Retrieve relative images from the source repository.
        for (const node of template.content.querySelectorAll("img[src]")) {
            node.src = new URL(
                node.getAttribute("src"), rawUrl
            ).href;
        }

        article.replaceChildren(template.content);

    } catch (error) {
        article.textContent =
            `Unable to load document: ${error.message}`;
    }
}

async function init() {
    renderNavigation();

    try {
        const response = await fetch("./catalog.json");

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const catalog = await response.json();

        const docId = params.get("doc");
        const section = params.get("section");

        if (docId) {
            const item = catalog.find(entry => entry.id === docId);

            if (!item) {
                throw new Error("Document not found.");
            }

            await renderDocument(item);

        } else {
            if (section && !Object.hasOwn(sections, section)) {
                throw new Error("Section not found.");
            }

            renderCatalog(catalog, section);
        }

    } catch (error) {
        content.textContent = error.message;
    }
}

init();
