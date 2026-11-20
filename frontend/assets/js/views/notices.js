import { api } from "../api.js";
import { icon } from "../icons.js";
import { ui, esc, field, pageHeader, toast } from "../ui.js";
import { portalStore } from "../portal-store.js";

const canPost = (role) => ["principal", "registrar", "teacher"].includes(role);

function pdfText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/[\\()]/g, "\\$&");
}

function wrapText(value, width = 84) {
  const words = String(value ?? "").split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (line && `${line} ${word}`.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function createPdf(notice) {
  const lines = [
    ...wrapText(notice.title, 58),
    "",
    `Category: ${notice.category}`,
    `Published: ${notice.date}`,
    `Posted by: ${notice.author}`,
    "",
    ...wrapText(notice.body),
  ];
  const text = [
    "BT",
    "/F1 18 Tf",
    "50 740 Td",
    `(${pdfText(lines[0] || "Notice")}) Tj`,
    "/F1 11 Tf",
    ...lines.slice(1).map((line) => `0 -18 Td (${pdfText(line)}) Tj`),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function downloadNotice(notice) {
  const url = URL.createObjectURL(createPdf(notice));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${notice.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "notice"}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function render({ mount }) {
  const role = api.role();
  const page = mount(`<div id="notices-page"></div>`);
  const paint = () => {
    const notices = [...portalStore.list("notices")].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    page.innerHTML = `
      ${pageHeader("Notices", "School announcements for students, staff and families.", `<span class="${ui.btnGhost}">${notices.length} notices</span>`)}
      ${canPost(role) ? `<form id="notice-form" class="${ui.card} mb-5 grid gap-3 p-4 sm:grid-cols-2">
        ${field({ label: "Notice title", name: "title", required: true, placeholder: "Announcement title", span: "sm:col-span-2" })}
        ${field({ label: "Category", name: "category", required: true, placeholder: "Academics, Campus, Events..." })}
        ${field({ label: "Notice text", name: "body", type: "textarea", required: true, placeholder: "Write the full notice here.", span: "sm:col-span-2" })}
        <div class="sm:col-span-2"><button type="submit" class="${ui.btnPrimary}">${icon("plus", 16)} Post notice</button></div>
      </form>` : ""}
      <section class="${ui.card} overflow-hidden">
        <div class="border-b border-slate-200 p-4 dark:border-slate-800"><h2 class="font-semibold">All notices</h2><p class="mt-1 text-sm text-slate-500">Select a notice title to download its PDF.</p></div>
        <div class="divide-y divide-slate-100 dark:divide-slate-800">${notices.length ? notices.map((notice) => `
          <article class="p-5">
            <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span class="rounded-full bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">${esc(notice.category)}</span><time datetime="${esc(notice.date)}">${esc(notice.date)}</time><span>Posted by ${esc(notice.author)}</span></div>
            <h3 class="mt-3 text-lg font-semibold"><a href="#" data-download="${notice.id}" aria-label="Download notice PDF: ${esc(notice.title)}" class="text-indigo-700 underline decoration-indigo-300 underline-offset-4 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-200">${esc(notice.title)}</a></h3>
            <p class="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">${esc(notice.body)}</p>
          </article>`).join("") : `<p class="p-6 text-sm text-slate-500">No notices have been posted yet.</p>`}</div>
      </section>`;
  };

  page.addEventListener("submit", (event) => {
    if (event.target.id !== "notice-form") return;
    event.preventDefault();
    const data = new FormData(event.target);
    portalStore.add("notices", {
      title: data.get("title").trim(),
      category: data.get("category").trim(),
      body: data.get("body").trim(),
      date: new Date().toISOString().slice(0, 10),
      author: api.auth.username(),
    });
    paint();
    toast("Notice posted.");
  });
  page.addEventListener("click", (event) => {
    const link = event.target.closest("[data-download]");
    if (!link) return;
    event.preventDefault();
    const notice = portalStore.list("notices").find((item) => item.id === Number(link.dataset.download));
    if (notice) downloadNotice(notice);
  });
  paint();
}
