import { useState, useEffect, useCallback, memo } from 'react'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { Document, Page, pdfjs } from 'react-pdf'
import { motion, AnimatePresence } from 'framer-motion'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import Swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import {
  FaRobot, FaCloudUploadAlt, FaTrash, FaEdit, FaSave, FaFileExcel,
  FaSearch, FaPhoneAlt, FaMapMarkerAlt, FaBirthdayCake,
  FaCopy, FaCheck, FaArrowLeft, FaFilePdf,
  FaSearchMinus, FaSearchPlus, FaRedo, FaLock, FaUnlock, FaVenusMars, FaTimes,
  FaDownload, FaSpinner, FaSync, FaUserShield, FaSignOutAlt, FaSignInAlt, 
  FaUserFriends, FaUniversity, FaGlobeAsia, FaBriefcase, FaUserClock, FaChartLine, FaChevronDown
} from 'react-icons/fa'
import { BsXLg } from "react-icons/bs";

// pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// --- HELPER: DECODE TOKEN ---
const getUserFromToken = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub; // 'sub' holds the username in your Python JWT
  } catch (e) {
    return null;
  }
}

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
  const [currentUser, setCurrentUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)

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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // GLOBAL DRAG STATE
  const [isDragging, setIsDragging] = useState(false)

  // Mobile UI
  const [showMobilePreview, setShowMobilePreview] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState(null)

  // PWA State
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

  useEffect(() => { fetchCandidates(1) }, [])

  // --- INIT AUTH ---
  useEffect(() => {
    const token = localStorage.getItem("cv_token")
    if (token) {
      setIsAuthenticated(true)
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

      // NEW: Recover username from token on reload
      const username = getUserFromToken(token)
      if (username) setCurrentUser(username)
    }
    fetchCandidates(1)
  }, [])

  // --- AUTH HANDLERS ---
  const handleLoginSuccess = (token, username) => {
    localStorage.setItem("cv_token", token)
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    setIsAuthenticated(true)

    // NEW: Set the user immediately
    setCurrentUser(username)

    setShowLoginModal(false)
    Toast.fire({ icon: 'success', title: 'Login Successful' })
  }

  const handleLogout = () => {
    localStorage.removeItem("cv_token")
    delete axios.defaults.headers.common['Authorization']
    setIsAuthenticated(false)
    setCurrentUser(null) // <--- Clear it on logout
    Toast.fire({ icon: 'success', title: 'Logged out' })
  }

  const checkAuth = () => {
    if (!isAuthenticated) {
      setShowLoginModal(true)
      return false
    }
    return true
  }

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

  // --- AUTO-REFRESH LOGIC ---
  useEffect(() => {
    // Check if any visible candidate is currently processing
    const hasProcessing = candidates.some(c => c.status === "Processing");

    if (hasProcessing) {
      console.log("Files are processing... polling for updates.");

      // Set up a timer to fetch data every 3 seconds
      const interval = setInterval(() => {
        // Use 'true' as a second arg to indicate this is a background refresh (optional)
        fetchCandidates(currentPage, searchTerm);
      }, 3000);

      // Cleanup the timer when component unmounts or processing finishes
      return () => clearInterval(interval);
    }
  }, [candidates, currentPage, searchTerm]); // Re-run whenever candidates list changes

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
        params: { page, limit: 20, search }
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
    total: totalItems,
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
    // 1. SECURITY: Check if user is logged in before starting
    if (!checkAuth()) return;

    if (files.length === 0) {
      Toast.fire({ icon: 'warning', title: 'Please select files first' })
      return
    }

    // 2. Start Inline Progress
    setIsUploading(true)
    setUploadProgress(0)
    setStatus("Uploading...")

    const formData = new FormData()
    for (let i = 0; i < files.length; i++) formData.append('files', files[i])

    try {
      // 3. Send Request (Token is automatically attached via axios defaults)
      const res = await axios.post(`${API_URL}/upload-cv`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const rawPercent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setUploadProgress(Math.min(rawPercent, 90))
        }
      })

      // 4. Server Responded
      setUploadProgress(100)
      setStatus("Finalizing...")

      // --- CALCULATE ESTIMATED TIME ---
      const count = res.data.details.length
      const secondsPerCv = 30
      const totalSeconds = count * secondsPerCv

      let timeMsg = ""
      if (totalSeconds < 60) {
        timeMsg = `~${totalSeconds} seconds`
      } else {
        const mins = Math.ceil(totalSeconds / 60)
        timeMsg = `~${mins} minute${mins > 1 ? 's' : ''}`
      }

      // 5. Success UI
      setTimeout(() => {
        setIsUploading(false)
        setStatus(`Done. ${count} uploaded.`)

        MySwal.fire({
          icon: 'success',
          title: 'Upload Complete',
          html: `
            <div style="font-size: 14px; color: #555;">
              <strong>${count}</strong> files are being processed in the background.<br/>
              <div style="margin-top: 8px; padding: 8px; background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; color: #b45309; font-weight: bold;">
                <i class="fas fa-clock"></i> Estimated time: ${timeMsg}
              </div>
            </div>
          `,
          timer: 6000,
          showConfirmButton: true,
          confirmButtonText: 'Got it',
          confirmButtonColor: '#000'
        })

        fetchCandidates()
        handleClearFiles()
      }, 1000)

    } catch (error) {
      console.error(error)
      setIsUploading(false)
      setStatus("Upload failed.")

      // 6. ERROR HANDLING: Check for expired session
      if (error.response && error.response.status === 401) {
        Toast.fire({ icon: 'error', title: 'Session Expired', text: 'Please login again.' })
        handleLogout() // Forces logout so user can sign in again
      } else {
        Toast.fire({ icon: 'error', title: 'Upload Failed' })
      }
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
    if (!checkAuth()) return;
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
  }, [isAuthenticated, showMobilePreview, editingCandidate])

  const handleBulkDelete = async () => {
    if (!checkAuth()) return;
    if (selectedIds.length === 0) return

    const result = await MySwal.fire({
      title: 'Bulk Delete',
      text: `Delete ${selectedIds.length} candidates?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, Delete'
    })

    if (result.isConfirmed) {
      try {
        // 1. Get the token
        const token = localStorage.getItem('token'); 

        // 2. Send request WITH headers
        await axios.post(
            `${API_URL}/candidates/bulk-delete`, 
            { candidate_ids: selectedIds }, 
            {
                headers: { Authorization: `Bearer ${token}` } // <--- The missing key
            }
        );

        fetchCandidates();
        clearSelection()
        MySwal.fire('Deleted!', 'Removed successfully.', 'success')
      } catch (error) {
        MySwal.fire('Error', 'Failed', 'error')
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
        currentUser={currentUser}
        isAuthenticated={isAuthenticated}
        setShowLoginModal={setShowLoginModal}
        handleLogout={handleLogout}
      />

      <main className="flex-1 flex overflow-hidden max-w-[1920px] mx-auto w-full relative">
        {/* LEFT PANEL */}
        <div className={`flex flex-col w-full lg:w-[500px] xl:w-[550px] border-r border-zinc-200 h-full transition-all duration-300 z-10 bg-white
          ${showMobilePreview ? 'hidden lg:flex' : 'flex'}
        `}>
          {/* <StatsPanel stats={stats} loading={loading} /> */}
          {/* <DashboardPanel candidates={candidates} loading={loading} /> */}
          {/* <WelcomePanel
            candidates={candidates}
            loading={loading}
            currentUser={currentUser}
            totalItems={totalItems}
          /> */}
          <StatusBar loading={loading} totalItems={totalItems} />
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
            handleExport={handleExport}
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
            isUploading={isUploading}
            uploadProgress={uploadProgress}
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
              <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">{candidates.length} Candidates</span>
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
      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onSuccess={handleLoginSuccess}
          API_URL={API_URL}
        />
      )}
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
const Navbar = ({ 
  deferredPrompt, handleInstallClick, isAuthenticated, 
  setShowLoginModal, handleLogout, currentUser 
}) => {
  
  const [showMenu, setShowMenu] = useState(false)
  const userInitial = (currentUser && currentUser.length > 0) ? currentUser.charAt(0).toUpperCase() : "?";

  return (
    <nav className="flex-none h-14 px-4 border-b border-zinc-100 bg-white flex items-center justify-between z-50 sticky top-0 select-none">
      
      {/* LEFT: LOGO + STACKED GREETING */}
      <div className="flex items-center gap-3">
      
        <img 
          src="/logo.svg" 
          alt="App Logo" 
          className="w-8 h-8 object-contain" 
        />

        <div className="flex flex-col justify-center">
          <span className="text-xs font-medium text-zinc-400 leading-none mb-0.5">Welcome Back,</span>
          <span className="text-xl font-bold text-black tracking-tight leading-none">{currentUser || "Guest"}.</span>
        </div>
      </div>

      {/* RIGHT: ACTIONS */}
      <div className="flex items-center gap-2">
        {deferredPrompt && (
          <button onClick={handleInstallClick} className="hidden md:flex items-center gap-2 px-3 py-1.5 text-blue-600 rounded-md text-[10px] font-bold uppercase hover:bg-blue-50 transition">
            <FaDownload size={10} /> App
          </button>
        )}

        {isAuthenticated ? (
          <div className="relative ml-2">
             <button onClick={() => setShowMenu(!showMenu)} onBlur={() => setTimeout(() => setShowMenu(false), 200)} className="flex items-center gap-1 outline-none group">
               <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-600 group-hover:bg-zinc-200 transition">{userInitial}</div>
               <FaChevronDown size={8} className="text-zinc-300 group-hover:text-zinc-500 transition" />
             </button>
             <AnimatePresence>
               {showMenu && (
                 <motion.div initial={{ opacity: 0, y: 5, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 5, scale: 0.95 }} transition={{ duration: 0.1 }} className="absolute right-0 top-10 w-40 bg-white rounded-lg shadow-xl border border-zinc-100 overflow-hidden z-50">
                    <div className="p-1">
                      <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition text-left"><FaSignOutAlt /> Sign Out</button>
                    </div>
                 </motion.div>
               )}
             </AnimatePresence>
          </div>
        ) : (
           <button onClick={() => setShowLoginModal(true)} className="ml-2 px-4 py-1.5 bg-black text-white rounded text-[10px] font-bold uppercase hover:bg-zinc-800 transition">Login</button>
        )}
      </div>
    </nav>
  )
}

const StatusBar = ({ loading, totalItems }) => {
  
  // Format: "Wed, Oct 25"
  const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' }
  const today = new Date().toLocaleDateString('en-US', dateOptions)

  return (
    <div className="flex-none px-4 h-10 border-b border-zinc-100 bg-white flex items-center justify-between z-10 select-none">
      
      {/* LEFT: SUBTLE DATE */}
      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
        {today}
      </span>

      {/* RIGHT: CLEAN COUNT */}
      <div className="text-[10px]">
        <span className="font-bold text-zinc-400 uppercase tracking-wider mr-2">Candidates</span>
        <span className="font-bold text-black">{loading ? "..." : totalItems}</span>
      </div>

    </div>
  )
}

// ==================== STATS PANEL ====================
const StatsPanel = ({ stats, loading }) => {
  return (
    <div className="flex-none p-4 border-b border-zinc-200 bg-zinc-50">
      <div className="grid grid-cols-3 gap-3">

        {/* Total Candidates */}
        <div className="bg-white p-3 rounded-lg border border-zinc-200 shadow-sm flex flex-col justify-between h-20">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total</span>
            <FaUserFriends className="text-zinc-200" size={14} />
          </div>
          <p className="text-xl font-bold text-black truncate">
            {loading ? "..." : stats.total}
          </p>
        </div>

        {/* Top Region */}
        <div className="bg-white p-3 rounded-lg border border-zinc-200 shadow-sm flex flex-col justify-between h-20">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Region</span>
            <FaGlobeAsia className="text-zinc-200" size={14} />
          </div>
          <p className="text-xs font-bold text-black line-clamp-2 leading-tight">
            {loading ? "..." : stats.topLocation}
          </p>
        </div>

        {/* Top School */}
        <div className="bg-white p-3 rounded-lg border border-zinc-200 shadow-sm flex flex-col justify-between h-20">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">School</span>
            <FaUniversity className="text-zinc-200" size={14} />
          </div>
          <p className="text-xs font-bold text-black line-clamp-2 leading-tight">
            {loading ? "..." : stats.topSchool}
          </p>
        </div>

      </div>
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
  toggleSelectAll, handleExitMode, handleBulkDelete,
  isUploading, uploadProgress, isAuthenticated, handleExport
}) => {
  
  // Logic to check if all items on the current page are selected
  const pageIds = processedCandidates.filter(c => !c.locked).map(c => c._id)
  const isPageFullySelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id))

  return (
    <div className="relative flex-none p-3 space-y-3 border-b border-zinc-100 bg-white">
      
      {/* 1. TOP ROW: UPLOAD & EXPORT TOOLS */}
      <div className="flex gap-2 h-8">
        
        {/* A. File Input (The big button) */}
        <div className="relative flex-1 h-full">
          <input 
            id="fileInput" 
            type="file" 
            multiple 
            onChange={handleFileChange} 
            className="hidden" 
            disabled={isUploading} 
          />
          <label 
            htmlFor="fileInput" 
            className={`w-full h-full flex justify-center items-center gap-2 border border-transparent rounded text-xs font-bold uppercase transition select-none 
              ${isUploading 
                ? 'opacity-50 cursor-not-allowed bg-zinc-100' 
                : 'hover:border-black cursor-pointer bg-zinc-100 text-zinc-600 hover:text-black'
              }`}
          >
            {files.length > 0 
              ? <><FaCheck /> {files.length} Ready</> 
              : <><FaCloudUploadAlt /> Upload PDFs</>
            }
          </label>
        </div>

        {/* B. Upload Actions (Visible only when files are selected) */}
        {files.length > 0 && !isUploading && (
          <>
            <button 
              onClick={handleUpload} 
              className="px-4 bg-black text-white rounded text-xs font-bold uppercase hover:bg-zinc-800 transition"
            >
              Start
            </button>
            <button 
              onClick={handleClearFiles} 
              className="px-3 bg-zinc-100 hover:bg-red-500 hover:text-white rounded text-zinc-500 transition"
            >
              <FaTrash size={12} />
            </button>
          </>
        )}

        {/* C. Export Button (Always visible for quick access) */}
        <button 
          onClick={handleExport} 
          title={selectedIds.length > 0 ? `Export ${selectedIds.length} Selected` : "Export All"}
          className={`px-3 h-full border rounded transition flex items-center justify-center gap-2
            ${selectedIds.length > 0 
              ? 'bg-white text-black border-zinc-100'  // Active Style (Black)
              : 'bg-white border-zinc-200 text-green-700 hover:border-black' // Default Style (White)
            }`}
        >
          <FaFileExcel className='text-green-700' size={14} />
          {selectedIds.length > 0 && (
             <span className="text-xs font-medium">({selectedIds.length})</span>
          )}
        </button>
      </div>

      {/* 2. PROGRESS BAR (Animated) */}
      <AnimatePresence>
        {isUploading && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: "auto", opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }} 
            className="overflow-hidden"
          >
            <div className="bg-zinc-50 border border-zinc-200 rounded p-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">
                  {uploadProgress < 90 ? 'Uploading...' : 'Finalizing...'}
                </span>
                <span className="text-[10px] font-bold text-black">{uploadProgress}%</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-200 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }} 
                  animate={{ width: `${uploadProgress}%` }} 
                  transition={{ ease: "easeOut", duration: 0.3 }} 
                  className={`h-full rounded-full ${uploadProgress >= 90 ? 'bg-green-500 animate-pulse' : 'bg-green-500'}`} 
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. SEARCH & SORT BAR */}
      <div className="relative">
        <FaSearch className="absolute left-2.5 top-2.5 text-zinc-400" size={10} />
        <input 
          type="text" 
          placeholder="Search candidates..." 
          className="w-full pl-8 pr-20 h-8 bg-white border border-zinc-200 rounded text-xs font-medium focus:ring-1 focus:ring-black outline-none transition placeholder:text-zinc-400" 
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
        </select>
      </div>

      {/* 4. BOTTOM ACTION ROW (Select & Bulk Operations) */}
      <div className='grid grid-cols-2 gap-2 pt-1'>
        
        {/* Copy All Button */}
        <button className="w-full h-8 bg-white text-black border border-zinc-300 rounded text-xs font-bold uppercase hover:bg-zinc-50 transition flex items-center justify-center gap-1.5">
           <FaCopy size={10} /> Copy All
        </button>
        
        {/* Selection Tools */}
        <div className="flex gap-1.5">
          {/* Toggle Select Mode */}
          <button 
            onClick={selectMode ? handleExitMode : () => setSelectMode(true)} 
            className={`h-8 text-xs font-bold uppercase rounded border transition flex items-center justify-center gap-1 
              ${selectMode 
                ? 'w-8 bg-red-50 text-red-600 border-red-200' 
                : 'flex-1 bg-black text-white border-black hover:bg-zinc-800'
              }`}
          >
            {selectMode ? <FaTimes size={12} /> : 'Select'}
          </button>
          
          {/* Active Selection Buttons */}
          {selectMode && (
            <>
              <button 
                onClick={toggleSelectAll} 
                className="flex-1 h-8 px-2 text-xs font-bold uppercase rounded border border-zinc-200 hover:border-black transition truncate bg-white"
              >
                {isPageFullySelected ? 'None' : 'All'}
              </button>
              
              <button 
                onClick={handleBulkDelete} 
                disabled={selectedIds.length === 0 || !isAuthenticated} 
                title={!isAuthenticated ? "Login required" : "Delete Selected"}
                className={`h-8 px-3 text-white text-xs font-bold uppercase rounded transition 
                  ${selectedIds.length > 0 && isAuthenticated 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-zinc-200 cursor-not-allowed'
                  }`}
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

// ==================== CANDIDATE CARD (MEMOIZED) ====================
const CandidateCard = memo(({
  person, expandedId, selectedIds, selectMode, copiedId,
  handleCardClick, toggleSelection, toggleLock, startEditing,
  handleDelete, handleCopy, handleOpenPdfMobile, handleRetry
}) => {
  const isExpanded = expandedId === person._id;
  const isSelected = selectedIds.includes(person._id);

  // CHECK PROCESSING STATUS
  const isProcessing = person.status === "Processing";

  return (
    <div
      onClick={() => !isProcessing && handleCardClick(person)} // Disable expand if processing
      className={`
        group relative p-3 rounded border cursor-pointer overflow-hidden transform-gpu
        transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)]
        ${isProcessing ? 'bg-zinc-50 opacity-90 border-zinc-100 cursor-wait' :
          isExpanded
            ? 'bg-zinc-50 border-black ring-1 ring-black shadow-md z-10'
            : 'bg-white border-zinc-200 hover:border-zinc-400 hover:shadow-sm'
        }
        ${isSelected && selectMode ? 'ring-1 ring-blue-500 border-blue-500 bg-blue-50/10' : ''}
      `}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2.5 w-full">
          {/* AVATAR / SPINNER BOX */}
          <div className="relative w-8 h-8 flex-none">
            <button
              onClick={(e) => { e.stopPropagation(); toggleSelection(person._id); }}
              disabled={isProcessing}
              className={`absolute inset-0 w-full h-full flex items-center justify-center border rounded transition-all duration-300 transform
                ${selectMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50 pointer-events-none'}
                ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-zinc-300'}
                ${isProcessing ? 'cursor-not-allowed opacity-50' : ''}
              `}
            >
              <FaCheck size={12} className={`transition-transform duration-200 ${isSelected ? 'scale-100' : 'scale-0'}`} />
            </button>

            {/* The Initial or Spinner */}
            <div className={`absolute inset-0 w-full h-full flex items-center justify-center text-xs font-bold border rounded transition-all duration-300 transform
              ${!selectMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'}
              ${isExpanded ? 'bg-black text-white border-black' : 'bg-white text-black border-zinc-200'}
              ${isProcessing ? 'border-green-200 bg-green-50 text-green-600' : ''}
            `}>
              {isProcessing ? <FaSpinner className="animate-spin" size={12} /> : person.Name.charAt(0).toUpperCase()}
            </div>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="overflow-hidden flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {isProcessing ? (
                // --- GREEN INSTALLATION DESIGN ---
                <div className="w-full pr-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Installing Data...</span>
                    <span className="text-[10px] font-bold text-green-600 animate-pulse">Wait</span>
                  </div>
                  <div className="h-1.5 w-full bg-green-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full animate-pulse w-full origin-left"></div>
                  </div>
                </div>
              ) : (
                // --- NORMAL NAME DISPLAY ---
                <>
                  <h3 className="text-xs font-semibold text-black uppercase truncate leading-none transition-colors">{person.Name}</h3>
                  {person.locked && <FaLock className="text-amber-500 shrink-0 animate-pulse" size={8} />}
                </>
              )}
            </div>

            {/* HIDE POSITION IF PROCESSING */}
            {!isProcessing && person.Position && person.Position !== "N/A" && (
              <p className="text-[10px] font-bold text-blue-600 truncate mt-0.5 uppercase">
                {person.Position}
              </p>
            )}

            {/* SUBTITLE */}
            <p className="text-xs text-zinc-500 font-medium truncate leading-tight mt-1">
              {isProcessing ? "AI is reading document..." : (person.School || "N/A")}
            </p>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        {!selectMode && (
          <div className={`flex gap-1 z-20 transition-all duration-300 ease-out pl-2 ${isExpanded || isProcessing ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none lg:pointer-events-auto lg:group-hover:opacity-100 lg:group-hover:translate-y-0'}`}>

            {/* Disable Lock/Edit if processing */}
            <button disabled={isProcessing} onClick={(e) => toggleLock(person, e)} className={`p-2 rounded transition-colors duration-200 border ${person.locked ? 'text-amber-600 border-amber-200 bg-amber-50' : 'text-zinc-400 hover:text-black bg-white border-zinc-100 hover:border-black'} ${isProcessing ? 'opacity-30 cursor-not-allowed' : ''}`}>
              {person.locked ? <FaLock size={10} /> : <FaUnlock size={10} />}
            </button>

            <button disabled={isProcessing} onClick={(e) => startEditing(person, e)} className={`p-2 text-zinc-400 hover:text-black bg-white border border-zinc-100 hover:border-black rounded transition-colors duration-200 ${isProcessing ? 'opacity-30 cursor-not-allowed' : ''}`}>
              <FaEdit size={10} />
            </button>

            {/* Allow Deleting "Processing" items in case they get stuck */}
            <button onClick={(e) => handleDelete(person._id, person.Name, e)} className="p-2 text-zinc-400 hover:text-red-600 bg-white border border-zinc-100 hover:border-red-500 rounded transition-colors duration-200" disabled={person.locked}>
              <FaTrash size={10} />
            </button>

            {/* Retry Button - Useful if it gets stuck on processing */}
            <button
              onClick={(e) => handleRetry(person, e)}
              title="Retry AI Parsing"
              disabled={isProcessing}
              className={`p-2 text-blue-400 hover:text-blue-600 bg-white border border-zinc-100 hover:border-blue-500 rounded transition-colors duration-200 ${isProcessing ? 'animate-pulse opacity-50 cursor-wait' : ''}`}
            >
              <FaSync size={10} className={isProcessing ? "animate-spin" : ""} />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs text-zinc-600">
          <span className="flex items-center gap-1.5 truncate"><FaPhoneAlt className="text-zinc-400 shrink-0" size={10} />{isProcessing ? "..." : person.Tel}</span>
          <span className="flex items-center gap-1.5 truncate"><FaBirthdayCake className="text-zinc-400 shrink-0" size={10} />{isProcessing ? "..." : formatDOB(person.BirthDate)}</span>
          <span className="flex items-center gap-1.5 truncate"><FaVenusMars className="text-zinc-400 shrink-0" size={10} />{isProcessing ? "..." : (person.Gender || 'N/A')}</span>
        </div>
        <div className="flex items-start gap-1.5 text-xs text-zinc-600">
          <FaMapMarkerAlt className="text-zinc-400 mt-0.5 shrink-0" size={10} />
          <span className="leading-tight line-clamp-1">{isProcessing ? "Analyzing location..." : person.Location}</span>
        </div>

        {/* EXPANDED CONTENT - Only show if NOT processing */}
        <div className={`grid transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] ${(isExpanded && !isProcessing) ? 'grid-rows-[1fr] opacity-100 mt-2 border-t border-zinc-200 pt-2' : 'grid-rows-[0fr] opacity-0 mt-0 border-t-0 pt-0'}`}>
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
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Birth Date <span className="text-[10px] font-normal text-zinc-400 normal-case ml-2 opacity-75">(MM-DD-YY)</span></label>
            <div className="flex gap-2">
              <input type="date" name="BirthDate" value={formatDateForInput(editingCandidate.BirthDate)} onChange={handleEditChange} className="flex-1 bg-white border border-zinc-300 p-2 text-sm font-semibold text-black focus:border-black focus:ring-1 focus:ring-black outline-none transition" />
              <button onClick={() => setEditingCandidate({ ...editingCandidate, Birth: "" })} className="px-3 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded text-xs font-bold text-zinc-600">Clear</button>
            </div>
          </div>
          <div className="col-span-1">
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Gender</label>
            <select name="Gender" value={editingCandidate.Gender || "N/A"} onChange={handleEditChange} className="w-full bg-white border border-zinc-300 p-2 text-sm font-semibold text-black focus:border-black focus:ring-1 focus:ring-black outline-none transition h-[38px]">
              <option value="N/A">N/A</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <SolidInput label="Address" name="Location" val={editingCandidate.Location} onChange={handleEditChange} />
          <div className="col-span-2">
            <SolidInput label="Education" name="School" val={editingCandidate.School} onChange={handleEditChange} />
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

// ==================== NEW: LOGIN MODAL COMPONENT ====================
const LoginModal = ({ onClose, onSuccess, API_URL }) => {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError("")
    try {
      const formData = new FormData()
      formData.append('username', username)
      formData.append('password', password)

      const res = await axios.post(`${API_URL}/token`, formData)
      onSuccess(res.data.access_token)
    } catch (err) {
      setError("Invalid username or password")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-999 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden"
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2"><FaUserShield /> Admin Login</h2>
            <button onClick={onClose}><BsXLg /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} className="w-full border p-2 rounded" autoFocus />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border p-2 rounded" />
            {error && <p className="text-red-500 font-bold text-xs">{error}</p>}
            <button disabled={loading} className="w-full bg-black text-white font-bold py-2 rounded uppercase text-sm">
              {loading ? "Verifying..." : "Login"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}