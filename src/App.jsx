import { useState, useEffect } from 'react'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { Document, Page, pdfjs } from 'react-pdf'
import { motion, AnimatePresence } from 'framer-motion'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import Swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'

import {
  FaRobot, FaCloudUploadAlt, FaTrash, FaEdit, FaSave, FaFileExcel,
  FaSearch, FaPhoneAlt, FaMapMarkerAlt, FaBirthdayCake,
  FaCopy, FaCheck, FaArrowLeft, FaFilePdf,
  FaSearchMinus, FaSearchPlus, FaEye, FaChevronDown, FaRedo, FaLock, FaUnlock, FaVenusMars, FaTimes,
  FaDownload, FaSpinner
} from 'react-icons/fa'
import { BsXLg, BsX } from "react-icons/bs";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

// --- HELPER: DATE FORMATTER (DD-Mon-YYYY) ---
const formatDOB = (dateString) => {
  if (!dateString || dateString === "N/A") return "N/A"

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

  // 1. Handle "YYYY-MM-DD" (Standard Database Format)
  const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [_, year, month, day] = isoMatch
    // Convert "03" -> Index 2 -> "Mar"
    const monthName = months[parseInt(month) - 1]
    return `${day}-${monthName}-${year}`
  }

  // 2. Handle Other Formats (e.g. "April 26, 2004")
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString

  const d = String(date.getDate()).padStart(2, '0')
  const m = months[date.getMonth()] // getMonth() returns 0-11
  const y = date.getFullYear()

  return `${d}-${m}-${y}`
}

function App() {
  // --- STATE ---
  const [file, setFile] = useState(null)
  const [files, setFiles] = useState([])
  const [previewUrl, setPreviewUrl] = useState(null)
  const [fileType, setFileType] = useState("")
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  // Selection State
  const [selectedIds, setSelectedIds] = useState([])
  const [selectMode, setSelectMode] = useState(false)

  // UI States
  const [expandedId, setExpandedId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [editingCandidate, setEditingCandidate] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortOption, setSortOption] = useState("newest")
  const [zoom, setZoom] = useState(1.0)

  // Mobile UI
  const [showMobilePreview, setShowMobilePreview] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState(null)

  // PWA State
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  const isLocal = window.location.hostname === "localhost" || window.location.hostname.includes("192.168")

  const API_URL = isLocal
    ? 'http://127.0.0.1:8000'
    : 'https://cv-tracker-api.onrender.com'

  useEffect(() => { fetchCandidates(1) }, [])

  // --- PWA INSTALL EFFECT ---
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  // --- AUTO-SEARCH EFFECT ---
  useEffect(() => {
    // Wait 500ms after user stops typing before calling server
    const delayDebounceFn = setTimeout(() => {
      // Always reset to Page 1 when searching
      fetchCandidates(1, searchTerm)
    }, 500)

    return () => clearTimeout(delayDebounceFn)
  }, [searchTerm]) // Runs whenever searchTerm changes

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt')
    }
    setDeferredPrompt(null)
  }

  // --- API FUNCTIONS ---
  const fetchCandidates = async (page = 1, search = searchTerm) => {
    setLoading(true)
    try {
      // Send the search term to the backend
      const res = await axios.get(`${API_URL}/candidates`, {
        params: {
          page: page,
          limit: 20,
          search: search // <--- Send it here
        }
      })

      setCandidates(res.data.data)
      setCurrentPage(res.data.page)
      setTotalItems(res.data.total)
      setTotalPages(Math.ceil(res.data.total / res.data.limit))
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const getMostFrequent = (arr, key) => {
    if (!arr.length) return "N/A"
    const counts = {}
    arr.forEach(person => {
      const value = (person[key] || "Unknown").trim().replace(/[.,]/g, '')
      if (value.length > 3) counts[value] = (counts[value] || 0) + 1
    })
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
    return sorted.length > 0 ? sorted[0][0] : "N/A"
  }

  const stats = {
    total: candidates.length,
    selected: selectedIds.length,
    topLocation: getMostFrequent(candidates, "Location"),
    topSchool: getMostFrequent(candidates, "School")
  }

  const processedCandidates = candidates.sort((a, b) => {
    // 1. Name
    if (sortOption === "nameAsc") return a.Name.localeCompare(b.Name)
    if (sortOption === "nameDesc") return b.Name.localeCompare(a.Name)

    // 2. School
    if (sortOption === "schoolAsc") return a.School.localeCompare(b.School)

    // 3. Gender
    if (sortOption === "genderAsc") return (a.Gender || "z").localeCompare(b.Gender || "z")
    if (sortOption === "genderDesc") return (b.Gender || "").localeCompare(a.Gender || "")

    // 4. Address/Location
    if (sortOption === "locationAsc") return (a.Location || "z").localeCompare(b.Location || "z")
    if (sortOption === "locationDesc") return (b.Location || "").localeCompare(a.Location || "")

    // 5. Time (Newest vs Oldest)
    if (sortOption === "oldest") return a._id.localeCompare(b._id) // Smallest ID = Oldest
    if (sortOption === "newest") return b._id.localeCompare(a._id) // Largest ID = Newest

    // Default fallback
    return 0
  })

  const MySwal = withReactContent(Swal)
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer)
      toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
  })

  // --- SELECTION FUNCTIONS ---
  const toggleSelection = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length > 0) {
      setSelectedIds([])
    } else {
      const unlocked = processedCandidates.filter(c => !c.locked).map(c => c._id)
      setSelectedIds(unlocked)
    }
  }

  const handleExitMode = () => {
    setSelectedIds([])
    setSelectMode(false)
  }

  const clearSelection = () => {
    setSelectedIds([])
    setSelectMode(false)
  }

  // --- FILE HANDLERS ---
  const handleFileChange = (e) => {
    const selectedFiles = e.target.files
    if (selectedFiles.length > 0) {
      setFiles(selectedFiles)
      setFile(selectedFiles[0])
    }
  }

  const handleClearFiles = () => {
    setFiles([])
    setFile(null)
    document.getElementById('fileInput').value = ""
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      Toast.fire({ icon: 'warning', title: 'Please select files first' })
      return
    }

    setLoading(true)
    setStatus(`Processing...`)
    const formData = new FormData()
    for (let i = 0; i < files.length; i++) formData.append('files', files[i])

    try {
      const res = await axios.post(`${API_URL}/upload-cv`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setStatus(`Done. ${res.data.details.length} scanned.`)
      MySwal.fire({
        icon: 'success',
        title: 'Upload Complete',
        text: `Processed ${res.data.details.length} files.`,
        timer: 2000,
        showConfirmButton: false
      })
      fetchCandidates()
      handleClearFiles()
    } catch (error) {
      setStatus("Upload failed.")
      MySwal.fire({
        icon: 'error',
        title: 'Upload Failed',
        text: 'Something went wrong with the server.',
      })
    }
    finally {
      setLoading(false)
      setTimeout(() => setStatus(""), 3000)
    }
  }

  // --- UI HANDLERS ---
  const handleCardClick = (person) => {
    if (selectMode) {
      toggleSelection(person._id)
      return
    }
    toggleExpand(person._id)
    setSelectedPerson(person)
    if (window.innerWidth >= 1024) {
      loadPdfIntoView(person)
    }
  }

  const handleOpenPdfMobile = (e, person) => {
    e.stopPropagation()
    setSelectedPerson(person)
    loadPdfIntoView(person)
    setShowMobilePreview(true)
  }

  const loadPdfIntoView = (person) => {
    let fileUrl
    if (person._id) {
      fileUrl = `${API_URL}/cv/${person._id}`
    } else {
      fileUrl = `${API_URL}/static/${person.file_name}`
    }
    const isPdf = person.file_name.toLowerCase().endsWith(".pdf")
    setFileType(isPdf ? "application/pdf" : "image/jpeg")
    setPreviewUrl(fileUrl)
    setZoom(1.0)
  }

  const handleDelete = async (id, name, e) => {
    e.stopPropagation()
    const result = await MySwal.fire({
      title: 'Delete candidate?',
      text: `Are you sure you want to remove ${name}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#000',
      cancelButtonColor: '#d4d4d8',
      confirmButtonText: 'Yes, delete it'
    })

    if (result.isConfirmed) {
      try {
        const response = await axios.delete(`${API_URL}/candidates/${id}`)
        if (response.data.status.includes("locked")) {
          Toast.fire({ icon: 'error', title: 'Candidate is locked!' })
          return
        }
        fetchCandidates()
        if (showMobilePreview) setShowMobilePreview(false)
        if (editingCandidate && editingCandidate._id === id) setEditingCandidate(null)
        setSelectedIds(prev => prev.filter(i => i !== id))
        Toast.fire({ icon: 'success', title: 'Candidate deleted' })
      }
      catch (error) { Toast.fire({ icon: 'error', title: 'Failed to delete' }) }
    }
  }

  // --- SMART DELETE FUNCTION ---
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return

    // 1. Check if user selected ALL unlocked candidates
    // (We compare selected count vs total unlocked count)
    const totalUnlocked = candidates.filter(c => !c.locked).length
    const isDeleteAll = selectedIds.length === totalUnlocked && totalUnlocked > 0

    if (isDeleteAll) {
      // --- SCENARIO A: DELETE ALL (Secure Mode) ---
      const { value: passcode } = await MySwal.fire({
        title: 'CRITICAL WARNING',
        html: `You have selected <b>ALL ${selectedIds.length} CANDIDATES</b>.<br/>This will wipe the database.`,
        icon: 'warning',
        input: 'password',
        inputLabel: 'Enter Admin Passcode to Confirm',
        inputPlaceholder: 'Passcode',
        confirmButtonText: 'DELETE EVERYTHING',
        confirmButtonColor: '#d33',
        showCancelButton: true,
        focusConfirm: false,
        preConfirm: (value) => {
          if (!value) Swal.showValidationMessage('Passcode is required')
          return value
        }
      })

      if (passcode) {
        try {
          // Send empty array [] to trigger "Delete All" mode in backend
          const response = await axios.post(`${API_URL}/candidates/bulk-delete`, {
            candidate_ids: [],
            passcode: passcode
          })

          if (response.data.status === "error") {
            MySwal.fire('Error', response.data.message, 'error')
          } else {
            MySwal.fire('Wiped!', `Database cleared. ${response.data.deleted} deleted.`, 'success')
            fetchCandidates()
            clearSelection()
          }
        } catch (error) {
          MySwal.fire('Error', 'Server connection failed', 'error')
        }
      }

    } else {
      // --- SCENARIO B: STANDARD BULK DELETE (Normal Mode) ---
      const result = await MySwal.fire({
        title: 'Bulk Delete',
        text: `Delete ${selectedIds.length} selected candidates?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#000',
        confirmButtonText: 'Yes, delete them'
      })

      if (result.isConfirmed) {
        try {
          await axios.post(`${API_URL}/candidates/bulk-delete`, {
            candidate_ids: selectedIds
          })
          fetchCandidates()
          clearSelection()
          MySwal.fire('Deleted!', 'Selected candidates have been removed.', 'success')
        } catch (error) {
          MySwal.fire('Error', 'Failed to delete candidates', 'error')
        }
      }
    }
  }

  const handleClearAll = async () => {
    const unlockedCount = candidates.filter(c => !c.locked).length
    if (unlockedCount === 0) {
      Toast.fire({ icon: 'info', title: 'No unlocked candidates to delete' })
      return
    }

    const { value: passcode } = await MySwal.fire({
      title: 'CRITICAL DELETION',
      html: `You are about to delete <b>${unlockedCount} candidates</b>.<br/>This action cannot be undone.`,
      icon: 'warning',
      input: 'password',
      inputLabel: 'Enter Admin Passcode',
      inputPlaceholder: 'Passcode',
      confirmButtonText: 'DELETE ALL',
      confirmButtonColor: '#d33',
      showCancelButton: true,
      focusConfirm: false,
      preConfirm: (value) => {
        if (!value) Swal.showValidationMessage('Passcode is required')
        return value
      }
    })

    if (passcode) {
      try {
        const response = await axios.post(`${API_URL}/candidates/bulk-delete`, {
          candidate_ids: [],
          passcode: passcode
        })
        if (response.data.status === "error") {
          MySwal.fire('Error', response.data.message, 'error')
        } else {
          MySwal.fire('Deleted!', `Successfully deleted ${response.data.deleted} candidates.`, 'success')
          fetchCandidates()
          clearSelection()
        }
      } catch (error) {
        MySwal.fire('Error', 'Server connection failed', 'error')
      }
    }
  }

  const handleClearPreview = () => {
    setPreviewUrl(null)
    setFileType("")
    setSelectedPerson(null)
    setExpandedId(null)
    if (editingCandidate) setEditingCandidate(null)
  }

  const handleExport = () => {
    const toExport = selectedIds.length > 0
      ? processedCandidates.filter(c => selectedIds.includes(c._id))
      : processedCandidates

    const data = toExport.map(c => ({
      Name: c.Name,
      Gender: c.Gender,
      Phone: c.Tel,
      Birth: formatDOB(c.Birth),
      Location: c.Location,
      School: c.School,
      Experience: c.Experience
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Candidates")
    XLSX.writeFile(wb, `CV_Database_${selectedIds.length > 0 ? 'Selected' : 'All'}.xlsx`)
  }

  const toggleLock = async (person, e) => {
    e.stopPropagation()
    try {
      await axios.put(`${API_URL}/candidates/${person._id}/lock`, {
        locked: !person.locked
      })
      fetchCandidates()
    } catch (error) {
      alert("Failed to toggle lock")
    }
  }

  const startEditing = (person, e) => {
    e.stopPropagation()
    setEditingCandidate({ ...person })
    loadPdfIntoView(person)
  }

  const handleEditChange = (e) => {
    const { name, value } = e.target
    setEditingCandidate({ ...editingCandidate, [name]: value })
  }

  const saveEdit = async () => {
    try {
      await axios.put(`${API_URL}/candidates/${editingCandidate._id}`, editingCandidate)
      setEditingCandidate(null)
      fetchCandidates()
    } catch (error) {
      alert("Failed to save")
    }
  }

  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id)

  // --- COPY FUNCTIONS ---

  // 1. Helper to format text (prevents code duplication)
  const formatCandidateText = (candidatesList) => {
    return candidatesList.map(p =>
      `Name: ${p.Name}\nGender: ${p.Gender || 'N/A'}\nDOB: ${p.Birth || 'N/A'}\nPhone: ${p.Tel}\nAddress: ${p.Location}\nEducation: ${p.School}\nExperience: ${p.Experience}`
    ).join('\n\n----------------------------------------\n\n')
  }

  // 2. Handle Single Copy (Existing, updated to use helper)
  const handleCopy = (person, e) => {
    if (e) e.stopPropagation()
    if (!person) return

    const text = formatCandidateText([person])
    navigator.clipboard.writeText(text)

    setCopiedId(person._id)
    setTimeout(() => setCopiedId(null), 2000)
    Toast.fire({ icon: 'success', title: 'Copied to clipboard' })
  }

  // 3. NEW: Handle Bulk Copy (All or Selected)
  const handleBulkCopy = (mode) => {
    let candidatesToCopy = []

    if (mode === 'selected') {
      // Filter the processed list to only get selected IDs
      candidatesToCopy = processedCandidates.filter(c => selectedIds.includes(c._id))
    } else {
      // Copy everyone currently visible (respecting search filters)
      candidatesToCopy = processedCandidates
    }

    if (candidatesToCopy.length === 0) {
      Toast.fire({ icon: 'warning', title: 'Nothing to copy' })
      return
    }

    const text = formatCandidateText(candidatesToCopy)
    navigator.clipboard.writeText(text)

    Toast.fire({
      icon: 'success',
      title: `Copied ${candidatesToCopy.length} candidates!`
    })

    // Optional: Clear selection after copying
    if (mode === 'selected') {
      clearSelection()
    }
  }

  const formatDateForInput = (dateString) => {
    if (!dateString) return ""

    // 1. If it is already perfect (YYYY-MM-DD), send it back.
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString

    const date = new Date(dateString)
    if (isNaN(date.getTime())) return ""

    // 2. FIX: Use getFullYear/getMonth/getDate (Local Time) 
    // instead of getUTCFullYear (London Time)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0') // +1 because Jan is 0
    const d = String(date.getDate()).padStart(2, '0')      // .getDate() is Local Day

    return `${y}-${m}-${d}`
  }

  // --- RENDER ---
  return (
    <div className="flex flex-col h-screen bg-white text-black font-sans selection:bg-black selection:text-white overflow-hidden select-none">
      <Navbar
        handleExport={handleExport}
        selectedCount={selectedIds.length}
        selectMode={selectMode}
        deferredPrompt={deferredPrompt}
        handleInstallClick={handleInstallClick}
      />

      <main className="flex-1 flex overflow-hidden max-w-[1920px] mx-auto w-full relative">
        {/* LEFT PANEL */}
        <div className={`flex flex-col w-full lg:w-[500px] xl:w-[550px] border-r border-zinc-200 h-full transition-all duration-300 z-10 bg-white
          ${showMobilePreview ? 'hidden lg:flex' : 'flex'}
        `}>
          <StatsPanel stats={stats} />
          <ControlPanel
            files={files}
            loading={loading}
            status={status}
            searchTerm={searchTerm}
            sortOption={sortOption}
            selectMode={selectMode}
            selectedIds={selectedIds}
            processedCandidates={processedCandidates}
            handleFileChange={handleFileChange}
            handleUpload={handleUpload}
            handleClearFiles={handleClearFiles}
            setSearchTerm={setSearchTerm}
            setSortOption={setSortOption}
            setSelectMode={setSelectMode}
            toggleSelectAll={toggleSelectAll}
            handleExitMode={handleExitMode}
            clearSelection={clearSelection}
            handleBulkDelete={handleBulkDelete}
            handleClearAll={handleClearAll}
            handleBulkCopy={handleBulkCopy}
          />

          {/* CANDIDATE LIST */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24 scroll-smooth">

            {/* --- NEW LOADING STATE --- */}
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-4 pt-20">
                <FaSpinner className="animate-spin text-lg text-black/50" />
                <div className="text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-black">
                    Loading Database
                  </p>
                  <p className="text-xs mt-1">
                    Please wait...
                  </p>
                </div>
              </div>
            ) : (
              /* --- EXISTING LIST --- */
              processedCandidates.length > 0 ? (
                processedCandidates.map((person) => (
                  <CandidateCard
                    key={person._id}
                    person={person}
                    expandedId={expandedId}
                    selectedIds={selectedIds}
                    selectMode={selectMode}
                    copiedId={copiedId}
                    handleCardClick={handleCardClick}
                    toggleSelection={toggleSelection}
                    toggleLock={toggleLock}
                    startEditing={startEditing}
                    handleDelete={handleDelete}
                    handleCopy={handleCopy}
                    handleOpenPdfMobile={handleOpenPdfMobile}
                  />
                ))
              ) : (
                /* --- EMPTY STATE (If no candidates found) --- */
                <div className="text-center py-10 text-zinc-400 text-xs">
                  No candidates found.
                </div>
              )
            )}
          </div>

          {/* --- PAGINATION CONTROLS --- */}
          <div className="flex-none p-4 border-t border-zinc-200 bg-zinc-50 flex justify-between items-center z-10">

            {/* Previous Button */}
            <button
              onClick={() => fetchCandidates(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              className="px-4 py-2 bg-white border border-zinc-300 rounded text-xs font-bold uppercase hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              &larr; Prev
            </button>

            {/* Page Info */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-black">
                Page {currentPage} of {totalPages}
              </span>
              <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
                {totalItems} Candidates Total
              </span>
            </div>

            {/* Next Button */}
            <button
              onClick={() => fetchCandidates(currentPage + 1)}
              disabled={currentPage === totalPages || loading}
              className="px-4 py-2 bg-black text-white border border-black rounded text-xs font-bold uppercase hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Next &rarr;
            </button>
          </div>

        </div>

        {/* RIGHT PANEL */}
        <div className={`flex-1 bg-zinc-100 relative flex flex-col h-full overflow-hidden
            ${showMobilePreview ? 'fixed inset-0 z-50 bg-white' : 'hidden lg:flex'}
        `}>
          <PDFViewer
            previewUrl={previewUrl}
            fileType={fileType}
            zoom={zoom}
            setZoom={setZoom}
            showMobilePreview={showMobilePreview}
            setShowMobilePreview={setShowMobilePreview}
            editingCandidate={editingCandidate}
            onClear={handleClearPreview}
          />
          {/* DESKTOP SPLIT EDIT */}
          <AnimatePresence>
            {editingCandidate && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "50%", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                className="hidden lg:flex bg-white border-t-4 border-black flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-20"
              >
                <EditForm
                  editingCandidate={editingCandidate}
                  setEditingCandidate={setEditingCandidate}
                  saveEdit={saveEdit}
                  handleEditChange={handleEditChange}
                  formatDateForInput={formatDateForInput}
                />
              </motion.div>
            )}
          </AnimatePresence>
          {/* MOBILE ACTION BAR */}
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

      {/* MOBILE EDIT SHEET */}
      <AnimatePresence>
        {editingCandidate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-60 flex flex-col"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="h-[50%] bg-white rounded-t-2xl shadow-2xl flex flex-col overflow-hidden border-t border-zinc-200 mt-auto"
            >
              <EditForm
                editingCandidate={editingCandidate}
                setEditingCandidate={setEditingCandidate}
                saveEdit={saveEdit}
                handleEditChange={handleEditChange}
                formatDateForInput={formatDateForInput}
                isMobile={true}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
export default App

// ==================== COMPACT NAVBAR ====================
const Navbar = ({ handleExport, selectedCount, selectMode, deferredPrompt, handleInstallClick }) => {
  return (
    <nav className="flex-none border-b border-zinc-200 px-4 h-12 flex items-center justify-between z-20 bg-white shadow-sm">
      <div className="flex items-center gap-2">
        <div className="bg-black text-white p-1.5 rounded cursor-pointer">
          <FaRobot size={14} />
        </div>
        <span className="font-bold text-lg tracking-tight">
          CV<span className="text-zinc-400">Tracker</span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* PWA INSTALL BUTTON */}
        {deferredPrompt && (
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-2 px-2 py-1 bg-blue-600 text-white rounded text-xs font-bold uppercase hover:bg-blue-700 transition shadow-sm animate-pulse"
          >
            <FaDownload /> Install
          </button>
        )}

        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-1 border border-zinc-200 rounded font-bold text-xs hover:bg-black hover:text-white transition uppercase"
        >
          <FaFileExcel />
          Export {selectedCount > 0 ? `(${selectedCount})` : ''}
        </button>

        <div className="text-xs font-bold text-black border border-zinc-200 px-2 py-1 rounded flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${selectMode ? 'bg-blue-500' : 'bg-green-500'} animate-pulse`}></span>
          {selectMode ? `${selectedCount} SELECTED` : 'ONLINE'}
        </div>
      </div>
    </nav>
  )
}

// ==================== COMPACT STATS PANEL ====================
const StatsPanel = ({ stats }) => {
  return (
    <div className="flex-none p-3 border-b border-zinc-100 grid grid-cols-3 gap-2 bg-zinc-50/50">
      <StatItem label="Candidates" val={stats.total} />
      <StatItem label="Top Region" val={stats.topLocation} />
      <StatItem label="Top School" val={stats.topSchool} />
    </div>
  )
}

const StatItem = ({ label, val }) => (
  <div>
    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide">{label}</p>
    <p className="text-sm font-semibold text-black truncate" title={val}>{val}</p>
  </div>
)

// ==================== COMPACT CONTROL PANEL ====================
const ControlPanel = ({
  files, loading, status, searchTerm, sortOption, selectMode,
  selectedIds, processedCandidates, handleFileChange, handleUpload,
  handleClearFiles, setSearchTerm, setSortOption, setSelectMode,
  toggleSelectAll, handleExitMode, clearSelection, handleBulkDelete,
  handleBulkCopy
}) => {

  const [isDragging, setIsDragging] = useState(false)

  // 1. Move Drag Events to the MAIN container
  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    // Only stop dragging if we left the main container
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange({ target: { files: e.dataTransfer.files } })
    }
  }

  return (
    <div
      // 2. Apply drag handlers here, to the whole panel
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex-none p-3 space-y-2 border-b border-zinc-100 bg-white transition-colors duration-200
        ${isDragging ? 'bg-blue-50' : ''} 
      `}
    >

      {/* --- 3. THE MAGIC OVERLAY (Visible only when dragging) --- */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-50/90 border-2 border-dashed border-blue-500 m-2 rounded-lg pointer-events-none">
          <div className="text-center">
            <FaCloudUploadAlt className="text-4xl text-blue-500 mx-auto mb-2" />
            <p className="text-md font-semibold text-blue-600 uppercase tracking-widest">Drop Files Here</p>
          </div>
        </div>
      )}

      {/* --- STANDARD UI (Stays essentially the same) --- */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id="fileInput"
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <label
            htmlFor="fileInput"
            className="w-full h-8 flex justify-center items-center gap-2 bg-zinc-100 border border-transparent hover:border-black rounded text-xs font-bold uppercase cursor-pointer transition text-zinc-600 hover:text-black select-none"
          >
            {files.length > 0 ? (
              <><FaCheck /> {files.length} Files Ready</>
            ) : (
              <><FaCloudUploadAlt /> Upload PDFs</>
            )}
          </label>
        </div>

        {files.length > 0 && (
          <div className="flex gap-1">
            <button
              onClick={handleUpload}
              disabled={loading}
              className="px-4 h-8 bg-black text-white rounded text-xs font-bold uppercase hover:bg-zinc-800 transition disabled:opacity-50"
            >
              {loading ? "..." : "Upload"}
            </button>
            <button
              onClick={handleClearFiles}
              className="px-2 h-8 bg-zinc-100 hover:bg-red-500 hover:text-white rounded text-zinc-500 transition"
            >
              <FaTrash size={12} />
            </button>
          </div>
        )}
      </div>

      {status && (
        <div className="text-xs text-center py-1 bg-zinc-50 rounded border border-zinc-200 text-zinc-500">
          {status}
        </div>
      )}

      <div className="relative">
        <FaSearch className="absolute left-2.5 top-2.5 text-zinc-400" size={10} />
        <input
          type="text"
          placeholder="Search candidates..."
          className="w-full pl-8 pr-20 h-8 bg-white border border-zinc-200 rounded text-xs font-medium focus:ring-1 focus:ring-black focus:border-black outline-none transition placeholder:text-zinc-400"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="absolute right-1 top-1 bottom-1 px-1 bg-transparent text-xs font-bold text-zinc-500 outline-none cursor-pointer hover:text-black"
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value)}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="nameAsc">Name (A-Z)</option>
          <option value="nameDesc">Name (Z-A)</option>
          <option value="schoolAsc">School</option>
          <option value="genderAsc">Gender (F-M)</option>
          <option value="genderDesc">Gender (M-F)</option>
          <option value="locationAsc">Address (A-Z)</option>
          <option value="locationDesc">Address (Z-A)</option>
        </select>
      </div>

      <div className='grid grid-cols-2 gap-2 pt-1'>
        {selectMode ? (
          <button
            onClick={() => handleBulkCopy('selected')}
            disabled={selectedIds.length === 0}
            className="w-full h-8 bg-black text-white border border-black rounded text-xs font-bold uppercase hover:bg-zinc-800 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <FaCopy size={10} /> Copy ({selectedIds.length})
          </button>
        ) : (
          <button
            onClick={() => handleBulkCopy('all')}
            disabled={processedCandidates.length === 0}
            className="w-full h-8 bg-white text-black border border-zinc-300 hover:border-black rounded text-xs font-bold uppercase hover:bg-zinc-50 transition flex items-center justify-center gap-1.5"
          >
            <FaCopy size={10} /> Copy All
          </button>
        )}

        <div className="flex gap-1.5">
          <button
            onClick={selectMode ? handleExitMode : () => setSelectMode(true)}
            className={`h-8 text-xs font-bold uppercase rounded border transition flex items-center justify-center gap-1
            ${selectMode
                ? 'w-8 bg-red-50 text-red-600 border-red-200 hover:border-red-500'
                : 'flex-1 bg-black text-white border-black hover:bg-zinc-800'
              }`}
            title={selectMode ? "Exit Selection" : "Select Candidates"}
          >
            {selectMode ? <FaTimes size={12} /> : 'Select'}
          </button>

          {selectMode && (
            <>
              <button
                onClick={toggleSelectAll}
                className="flex-1 h-8 px-2 text-xs font-bold uppercase rounded border border-zinc-200 hover:border-black transition truncate bg-white"
              >
                {selectedIds.length > 0 ? 'None' : 'All'}
              </button>

              <button
                onClick={handleBulkDelete}
                disabled={selectedIds.length === 0}
                className={`h-8 px-3 text-white text-xs font-bold uppercase rounded transition
                ${selectedIds.length > 0
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-zinc-200 cursor-not-allowed'}`}
              >
                <FaTrash size={10} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== CANDIDATE CARD (Clean Style) ====================
const CandidateCard = ({
  person, expandedId, selectedIds, selectMode, copiedId,
  handleCardClick, toggleSelection, toggleLock, startEditing,
  handleDelete, handleCopy, handleOpenPdfMobile
}) => {
  const isExpanded = expandedId === person._id
  const isSelected = selectedIds.includes(person._id)

  return (
    <div
      onClick={() => handleCardClick(person)}
      className={`group p-3 rounded border cursor-pointer overflow-hidden transition-all duration-200 relative
        ${isExpanded ? 'bg-zinc-50 border-black ring-1 ring-black shadow-sm' : 'bg-white border-zinc-200 hover:border-zinc-400'}
        ${isSelected && selectMode ? 'ring-1 ring-blue-500 border-blue-500 bg-blue-50/10' : ''}
      `}
    >
      {/* HEADER: AVATAR + NAME + ACTIONS */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2.5">
          {/* 1. SELECTION / AVATAR */}
          {selectMode ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleSelection(person._id); }}
              className={`w-8 h-8 flex items-center justify-center border rounded transition-all
                ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-zinc-300'}`}
            >
              {isSelected && <FaCheck size={12} />}
            </button>
          ) : (
            <div className={`w-8 h-8 flex items-center justify-center text-xs font-bold border rounded transition-colors
              ${isExpanded ? 'bg-black text-white border-black' : 'bg-white text-black border-zinc-200'}`}>
              {person.Name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* 2. NAME & SCHOOL */}
          <div className="overflow-hidden">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-semibold text-black uppercase truncate leading-none">
                {person.Name}
              </h3>
              {/* Lock Icon Indicator (Small) */}
              {person.locked && <FaLock className="text-amber-500 shrink-0" size={8} />}
            </div>
            <p className="text-xs text-zinc-500 font-medium truncate leading-tight mt-1">
              {person.School || "N/A"}
            </p>
          </div>
        </div>

        {/* 3. ACTIONS (Top Right Icons - Mobile & Desktop) */}
        {!selectMode && (
          <div className={`flex gap-1 z-20 transition-all duration-200
            ${/* VISIBILITY LOGIC:
                - Desktop (lg): Hidden by default, Visible on Hover.
                - Mobile: Hidden by default, Visible when Expanded. */
            isExpanded
              ? 'opacity-100'
              : 'opacity-0 pointer-events-none lg:pointer-events-auto lg:group-hover:opacity-100'
            }
          `}>
            {/* Lock Button */}
            <button
              onClick={(e) => toggleLock(person, e)}
              className={`p-2 rounded transition border
                ${person.locked
                  ? 'text-amber-600 border-amber-200 bg-amber-50'
                  : 'text-zinc-400 hover:text-black bg-white border-zinc-100 hover:border-black'
                }`}
              title={person.locked ? 'Unlock' : 'Lock'}
            >
              {person.locked ? <FaLock size={10} /> : <FaUnlock size={10} />}
            </button>

            {/* Edit Button */}
            <button
              onClick={(e) => startEditing(person, e)}
              className="p-2 text-zinc-400 hover:text-black bg-white border border-zinc-100 hover:border-black rounded transition"
            >
              <FaEdit size={10} />
            </button>

            {/* Delete Button */}
            <button
              onClick={(e) => handleDelete(person._id, person.Name, e)}
              className="p-2 text-zinc-400 hover:text-red-600 bg-white border border-zinc-100 hover:border-red-500 rounded transition"
              disabled={person.locked}
            >
              <FaTrash size={10} />
            </button>
          </div>
        )}
      </div>

      {/* BODY: INFO GRID */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs text-zinc-600">
          <span className="flex items-center gap-1.5 truncate">
            <FaPhoneAlt className="text-zinc-400 shrink-0" size={10} />
            {person.Tel}
          </span>
          <span className="flex items-center gap-1.5 truncate">
            <FaBirthdayCake className="text-zinc-400 shrink-0" size={10} />
            {formatDOB(person.Birth)}
          </span>
          <span className="flex items-center gap-1.5 truncate">
            <FaVenusMars className="text-zinc-400 shrink-0" size={10} />
            {person.Gender || 'N/A'}
          </span>
        </div>

        <div className="flex items-start gap-1.5 text-xs text-zinc-600">
          <FaMapMarkerAlt className="text-zinc-400 mt-0.5 shrink-0" size={10} />
          <span className="leading-tight line-clamp-1">{person.Location}</span>
        </div>

        {/* EXPANDED SECTION */}
        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-zinc-200 animate-fade-in">
            <div className="mb-2">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                Experience
              </span>
              <p className="text-xs italic text-zinc-600 leading-relaxed bg-white p-2 border border-zinc-200 rounded max-h-32 overflow-y-auto">
                {person.Experience || "No experience listed."}
              </p>
            </div>

            {/* PRIMARY ACTIONS (View / Copy) */}
            <div className="flex gap-2">
              <button
                onClick={(e) => handleOpenPdfMobile(e, person)}
                className="flex-1 lg:hidden h-8 bg-white text-black text-xs font-bold uppercase tracking-wider rounded border border-black flex items-center justify-center gap-2 hover:bg-zinc-100"
              >
                <FaFilePdf size={12} /> View Doc
              </button>

              <button
                onClick={(e) => handleCopy(person, e)}
                className={`flex-2 h-8 px-3 text-xs font-bold uppercase tracking-wider rounded border transition flex items-center justify-center gap-2 w-full
                ${copiedId === person._id
                    ? 'bg-green-600 border-green-600 text-white'
                    : 'bg-black border-black text-white hover:bg-zinc-800'
                  }`}
              >
                {copiedId === person._id
                  ? <><FaCheck size={12} /> Copied</>
                  : <><FaCopy size={12} /> Copy Data</>
                }
              </button>
            </div>

            {/* NOTE: Bottom buttons removed as requested. Icons are now in the top right. */}
          </div>
        )}
      </div>
    </div>
  )
}

// PDFViewer Component
const PDFViewer = ({
  previewUrl, fileType, zoom, setZoom,
  showMobilePreview, setShowMobilePreview, editingCandidate,
  onClear
}) => {
  return (
    <>
      {/* VIEWER HEADER */}
      <div className="flex-none bg-white border-b border-zinc-200 h-14 flex items-center justify-between px-4 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMobilePreview(false)}
            className="lg:hidden p-2 -ml-2 text-black hover:bg-zinc-100 rounded transition"
          >
            <FaArrowLeft />
          </button>
          <div className="flex items-center gap-2 text-sm font-bold text-black uppercase tracking-wide">
            <FaFilePdf className="text-zinc-400" size={12} /> Document Preview
          </div>
        </div>

        {previewUrl && (
          <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded p-1">
            <button
              onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}
              className="p-1 text-zinc-500 hover:text-black"
            >
              <FaSearchMinus size={12} />
            </button>
            <span className="text-xs font-bold text-zinc-400 w-8 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(3.0, z + 0.2))}
              className="p-1 text-zinc-500 hover:text-black"
            >
              <FaSearchPlus size={12} />
            </button>
            <div className="w-px h-3 bg-zinc-200 mx-1"></div>
            <button
              onClick={() => setZoom(1.0)}
              className="p-1 text-zinc-500 hover:text-black"
              title="Reset Zoom"
            >
              <FaRedo size={12} />
            </button>

            {/* --- 2. CLOSE BUTTON --- */}
            <div className="hidden md:block w-px h-3 bg-zinc-200 mx-1"></div>
            <button
              onClick={onClear}
              className="hidden md:flex p-1 text-red-500 hover:bg-red-50 rounded transition"
              title="Close Preview"
            >
              <BsXLg size={16} />
            </button>
          </div>
        )}
      </div>

      {/* VIEWER CONTENT */}
      <div
        className={`flex-1 overflow-auto p-4 lg:p-10 bg-zinc-100 transition-all duration-300
          ${editingCandidate && window.innerWidth >= 1024 ? 'border-b border-zinc-300' : ''}
          ${editingCandidate && window.innerWidth < 1024 ? 'pb-[60vh]' : ''} 
        `}
      >
        <div className="min-h-full flex justify-center items-start">
          {previewUrl ? (
            fileType.includes("pdf") ? (
              <div>
                <Document
                  file={previewUrl}
                  loading={<div className="p-10 text-xs">Loading PDF...</div>}
                  error={<div className="p-10 text-xs text-red-500">Failed to load PDF</div>}
                >
                  <Page
                    pageNumber={1}
                    width={(window.innerWidth < 768 ? window.innerWidth - 32 : 650) * zoom}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </Document>
              </div>
            ) : (
              <img
                src={previewUrl}
                className="shadow-md rounded-lg border border-white object-contain"
                alt="CV"
                style={{ width: `${100 * zoom}%`, maxWidth: 'none' }}
              />
            )
          ) : (
            <div className="mt-20 flex flex-col items-center text-zinc-300 gap-4">
              <FaCopy size={48} className="opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest">Select a candidate</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// EditForm Component
const EditForm = ({
  editingCandidate, setEditingCandidate, saveEdit,
  handleEditChange, formatDateForInput, isMobile
}) => {
  const handleClearDate = () => {
    setEditingCandidate({ ...editingCandidate, Birth: "" })
  }

  return (
    <>
      <div className="flex-none px-6 py-3 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
        <h2 className="font-bold text-black uppercase tracking-wide text-xs flex items-center gap-2">
          <FaEdit /> Editing: <span className="text-zinc-500">{editingCandidate.Name}</span>
        </h2>
        <div className="flex gap-2">
          {isMobile && (
            <button
              onClick={() => setEditingCandidate(null)}
              className="p-2 -mr-2 text-zinc-400"
            >
              <FaChevronDown />
            </button>
          )}
          {!isMobile && (
            <>
              <button
                onClick={() => setEditingCandidate(null)}
                className="px-3 py-1.5 text-xs font-bold uppercase text-zinc-500 hover:text-black border border-zinc-200 rounded bg-white"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="px-4 py-1.5 text-xs font-bold uppercase text-white bg-black rounded hover:bg-zinc-800 flex items-center gap-1"
              >
                <FaSave /> Save
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-white">
        <div className="grid grid-cols-2 gap-4 max-w-4xl mx-auto">
          <SolidInput
            label="Full Name"
            name="Name"
            val={editingCandidate.Name}
            onChange={handleEditChange}
          />
          <SolidInput
            label="Phone"
            name="Tel"
            val={editingCandidate.Tel}
            onChange={handleEditChange}
          />

          <div className="col-span-1">
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Gender
            </label>
            <select
              name="Gender"
              value={editingCandidate.Gender || "N/A"}
              onChange={handleEditChange}
              className="w-full bg-white border border-zinc-300 p-2 text-sm font-semibold text-black focus:border-black focus:ring-1 focus:ring-black outline-none transition h-[38px]"
            >
              <option value="N/A">N/A</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Birth Date
              {/* Add this helper text */}
              <span className="text-[10px] font-normal text-zinc-400 normal-case ml-2 opacity-75">
                (MM-DD-YY)
              </span>
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                name="Birth"
                value={formatDateForInput(editingCandidate.Birth)}
                onChange={handleEditChange}
                className="flex-1 bg-white border border-zinc-300 p-2 text-sm font-semibold text-black focus:border-black focus:ring-1 focus:ring-black outline-none transition"
              />
              <button
                onClick={handleClearDate}
                className="px-3 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded text-xs font-bold text-zinc-600"
                title="Clear date"
              >
                Clear
              </button>
            </div>
          </div>

          <SolidInput
            label="Address"
            name="Location"
            val={editingCandidate.Location}
            onChange={handleEditChange}
          />

          <div className="col-span-1">
            <SolidInput
              label="School"
              name="School"
              val={editingCandidate.School}
              onChange={handleEditChange}
            />
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Experience
            </label>
            <textarea
              name="Experience"
              value={editingCandidate.Experience}
              onChange={handleEditChange}
              rows="3"
              className="w-full bg-white border border-zinc-300 p-2 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none transition"
            />
          </div>
        </div>
      </div>

      {isMobile && (
        <div className="p-4 border-t border-zinc-100">
          <button
            onClick={saveEdit}
            className="w-full py-3 text-sm bg-black text-white font-bold uppercase tracking-wider rounded"
          >
            Save Changes
          </button>
        </div>
      )}
    </>
  )
}

const SolidInput = ({ label, name, val, onChange, type = "text" }) => (
  <div>
    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
      {label}
    </label>
    <input
      type={type}
      name={name}
      value={val}
      onChange={onChange}
      className="w-full bg-white border border-zinc-300 p-2 text-sm font-semibold text-black focus:border-black focus:ring-1 focus:ring-black outline-none transition"
    />
  </div>
)