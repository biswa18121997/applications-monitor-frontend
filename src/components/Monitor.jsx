

import React, { useMemo, useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_BASE;

// ---------------- API ----------------
async function fetchAllJobs() {
  const res = await fetch(`${API_BASE}/getalljobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({"name": "John Doe"}),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return Array.isArray(data.jobDB) ? data.jobDB : [];
}

// ---------------- Helpers ----------------
function parseFlexibleDate(input) {
  if (!input) return null;

  // Try dd/mm/yyyy format first
  const m = String(input).trim().match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i
  );

  if (m) {
    let [, d, mo, y, h = "0", mi = "0", s = "0", ap] = m;
    d = +d; mo = +mo - 1; y = +y; h = +h; mi = +mi; s = +s;
    if (ap) {
      const isPM = ap.toLowerCase() === "pm";
      if (h === 12) h = isPM ? 12 : 0;
      else if (isPM) h += 12;
    }
    return new Date(y, mo, d, h, mi, s);
  }

  // If input is already a Date or ISO string
  const native = new Date(input);
  return isNaN(native.getTime()) ? null : native;
}
// function parseFlexibleDate(input) {
//   if (!input) return null;
//   const dt = new Date(input);
//   return isNaN(dt.getTime()) ? null : dt;
// }


function formatDate(dt) {
  if (!dt) return "—";
  return dt.toLocaleDateString("en-GB"); // forces dd/mm/yyyy
}

function formatDateTime(dt) {
  if (!dt) return "—";
  return dt.toLocaleString("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
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
  const da = parseFlexibleDate(a.updatedAt );
  const db = parseFlexibleDate(b.updatedAt );
  const ta = da ? da.getTime() : 0;
  const tb = db ? db.getTime() : 0;
  return tb - ta;
}

function safeDate(job) {
  return parseFlexibleDate(job.updatedAt || job.dateAdded);
}

// Status counters: { applied: 10, interviewing: 4, rejected: 2, ... }
function getStatusCounts(jobs = []) {
  const counts = {};
  for (const j of jobs) {
    const s = String(j.currentStatus || "").toLowerCase() || "unknown";
    counts[s] = (counts[s] || 0) + 1;
  }
  return counts;
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

function StatusBar({ counts = {}, dateAppliedCount = 0, filterDate }) {
  const commonOrder = ["applied", "interviewing", "rejected", "offer", "hired", "on-hold"];
  const keys = [
    ...commonOrder.filter((k) => counts[k]),
    ...Object.keys(counts)
      .filter((k) => !commonOrder.includes(k))
      .sort(),
  ];

  const statusColors = {
    applied: "bg-blue-100 text-blue-700 border-blue-300",
    interviewing: "bg-yellow-100 text-yellow-700 border-yellow-300",
    rejected: "bg-red-100 text-red-700 border-red-300",
    offer: "bg-green-100 text-green-700 border-green-300",
    hired: "bg-purple-100 text-purple-700 border-purple-300",
    "on-hold": "bg-gray-100 text-gray-700 border-gray-300",
  };

  return (
    <div className="sticky top-0 z-20 mb-4  rounded-lg border border-slate-300 bg-white shadow-md px-4 py-3 flex flex-col">
      <h1 className="mb-2 pb-1.5 text-lg underline font-semibold text-slate-900 ">Status Overview</h1><hr />
      <div className="flex flex-col items-baseline gap-3 w-1/3">
        {keys.length === 0 ? (
          <span className="text-sm text-slate-500 ">No jobs for this client.</span>
        ) : (
          keys.map((k) => (
            <span
              key={k}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold border ${statusColors[k] || "bg-slate-100 text-slate-700 border-slate-300"}`}
              title={k}
            >
              <span className="capitalize">{k}</span>
              <span className="rounded bg-white px-2 text-xs font-bold shadow">{counts[k]}</span>
            </span>
          ))
        )}
<hr />
        <div className="ml-auto flex items-center gap-2 text-sm font-semibold text-slate-800 border-t-2 pt-2 pl-2 border-r-2 p-2">
          <span>Applied on:</span>
          <span className="rounded-full bg-blue-50 border border-blue-300 px-3 py-1 text-blue-700 font-extrabold">
            {filterDate ? dateAppliedCount : 0}
          </span>
          {filterDate ? (
            <span className="ml-2 text-slate-600 font-normal">({filterDate})</span>
          ) : (
            <span className="ml-2 text-slate-400">(pick a date)</span>
          )}
        </div>
      </div>
    </div>
  );
}


function JobCard({ job }) {
  const dt = safeDate(job);
  const when = formatDateTime(dt);
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
  const dt = safeDate(job);
  const when = formatDate(dt);
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
  const [filterDate, setFilterDate] = useState(() => {
  const today = new Date();
  return today.toISOString().split("T")[0]; // "yyyy-mm-dd"
}); // yyyy-mm-dd

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

  const clientJobs = useMemo(() => {
    if (!selectedClient) return [];
    return jobs.filter((j) => j.userID === selectedClient);
  }, [jobs, selectedClient]);

  const statusCounts = useMemo(() => getStatusCounts(clientJobs), [clientJobs]);

  // Applied jobs for selected client (used in both middle & right)
  const appliedJobs = useMemo(() => {
    return clientJobs.filter(isAppliedNow).sort(sortByUpdatedDesc);
  }, [clientJobs]);

  // Middle column: date-filtered applied jobs (for the selected date)
  const dateFilteredJobs = useMemo(() => {
    if (!filterDate) return [];
    const target = new Date(filterDate);
    return appliedJobs.filter((job) => {
      const dt = safeDate(job);
      return dt && sameDay(dt, target);
    });
  }, [appliedJobs, filterDate]);

  const dateAppliedCount = dateFilteredJobs.length;

  return (
    <div className="flex min-h-[500px] rounded-xl border border-slate-200 bg-white">
      {/* Left: Clients */}
      <ClientList
        clients={clients}
        selected={selectedClient}
        onSelect={setSelectedClient}
      />
      <div>
        <StatusBar
              counts={statusCounts}
              dateAppliedCount={dateAppliedCount}
              filterDate={filterDate}
            />
        <RightAppliedColumn jobs={appliedJobs} />
      </div>
      

      {/* Middle: Status bar + date filter + results */}
      <div className="flex-1 overflow-auto border-r border-slate-200 p-4">
        {loading && <div className="text-slate-700">Loading…</div>}
        {!loading && err && <div className="text-red-600">Error: {err}</div>}

        {!loading && !err && selectedClient && (
          <>
            {/* Slim status bar */}
            

            {/* Title + date filter */}
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">
                Jobs for <span className="font-bold">{selectedClient}</span>
              </h2>
              <div className="ml-auto flex items-center gap-2">
                <label className="text-sm text-slate-700">Filter date:</label>
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
            {/* <StatusBar
              counts={statusCounts}
              dateAppliedCount={dateAppliedCount}
              filterDate={filterDate}
            /> */}

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
      {/* <RightAppliedColumn jobs={appliedJobs} /> */}
    </div>
  );
}
