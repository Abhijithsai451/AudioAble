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
  const [processingStatus, setProcessingStatus] = useState<{ progress: number; total: number; status: string } | null>(null);
  const [hasText, setHasText] = useState(false);
  const [theme, setTheme] = useState<'light' | 'sepia' | 'dark'>('light');
  const [playbackRate, setPlaybackRate] = useState(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleFileUpload = async (selectedFile?: File) => {
    const fileToUpload = selectedFile || file;
    if (!fileToUpload) return;
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', fileToUpload);

    try {
      const response = await axios.post(`${API_BASE}/upload`, formData);
      setFileId(response.data.file_id);
      setCurrentChunk(0);
      setView('reader');
      setProcessingStatus({ progress: 0, total: response.data.total_chunks, status: 'processing' });
      await fetchLibrary();
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
        setHasText(false);
      }
    } catch (e) {
      alert("Error deleting book");
    }
  };

  const selectBook = async (id: string, name: string) => {
    setFileId(id);
    setCurrentChunk(0);
    setView('reader');
    try {
      const response = await axios.get(`${API_BASE}/status/${id}`);
      setProcessingStatus(response.data);
      if (response.data.chunks) {
        setChunks(response.data.chunks);
        setHasText(true);
      } else {
        setHasText(false);
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
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().catch(e => console.log("Playback failed", e));
    }
  };

  useEffect(() => {
    if (isPlaying && fileId) {
      playCurrentChunk();
    }
  }, [isPlaying, currentChunk, playbackRate]);

  const handleAudioEnd = () => {
    if (currentChunk < chunks.length - 1) {
      setCurrentChunk(prev => prev + 1);
    } else {
      setIsPlaying(false);
    }
  };

  const themeStyles = {
    light: {
      bg: 'bg-[#FAF9F6]',
      readerBg: 'bg-[#fffefc]',
      text: 'text-slate-800',
      border: 'border-slate-200',
      accent: 'text-indigo-600'
    },
    sepia: {
      bg: 'bg-[#f4ecd8]',
      readerBg: 'bg-[#fdf6e3]',
      text: 'text-sepia-900',
      border: 'border-sepia-200',
      accent: 'text-amber-700'
    },
    dark: {
      bg: 'bg-slate-950',
      readerBg: 'bg-slate-900',
      text: 'text-slate-100',
      border: 'border-slate-800',
      accent: 'text-indigo-400'
    }
  };

  const currentTheme = themeStyles[theme];

  const renderHome = () => (
    <div className="bg-white/80 backdrop-blur-sm p-16 rounded-[3rem] shadow-2xl w-full max-w-xl flex flex-col items-center gap-8 border border-indigo-100 transition-all hover:shadow-indigo-100/50">
      <div className="text-center mb-4">
        <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-indigo-50/50">
          <Upload size={48} className="text-indigo-600 animate-bounce" />
        </div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Your Audio Library</h1>
        <p className="text-slate-500 text-lg">Upload an ebook to transform it into a personal audiobook</p>
      </div>
      <div className="w-full flex flex-col items-center gap-6">
        <div className="relative w-full max-w-sm">
          <label
            htmlFor="file-upload"
            className="flex items-center justify-between gap-3 px-8 py-5 bg-slate-50 text-slate-700 rounded-2xl cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-300 border-2 border-dashed border-slate-200 hover:border-indigo-300 font-medium group"
          >
            <span className="truncate flex items-center gap-2">
              <Upload size={18} className="text-slate-400 group-hover:text-indigo-500" />
              {file ? file.name : "Select Book File"}
            </span>
            {file && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setFile(null); }}
                className="p-1 bg-white rounded-full shadow-sm hover:bg-red-50 hover:text-red-500 transition-all ml-2"
              >
                <X size={16} />
              </button>
            )}
          </label>
        </div>

        <button
          onClick={() => handleFileUpload()}
          disabled={!file || isLoading}
          className="w-full max-w-sm py-5 bg-gradient-to-r from-indigo-600 to-violet-500 text-white rounded-2xl disabled:from-slate-300 disabled:to-slate-400 font-bold text-xl hover:from-indigo-500 hover:to-violet-400 transition-all transform hover:scale-105 shadow-lg shadow-indigo-200"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={24} /> Processing...
            </span>
          ) : "Begin Conversion"}
        </button>
      </div>
    </div>
  );

  const renderReader = () => {
    if (!hasText) {
      return (
        <div className="bg-white p-16 rounded-[3rem] shadow-xl w-full max-w-lg flex flex-col items-center gap-8 border border-indigo-100">
          <div className="relative">
            <Loader2 className="animate-spin text-indigo-600" size={64} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-indigo-900">...</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-slate-800 mb-2">Preparing your book...</p>
            <p className="text-slate-500 italic">Extracting text and mapping pages</p>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
            <div className="bg-indigo-600 h-full w-1/3 animate-pulse" />
          </div>
          <p className="text-slate-600 font-medium">Just a moment...</p>
        </div>
      );
    }

    const progress = (currentChunk + 1) / chunks.length * 100;

    return (
      <div className={`relative w-full max-w-4xl ${currentTheme.readerBg} rounded-r-3xl rounded-l-sm shadow-2xl border-l-[16px] border-slate-800 h-[85vh] flex flex-col transition-all duration-500 overflow-hidden ring-1 ${currentTheme.border}`}>
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1 z-10 bg-slate-100">
          <div
            className="h-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header Section - Compact */}
        <div className={`flex flex-col items-center justify-center gap-2 py-4 px-6 border-b ${currentTheme.border} bg-gradient-to-b from-white/20 to-transparent shrink-0`}>
          <div className={`flex items-center gap-2 font-bold tracking-widest uppercase text-[9px] md:text-xs px-3 py-1 rounded-full ${
            processingStatus?.status === 'completed'
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-amber-50 text-amber-600'
          }`}>
            {processingStatus?.status === 'completed' ? (
              <><CheckCircle2 size={12} /> Ready for Listening</>
            ) : (
              <><Loader2 size={12} className="animate-spin" /> Processing Audio in Background</>
            )}
          </div>
          <div className={`text-slate-400 font-medium italic text-[10px] ${theme === 'dark' ? 'text-slate-500' : ''}`}>Page {currentChunk + 1} of {chunks.length}</div>
        </div>

        {/* Content & Controls Section */}
        <div className="flex-1 flex flex-col justify-between relative overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 md:p-12 text-center">
            <p key={currentChunk} className={`text-base md:text-xl font-serif leading-relaxed transition-all duration-500 animate-in fade-in slide-in-from-bottom-2 px-4 py-2 ${currentTheme.text}`}>
              {chunks[currentChunk]}
            </p>
          </div>

          <div className={`flex items-center justify-between p-4 md:p-6 border-t ${currentTheme.border} bg-white/30 backdrop-blur-sm shrink-0`}>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentChunk(prev => Math.max(0, prev - 1));
                }}
                disabled={currentChunk === 0}
                className={`p-2 md:p-3 rounded-full transition-all disabled:opacity-20 transform hover:scale-110 ${theme === 'dark' ? 'text-slate-500 hover:text-indigo-400 hover:bg-slate-800' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
              >
                <SkipBack size={20} className="md:w-6 md:h-6" />
              </button>

              <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/50 border border-slate-200 text-[10px] font-bold text-slate-500">
                <span className="uppercase">Speed:</span>
                <select
                  value={playbackRate}
                  onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                  className="bg-transparent outline-none cursor-pointer hover:text-indigo-600"
                >
                  <option value="1">1x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`p-5 rounded-full text-white shadow-xl transition-all transform hover:scale-110 active:scale-95 ring-4 ${theme === 'dark' ? 'bg-slate-800 hover:bg-indigo-900 ring-slate-700' : 'bg-slate-900 hover:bg-indigo-700 ring-slate-100'}`}
            >
              {isPlaying ? <Pause size={32} className="md:w-10 md:h-10" /> : <Play size={32} className="md:w-10 md:h-10" />}
            </button>

            <button
              onClick={() => {
                setIsPlaying(false);
                setCurrentChunk(prev => Math.min(chunks.length - 1, prev + 1));
              }}
              disabled={currentChunk === chunks.length - 1}
              className={`p-2 md:p-3 rounded-full transition-all disabled:opacity-20 transform hover:scale-110 ${theme === 'dark' ? 'text-slate-500 hover:text-indigo-400 hover:bg-slate-800' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
            >
              <SkipForward size={20} className="md:w-6 md:h-6" />
            </button>
          </div>

          <div className={`py-3 flex items-center justify-center gap-2 text-slate-400 text-[9px] md:text-xs italic bg-white/40 shrink-0 ${theme === 'dark' ? 'text-slate-500' : ''}`}>
            <Volume2 size={12} />
            <span className="text-xs font-medium">Hifi Audio Engine • Localized Processing</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen w-full ${currentTheme.bg} font-sans relative overflow-hidden flex flex-col transition-colors duration-500 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
      {/* Background decorative blobs */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl" />
      <div className="absolute top-1/2 -right-24 w-80 h-80 bg-teal-200/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 left-1/3 w-96 h-96 bg-violet-200/30 rounded-full blur-3xl" />

      <nav className="w-full p-8 flex justify-start items-start z-20">
        <div className="flex flex-col items-start gap-4 relative">
          <div
            className="flex items-center gap-3 cursor-pointer group transition-all"
            onClick={() => setView('home')}
          >
            <div className="bg-teal-600 p-2 rounded-xl shadow-lg group-hover:bg-teal-500 transition-colors">
              <BookOpen size={28} className="text-white" />
            </div>
            <span className={`text-2xl font-extrabold tracking-tight transition-colors ${theme === 'dark' ? 'text-slate-100 group-hover:text-teal-400' : 'text-slate-800 group-hover:text-teal-600'}`}>AudioAble</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => { setIsLibraryOpen(!isLibraryOpen); if (!isLibraryOpen) fetchLibrary(); }}
                className={`p-2 rounded-xl shadow-sm border transition-all flex items-center gap-2 px-4 text-sm font-semibold ${
                  theme === 'dark'
                    ? 'bg-slate-900 border-slate-800 text-slate-400 hover:border-indigo-500 hover:bg-slate-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                }`}
              >
                <Menu size={18} className={theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} />
                <span>Library {isLibraryOpen && <X size={14} className="inline ml-1 text-red-400" />}</span>
              </button>

              {isLibraryOpen && (
                <div className={`absolute top-full left-0 mt-3 w-80 rounded-3xl shadow-2xl border py-5 z-50 animate-in fade-in slide-in-from-top-4 flex flex-col backdrop-blur-md ${
                  theme === 'dark'
                    ? 'bg-slate-900/90 border-slate-800'
                    : 'bg-white/90 border-slate-200'
                }`}>
                  <div className={`px-6 py-3 border-b mb-4 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                    <h2 className={`text-xs font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Your Collection</h2>
                  </div>
                  <div className="max-h-96 overflow-y-auto px-3 space-y-2 flex-1">
                    {library.length === 0 ? (
                      <p className={`italic text-xs p-6 text-center ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>No books uploaded yet.</p>
                    ) : (
                      library.map(book => (
                        <div key={book.file_id} className={`flex items-center justify-between p-3 rounded-2xl transition-all group border ${
                          theme === 'dark'
                            ? 'hover:bg-slate-800 border-transparent hover:border-slate-700'
                            : 'hover:bg-indigo-50 border-transparent hover:border-indigo-100'
                        }`}>
                          <button
                            onClick={() => {
                              selectBook(book.file_id, book.name);
                              setIsLibraryOpen(false);
                            }}
                            className="flex-1 text-left truncate pr-2"
                          >
                            <div className={`font-semibold truncate text-sm ${theme === 'dark' ? 'text-slate-300 group-hover:text-indigo-400' : 'text-slate-700 group-hover:text-indigo-700'}`}>{book.name}</div>
                            <div className={`text-[10px] font-bold uppercase tracking-tighter ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{book.status}</div>
                          </button>
                          <button
                            onClick={() => deleteBook(book.file_id)}
                            className="p-2 text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="px-4 pt-5 flex justify-end">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-3 bg-violet-600 text-white rounded-full shadow-lg hover:bg-violet-500 transition-all transform hover:scale-110"
                      title="Upload New Book"
                    >
                      <Upload size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <div className={`flex items-center gap-1 ml-4 p-1 rounded-full border transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-200/50 border-slate-200'}`}>
              {(['light', 'sepia', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    theme === t
                      ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white scale-105'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex items-start justify-center px-8 py-4 overflow-hidden">
        {view === 'home' ? renderHome() : renderReader()}
      </main>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const selectedFile = e.target.files?.[0];
          if (selectedFile) {
            setFile(selectedFile);
            handleFileUpload(selectedFile);
          }
        }}
        accept=".pdf,.epub,.mobi,.azw3"
      />
    </div>
  );
}
