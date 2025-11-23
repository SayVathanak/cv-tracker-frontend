import { useState, useEffect } from 'react'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { Document, Page, pdfjs } from 'react-pdf';
import { motion, AnimatePresence } from 'framer-motion'; 
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { 
  FaRobot, FaCloudUploadAlt, FaTrash, FaEdit, FaSave, FaFileExcel, 
  FaSearch, FaPhoneAlt, FaMapMarkerAlt, FaBirthdayCake, 
  FaCopy, FaCheck, FaArrowLeft, FaFilePdf,
  FaSearchMinus, FaSearchPlus, FaEye, FaChevronDown, FaRedo // <--- Added FaRedo
} from 'react-icons/fa'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function App() {
  // --- STATE ---
  const [file, setFile] = useState(null) 
  const [files, setFiles] = useState([]) 
  const [previewUrl, setPreviewUrl] = useState(null)
  const [fileType, setFileType] = useState("")
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")
  
  const [expandedId, setExpandedId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [editingCandidate, setEditingCandidate] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortOption, setSortOption] = useState("newest")
  const [zoom, setZoom] = useState(1.0)
  
  // Mobile UI
  const [showMobilePreview, setShowMobilePreview] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState(null)

  // ⚠️ REPLACE WITH YOUR IP
  // const API_URL = 'http://192.168.100.54:8000'; 
  // The URL from your Render Dashboard
const API_URL = 'https://cv-tracker-api.onrender.com';

  useEffect(() => { fetchCandidates() }, [])

  // --- LOGIC ---
  const fetchCandidates = async () => {
    try {
      const res = await axios.get(`${API_URL}/candidates`)
      setCandidates(res.data)
    } catch (error) { console.error(error) }
  }

  const getMostFrequent = (arr, key) => {
    if (!arr.length) return "N/A";
    const counts = {};
    arr.forEach(person => {
      const value = (person[key] || "Unknown").trim().replace(/[.,]/g, ''); 
      if(value.length > 3) counts[value] = (counts[value] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : "N/A";
  }

  const stats = {
    total: candidates.length,
    topLocation: getMostFrequent(candidates, "Location"),
    topSchool: getMostFrequent(candidates, "School")
  };

  const processedCandidates = candidates
    .filter(person => {
      const term = searchTerm.toLowerCase();
      return (
        person.Name.toLowerCase().includes(term) ||
        person.Tel.toLowerCase().includes(term) ||
        person.School.toLowerCase().includes(term) ||
        person.Location.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      if (sortOption === "nameAsc") return a.Name.localeCompare(b.Name);
      if (sortOption === "nameDesc") return b.Name.localeCompare(a.Name);
      if (sortOption === "schoolAsc") return a.School.localeCompare(b.School);
      return 0; 
    });

  const handleFileChange = (e) => {
    const selectedFiles = e.target.files;
    if (selectedFiles.length > 0) {
      setFiles(selectedFiles);
      setFile(selectedFiles[0]); 
    }
  }

  const handleClearFiles = () => {
    setFiles([]); setFile(null);
    document.getElementById('fileInput').value = "";
  }

  const handleUpload = async () => {
    if (files.length === 0) return alert("Select files first")
    setLoading(true); setStatus(`Processing...`)
    const formData = new FormData()
    for (let i = 0; i < files.length; i++) formData.append('files', files[i]);
    try {
      const res = await axios.post(`${API_URL}/upload-cv`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setStatus(`Done. ${res.data.details.length} scanned.`)
      fetchCandidates()
      handleClearFiles() 
    } catch (error) { setStatus("Upload failed.") } 
    finally { setLoading(false); setTimeout(() => setStatus(""), 3000) }
  }

  const handleCardClick = (person) => {
    toggleExpand(person._id);
    setSelectedPerson(person);
    if (window.innerWidth >= 1024) {
       loadPdfIntoView(person);
    }
  }

  const handleOpenPdfMobile = (e, person) => {
    e.stopPropagation();
    setSelectedPerson(person);
    loadPdfIntoView(person);
    setShowMobilePreview(true);
  }

  const loadPdfIntoView = (person) => {
    const fileUrl = `${API_URL}/static/${person.file_name}`;
    const isPdf = person.file_name.toLowerCase().endsWith(".pdf");
    setFileType(isPdf ? "application/pdf" : "image/jpeg");
    setPreviewUrl(fileUrl);
    setZoom(1.0);
  }

  const handleDelete = async (id, name, e) => {
    e.stopPropagation(); 
    if(!window.confirm(`Delete ${name}?`)) return;
    try { 
      await axios.delete(`${API_URL}/candidates/${id}`); 
      fetchCandidates();
      if(showMobilePreview) setShowMobilePreview(false);
      if(editingCandidate && editingCandidate._id === id) setEditingCandidate(null);
    } 
    catch (error) { alert("Failed to delete") }
  }

  const handleExport = () => {
    const data = processedCandidates.map(c => ({ Name: c.Name, Phone: c.Tel, Birth: c.Birth, Location: c.Location, School: c.School, Experience: c.Experience }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Candidates");
    XLSX.writeFile(wb, "CV_Database.xlsx");
  }

  const startEditing = (person, e) => { 
    e.stopPropagation(); 
    setEditingCandidate({ ...person });
    loadPdfIntoView(person);
  }

  const handleEditChange = (e) => setEditingCandidate({ ...editingCandidate, [e.target.name]: e.target.value })
  
  const saveEdit = async () => {
    try {
      await axios.put(`${API_URL}/candidates/${editingCandidate._id}`, editingCandidate)
      setEditingCandidate(null); 
      fetchCandidates();
    } catch (error) { alert("Failed to save") }
  }

  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id)

  const handleCopy = (person, e) => {
    if(e) e.stopPropagation();
    if(!person) return;
    const text = `Name: ${person.Name}\nDOB: ${person.Birth}\nPhone: ${person.Tel}\nAddress: ${person.Location}\nEducation: ${person.School}\nExperience: ${person.Experience}`.trim();
    navigator.clipboard.writeText(text)
    setCopiedId(person._id); setTimeout(() => setCopiedId(null), 2000)
  }

  // --- RENDER ---
  return (
    <div className="flex flex-col h-screen bg-white text-black font-sans selection:bg-black selection:text-white overflow-hidden">
      
      {/* NAVBAR */}
      <nav className="flex-none border-b-2 border-zinc-100 px-6 h-16 flex items-center justify-between z-20 bg-white">
        <div className="flex items-center gap-2">
          <div className="bg-black text-white p-2 rounded cursor-pointer">
            <FaRobot size={18} />
          </div>
          <span className="font-bold text-xl tracking-tight">CV<span className="text-zinc-400">TRACKER</span></span>
        </div>
        <div className="flex items-center gap-4">
             <button onClick={handleExport} className="hidden sm:flex items-center gap-2 px-4 py-2 border border-zinc-200 rounded font-bold text-xs hover:bg-black hover:text-white transition uppercase">
                <FaFileExcel /> Export
             </button>
             <div className="text-xs font-bold text-black border border-zinc-200 px-3 py-1.5 rounded flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> ONLINE
             </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex overflow-hidden max-w-[1920px] mx-auto w-full relative">
        
        {/* --- LEFT PANEL: LIST --- */}
        <div className={`flex flex-col w-full lg:w-[500px] xl:w-[550px] border-r border-zinc-200 h-full transition-all duration-300 z-10 bg-white
          ${showMobilePreview ? 'hidden lg:flex' : 'flex'}
        `}>
          
          {/* STATS */}
          <div className="flex-none p-6 border-b border-zinc-100 grid grid-cols-3 gap-4">
            <StatItem label="Candidates" val={stats.total} />
            <StatItem label="Top Region" val={stats.topLocation} />
            <StatItem label="Top School" val={stats.topSchool} />
          </div>

          {/* CONTROLS */}
          <div className="flex-none p-6 space-y-4 border-b border-zinc-100">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input id="fileInput" type="file" multiple onChange={handleFileChange} className="hidden" />
                <label htmlFor="fileInput" className="w-full h-10 flex justify-center items-center gap-2 bg-zinc-100 border border-transparent hover:border-black rounded text-xs font-bold uppercase cursor-pointer transition">
                  {files.length > 0 ? <><FaCheck /> {files.length} Files</> : <><FaCloudUploadAlt /> Select PDFs</>}
                </label>
              </div>
              {files.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={handleUpload} disabled={loading} className="px-6 bg-black text-white rounded text-xs font-bold uppercase hover:bg-zinc-800 transition">{loading ? "..." : "Upload"}</button>
                  <button onClick={handleClearFiles} className="px-4 bg-zinc-100 hover:bg-red-500 hover:text-white rounded text-zinc-500 transition"><FaTrash /></button>
                </div>
              )}
            </div>
            
            <div className="relative">
              <FaSearch className="absolute left-3 top-3 text-zinc-400" size={12} />
              <input 
                type="text" 
                placeholder="Search..." 
                className="w-full pl-9 pr-24 h-10 bg-white border border-zinc-200 rounded text-sm font-medium focus:ring-1 focus:ring-black focus:border-black outline-none transition"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select 
                className="absolute right-1 top-1 bottom-1 px-2 bg-transparent text-xs font-bold text-zinc-500 outline-none cursor-pointer hover:text-black"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
              >
                <option value="newest">Newest</option>
                <option value="nameAsc">A-Z</option>
              </select>
            </div>
          </div>

          {/* LIST ITEMS */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24 scroll-smooth">
            {processedCandidates.map((person) => (
              <div 
                key={person._id} 
                onClick={() => handleCardClick(person)}
                className={`group p-5 rounded border cursor-pointer overflow-hidden transition-all duration-200
                  ${expandedId === person._id ? 'bg-zinc-50 border-black ring-1 ring-black' : 'bg-white border-zinc-200 hover:border-zinc-400'}
                `}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 flex items-center justify-center text-sm font-bold border transition-colors
                      ${expandedId === person._id ? 'bg-black text-white border-black' : 'bg-white text-black border-zinc-200'}`}>
                      {person.Name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-black uppercase">{person.Name}</h3>
                        <p className="text-xs text-zinc-500 font-medium">{person.School}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-1 z-10">
                    <button onClick={(e) => startEditing(person, e)} className="p-2 text-zinc-400 hover:text-black bg-white border border-zinc-100 hover:border-black rounded transition"><FaEdit /></button>
                    <button onClick={(e) => handleDelete(person._id, person.Name, e)} className="p-2 text-zinc-400 hover:text-red-600 bg-white border border-zinc-100 hover:border-red-500 rounded transition"><FaTrash size={12} /></button>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-zinc-700">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                        <span className="flex items-center gap-2"><FaPhoneAlt className="text-zinc-400"/> {person.Tel}</span>
                        <span className="flex items-center gap-2"><FaBirthdayCake className="text-zinc-400"/> {person.Birth}</span>
                    </div>
                    
                    <div className="flex items-start gap-2 text-xs pt-1">
                        <FaMapMarkerAlt className="text-zinc-400 mt-0.5 shrink-0"/>
                        <span className="leading-relaxed">{person.Location}</span>
                    </div>

                    {expandedId === person._id && (
                        <div className="mt-4 pt-4 border-t border-zinc-200 animate-fade-in">
                            <div className="mb-4">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Experience</span>
                                <p className="text-xs italic text-zinc-600 leading-relaxed bg-white p-3 border border-zinc-100 rounded">
                                    {person.Experience || "No experience listed."}
                                </p>
                            </div>
                            
                            <div className="flex gap-2">
                                <button 
                                    onClick={(e) => handleOpenPdfMobile(e, person)}
                                    className="flex-1 lg:hidden py-3 bg-white text-black text-[10px] font-bold uppercase tracking-wider rounded border border-black flex items-center justify-center gap-2 hover:bg-zinc-100"
                                >
                                    <FaEye /> View Doc
                                </button>

                                <button 
                                    onClick={(e) => handleCopy(person, e)}
                                    className={`flex-2 py-3 text-[10px] font-bold uppercase tracking-wider rounded border transition flex items-center justify-center gap-2
                                    ${copiedId === person._id ? 'bg-green-600 border-green-600 text-white' : 'bg-black border-black text-white hover:bg-zinc-800'}`}
                                >
                                    {copiedId === person._id ? <><FaCheck /> Copied</> : <><FaCopy /> Copy Data</>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- RIGHT PANEL: PDF PREVIEW --- */}
        <div className={`flex-1 bg-zinc-100 relative flex flex-col h-full overflow-hidden
            ${showMobilePreview ? 'fixed inset-0 z-50 bg-white' : 'hidden lg:flex'}
        `}>
          
          <div className="flex-none bg-white border-b border-zinc-200 h-14 flex items-center justify-between px-4 shadow-sm z-10">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowMobilePreview(false)} className="lg:hidden p-2 -ml-2 text-black hover:bg-zinc-100 rounded transition"><FaArrowLeft /></button>
              <div className="flex items-center gap-2 text-sm font-bold text-black uppercase tracking-wide">
                <FaFilePdf className="text-zinc-400" size={12} /> Document Preview
              </div>
            </div>
            {previewUrl && (
              <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded p-1">
                <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} className="p-1 text-zinc-500 hover:text-black"><FaSearchMinus size={12} /></button>
                <span className="text-[10px] font-bold text-zinc-400 w-8 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(3.0, z + 0.2))} className="p-1 text-zinc-500 hover:text-black"><FaSearchPlus size={12} /></button>
                <div className="w-px h-3 bg-zinc-200 mx-1"></div>
                {/* --- RESTORED RESET BUTTON --- */}
                <button onClick={() => setZoom(1.0)} className="p-1 text-zinc-500 hover:text-black" title="Reset Zoom"><FaRedo size={12} /></button>
              </div>
            )}
          </div>

          <div 
            className={`flex-1 overflow-auto p-4 lg:p-10 flex justify-center items-start bg-zinc-100 transition-all duration-300
              ${editingCandidate && window.innerWidth >= 1024 ? 'border-b border-zinc-300' : ''}
              ${editingCandidate && window.innerWidth < 1024 ? 'pb-[60vh]' : ''} 
            `}
          >
             {previewUrl ? (
                <div className="shadow-2xl border border-zinc-200 bg-white origin-top" style={{ transform: `scale(${zoom})` }}>
                  {fileType.includes("pdf") ? (
                    <Document file={previewUrl} loading={<div className="p-10 font-bold text-xs">LOADING...</div>}>
                      <Page pageNumber={1} width={window.innerWidth < 768 ? window.innerWidth - 32 : 650} renderTextLayer={false} renderAnnotationLayer={false} />
                    </Document>
                  ) : (
                     <img src={previewUrl} className="max-w-[650px] w-full block" alt="CV" />
                  )}
                </div>
             ) : (
                <div className="mt-20 flex flex-col items-center text-zinc-300 gap-4">
                   <FaCopy size={48} className="opacity-20" />
                   <p className="text-xs font-bold uppercase tracking-widest">Select a candidate</p>
                </div>
             )}
          </div>

          {/* DESKTOP SPLIT EDIT */}
          <AnimatePresence>
            {editingCandidate && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "45%", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                  className="hidden lg:flex bg-white border-t-4 border-black flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-20"
                >
                    <EditForm editingCandidate={editingCandidate} setEditingCandidate={setEditingCandidate} saveEdit={saveEdit} handleEditChange={handleEditChange} />
                </motion.div>
            )}
          </AnimatePresence>
          
          {/* MOBILE STICKY ACTION BAR */}
          {showMobilePreview && selectedPerson && !editingCandidate && (
            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-zinc-200 p-4 shadow-[0_-5px_30px_rgba(0,0,0,0.1)] z-50 lg:hidden">
                <div className="flex gap-2">
                    <a href={`tel:${selectedPerson.Tel}`} className="flex-1 py-3 bg-zinc-100 border border-zinc-200 rounded text-center transition flex justify-center items-center">
                        <FaPhoneAlt className="text-zinc-600" />
                    </a>
                    <button onClick={() => handleCopy(selectedPerson)} className="flex-2 py-3 bg-black text-white rounded font-bold uppercase text-xs shadow-lg">
                        {copiedId === selectedPerson._id ? "COPIED!" : "COPY DATA"}
                    </button>
                    <button onClick={(e) => startEditing(selectedPerson, e)} className="flex-1 py-3 bg-zinc-100 border border-zinc-200 rounded text-center transition flex justify-center items-center">
                        <FaEdit className="text-zinc-600" />
                    </button>
                </div>
            </div>
          )}
        </div>
      </main>

      {/* MOBILE BOTTOM SHEET EDIT */}
      <AnimatePresence>
        {editingCandidate && (
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="lg:hidden fixed inset-0 z-60 flex flex-col"
            >
                <div className="flex-1 bg-black/20 backdrop-blur-[1px]" onClick={() => setEditingCandidate(null)} />
                <motion.div 
                    initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="h-[65%] bg-white rounded-t-2xl shadow-2xl flex flex-col overflow-hidden border-t border-zinc-200"
                >
                    <EditForm editingCandidate={editingCandidate} setEditingCandidate={setEditingCandidate} saveEdit={saveEdit} handleEditChange={handleEditChange} isMobile={true} />
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Reusable Edit Form
const EditForm = ({ editingCandidate, setEditingCandidate, saveEdit, handleEditChange, isMobile }) => (
    <>
        <div className="flex-none px-6 py-3 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
            <h2 className="font-bold text-black uppercase tracking-wide text-xs flex items-center gap-2">
                <FaEdit /> Editing: <span className="text-zinc-500">{editingCandidate.Name}</span>
            </h2>
            <div className="flex gap-2">
                {isMobile && <button onClick={() => setEditingCandidate(null)} className="p-2 -mr-2 text-zinc-400"><FaChevronDown /></button>}
                {!isMobile && (
                    <>
                    <button onClick={() => setEditingCandidate(null)} className="px-3 py-1.5 text-[10px] font-bold uppercase text-zinc-500 hover:text-black border border-zinc-200 rounded bg-white">Cancel</button>
                    <button onClick={saveEdit} className="px-4 py-1.5 text-[10px] font-bold uppercase text-white bg-black rounded hover:bg-zinc-800 flex items-center gap-1"><FaSave /> Save</button>
                    </>
                )}
            </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-white">
            <div className="grid grid-cols-2 gap-4 max-w-4xl mx-auto">
                <SolidInput label="Full Name" name="Name" val={editingCandidate.Name} onChange={handleEditChange} />
                <SolidInput label="Phone" name="Tel" val={editingCandidate.Tel} onChange={handleEditChange} />
                <SolidInput label="Birth Date" name="Birth" val={editingCandidate.Birth} onChange={handleEditChange} type="date" />
                <SolidInput label="Address" name="Location" val={editingCandidate.Location} onChange={handleEditChange} />
                <div className="col-span-2">
                    <SolidInput label="School" name="School" val={editingCandidate.School} onChange={handleEditChange} />
                </div>
                <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Experience</label>
                    <textarea name="Experience" value={editingCandidate.Experience} onChange={handleEditChange} rows="3" 
                    className="w-full bg-white border border-zinc-300 p-2 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none transition" />
                </div>
            </div>
        </div>
        {isMobile && (
            <div className="p-4 border-t border-zinc-100">
              <button onClick={saveEdit} className="w-full py-3 bg-black text-white font-bold uppercase tracking-wider rounded">Save Changes</button>
            </div>
        )}
    </>
)

const StatItem = ({ label, val }) => (
  <div>
    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{label}</p>
    <p className="text-lg font-bold text-black truncate" title={val}>{val}</p>
  </div>
)

const SolidInput = ({ label, name, val, onChange, type = "text" }) => (
  <div>
    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{label}</label>
    <input 
      type={type}
      name={name} value={val} onChange={onChange} 
      className="w-full bg-white border border-zinc-300 p-2 text-sm font-semibold text-black focus:border-black focus:ring-1 focus:ring-black outline-none transition" 
    />
  </div>
)

export default App