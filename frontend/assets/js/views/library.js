import { icon } from "../icons.js";
import { ui, esc, field, pageHeader, toast } from "../ui.js";
import { portalStore } from "../portal-store.js";

export async function render({ el, mount }) {
  const page = mount(`<div id="library-page"></div>`);
  const paint = () => {
    const books = portalStore.list("books");
    page.innerHTML = `
      ${pageHeader("Library", "Manage the catalogue and track available copies.", `<span class="${ui.btnGhost}">${books.reduce((sum, book) => sum + book.available, 0)} copies available</span>`)}
      <form id="book-form" class="${ui.card} mb-5 grid gap-3 p-4 sm:grid-cols-4 sm:items-end">
        ${field({ label: "Book title", name: "title", required: true, placeholder: "Book title" })}
        ${field({ label: "Author", name: "author", required: true, placeholder: "Author" })}
        ${field({ label: "Catalogue code", name: "code", required: true, placeholder: "BOOK-005" })}
        <button type="submit" class="${ui.btnPrimary}">${icon("plus", 16)} Add book</button>
      </form>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">${books.map((book) => `
        <article class="${ui.card} flex flex-col p-5">
          <div class="flex items-start justify-between"><span class="rounded-lg bg-indigo-50 px-2.5 py-1 font-mono text-xs font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">${esc(book.code)}</span>${icon("book", 20)}</div>
          <h2 class="mt-4 font-semibold">${esc(book.title)}</h2><p class="mt-1 text-sm text-slate-500">${esc(book.author)}</p>
          <div class="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800"><span class="text-sm">${book.available} of ${book.total} available</span>
            <div class="flex gap-2"><button type="button" class="${ui.btnGhost} !px-3 !py-1.5" data-copy="${book.id}" data-mode="checkout" ${book.available ? "" : "disabled"}>Check out</button><button type="button" class="${ui.btnGhost} !px-3 !py-1.5" data-copy="${book.id}" data-mode="return" ${book.available < book.total ? "" : "disabled"}>Return</button></div></div>
        </article>`).join("")}</div>`;
  };
  page.addEventListener("submit", (event) => {
    if (event.target.id !== "book-form") return;
    event.preventDefault();
    const data = new FormData(event.target);
    portalStore.add("books", { title: data.get("title").trim(), author: data.get("author").trim(), code: data.get("code").trim().toUpperCase(), total: 1, available: 1 });
    paint();
    toast("Book added to the catalogue.");
  });
  page.addEventListener("click", (event) => {
    const button = event.target.closest("[data-copy]");
    if (!button) return;
    const book = portalStore.list("books").find((item) => item.id === Number(button.dataset.copy));
    const checkout = button.dataset.mode === "checkout";
    if (checkout && !book.available) return;
    portalStore.update("books", book.id, { available: book.available + (checkout ? -1 : 1) });
    paint();
    toast(checkout ? "Copy checked out." : "Copy returned.");
  });
  paint();
}
