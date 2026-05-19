"use client";

import { useEffect, useState, useRef } from "react";
import { getUserRecordings, deleteRecording } from "@/lib/recording";

type Recording = {
  id: string;
  user_id: string;
  storage_path: string;
  duration: number;
  created_at: string;
  url: string | null;
};

function DeleteConfirmModal({ recording, onConfirm, onCancel }: { recording: Recording; onConfirm: (r: Recording) => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="rounded-2xl border border-white/10 bg-[#0a0118]/95 backdrop-blur-xl px-8 py-6 shadow-2xl max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white text-lg font-semibold mb-2">Delete recording?</h3>
        <p className="text-white/50 text-sm mb-6">This will permanently remove this recording. This action cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-xl bg-white/5 hover:bg-white/10 px-5 py-2.5 text-white/60 text-sm font-medium transition-colors">Cancel</button>
          <button onClick={() => onConfirm(recording)} className="rounded-xl bg-rose-500/20 hover:bg-rose-500/30 px-5 py-2.5 text-rose-300 text-sm font-medium transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
}

function RecordingViewer({ recording, onClose, onDelete }: { recording: Recording; onClose: () => void; onDelete: (r: Recording) => void }) {
  const handleDownload = async () => {
    if (!recording.url) return;
    const a = document.createElement("a");
    a.href = recording.url;
    a.download = `recording-${recording.created_at.slice(0, 10)}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {recording.url ? (
          <video src={recording.url} controls autoPlay className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl" />
        ) : (
          <p className="text-white/50">Video unavailable</p>
        )}
        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 px-5 py-2.5 text-white text-sm font-medium transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Download
          </button>
          <button
            onClick={() => { onClose(); onDelete(recording); }}
            className="flex items-center gap-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 px-5 py-2.5 text-rose-300 text-sm font-medium transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 px-5 py-2.5 text-white/60 text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordingThumbnail({ recording, onClick, onDelete }: { recording: Recording; onClick: (r: Recording) => void; onDelete: (r: Recording) => void }) {
  return (
    <div className="relative w-30 h-30 rounded-2xl border border-white/8 bg-[#0a0118]/70 backdrop-blur-xl overflow-hidden group cursor-pointer flex-shrink-0" onClick={() => onClick(recording)}>
      {recording.url ? (
        <video
          src={recording.url}
          className="w-full h-full object-cover"
          preload="metadata"
          muted
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8 text-white/20">
            <circle cx="12" cy="12" r="10" />
            <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
          </svg>
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-10 h-10 text-white/80">
          <polygon points="8,5 19,12 8,19" fill="currentColor" stroke="none" />
        </svg>
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
        <p className="text-[10px] text-white/70 font-medium">{new Date(recording.created_at).toLocaleDateString()}</p>
        <p className="text-[9px] text-white/40">{Math.round(recording.duration)}s</p>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(recording); }}
        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/40 text-white/40 hover:text-rose-400 hover:bg-black/60 transition-colors opacity-0 group-hover:opacity-100 text-[10px]"
      >
        ✕
      </button>
    </div>
  );
}

export function RecordingsPanel({ userId }: { userId: string }) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Recording | null>(null);
  const [deleting, setDeleting] = useState<Recording | null>(null);

  const fetchRecordings = async () => {
    setLoading(true);
    const data = await getUserRecordings(userId);
    setRecordings(data as Recording[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchRecordings();
  }, [userId]);

  const handleDelete = (r: Recording) => setDeleting(r);

  const confirmDelete = async (r: Recording) => {
    await deleteRecording(r.id, r.storage_path);
    setRecordings((prev) => prev.filter((rec) => rec.id !== r.id));
    setDeleting(null);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/8 bg-[#0a0118]/70 backdrop-blur-xl p-5 flex-1 min-h-0">
        <h2 className="text-white font-semibold text-lg mb-4">Recordings</h2>
        <p className="text-white/30 text-sm italic">Loading...</p>
      </div>
    );
  }

  return (
    <>
      {deleting && (
        <DeleteConfirmModal
          recording={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
      {viewing && (
        <RecordingViewer
          recording={viewing}
          onClose={() => setViewing(null)}
          onDelete={handleDelete}
        />
      )}
      <div className="rounded-2xl border border-white/8 bg-[#0a0118]/70 backdrop-blur-xl p-5 flex flex-col flex-1 min-h-0">
        <h2 className="text-white font-semibold text-lg mb-4 shrink-0">Recordings</h2>
        {recordings.length === 0 ? (
          <p className="text-white/30 text-sm italic">No recordings yet. Press the record button while playing to capture your session.</p>
        ) : (
          <div className="flex flex-wrap gap-3 overflow-y-auto pr-1 -mr-1 min-h-0">
            {recordings.map((r) => (
              <RecordingThumbnail key={r.id} recording={r} onClick={setViewing} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
