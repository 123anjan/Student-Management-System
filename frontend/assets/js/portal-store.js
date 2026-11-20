const KEY = "edutrack_portal_data_v1";

const initial = {
  admissions: [
    { id: 1, name: "Riya Kapoor", email: "riya.kapoor@example.edu", program: "Computer Science", status: "Review" },
    { id: 2, name: "Arman Das", email: "arman.das@example.edu", program: "Mathematics", status: "Interview" },
    { id: 3, name: "Nina Joseph", email: "nina.joseph@example.edu", program: "Business", status: "Documents needed" },
  ],
  fees: [
    { id: 1, student: "Aarav Banerjee", roll: "STU-2026-001", term: "Term 1", amount: 24000, status: "Paid" },
    { id: 2, student: "Diya Patel", roll: "STU-2026-002", term: "Term 1", amount: 24000, status: "Due" },
    { id: 3, student: "Rohan Mehta", roll: "STU-2026-003", term: "Term 1", amount: 18000, status: "Overdue" },
    { id: 4, student: "Ananya Gupta", roll: "STU-2026-004", term: "Term 1", amount: 24000, status: "Paid" },
  ],
  books: [
    { id: 1, title: "Introduction to Algorithms", author: "Cormen et al.", code: "BOOK-001", total: 8, available: 5 },
    { id: 2, title: "Database System Concepts", author: "Silberschatz et al.", code: "BOOK-002", total: 6, available: 2 },
    { id: 3, title: "Discrete Mathematics", author: "Kenneth Rosen", code: "BOOK-003", total: 5, available: 5 },
    { id: 4, title: "Clean Code", author: "Robert C. Martin", code: "BOOK-004", total: 4, available: 1 },
  ],
  notices: [
    { id: 1, title: "Final examination timetable published", category: "Academics", date: "2026-11-20", author: "Registrar", body: "The final examination timetable for the December 2026 examination period is now available. Students should review their course schedules and contact the Registrar's Office promptly if they find a scheduling conflict." },
    { id: 2, title: "Library extended hours during examinations", category: "Library", date: "2026-11-18", author: "Librarian", body: "The library will remain open until 9:00 PM on weekdays from November 23 through December 18. Students are reminded to carry their campus identification cards." },
    { id: 3, title: "Campus maintenance notice", category: "Campus", date: "2026-11-16", author: "Principal", body: "Scheduled electrical maintenance will take place in the east academic building on November 25. Classes in that building will move to their listed alternate rooms." },
  ],
};

function read() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || "null");
    return stored ? { ...initial, ...stored } : structuredClone(initial);
  } catch {
    return structuredClone(initial);
  }
}

function write(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export const portalStore = {
  list(key) {
    return read()[key];
  },
  add(key, row) {
    const data = read();
    const rows = data[key];
    const id = Math.max(0, ...rows.map((item) => item.id)) + 1;
    rows.unshift({ id, ...row });
    write(data);
    return rows[0];
  },
  update(key, id, patch) {
    const data = read();
    const row = data[key].find((item) => item.id === Number(id));
    if (!row) throw new Error("Record not found.");
    Object.assign(row, patch);
    write(data);
    return row;
  },
};
