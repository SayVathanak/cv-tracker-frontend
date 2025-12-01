import { useState, useEffect, useCallback, memo } from 'react'
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
  FaSearchMinus, FaSearchPlus, FaRedo, FaLock, FaUnlock, FaVenusMars, FaTimes,
  FaDownload, FaSpinner, FaSync
} from 'react-icons/fa'
import { BsXLg } from "react-icons/bs";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

// --- HELPER: DATE FORMATTER ---
const formatDOB = (dateString) => {
  if (!dateString || dateString === "N/A") return "N/A"
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [_, year, month, day] = isoMatch
    const monthName = months[parseInt(month) - 1]
    return `${day}-${monthName}-${year}`
  }
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString
  const d = String(date.getDate()).padStart(2, '0')
  const m = months[date.getMonth()]
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

  // GLOBAL DRAG STATE
  const [isDragging, setIsDragging] = useState(false)

  // Mobile UI
  const [showMobilePreview, setShowMobilePreview] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState(null)

  // PWA State
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

  useEffect(() => { fetchCandidates(1) }, [])

  // --- GLOBAL DRAG AND DROP HANDLERS ---
  const handleGlobalDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleGlobalDragLeave = useCallback((e) => {
    e.preventDefault()
    // Only set false if we are leaving the window
    if (!e.relatedTarget || e.relatedTarget.nodeName === "HTML") {
      setIsDragging(false)
    }
  }, [])

  const handleGlobalDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Pass the dataTransfer object directly so our new logic works
      handleFileChange({
        target: { files: null }, // Mock target
        dataTransfer: e.dataTransfer // Pass drop data here
      })
    }
  }, [])

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
    const delayDebounceFn = setTimeout(() => {
      fetchCandidates(1, searchTerm)
    }, 500)
    return () => clearTimeout(delayDebounceFn)
  }, [searchTerm])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') console.log('User accepted')
    setDeferredPrompt(null)
  }

  // --- API FUNCTIONS ---
  const fetchCandidates = async (page = 1, search = searchTerm) => {
    setLoading(true)
    try {
      const res = await axios.get(`${API_URL}/candidates`, {
        params: { page, limit: 10, search }
      })
      setCandidates(res.data.data)
      setCurrentPage(res.data.page)
      setTotalItems(res.data.total)
      setTotalPages(Math.ceil(res.data.total / res.data.limit))
    } catch (error) {
      console.error(error)
    } finally {
      // Small artificial delay to show off the skeleton (optional, remove in prod)
      // setTimeout(() => setLoading(false), 300) 
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
    if (sortOption === "nameAsc") return a.Name.localeCompare(b.Name)
    if (sortOption === "nameDesc") return b.Name.localeCompare(a.Name)
    if (sortOption === "schoolAsc") return a.School.localeCompare(b.School)
    if (sortOption === "genderAsc") return (a.Gender || "z").localeCompare(b.Gender || "z")
    if (sortOption === "genderDesc") return (b.Gender || "").localeCompare(a.Gender || "")
    if (sortOption === "locationAsc") return (a.Location || "z").localeCompare(b.Location || "z")
    if (sortOption === "locationDesc") return (b.Location || "").localeCompare(a.Location || "")
    if (sortOption === "oldest") return a._id.localeCompare(b._id)
    if (sortOption === "newest") return b._id.localeCompare(a._id)
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
  // Memoized for performance
  const toggleSelection = useCallback((id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }, [])

  // --- UPDATED SELECTION FUNCTION ---
  const toggleSelectAll = useCallback(() => {
    // 1. Get all unlocked IDs on the CURRENT page
    const currentPageIds = processedCandidates
      .filter(c => !c.locked)
      .map(c => c._id)

    if (currentPageIds.length === 0) return

    // 2. Check if all items on this page are ALREADY selected
    const isPageSelected = currentPageIds.every(id => selectedIds.includes(id))

    if (isPageSelected) {
      // DESELECT: Remove current page IDs, keep others
      setSelectedIds(prev => prev.filter(id => !currentPageIds.includes(id)))
    } else {
      // SELECT: Add current page IDs to existing selection (using Set to prevent duplicates)
      setSelectedIds(prev => [...new Set([...prev, ...currentPageIds])])
    }
  }, [processedCandidates, selectedIds])

  const handleExitMode = () => { setSelectedIds([]); setSelectMode(false) }
  const clearSelection = () => { setSelectedIds([]); setSelectMode(false) }

  // --- FILE HANDLERS ---
  const handleFileChange = (e) => {
    // 1. Get files from either Input change or Drag & Drop
    const incoming = e.target.files || (e.dataTransfer && e.dataTransfer.files)
    if (!incoming || incoming.length === 0) return

    const newFilesArray = Array.from(incoming)

    setFiles(prevFiles => {
      // 2. Get list of existing file names
      const existingNames = new Set(prevFiles.map(f => f.name))

      // 3. Filter only NEW files (prevent same file name)
      const uniqueFiles = newFilesArray.filter(f => !existingNames.has(f.name))

      // 4. Show feedback if duplicates were skipped
      if (uniqueFiles.length < newFilesArray.length) {
        const skippedCount = newFilesArray.length - uniqueFiles.length
        Toast.fire({
          icon: 'warning',
          title: 'Duplicates Skipped',
          text: `${skippedCount} file(s) are already in the list.`
        })
      }

      // 5. Append new files to the existing list
      const updatedList = [...prevFiles, ...uniqueFiles]

      // Update single file reference (optional, keeps logic consistent)
      if (updatedList.length > 0) setFile(updatedList[0])

      return updatedList
    })

    // 6. Reset input value so you can select the same file again if you delete it from list
    if (e.target && e.target.value) e.target.value = ""
  }

  const handleClearFiles = () => {
    setFiles([])
    setFile(null)
    const input = document.getElementById('fileInput')
    if (input) input.value = ""
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
      MySwal.fire({ icon: 'error', title: 'Upload Failed', text: 'Server error.' })
    } finally {
      setLoading(false)
      setTimeout(() => setStatus(""), 3000)
    }
  }

  // --- UI HANDLERS ---
  const handleCardClick = useCallback((person) => {
    if (selectMode) {
      toggleSelection(person._id)
      return
    }
    setExpandedId(prev => prev === person._id ? null : person._id)
    setSelectedPerson(person)
    if (window.innerWidth >= 1024) loadPdfIntoView(person)
  }, [selectMode, toggleSelection]) // Dependencies

  const handleOpenPdfMobile = useCallback((e, person) => {
    e.stopPropagation()
    setSelectedPerson(person)
    loadPdfIntoView(person)
    setShowMobilePreview(true)
  }, [])

  const loadPdfIntoView = (person) => {
    let fileUrl
    if (person._id) fileUrl = `${API_URL}/cv/${person._id}`
    else fileUrl = `${API_URL}/static/${person.file_name}`
    const isPdf = person.file_name.toLowerCase().endsWith(".pdf")
    setFileType(isPdf ? "application/pdf" : "image/jpeg")
    setPreviewUrl(fileUrl)
    setZoom(1.0)
  }

  // --- RETRY HANDLER ---
  const handleRetry = useCallback(async (person, e) => {
    e.stopPropagation()

    // UI Feedback
    Toast.fire({
      icon: 'info',
      title: 'Re-analyzing CV...',
      text: 'Attempting to extract more details.'
    })

    try {
      const res = await axios.post(`${API_URL}/candidates/${person._id}/retry`)

      if (res.data.status === "success") {
        Toast.fire({ icon: 'success', title: 'Updated!', text: 'Data refreshed.' })
        fetchCandidates(currentPage) // Refresh the list to show new data

        // If this person is currently selected/previewed, update the edit view if open
        if (editingCandidate && editingCandidate._id === person._id) {
          setEditingCandidate(prev => ({ ...prev, ...res.data.data }))
        }
      } else {
        Toast.fire({ icon: 'error', title: 'Failed', text: res.data.message })
      }
    } catch (error) {
      console.error(error)
      Toast.fire({ icon: 'error', title: 'Server Error' })
    }
  }, [editingCandidate]) // Add dependencies if needed

  const handleDelete = useCallback(async (id, name, e) => {
    e.stopPropagation()
    const result = await MySwal.fire({
      title: 'Delete candidate?',
      text: `Remove ${name}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#000',
      confirmButtonText: 'Delete'
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
        Toast.fire({ icon: 'success', title: 'Deleted' })
      } catch (error) { Toast.fire({ icon: 'error', title: 'Failed' }) }
    }
  }, [showMobilePreview, editingCandidate])

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    const totalUnlocked = candidates.filter(c => !c.locked).length
    const isDeleteAll = selectedIds.length === totalUnlocked && totalUnlocked > 0

    if (isDeleteAll) {
      const { value: passcode } = await MySwal.fire({
        title: 'CRITICAL WARNING',
        html: `You selected <b>ALL CANDIDATES</b>.<br/>Enter Admin Passcode:`,
        icon: 'warning',
        input: 'password',
        confirmButtonText: 'DELETE EVERYTHING',
        confirmButtonColor: '#d33',
        showCancelButton: true
      })
      if (passcode) {
        try {
          const response = await axios.post(`${API_URL}/candidates/bulk-delete`, { candidate_ids: [], passcode })
          if (response.data.status === "error") MySwal.fire('Error', response.data.message, 'error')
          else {
            MySwal.fire('Wiped!', 'Database cleared.', 'success')
            fetchCandidates()
            clearSelection()
          }
        } catch (error) { MySwal.fire('Error', 'Failed', 'error') }
      }
    } else {
      const result = await MySwal.fire({
        title: 'Bulk Delete',
        text: `Delete ${selectedIds.length} candidates?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#000',
        confirmButtonText: 'Yes'
      })
      if (result.isConfirmed) {
        try {
          await axios.post(`${API_URL}/candidates/bulk-delete`, { candidate_ids: selectedIds })
          fetchCandidates()
          clearSelection()
          MySwal.fire('Deleted!', 'Removed successfully.', 'success')
        } catch (error) { MySwal.fire('Error', 'Failed', 'error') }
      }
    }
  }

  const handleClearAll = async () => {
    // ... (Keep existing implementation logic if needed, omitted for brevity as bulk delete covers most)
    // Kept simplified for this update to focus on UI
    handleBulkDelete()
  }

  const handleClearPreview = useCallback(() => {
    setPreviewUrl(null)
    setFileType("")
    setSelectedPerson(null)
    setExpandedId(null)
    if (editingCandidate) setEditingCandidate(null)
  }, [editingCandidate])

  // --- HELPER: SMART FETCH (Batches of 50) ---
  const fetchAllForAction = async () => {
    try {
      const BATCH_SIZE = 50; // Safe size that won't crash the server
      
      // 1. Get the first page to see how many items exist total
      const firstRes = await axios.get(`${API_URL}/candidates`, {
        params: { page: 1, limit: BATCH_SIZE, search: searchTerm }
      })

      let allData = firstRes.data.data || [];
      const totalItems = firstRes.data.total;
      const totalPages = Math.ceil(totalItems / BATCH_SIZE);

      // 2. If there are more pages, fetch them all in parallel
      if (totalPages > 1) {
        Toast.fire({ 
          icon: 'info', 
          title: 'Downloading...', 
          text: `Fetching ${totalItems} items in batches...` 
        });

        const promises = [];
        for (let p = 2; p <= totalPages; p++) {
          promises.push(
            axios.get(`${API_URL}/candidates`, {
              params: { page: p, limit: BATCH_SIZE, search: searchTerm }
            })
          );
        }

        const responses = await Promise.all(promises);
        responses.forEach(res => {
          if (res.data.data) {
            allData = [...allData, ...res.data.data];
          }
        });
      }

      console.log(`Successfully fetched ${allData.length} items`);
      return allData;

    } catch (error) {
      console.error("Smart Fetch Error:", error);
      Toast.fire({ icon: 'error', title: 'Export Failed', text: 'Server rejected the request.' });
      return [];
    }
  }

  const handleExport = async () => {
    // 1. Fetch Data
    Toast.fire({ icon: 'info', title: 'Downloading...', text: 'Please wait.' })

    const allData = await fetchAllForAction()

    // 2. Safety Check
    if (!allData || allData.length === 0) {
      // If you see this, check the Browser Console (F12) for the red error details
      console.log("Export stopped: No data received from API")
      return
    }

    // 3. Filter (if specific items selected) or Use All
    let finalData = []
    if (selectedIds.length > 0) {
      finalData = allData.filter(c => selectedIds.includes(c._id))
    } else {
      finalData = allData
    }

    // 4. Double Check before exporting
    if (finalData.length === 0) {
      Toast.fire({ icon: 'warning', title: 'Selection Error', text: 'Selected items not found in full list.' })
      return
    }

    // 5. Create Excel
    const data = finalData.map(c => ({
      Name: c.Name,
      Position: c.Position || "N/A",
      Gender: c.Gender,
      Phone: c.Tel,
      Birth: formatDOB(c.BirthDate),
      Location: c.Location,
      School: c.School,
      Experience: c.Experience
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Candidates")
    XLSX.writeFile(wb, `CV_Export.xlsx`)

    Toast.fire({ icon: 'success', title: 'Success', text: `Exported ${finalData.length} records.` })
  }

  const toggleLock = useCallback(async (person, e) => {
    e.stopPropagation()
    try {
      await axios.put(`${API_URL}/candidates/${person._id}/lock`, { locked: !person.locked })
      fetchCandidates(currentPage) // <--- Pass currentPage here
    } catch (error) { alert("Failed") }
  }, [currentPage]) // Add currentPage to dependency array

  const startEditing = useCallback((person, e) => {
    e.stopPropagation()
    setEditingCandidate({ ...person })
    loadPdfIntoView(person)
  }, [])

  const handleEditChange = (e) => {
    const { name, value } = e.target
    setEditingCandidate({ ...editingCandidate, [name]: value })
  }

  const saveEdit = async () => {
    try {
      await axios.put(`${API_URL}/candidates/${editingCandidate._id}`, editingCandidate)
      setEditingCandidate(null)

      // CHANGE THIS LINE: Pass 'currentPage' to stay on the same page
      fetchCandidates(currentPage)

    } catch (error) { alert("Failed to save") }
  }

  // --- COPY FUNCTIONS ---
  const formatCandidateText = (candidatesList) => {
    return candidatesList.map(p =>
      `Name: ${p.Name}\nPosition: ${p.Position || 'N/A'}\nGender: ${p.Gender || 'N/A'}\nDOB: ${p.BirthDate || 'N/A'}\nPhone: ${p.Tel}\nAddress: ${p.Location}\nEducation: ${p.School}\nExperience: ${p.Experience}`
    ).join('\n\n---\n\n')
  }

  const handleCopy = useCallback((person, e) => {
    if (e) e.stopPropagation()
    if (!person) return
    const text = formatCandidateText([person])
    navigator.clipboard.writeText(text)
    setCopiedId(person._id)
    setTimeout(() => setCopiedId(null), 2000)
    Toast.fire({ icon: 'success', title: 'Copied' })
  }, [])

  const handleBulkCopy = async (mode) => {
    let candidatesToCopy = []

    if (mode === 'selected') {
      // Copy only selected items
      candidatesToCopy = processedCandidates.filter(c => selectedIds.includes(c._id))
    } else {
      // Copy ALL items from Database
      Toast.fire({ icon: 'info', title: 'Copying All...', text: 'Fetching full dataset...' })
      candidatesToCopy = await fetchAllForAction()
    }

    if (!candidatesToCopy || candidatesToCopy.length === 0) {
      Toast.fire({ icon: 'warning', title: 'Nothing to copy' })
      return
    }

    navigator.clipboard.writeText(formatCandidateText(candidatesToCopy))
    Toast.fire({ icon: 'success', title: `Copied ${candidatesToCopy.length} items to clipboard` })

    if (mode === 'selected') clearSelection()
  }

  const formatDateForInput = (dateString) => {
    if (!dateString) return ""
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return ""
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // --- RENDER ---
  return (
    <div
      // GLOBAL DRAG HANDLERS AT ROOT
      onDragOver={handleGlobalDragOver}
      onDragLeave={handleGlobalDragLeave}
      onDrop={handleGlobalDrop}
      className="flex flex-col h-screen bg-white text-black font-sans selection:bg-black selection:text-white overflow-hidden select-none relative"
    >

      {/* GLOBAL DRAG OVERLAY */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-100 backdrop-blur-xs flex flex-col items-center justify-center pointer-events-none"
          >
            <FaCloudUploadAlt className="text-6xl text-blue-500 mb-4 animate-bounce" />
            <p className="text-2xl font-bold text-blue-600 uppercase tracking-widest">Drop Files Here</p>
          </motion.div>
        )}
      </AnimatePresence>

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
          <StatsPanel stats={stats} loading={loading} />
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
            {loading ? (
              // --- SKELETON LOADING STATE ---
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <SkeletonLoader key={i} />
                ))}
              </div>
            ) : (
              // --- FRAMER MOTION LIST ---
              <AnimatePresence mode='popLayout'>
                {processedCandidates.length > 0 ? (
                  processedCandidates.map((person) => (
                    <motion.div
                      key={person._id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                    >
                      <CandidateCard
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
                        handleRetry={handleRetry}
                      />
                    </motion.div>
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-center py-10 text-zinc-400 text-xs"
                  >
                    No candidates found.
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>

          {/* PAGINATION */}
          <div className="flex-none p-4 border-t border-zinc-200 bg-zinc-50 flex justify-between items-center z-10">
            <button
              onClick={() => fetchCandidates(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              className="px-4 py-2 bg-white border border-zinc-300 rounded text-xs font-bold uppercase hover:bg-zinc-100 disabled:opacity-50 transition"
            >
              &larr; Prev
            </button>
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-black">Page {currentPage} of {totalPages}</span>
              <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">{totalItems} Candidates</span>
            </div>
            <button
              onClick={() => fetchCandidates(currentPage + 1)}
              disabled={currentPage === totalPages || loading}
              className="px-4 py-2 bg-black text-white border border-black rounded text-xs font-bold uppercase hover:bg-zinc-800 disabled:opacity-50 transition"
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
                <a href={`tel:${selectedPerson.Tel}`} className="flex-1 py-3 bg-zinc-100 border border-zinc-200 rounded text-center flex justify-center items-center">
                  <FaPhoneAlt className="text-zinc-600" />
                </a>
                <button onClick={() => handleCopy(selectedPerson)} className="flex-2 py-3 bg-black text-white rounded font-bold uppercase text-xs shadow-lg">
                  {copiedId === selectedPerson._id ? "COPIED!" : "COPY DATA"}
                </button>
                <button onClick={(e) => startEditing(selectedPerson, e)} className="flex-1 py-3 bg-zinc-100 border border-zinc-200 rounded text-center flex justify-center items-center">
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
              className="h-[60%] bg-white rounded-t-2xl shadow-2xl flex flex-col overflow-hidden border-t border-zinc-200 mt-auto"
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

// ==================== SKELETON LOADER COMPONENT ====================
const SkeletonLoader = () => {
  return (
    <div className="p-3 rounded border border-zinc-100 bg-white">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2.5 w-full">
          <div className="w-8 h-8 rounded bg-zinc-200 animate-pulse flex-none"></div>
          <div className="flex-1 space-y-1.5 overflow-hidden">
            <div className="h-3 bg-zinc-200 rounded w-1/3 animate-pulse"></div>
            <div className="h-2 bg-zinc-100 rounded w-1/2 animate-pulse"></div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        <div className="h-2 bg-zinc-100 rounded animate-pulse"></div>
        <div className="h-2 bg-zinc-100 rounded animate-pulse"></div>
        <div className="h-2 bg-zinc-100 rounded animate-pulse"></div>
      </div>
    </div>
  )
}

// ==================== COMPACT NAVBAR ====================
const Navbar = ({ handleExport, selectedCount, selectMode, deferredPrompt, handleInstallClick }) => {
  return (
    <nav className="flex-none border-b border-zinc-200 px-4 h-12 flex items-center justify-between z-20 bg-white shadow-sm">
      <div className="flex items-center gap-2">
        <div className="bg-black text-white p-1.5 rounded cursor-pointer"><FaRobot size={14} /></div>
        <span className="font-bold text-lg tracking-tight">CV<span className="text-zinc-400">Tracker</span></span>
      </div>
      <div className="flex items-center gap-3">
        {deferredPrompt && (
          <button onClick={handleInstallClick} className="flex items-center gap-2 px-2 py-1 bg-blue-600 text-white rounded text-xs font-bold uppercase hover:bg-blue-700 transition animate-pulse">
            <FaDownload /> Install
          </button>
        )}
        <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1 border border-zinc-200 rounded font-bold text-xs hover:bg-black hover:text-white transition uppercase">
          <FaFileExcel /> Export {selectedCount > 0 ? `(${selectedCount})` : ''}
        </button>
        <div className="text-xs font-bold text-black border border-zinc-200 px-2 py-1 rounded flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${selectMode ? 'bg-blue-500' : 'bg-green-500'} animate-pulse`}></span>
          {selectMode ? `${selectedCount} SELECTED` : 'ONLINE'}
        </div>
      </div>
    </nav>
  )
}

// ==================== STATS PANEL ====================
const StatsPanel = ({ stats, loading }) => {
  return (
    <div className="flex-none p-3 border-b border-zinc-100 grid grid-cols-3 gap-2 bg-zinc-50/50">
      <StatItem label="Candidates" val={stats.total} loading={loading} />
      <StatItem label="Top Region" val={stats.topLocation} loading={loading} />
      <StatItem label="Top School" val={stats.topSchool} loading={loading} />
    </div>
  )
}

const StatItem = ({ label, val, loading }) => (
  <div>
    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide">{label}</p>
    {loading ? (
      <div className="h-5 flex items-center">
        <span className="text-xl leading-none text-zinc-400 animate-pulse pb-2 tracking-widest">...</span>
      </div>
    ) : (
      <p className="text-sm font-semibold text-black truncate" title={val}>{val}</p>
    )}
  </div>
)

// ==================== CONTROL PANEL ====================
const ControlPanel = ({
  files, loading, status, searchTerm, sortOption, selectMode,
  selectedIds, processedCandidates, handleFileChange, handleUpload,
  handleClearFiles, setSearchTerm, setSortOption, setSelectMode,
  toggleSelectAll, handleExitMode, handleBulkDelete, handleBulkCopy
}) => {

  // NOTE: Drag events removed from here as they are now global in App component

  const pageIds = processedCandidates.filter(c => !c.locked).map(c => c._id)
  const isPageFullySelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id))

  return (
    <div className="relative flex-none p-3 space-y-2 border-b border-zinc-100 bg-white">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input id="fileInput" type="file" multiple onChange={handleFileChange} className="hidden" />
          <label htmlFor="fileInput" className="w-full h-8 flex justify-center items-center gap-2 bg-zinc-100 border border-transparent hover:border-black rounded text-xs font-bold uppercase cursor-pointer transition text-zinc-600 hover:text-black select-none">
            {files.length > 0 ? <><FaCheck /> {files.length} Files Ready</> : <><FaCloudUploadAlt /> Upload PDFs</>}
          </label>
        </div>
        {files.length > 0 && (
          <div className="flex gap-1">
            <button onClick={handleUpload} disabled={loading} className="px-4 h-8 bg-black text-white rounded text-xs font-bold uppercase hover:bg-zinc-800 transition disabled:opacity-50">
              {loading ? "..." : "Upload"}
            </button>
            <button onClick={handleClearFiles} className="px-2 h-8 bg-zinc-100 hover:bg-red-500 hover:text-white rounded text-zinc-500 transition">
              <FaTrash size={12} />
            </button>
          </div>
        )}
      </div>

      {status && <div className="text-xs text-center py-1 bg-zinc-50 rounded border border-zinc-200 text-zinc-500">{status}</div>}

      <div className="relative">
        <FaSearch className="absolute left-2.5 top-2.5 text-zinc-400" size={10} />
        <input
          type="text" placeholder="Search..."
          className="w-full pl-8 pr-20 h-8 bg-white border border-zinc-200 rounded text-xs font-medium focus:ring-1 focus:ring-black focus:border-black outline-none transition placeholder:text-zinc-400"
          value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="absolute right-1 top-1 bottom-1 px-1 bg-transparent text-xs font-bold text-zinc-500 outline-none cursor-pointer hover:text-black"
          value={sortOption} onChange={(e) => setSortOption(e.target.value)}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="nameAsc">Name (A-Z)</option>
          <option value="schoolAsc">School</option>
        </select>
      </div>

      <div className='grid grid-cols-2 gap-2 pt-1'>
        {selectMode ? (
          <button onClick={() => handleBulkCopy('selected')} disabled={selectedIds.length === 0} className="w-full h-8 bg-black text-white border border-black rounded text-xs font-bold uppercase hover:bg-zinc-800 transition disabled:opacity-50 flex items-center justify-center gap-1.5">
            <FaCopy size={10} /> Copy ({selectedIds.length})
          </button>
        ) : (
          <button onClick={() => handleBulkCopy('all')} disabled={processedCandidates.length === 0} className="w-full h-8 bg-white text-black border border-zinc-300 hover:border-black rounded text-xs font-bold uppercase hover:bg-zinc-50 transition flex items-center justify-center gap-1.5">
            <FaCopy size={10} /> Copy All
          </button>
        )}

        <div className="flex gap-1.5">
          <button onClick={selectMode ? handleExitMode : () => setSelectMode(true)} className={`h-8 text-xs font-bold uppercase rounded border transition flex items-center justify-center gap-1 ${selectMode ? 'w-8 bg-red-50 text-red-600 border-red-200 hover:border-red-500' : 'flex-1 bg-black text-white border-black hover:bg-zinc-800'}`} title={selectMode ? "Exit Selection" : "Select"}>
            {selectMode ? <FaTimes size={12} /> : 'Select'}
          </button>
          {selectMode && (
            <>
              <button onClick={toggleSelectAll} className="flex-1 h-8 px-2 text-xs font-bold uppercase rounded border border-zinc-200 hover:border-black transition truncate bg-white">
                {isPageFullySelected ? 'None' : 'All'}
              </button>
              <button onClick={handleBulkDelete} disabled={selectedIds.length === 0} className={`h-8 px-3 text-white text-xs font-bold uppercase rounded transition ${selectedIds.length > 0 ? 'bg-red-500 hover:bg-red-600' : 'bg-zinc-200 cursor-not-allowed'}`}>
                <FaTrash size={10} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== CANDIDATE CARD (MEMOIZED) ====================
// Wrapped in React.memo to prevent re-renders when other candidates change
const CandidateCard = memo(({
  person, expandedId, selectedIds, selectMode, copiedId,
  handleCardClick, toggleSelection, toggleLock, startEditing,
  handleDelete, handleCopy, handleOpenPdfMobile, handleRetry
}) => {
  const isExpanded = expandedId === person._id;
  const isSelected = selectedIds.includes(person._id);

  return (
    <div
      onClick={() => handleCardClick(person)}
      className={`
        group relative p-3 rounded border cursor-pointer overflow-hidden transform-gpu
        transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)]
        ${isExpanded
          ? 'bg-zinc-50 border-black ring-1 ring-black shadow-md z-10'
          : 'bg-white border-zinc-200 hover:border-zinc-400 hover:shadow-sm'
        }
        ${isSelected && selectMode ? 'ring-1 ring-blue-500 border-blue-500 bg-blue-50/10' : ''}
      `}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8">
            <button
              onClick={(e) => { e.stopPropagation(); toggleSelection(person._id); }}
              className={`absolute inset-0 w-full h-full flex items-center justify-center border rounded transition-all duration-300 transform
                ${selectMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50 pointer-events-none'}
                ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-zinc-300'}
              `}
            >
              <FaCheck size={12} className={`transition-transform duration-200 ${isSelected ? 'scale-100' : 'scale-0'}`} />
            </button>
            <div className={`absolute inset-0 w-full h-full flex items-center justify-center text-xs font-bold border rounded transition-all duration-300 transform
              ${!selectMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'}
              ${isExpanded ? 'bg-black text-white border-black' : 'bg-white text-black border-zinc-200'}
            `}>
              {person.Name.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-semibold text-black uppercase truncate leading-none transition-colors">{person.Name}</h3>
              {person.locked && <FaLock className="text-amber-500 shrink-0 animate-pulse" size={8} />}
            </div>
            {person.Position && person.Position !== "N/A" && (
              <p className="text-[10px] font-bold text-blue-600 truncate mt-0.5 uppercase">
                {person.Position}
              </p>
            )}
            <p className="text-xs text-zinc-500 font-medium truncate leading-tight mt-1">{person.School || "N/A"}</p>
          </div>
        </div>
        {!selectMode && (
          <div className={`flex gap-1 z-20 transition-all duration-300 ease-out ${isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none lg:pointer-events-auto lg:group-hover:opacity-100 lg:group-hover:translate-y-0'}`}>
            <button onClick={(e) => toggleLock(person, e)} className={`p-2 rounded transition-colors duration-200 border ${person.locked ? 'text-amber-600 border-amber-200 bg-amber-50' : 'text-zinc-400 hover:text-black bg-white border-zinc-100 hover:border-black'}`}>
              {person.locked ? <FaLock size={10} /> : <FaUnlock size={10} />}
            </button>
            <button onClick={(e) => startEditing(person, e)} className="p-2 text-zinc-400 hover:text-black bg-white border border-zinc-100 hover:border-black rounded transition-colors duration-200"><FaEdit size={10} /></button>
            <button onClick={(e) => handleDelete(person._id, person.Name, e)} className="p-2 text-zinc-400 hover:text-red-600 bg-white border border-zinc-100 hover:border-red-500 rounded transition-colors duration-200" disabled={person.locked}><FaTrash size={10} /></button>
            <button
              onClick={(e) => handleRetry(person, e)}
              title="Retry AI Parsing"
              className="hidden sm:block p-2 text-blue-400 hover:text-blue-600 bg-white border border-zinc-100 hover:border-blue-500 rounded transition-colors duration-200"
            >
              <FaSync size={10} />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs text-zinc-600">
          <span className="flex items-center gap-1.5 truncate"><FaPhoneAlt className="text-zinc-400 shrink-0" size={10} />{person.Tel}</span>
          <span className="flex items-center gap-1.5 truncate"><FaBirthdayCake className="text-zinc-400 shrink-0" size={10} />{formatDOB(person.BirthDate)}</span>
          <span className="flex items-center gap-1.5 truncate"><FaVenusMars className="text-zinc-400 shrink-0" size={10} />{person.Gender || 'N/A'}</span>
        </div>
        <div className="flex items-start gap-1.5 text-xs text-zinc-600">
          <FaMapMarkerAlt className="text-zinc-400 mt-0.5 shrink-0" size={10} />
          <span className="leading-tight line-clamp-1">{person.Location}</span>
        </div>
        <div className={`grid transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-2 border-t border-zinc-200 pt-2' : 'grid-rows-[0fr] opacity-0 mt-0 border-t-0 pt-0'}`}>
          <div className="overflow-hidden min-h-0">
            <div className="mb-2">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1">Experience</span>
              <p className="text-xs italic text-zinc-600 leading-relaxed bg-white p-2 border border-zinc-200 rounded max-h-32 overflow-y-auto custom-scrollbar">
                {person.Experience || "No experience listed."}
              </p>
            </div>
            <div className="flex gap-2 pb-1">
              <button onClick={(e) => handleOpenPdfMobile(e, person)} className="flex-1 lg:hidden h-8 bg-white text-black text-xs font-bold uppercase tracking-wider rounded border border-black flex items-center justify-center gap-2 hover:bg-zinc-100 transition-colors">
                <FaFilePdf size={12} /> View Doc
              </button>
              <button onClick={(e) => handleCopy(person, e)} className={`flex-2 h-8 px-3 text-xs font-bold uppercase tracking-wider rounded border transition-all duration-200 flex items-center justify-center gap-2 w-full ${copiedId === person._id ? 'bg-green-600 border-green-600 text-white scale-95' : 'bg-black border-black text-white hover:bg-zinc-800'}`}>
                {copiedId === person._id ? <><FaCheck size={12} /> Copied</> : <><FaCopy size={12} /> Copy Data</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// ==================== PDF VIEWER (MEMOIZED) ====================
const PDFViewer = memo(({
  previewUrl, fileType, zoom, setZoom,
  showMobilePreview, setShowMobilePreview, editingCandidate,
  onClear
}) => {
  return (
    <>
      <div className="flex-none bg-white border-b border-zinc-200 h-14 flex items-center justify-between px-4 shadow-sm z-10 select-none">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowMobilePreview(false)} className="lg:hidden p-2 -ml-2 text-black hover:bg-zinc-100 rounded transition"><FaArrowLeft /></button>
          <div className="flex items-center gap-2 text-sm font-bold text-black uppercase tracking-wide">
            <FaFilePdf className="text-zinc-400" size={12} /> Document Preview
          </div>
        </div>
        {previewUrl && (
          <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded p-1 select-none">
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} className="p-1 text-zinc-500 hover:text-black"><FaSearchMinus size={12} /></button>
            <span className="text-xs font-bold text-zinc-400 w-8 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(3.0, z + 0.2))} className="p-1 text-zinc-500 hover:text-black"><FaSearchPlus size={12} /></button>
            <div className="w-px h-3 bg-zinc-200 mx-1"></div>
            <button onClick={() => setZoom(1.0)} className="p-1 text-zinc-500 hover:text-black" title="Reset"><FaRedo size={12} /></button>
            <div className="hidden md:block w-px h-3 bg-zinc-200 mx-1"></div>
            <button onClick={onClear} className="hidden md:flex p-1 text-red-500 hover:bg-red-50 rounded transition" title="Close"><BsXLg size={16} /></button>
          </div>
        )}
      </div>
      <div className={`flex-1 overflow-auto p-4 lg:p-10 bg-zinc-100 transition-all duration-300 ${editingCandidate && window.innerWidth >= 1024 ? 'border-b border-zinc-300' : ''} ${editingCandidate && window.innerWidth < 1024 ? 'pb-[60vh]' : ''}`}>
        <div className="min-h-full flex justify-center items-start">
          {previewUrl ? (
            fileType.includes("pdf") ? (
              <div>
                <Document file={previewUrl} loading={<div className="flex flex-col items-center justify-center h-96 text-zinc-400"><FaSpinner className="animate-spin text-2xl mb-2 text-zinc-300" /><p className="text-xs tracking-wider">Loading...</p></div>} error={<div className="flex flex-col items-center justify-center h-96 text-red-400"><FaFilePdf className="text-4xl mb-2 opacity-50" /><p className="text-xs font-bold uppercase">Failed to load</p></div>}>
                  <Page pageNumber={1} width={(window.innerWidth < 768 ? window.innerWidth - 32 : 650) * zoom} renderTextLayer={false} renderAnnotationLayer={false} />
                </Document>
              </div>
            ) : (
              <img src={previewUrl} className="shadow-md rounded-lg border border-white object-contain" alt="CV" style={{ width: `${100 * zoom}%`, maxWidth: 'none' }} />
            )
          ) : (
            <div className="mt-20 flex flex-col items-center text-zinc-300 gap-4 select-none">
              <FaCopy size={48} className="opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest">Select a candidate</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
});

// ==================== EDIT FORM ====================
const EditForm = ({
  editingCandidate, setEditingCandidate, saveEdit,
  handleEditChange, formatDateForInput, isMobile
}) => {
  return (
    <>
      <div className="flex-none px-6 py-3 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
        <h2 className="font-bold text-black uppercase tracking-wide text-xs flex items-center gap-2">
          <FaEdit /> Editing: <span className="text-zinc-500">{editingCandidate.Name}</span>
        </h2>
        <div className="flex gap-2">
          {isMobile ? (
            <button onClick={() => setEditingCandidate(null)} className="p-2 -mr-2 text-zinc-400"><FaTimes /></button>
          ) : (
            <>
              <button onClick={() => setEditingCandidate(null)} className="px-3 py-1.5 text-xs font-bold uppercase text-zinc-500 hover:text-black border border-zinc-200 rounded bg-white">Cancel</button>
              <button onClick={saveEdit} className="px-4 py-1.5 text-xs font-bold uppercase text-white bg-black rounded hover:bg-zinc-800 flex items-center gap-1"><FaSave /> Save</button>
            </>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 bg-white">
        <div className="grid grid-cols-2 gap-4 max-w-4xl mx-auto">
          <SolidInput label="Full Name" name="Name" val={editingCandidate.Name} onChange={handleEditChange} />
          <SolidInput label="Applying For" name="Position" val={editingCandidate.Position} onChange={handleEditChange} />
          <SolidInput label="Phone" name="Tel" val={editingCandidate.Tel} onChange={handleEditChange} />
          <div className="col-span-1">
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Gender</label>
            <select name="Gender" value={editingCandidate.Gender || "N/A"} onChange={handleEditChange} className="w-full bg-white border border-zinc-300 p-2 text-sm font-semibold text-black focus:border-black focus:ring-1 focus:ring-black outline-none transition h-[38px]">
              <option value="N/A">N/A</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Birth Date <span className="text-[10px] font-normal text-zinc-400 normal-case ml-2 opacity-75">(MM-DD-YY)</span></label>
            <div className="flex gap-2">
              <input type="date" name="BirthDate" value={formatDateForInput(editingCandidate.BirthDate)} onChange={handleEditChange} className="flex-1 bg-white border border-zinc-300 p-2 text-sm font-semibold text-black focus:border-black focus:ring-1 focus:ring-black outline-none transition" />
              <button onClick={() => setEditingCandidate({ ...editingCandidate, Birth: "" })} className="px-3 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded text-xs font-bold text-zinc-600">Clear</button>
            </div>
          </div>
          <SolidInput label="Address" name="Location" val={editingCandidate.Location} onChange={handleEditChange} />
          <div className="col-span-1">
            <SolidInput label="School" name="School" val={editingCandidate.School} onChange={handleEditChange} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Experience</label>
            <textarea name="Experience" value={editingCandidate.Experience} onChange={handleEditChange} rows="5" className="w-full bg-white border border-zinc-300 p-2 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none transition" />
          </div>
        </div>
      </div>
      {isMobile && (
        <div className="p-4 border-t border-zinc-100">
          <button onClick={saveEdit} className="w-full py-3 text-sm bg-black text-white font-bold uppercase tracking-wider rounded">Save Changes</button>
        </div>
      )}
    </>
  )
}
const SolidInput = ({ label, name, val, onChange, type = "text" }) => (
  <div>
    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">{label}</label>
    <input type={type} name={name} value={val} onChange={onChange} className="w-full bg-white border border-zinc-300 p-2 text-sm font-semibold text-black focus:border-black focus:ring-1 focus:ring-black outline-none transition" />
  </div>
)