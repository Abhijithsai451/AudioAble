import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Upload, Play, Pause, SkipForward, SkipBack, Volume2, BookOpen, Loader2, CheckCircle2, Menu, X, Trash2 } from 'lucide-react';

const API_BASE = "http://localhost:8000";

export default function Home() {
  const [view, setView] = useState<'home' | 'reader'>('home');
  const [library, setLibrary] = useState<{file_id: string, name: string, status: string}[]>([]);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<string[]>([]);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<{ progress: number; total: number; status: string; extension?: string } | null>(null);
  const [hasText, setHasText] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchLibrary = async () => {
    try {
      const response = await axios.get(`${API_BASE}/library`);
      setLibrary(response.data);
    } catch (e) {
      console.error("Error fetching library", e);
    }
  };

  useEffect(() => {
    fetchLibrary();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (fileId) {
      interval = setInterval(async () => {
        try {
          const response = await axios.get(`${API_BASE}/status/${fileId}`);
          setProcessingStatus(response.data);
          if (response.data.chunks) {
            setChunks(response.data.chunks);
            setHasText(true);
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 1500);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [fileId]);

  const handleFileUpload = async () => {
    if (!file) return;
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_BASE}/upload`, formData);
      setFileId(response.data.file_id);
      setCurrentChunk(0);
      setView('reader');
      setProcessingStatus({ progress: 0, total: response.data.total_chunks, status: 'processing' });
    } catch (error) {
      alert("Error uploading file");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteBook = async (id: string) => {
    if (!confirm("Are you sure you want to delete this book?")) return;
    try {
      await axios.delete(`${API_BASE}/delete/${id}`);
      await fetchLibrary();
      if (fileId === id) {
        setFileId(null);
        setView('home');
      }
    } catch (e) {
      alert("Error deleting book");
    }
  };

  const selectBook = async (id: string, name: string) => {
    setFileId(id);
    setCurrentChunk(0);
    setView('reader');
    setIsLibraryOpen(false);
    try {
      const response = await axios.get(`${API_BASE}/status/${id}`);
      setProcessingStatus(response.data);
      if (response.data.chunks) {
        setChunks(response.data.chunks);
        setHasText(true);
      }
    } catch (e) {
      console.error("Error loading book", e);
    }
  };

  const playCurrentChunk = async () => {
    if (!fileId) return;
    const audioUrl = `${API_BASE}/generate-chunk/${fileId}/${currentChunk}`;
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play().catch(e => console.log("Playback failed", e));
    }
  };

  useEffect(() => {
    if (isPlaying && fileId) {
      playCurrentChunk();
    }
  }, [isPlaying, currentChunk]);

  const handleAudioEnd = () => {
    if (currentChunk < chunks.length - 1) {
      setCurrentChunk(prev => prev + 1);
    } else {
      setIsPlaying(false);
    }
  };

  const renderHome = () => (
    <div className="bg-white p-16 rounded-3xl shadow-2xl w-full max-w-xl flex flex-col items-center gap-8 border border-stone-200 transition-all hover:shadow-amber-100">
      <div className="text-center mb-4">
        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Upload size={40} className="text-amber-700" />
        </div>
        <p className="text-stone-600 text-xl">Upload your ebook to begin</p>
      </div>

      <div className="w-full flex flex-col items-center gap-4">
        <div className="relative w-full max-w-sm">
          <input
            type="file"
            className="hidden"
            id="file-upload"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            accept=".pdf,.epub,.mobi,.azw3"
          />
          <label
            htmlFor="file-upload"
            className="flex items-center justify-between gap-3 px-8 py-4 bg-stone-100 text-stone-800 rounded-full cursor-pointer hover:bg-stone-200 transition border border-stone-300 font-medium"
          >
            <span className="truncate">{file ? file.name : "Select Book File"}</span>
            {file && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setFile(null); }}
                className="p-1 hover:bg-stone-300 rounded-full transition ml-2"
              >
                <X size={16} />
              </button>
            )}
          </label>
        </div>

        <button
          onClick={handleFileUpload}
          disabled={!file || isLoading}
          className="w-full max-w-sm py-4 bg-amber-700 text-white rounded-full disabled:bg-stone-300 font-bold text-lg hover:bg-amber-800 transition-all transform hover:scale-105 shadow-lg"
        >
          {isLoading ? "Reading File..." : "Begin Conversion"}
        </button>
      </div>
    </div>
  );

  const renderReader = () => {
    if (!hasText) {
      return (
        <div className="bg-white p-16 rounded-3xl shadow-xl w-full max-w-lg flex flex-col items-center gap-8 border border-stone-200">
          <div className="relative">
            <Loader2 className="animate-spin text-amber-700" size={64} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-amber-900">...</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-stone-800 mb-2">Preparing your book...</p>
            <p className="text-stone-500 italic">Extracting text and mapping pages</p>
          </div>
          <div className="w-full bg-stone-100 rounded-full h-3 overflow-hidden border border-stone-200">
            <div className="bg-amber-700 h-full w-1/3 animate-pulse" />
          </div>
          <p className="text-stone-600 font-medium">Just a moment...</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col lg:flex-row gap-8 w-full max-w-6xl h-[80vh] animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* PDF Preview Section */}
        <div className="flex-1 bg-stone-200 rounded-2xl overflow-hidden shadow-inner border border-stone-300 relative flex flex-col">
          {processingStatus?.extension === 'pdf' ? (
            <>
              <iframe
                src={`${API_BASE}/uploads/${fileId}.pdf#toolbar=0`}
                className="w-full h-full border-none"
                title="PDF Preview"
              />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-stone-800/80 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-medium flex items-center gap-4 shadow-xl">
                <span className="opacity-70">Scroll to read</span>
                <div className="w-px h-3 bg-white/20" />
                <span>PDF Mode Active</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-stone-500 p-8 text-center">
              <BookOpen size={48} className="mb-4 opacity-20" />
              <p className="font-medium">Preview unavailable for this file type</p>
              <p className="text-sm opacity-60">PDFs are supported for visual preview</p>
            </div>
          )}
        </div>

        {/* Audio Control Section */}
        <div className="w-full lg:w-96 bg-white rounded-2xl shadow-xl border-l-[12px] border-stone-800 p-6 md:p-8 flex flex-col justify-between transition-all border-r border-stone-200">
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-2 text-amber-700 font-bold tracking-widest uppercase text-[10px] md:text-xs">
              {processingStatus?.status === 'completed' ? (
                <><CheckCircle2 size={14} /> Ready for Listening</>
              ) : (
                <><Loader2 size={14} className="animate-spin" /> Processing Audio</>
              )}
            </div>

            <div className="text-center w-full">
              <div className="text-stone-400 italic text-xs mb-4">Page {currentChunk + 1} of {chunks.length}</div>
              <p className="text-lg md:text-xl font-medium text-stone-800 leading-relaxed transition-opacity duration-500 px-2">
                {chunks[currentChunk]}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between px-2">
              <button
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentChunk(prev => Math.max(0, prev - 1));
                }}
                disabled={currentChunk === 0}
                className="p-3 rounded-full text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition disabled:opacity-20 transform hover:scale-110"
              >
                <SkipBack size={24} />
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-6 rounded-full bg-stone-800 text-white hover:bg-stone-700 shadow-lg transition transform hover:scale-110 active:scale-95"
              >
                {isPlaying ? <Pause size={32} /> : <Play size={32} />}
              </button>

              <button
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentChunk(prev => Math.min(chunks.length - 1, prev + 1));
                }}
                disabled={currentChunk === chunks.length - 1}
                className="p-3 rounded-full text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition disabled:opacity-20 transform hover:scale-110"
              >
                <SkipForward size={24} />
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 text-stone-400 text-[10px] md:text-xs italic">
              <Volume2 size={12} />
              <span>Hifi Audio Engine • Localized Processing</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#fdfcf8] p-8 flex flex-col items-center font-serif relative overflow-hidden">
      <nav className="w-full max-w-5xl flex justify-start items-start mb-16">
        <div className="flex flex-col items-start gap-4 relative">
          <div
            className="flex items-center gap-3 cursor-pointer hover:text-amber-700 transition"
            onClick={() => setView('home')}
          >
            <BookOpen size={32} className="text-amber-700" />
            <span className="text-2xl font-bold text-stone-800">AudioAble</span>
          </div>
          <div className="relative">
            <button
              onClick={() => { setIsLibraryOpen(!isLibraryOpen); if (!isLibraryOpen) fetchLibrary(); }}
              className="p-2 bg-white rounded-lg shadow-sm border border-stone-200 hover:bg-stone-50 transition flex items-center gap-2 px-3 text-stone-600 text-sm font-medium"
            >
              <Menu size={18} />
              <span className="flex items-center gap-1">
                Library {isLibraryOpen && <X size={14} />}
              </span>
            </button>

            {isLibraryOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-stone-200 py-2 z-50 transition-all animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-2 border-b border-stone-100 mb-2">
                  <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Your Collection</h2>
                </div>
                <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                  {library.length === 0 ? (
                    <p className="text-stone-500 italic text-xs p-3 text-center">No books uploaded yet.</p>
                  ) : (
                    library.map(book => (
                      <div key={book.file_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-stone-100 transition group">
                        <button
                          onClick={() => selectBook(book.file_id, book.name)}
                          className="flex-1 text-left text-sm border border-transparent hover:border-stone-200 transition"
                        >
                          <div className="font-medium text-stone-800 group-hover:text-amber-700 truncate">{book.name}</div>
                          <div className="text-[10px] text-stone-400 uppercase tracking-tighter">{book.status}</div>
                        </button>
                        <button
                          onClick={() => deleteBook(book.file_id)}
                          className="p-2 text-stone-400 hover:text-red-600 transition opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {view === 'home' ? renderHome() : renderReader()}
    </div>
  );
}
