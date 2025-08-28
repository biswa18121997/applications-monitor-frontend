import React, { useMemo, useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_BASE;

// ---------------- API ----------------
async function fetchAllJobs() {
  const res = await fetch(`${API_BASE}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return Array.isArray(data.jobDB) ? data.jobDB : [];
}

// ---------------- Helpers ----------------
function parseFlexibleDate(input) {
  if (!input) return null;
  const native = new Date(input);
  if (!isNaN(native.getTime())) return native;
  const m = String(input).trim().match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i
  );
  if (m) {
    let [, d, mo, y, h, mi, s = "0", ap] = m;
    d = +d; mo = +mo - 1; y = +y; h = +h; mi = +mi; s = +s;
    if (ap) {
      const isPM = ap.toLowerCase() === "pm";
      if (h === 12) h = isPM ? 12 : 0;
      else if (isPM) h += 12;
    }
    return new Date(y, mo, d, h, mi, s);
  }
  return null;
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getLastTimelineStatus(timeline = []) {
  if (!timeline.length) return null;
  const last = timeline[timeline.length - 1];
  if (typeof last === "string") return last.toLowerCase();
  if (last && typeof last === "object" && last.status)
    return String(last.status).toLowerCase();
  return null;
}

function isAppliedNow(job) {
  const current = String(job.currentStatus || "").toLowerCase();
  const last = getLastTimelineStatus(job.timeline);
  return current === "applied" && last === "applied";
}

function sortByUpdatedDesc(a, b) {
  const da = parseFlexibleDate(a.updatedAt || a.dateAdded);
  const db = parseFlexibleDate(b.updatedAt || b.dateAdded);
  const ta = da ? da.getTime() : 0;
  const tb = db ? db.getTime() : 0;
  return tb - ta;
}

// ---------------- UI ----------------
function ClientList({ clients = [], selected, onSelect }) {
  return (
    <div className="w-64 border-r border-slate-200 p-3">
      <h3 className="mb-2 text-base font-semibold text-slate-800">Clients</h3>
      <div className="flex flex-col gap-2">
        {clients.map((c) => (
          <button
            key={c}
            onClick={() => onSelect(c)}
            className={`w-full truncate rounded-lg border px-3 py-2 text-left transition ${
              selected === c
                ? "border-slate-300 bg-slate-100 font-semibold"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
            title={c}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

function JobCard({ job }) {
  const dt = parseFlexibleDate(job.updatedAt || job.dateAdded);
  const when = dt ? dt.toLocaleString() : "—";
  const [open, setOpen] = useState(false);

  return (
    <div
      onClick={() => setOpen((o) => !o)}
      className="cursor-pointer rounded-xl border border-slate-200 p-3 hover:bg-slate-50"
    >
      <div className="font-semibold">{job.jobTitle || "Untitled Role"}</div>
      <div className="mt-0.5 text-sm text-slate-600">
        {job.companyName || "Company"} • Updated: {when}
      </div>
      {open && (
        <div className="mt-2 text-sm text-slate-700">
          {typeof job.jobDescription === "string"
            ? job.jobDescription
            : JSON.stringify(job.jobDescription)}
        </div>
      )}
    </div>
  );
}

function CompactRow({ job }) {
  const dt = parseFlexibleDate(job.updatedAt || job.dateAdded);
  const when = dt ? dt.toLocaleDateString() : "—";
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <div className="truncate text-sm font-semibold">
        {job.jobTitle || "Untitled Role"}
      </div>
      <div className="truncate text-xs text-slate-600">
        {(job.companyName || "Company") + " • " + when}
      </div>
    </div>
  );
}

function RightAppliedColumn({ jobs = [] }) {
  const sorted = useMemo(() => [...jobs].sort(sortByUpdatedDesc), [jobs]);
  return (
    <div className="w-64 border-l border-slate-200 p-3">
      <h3 className="mb-2 text-base font-semibold text-slate-800">
        Applied <span className="text-slate-500">({sorted.length})</span>
      </h3>
      <div className="flex max-h-[calc(100vh-10rem)] flex-col gap-2 overflow-y-auto">
        {sorted.map((j) => (
          <CompactRow key={j._id || j.jobID || `${j.userID}-${j.joblink}`} job={j} />
        ))}
      </div>
    </div>
  );
}

// ---------------- Main Component ----------------
export default function Monitor() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [filterDate, setFilterDate] = useState(""); // yyyy-mm-dd

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await fetchAllJobs();
        setJobs(data);
      } catch (e) {
        setErr(e.message || "Failed to fetch");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Left column: clients
  const clients = useMemo(() => {
    const set = new Set();
    jobs.forEach((j) => j.userID && set.add(j.userID));
    return [...set];
  }, [jobs]);

  useEffect(() => {
    if (!selectedClient && clients.length) setSelectedClient(clients[0]);
  }, [clients, selectedClient]);

  // Applied jobs for selected client (used in both middle & right)
  const appliedJobs = useMemo(() => {
    if (!selectedClient) return [];
    return jobs
      .filter((j) => j.userID === selectedClient && isAppliedNow(j))
      .sort(sortByUpdatedDesc);
  }, [jobs, selectedClient]);

  // Middle column: date-filtered applied jobs
  const dateFilteredJobs = useMemo(() => {
    if (!filterDate) return [];
    const target = new Date(filterDate);
    return appliedJobs.filter((job) => {
      const dt = parseFlexibleDate(job.updatedAt || job.dateAdded);
      return dt && sameDay(dt, target);
    });
  }, [appliedJobs, filterDate]);

  return (
    <div className="flex min-h-[500px] rounded-xl border border-slate-200 bg-white">
      {/* Left: Clients */}
      <ClientList
        clients={clients}
        selected={selectedClient}
        onSelect={setSelectedClient}
      />

      {/* Middle: Date Filter + Matching Applied Jobs */}
      <div className="flex-1 overflow-auto border-r border-slate-200 p-4">
        {loading && <div className="text-slate-700">Loading…</div>}
        {!loading && err && <div className="text-red-600">Error: {err}</div>}

        {!loading && !err && selectedClient && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">
                Jobs for <span className="font-bold">{selectedClient}</span>
              </h2>
              <div className="ml-auto flex items-center gap-2">
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                />
                {filterDate && (
                  <button
                    onClick={() => setFilterDate("")}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {!filterDate && (
              <div className="text-slate-600">
                Pick a date to see jobs applied on that day.
              </div>
            )}

            {filterDate && dateFilteredJobs.length === 0 && (
              <div className="text-slate-600">
                No applied jobs for the selected date.
              </div>
            )}

            {filterDate && dateFilteredJobs.length > 0 && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {dateFilteredJobs.map((job) => (
                  <JobCard key={job._id || job.jobID || `${job.userID}-${job.joblink}`} job={job} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Right: ALL Applied for this client */}
      <RightAppliedColumn jobs={appliedJobs} />
    </div>
  );
}
