import { api } from "../api.js";
import { icon } from "../icons.js";
import { ui, esc, field, pageHeader, toast } from "../ui.js";

const canPost = (role) => ["principal", "registrar", "teacher"].includes(role);
const MAX_PDF_BYTES = 10 * 1024 * 1024;

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

function generatedPdfUrl(notice) {
  return URL.createObjectURL(createPdf(notice));
}

export async function render({ mount, stale }) {
  const role = api.role();
  const page = mount(`<div id="notices-page"></div>`);
  let notices = await api.notices.list();
  if (stale()) return;

  const paint = () => {
    const orderedNotices = [...notices].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    page.innerHTML = `
      ${pageHeader("Notices", "School announcements for students, staff and families.", `<span class="${ui.btnGhost}">${orderedNotices.length} notices</span>`)}
      ${canPost(role) ? `<form id="notice-form" class="${ui.card} mb-5 grid gap-3 p-4 sm:grid-cols-2">
        ${field({ label: "Notice title", name: "title", required: true, placeholder: "Announcement title", span: "sm:col-span-2" })}
        ${field({ label: "Category", name: "category", required: true, placeholder: "Academics, Campus, Events..." })}
        ${field({ label: "Notice text", name: "body", type: "textarea", required: true, placeholder: "Write the full notice here.", span: "sm:col-span-2" })}
        ${role === "principal" ? `<div class="sm:col-span-2">
          <label for="notice-pdf" class="${ui.label}">Attach PDF (optional)</label>
          <input id="notice-pdf" name="pdf" type="file" accept=".pdf,application/pdf" class="${ui.input}">
          <p class="mt-1 text-xs text-slate-500">${api.mode === "live" ? "PDF only, up to 10 MB. Anyone can open it by clicking the notice text." : "PDF only, up to 10 MB. Demo uploads are stored in this browser; use live mode to share them."}</p>
        </div>` : ""}
        <div class="sm:col-span-2"><button type="submit" class="${ui.btnPrimary}">${icon("plus", 16)} Post notice</button></div>
      </form>` : ""}
      <section class="${ui.card} overflow-hidden">
        <div class="border-b border-slate-200 p-4 dark:border-slate-800"><h2 class="font-semibold">All notices</h2><p class="mt-1 text-sm text-slate-500">Click anywhere on a notice's text to open its PDF.</p></div>
        <div class="divide-y divide-slate-100 dark:divide-slate-800">${orderedNotices.length ? orderedNotices.map((notice) => `
          <article class="p-5">
            <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span class="rounded-full bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">${esc(notice.category)}</span><time datetime="${esc(notice.date)}">${esc(notice.date)}</time><span>Posted by ${esc(notice.author)}</span></div>
            <a href="${esc(notice.pdf_url || "#")}" ${notice.pdf_url ? "" : `data-open-generated="${notice.id}"`} target="_blank" rel="noopener noreferrer" aria-label="Open notice PDF: ${esc(notice.title)}" class="block cursor-pointer text-inherit no-underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
              <h3 class="mt-3 text-lg font-semibold text-slate-900 dark:text-white">${esc(notice.title)}</h3>
              <p class="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">${esc(notice.body)}</p>
            </a>
          </article>`).join("") : `<p class="p-6 text-sm text-slate-500">No notices have been posted yet.</p>`}</div>
      </section>`;
  };

  page.addEventListener("submit", async (event) => {
    if (event.target.id !== "notice-form") return;
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const title = data.get("title").trim();
    const category = data.get("category").trim();
    const body = data.get("body").trim();
    try {
      data.set("title", title);
      data.set("category", category);
      data.set("body", body);
      const pdf = data.get("pdf");
      if (pdf?.size > MAX_PDF_BYTES) {
        toast("PDF files must be 10 MB or smaller.", "error");
        return;
      }
      if (pdf?.size) {
        if (!pdf.name.toLowerCase().endsWith(".pdf") || await pdf.slice(0, 5).text() !== "%PDF-") {
          toast("Choose a valid PDF file.", "error");
          return;
        }
      } else {
        data.delete("pdf");
      }
      const notice = await api.notices.create(data);
      if (stale()) return;
      notices.push(notice);
      paint();
      toast("Notice posted.");
    } catch (error) {
      toast(error.message, "error");
    }
  });
  const prepareGeneratedPdfLink = (event) => {
    if (event.type === "keydown" && event.key !== "Enter") return;
    const link = event.target.closest("[data-open-generated]");
    if (!link) return;
    const notice = notices.find((item) => item.id === Number(link.dataset.openGenerated));
    if (!notice) return;
    const url = generatedPdfUrl(notice);
    link.href = url;
    setTimeout(() => {
      URL.revokeObjectURL(url);
      if (link.href === url) link.href = "#";
    }, 60000);
  };
  page.addEventListener("pointerdown", prepareGeneratedPdfLink);
  page.addEventListener("focusin", prepareGeneratedPdfLink);
  page.addEventListener("keydown", prepareGeneratedPdfLink);
  paint();
}
