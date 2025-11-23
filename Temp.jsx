import { useState, useEffect } from 'react'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { 
  FaRobot, FaCloudUploadAlt, FaTrash, FaChevronRight, 
  FaBirthdayCake, FaPhoneAlt, FaMapMarkerAlt, FaGraduationCap, 
  FaBriefcase, FaCopy, FaCheck, FaEdit, FaTimes, FaSave, FaFileExcel, FaEye,
  FaSearch, FaSortAmountDown, FaUsers, FaGlobeAsia, FaUniversity, FaFilePdf,
  FaSearchPlus, FaSearchMinus, FaRedo
} from 'react-icons/fa'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function App() {
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

  // ⚠️ REPLACE WITH YOUR IP
  const API_URL = 'http://192.168.100.54:8000'; 

  useEffect(() => { fetchCandidates() }, [])

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
      const firstFile = selectedFiles[0];
      setFileType(firstFile.type);
      setPreviewUrl(URL.createObjectURL(firstFile));
      setZoom(1.0);
    }
  }

  const handleClearFiles = () => {
    setFiles([]);
    setFile(null);
    setPreviewUrl(null);
    document.getElementById('fileInput').value = "";
  }

  const handleUpload = async () => {
    if (files.length === 0) return alert("Please select files first!")
    setLoading(true); setStatus(`Processing ${files.length} files...`)
    
    const formData = new FormData()
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }

    try {
      const res = await axios.post(`${API_URL}/upload-cv`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setStatus(`✅ Batch Complete: ${res.data.details.length} files scanned`)
      fetchCandidates()
      handleClearFiles() 
    } catch (error) { setStatus("Error: Batch upload failed.") } 
    finally { setLoading(false) }
  }

  const handleViewCV = (person) => {
    const fileUrl = `${API_URL}/static/${person.file_name}`;
    const isPdf = person.file_name.toLowerCase().endsWith(".pdf");
    setFileType(isPdf ? "application/pdf" : "image/jpeg");
    setPreviewUrl(fileUrl);
    setZoom(1.0);
    
    if(window.innerWidth < 1024) {
      document.getElementById('document-viewer').scrollIntoView({ behavior: 'smooth' });
    }
  }

  const handleDelete = async (id, name, e) => {
    e.stopPropagation(); 
    if(!window.confirm(`Delete ${name}?`)) return;
    try { await axios.delete(`${API_URL}/candidates/${id}`); fetchCandidates() } 
    catch (error) { alert("Failed to delete") }
  }

  const handleExport = () => {
    const data = processedCandidates.map(c => ({ Name: c.Name, Phone: c.Tel, Birth: c.Birth, Location: c.Location, School: c.School, Experience: c.Experience }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Candidates");
    XLSX.writeFile(wb, "CV_Database.xlsx");
  }

  const openEditModal = (person, e) => { e.stopPropagation(); setEditingCandidate({ ...person }) }
  const handleEditChange = (e) => setEditingCandidate({ ...editingCandidate, [e.target.name]: e.target.value })
  
  const saveEdit = async () => {
    try {
      await axios.put(`${API_URL}/candidates/${editingCandidate._id}`, editingCandidate)
      setEditingCandidate(null); fetchCandidates(); setStatus("✅ Updated!"); setTimeout(() => setStatus(""), 3000)
    } catch (error) { alert("Failed") }
  }

  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id)

  const handleCopy = (person) => {
    const text = `Name: ${person.Name}\nBirth: ${person.Birth}\nPhone: ${person.Tel}\nLocation: ${person.Location}\nSchool: ${person.School}\nExperience: ${person.Experience}`.trim();
    navigator.clipboard.writeText(text)
    setCopiedId(person._id); setTimeout(() => setCopiedId(null), 2000)
  }

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-indigo-100">
      
      {/* NAVBAR */}
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm backdrop-blur-md bg-opacity-80">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-indigo-200 shadow-lg">
              <FaRobot size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">CV<span className="text-indigo-600">Tracker</span></h1>
          </div>
          <div className="hidden md:flex items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div> Online</span>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* === LEFT COLUMN: CONTROLS & DATA (7 Columns) === */}
          <div className="lg:col-span-7 flex flex-col gap-8 order-2 lg:order-1">
            
            {/* STATS DASHBOARD */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Candidates", val: stats.total, icon: FaUsers, color: "text-blue-600", bg: "bg-blue-50" },
                { label: "Top Location", val: stats.topLocation, icon: FaGlobeAsia, color: "text-orange-600", bg: "bg-orange-50" },
                { label: "Top School", val: stats.topSchool, icon: FaUniversity, color: "text-purple-600", bg: "bg-purple-50" }
              ].map((item, i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.label}</p>
                      <p className="text-xl font-bold text-slate-800 mt-1 truncate w-32" title={item.val}>{item.val}</p>
                    </div>
                    <div className={`p-2.5 rounded-xl ${item.bg} ${item.color}`}>
                      <item.icon size={18} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* UPLOAD BOX */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-4">
                <div className="w-full">
                  <label className="text-sm font-bold text-slate-700 mb-2 flex justify-between">
                    <span>Upload CVs (PDF/Image)</span>
                    {files.length > 0 && (
                      <button onClick={handleClearFiles} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 font-medium transition">
                        <FaTrash size={10} /> Clear
                      </button>
                    )}
                  </label>
                  <div className="relative group">
                    <input 
                      id="fileInput"
                      type="file" 
                      multiple 
                      onChange={handleFileChange} 
                      className="block w-full text-sm text-slate-500
                        file:mr-4 file:py-2.5 file:px-6
                        file:rounded-full file:border-0
                        file:text-sm file:font-bold
                        file:bg-slate-100 file:text-slate-700
                        hover:file:bg-slate-200
                        cursor-pointer border border-slate-200 rounded-full pl-1 hover:border-indigo-300 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={handleUpload} 
                  disabled={loading} 
                  className={`flex-1 py-3 rounded-xl font-bold text-white flex justify-center items-center gap-2 transition-all duration-200 shadow-lg shadow-indigo-100
                    ${loading ? 'bg-slate-300 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800 hover:-translate-y-0.5'}`}
                >
                  {loading ? "Processing..." : <><FaCloudUploadAlt size={18} /> Upload & Scan</>}
                </button>
                <button 
                  onClick={handleExport} 
                  className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 hover:border-green-500 hover:text-green-600 flex items-center gap-2 transition-all duration-200"
                >
                  <FaFileExcel size={18} />
                </button>
              </div>
              {status && <p className="text-center text-sm font-medium text-green-600 mt-4 bg-green-50 py-2 rounded-lg animate-fade-in">{status}</p>}
            </div>

            {/* SCROLLABLE SEARCH & LIST */}
            <div className="flex flex-col gap-4 pr-2 bg-white p-2 rounded-xl border border-slate-100">
              
              {/* Sticky Search */}
              <div className="flex flex-col sm:flex-row gap-3 items-center sticky top-0 bg-white z-10 pb-2 border-b border-slate-100">
                <div className="relative flex-1 w-full">
                  <FaSearch className="absolute left-4 top-3.5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search candidates..." 
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="relative w-full sm:w-auto">
                  <FaSortAmountDown className="absolute left-3 top-3.5 text-slate-500 pointer-events-none" size={12} />
                  <select 
                    className="w-full sm:w-auto pl-9 pr-8 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-semibold text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer hover:bg-slate-100"
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                  >
                    <option value="newest">Newest</option>
                    <option value="nameAsc">A-Z</option>
                    <option value="schoolAsc">School</option>
                  </select>
                </div>
              </div>

              {/* List */}
              <div className="flex flex-col gap-4 pb-4">
                {processedCandidates.map((person) => (
                  <div 
                    key={person._id} 
                    className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden group
                      ${expandedId === person._id ? 'border-indigo-200 shadow-md ring-1 ring-indigo-50' : 'border-slate-100 shadow-sm hover:border-indigo-100 hover:shadow-md'}`}
                  >
                    {/* HEADER */}
                    <div 
                      className="p-5 flex justify-between items-center cursor-pointer"
                      onClick={() => toggleExpand(person._id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold 
                          ${expandedId === person._id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600'} transition-colors`}>
                          {person.Name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 text-lg">{person.Name}</h3>
                          <p className="text-xs text-slate-400 font-medium flex items-center gap-1">
                            {person.Tel || "No Phone"} • {person.School || "Unknown School"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => openEditModal(person, e)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        >
                          <FaEdit />
                        </button>
                        <button 
                          onClick={(e) => handleDelete(person._id, person.Name, e)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <FaTrash size={14} />
                        </button>
                        <div className={`text-slate-300 transform transition-transform duration-300 ${expandedId === person._id ? 'rotate-90' : ''}`}>
                          <FaChevronRight />
                        </div>
                      </div>
                    </div>

                    {/* BODY */}
                    {expandedId === person._id && (
                      <div className="px-5 pb-5 pt-0 animate-fade-in">
                        <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                            <InfoItem icon={FaBirthdayCake} label="Birth" val={person.Birth} />
                            <InfoItem icon={FaPhoneAlt} label="Phone" val={person.Tel} />
                            <InfoItem icon={FaMapMarkerAlt} label="Location" val={person.Location} full />
                            <InfoItem icon={FaGraduationCap} label="Education" val={person.School} full />
                          </div>
                          
                          <div className="pt-4 border-t border-slate-200">
                            <div className="flex items-start gap-2 mb-2">
                              <FaBriefcase className="text-slate-400 mt-1" />
                              <span className="font-bold text-slate-700 text-sm">Experience Summary</span>
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed pl-6 italic bg-white p-3 rounded-lg border border-slate-100">
                              "{person.Experience}"
                            </p>
                          </div>

                          <div className="flex gap-3 pt-2">
                            <button 
                              onClick={() => handleViewCV(person)}
                              className="flex-1 py-2 bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-lg hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600 transition flex items-center justify-center gap-2 shadow-sm"
                            >
                              <FaEye /> View CV
                            </button>
                            <button 
                              onClick={() => handleCopy(person)}
                              className={`flex-1 py-2 font-bold text-sm rounded-lg flex items-center justify-center gap-2 transition shadow-sm
                                ${copiedId === person._id ? 'bg-green-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                            >
                              {copiedId === person._id ? <><FaCheck /> Copied</> : <><FaCopy /> Copy Data</>}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* === RIGHT COLUMN: PREVIEWER (FIXED SCROLL & ZOOM) === */}
          <div id="document-viewer" className="lg:col-span-5 flex flex-col gap-6 order-1 lg:order-2">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden sticky top-24 h-[80vh] flex flex-col">
              <div className="bg-slate-900 text-white p-4 flex justify-between items-center z-10">
                <div className="flex items-center gap-2 font-bold text-sm tracking-wide">
                  <FaFilePdf className="text-white" /> DOCUMENT VIEWER
                </div>
                
                {previewUrl && (
                  <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-2 py-1 shadow-lg">
                    <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition"><FaSearchMinus size={12} /></button>
                    <span className="text-xs font-mono text-slate-200 min-w-[35px] text-center">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(3.0, z + 0.2))} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition"><FaSearchPlus size={12} /></button>
                    <div className="w-px h-4 bg-slate-700 mx-1"></div>
                    <button onClick={() => setZoom(1.0)} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition" title="Reset Zoom"><FaRedo size={12} /></button>
                  </div>
                )}
              </div>
              
              {/* --- FIXED SCROLLING CONTAINER --- */}
              <div className="flex-1 bg-slate-100 overflow-y-auto p-6 relative">
                <div className="min-h-full flex justify-center items-start">
                  {previewUrl ? (
                    fileType.includes("pdf") ? (
                      <div className="shadow-2xl border border-slate-200 rounded-lg overflow-hidden bg-white">
                        <Document 
                          file={previewUrl} 
                          loading={<Loader />} 
                          error={<div className="p-10 text-red-500 text-sm">Error loading PDF.</div>}
                        >
                          <Page 
                            pageNumber={1} 
                            width={500 * zoom} 
                            renderTextLayer={false} 
                            renderAnnotationLayer={false} 
                          />
                        </Document>
                      </div>
                    ) : (
                      <img 
                        src={previewUrl} 
                        alt="CV Preview" 
                        className="object-contain shadow-md rounded-lg border border-white transition-all duration-200" 
                        style={{ width: `${100 * zoom}%`, maxWidth: 'none' }} 
                      />
                    )
                  ) : (
                    <div className="text-slate-300 text-center mt-20">
                      <FaFilePdf className="text-6xl mx-auto mb-4 opacity-50" />
                      <p className="font-medium">Select a candidate to preview document</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* EDIT MODAL */}
      {editingCandidate && (
        <div className="fixed inset-0 backdrop-blur-sm bg-slate-900/20 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 transform transition-all scale-100">
            <div className="bg-white p-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2"><FaEdit className="text-indigo-600" /> Edit Candidate</h2>
              <button onClick={() => setEditingCandidate(null)} className="text-slate-400 hover:text-slate-600 transition"><FaTimes size={20} /></button>
            </div>
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto bg-slate-50/50">
              <InputGroup label="Full Name" name="Name" val={editingCandidate.Name} onChange={handleEditChange} />
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Phone" name="Tel" val={editingCandidate.Tel} onChange={handleEditChange} />
                <InputGroup label="Birth Date" name="Birth" val={editingCandidate.Birth} onChange={handleEditChange} />
              </div>
              <InputGroup label="Location" name="Location" val={editingCandidate.Location} onChange={handleEditChange} />
              <InputGroup label="Education" name="School" val={editingCandidate.School} onChange={handleEditChange} />
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Experience</label>
                <textarea name="Experience" value={editingCandidate.Experience} onChange={handleEditChange} rows="4" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition shadow-sm" />
              </div>
            </div>
            <div className="p-5 bg-white border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setEditingCandidate(null)} className="px-5 py-2.5 text-slate-600 font-bold text-sm hover:bg-slate-50 rounded-xl transition">Cancel</button>
              <button onClick={saveEdit} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 shadow-lg shadow-indigo-100 transition flex items-center gap-2"><FaSave /> Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const InfoItem = ({ icon: Icon, label, val, full }) => (
  <div className={`${full ? 'col-span-1 md:col-span-2' : ''}`}>
    <div className="flex items-center gap-2 mb-1">
      <Icon className="text-slate-400 text-xs" />
      <span className="text-xs font-bold text-slate-500 uppercase">{label}</span>
    </div>
    <p className="text-sm font-semibold text-slate-800">{val || "N/A"}</p>
  </div>
)

const InputGroup = ({ label, name, val, onChange }) => (
  <div>
    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
    <input name={name} value={val} onChange={onChange} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition shadow-sm" />
  </div>
)

const Loader = () => <div className="flex justify-center items-center h-40 text-indigo-500 font-bold animate-pulse">Loading PDF...</div>

export default App