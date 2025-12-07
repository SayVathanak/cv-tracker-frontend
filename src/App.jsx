import { useState, useEffect, useCallback, memo } from 'react'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { Document, Page, pdfjs } from 'react-pdf'
import { motion, AnimatePresence } from 'framer-motion'
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import Swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'
import SettingsPage from './components/Settings'
import CreditBadge from './components/CreditBadge'

import {
  FaRobot, FaCloudUploadAlt, FaTrash, FaEdit, FaSave, FaFileExcel,
  FaSearch, FaPhoneAlt, FaMapMarkerAlt, FaBirthdayCake,
  FaCopy, FaCheck, FaArrowLeft, FaFilePdf,
  FaSearchMinus, FaSearchPlus, FaRedo, FaLock, FaUnlock, FaVenusMars, FaTimes,
  FaDownload, FaSpinner, FaSync, FaUserShield, FaSignOutAlt,
  FaUniversity, FaGlobeAsia, FaBriefcase, FaUser,
  FaChevronDown, FaCog, FaEye, FaEyeSlash, FaBars
} from 'react-icons/fa'
import { BsXLg } from "react-icons/bs";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// --- HELPER: DECODE TOKEN ---
const getUserFromToken = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub;
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
  const [batchStats, setBatchStats] = useState({ total: 0, processed: 0, active: false });
  const [filters, setFilters] = useState({ location: "", position: "", education: "", gender: "" });
  const [showSettings, setShowSettings] = useState(false);
  const [appSettings, setAppSettings] = useState(() => {
    const saved = localStorage.getItem('cv_app_settings');
    const parsed = saved ? JSON.parse(saved) : {};

    const token = localStorage.getItem("cv_token");
    let currentSystemUser = "Guest";
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        currentSystemUser = payload.sub;
      } catch (e) { }
    }

    return {
      autoDelete: parsed.autoDelete || false,
      retention: parsed.retention || '30',
      exportFields: parsed.exportFields || {
        phone: true, dob: true, address: true,
        gender: true, education: true, experience: true
      },
      autoTags: parsed.autoTags || "",

      profile: {
        displayName: parsed.profile?.displayName || "",
        username: currentSystemUser,
        org: parsed.profile?.org || "My Company"
      }
    };
  });

  const [selectedIds, setSelectedIds] = useState([])
  const [selectMode, setSelectMode] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [editingCandidate, setEditingCandidate] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortOption, setSortOption] = useState("newest")
  const [zoom, setZoom] = useState(1.0)
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false)
  const [showMobilePreview, setShowMobilePreview] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [credits, setCredits] = useState(0);

  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

  useEffect(() => { fetchCandidates(1) }, [])

  const fetchCredits = async () => {
    try {
      const token = localStorage.getItem("cv_token");
      if (!token) return;

      const res = await axios.get(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCredits(res.data.current_credits);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchCredits();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("cv_token")
    if (token) {
      setIsAuthenticated(true)
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

      const username = getUserFromToken(token)
      if (username) setCurrentUser(username)

      fetchCandidates(1)
    }
  }, [])

  const processedCandidates = candidates
    .filter(person => {
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        const matchesName = person.Name.toLowerCase().includes(lowerSearch);
        const matchesTel = person.Tel.includes(searchTerm);
        if (!matchesName && !matchesTel) return false;
      }
      if (filters.location && person.Location !== filters.location) return false;
      if (filters.position && person.Position !== filters.position) return false;
      if (filters.education && person.School !== filters.education) return false;
      if (filters.gender && person.Gender !== filters.gender) return false;

      return true;
    })
    .sort((a, b) => {
      if (sortOption === "nameAsc") return a.Name.localeCompare(b.Name)
      if (sortOption === "scoreDesc") return (b.Confidence || 0) - (a.Confidence || 0)
      if (sortOption === "newest") return b._id.localeCompare(a._id)
      return 0
    })

  const saveSettings = (newSettings) => {
    setAppSettings(newSettings);
    localStorage.setItem('cv_app_settings', JSON.stringify(newSettings));
    const Toast = Swal.mixin({
      toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true
    });
    Toast.fire({ icon: 'success', title: 'Settings Saved' });
    setShowSettings(false);
  };

  const MySwal = withReactContent(Swal)
  const Toast = Swal.mixin({
    toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer)
      toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
  })

  const handleLoginSuccess = (token, username) => {
    localStorage.setItem("cv_token", token)
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    setIsAuthenticated(true)
    setCurrentUser(username)
    setShowLoginModal(false)
    Toast.fire({ icon: 'success', title: 'Login Successful' })
  }

  const handleLogout = () => {
    localStorage.removeItem("cv_token")
    delete axios.defaults.headers.common['Authorization']
    setIsAuthenticated(false)
    setCurrentUser(null)
    Toast.fire({ icon: 'success', title: 'Logged out' })
  }

  const checkAuth = () => {
    if (!isAuthenticated) {
      setShowLoginModal(true)
      return false
    }
    return true
  }

  const handleGlobalDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleGlobalDragLeave = useCallback((e) => {
    e.preventDefault()
    if (!e.relatedTarget || e.relatedTarget.nodeName === "HTML") {
      setIsDragging(false)
    }
  }, [])

  const handleGlobalDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange({
        target: { files: null },
        dataTransfer: e.dataTransfer
      })
    }
  }, [])

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchCandidates(1, searchTerm)
    }, 500)
    return () => clearTimeout(delayDebounceFn)
  }, [searchTerm])

  useEffect(() => {
    const hasProcessing = candidates.some(c => c.status === "Processing");

    if (hasProcessing) {
      const interval = setInterval(() => {
        fetchCandidates(currentPage, searchTerm);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [candidates, currentPage, searchTerm]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') console.log('User accepted')
    setDeferredPrompt(null)
  }

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

  const toggleSelection = useCallback((id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }, [])

  const toggleSelectAll = useCallback(() => {
    const currentPageIds = processedCandidates
      .filter(c => !c.locked)
      .map(c => c._id)

    if (currentPageIds.length === 0) return

    const isPageSelected = currentPageIds.every(id => selectedIds.includes(id))

    if (isPageSelected) {
      setSelectedIds(prev => prev.filter(id => !currentPageIds.includes(id)))
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...currentPageIds])])
    }
  }, [processedCandidates, selectedIds])

  const handleExitMode = () => { setSelectedIds([]); setSelectMode(false) }
  const clearSelection = () => { setSelectedIds([]); setSelectMode(false) }

  const handleFileChange = (e) => {
    const incoming = e.target.files || (e.dataTransfer && e.dataTransfer.files)
    if (!incoming || incoming.length === 0) return

    const newFilesArray = Array.from(incoming)

    setFiles(prevFiles => {
      const existingNames = new Set(prevFiles.map(f => f.name))
      const uniqueFiles = newFilesArray.filter(f => !existingNames.has(f.name))

      if (uniqueFiles.length < newFilesArray.length) {
        Toast.fire({
          icon: 'warning',
          title: 'Duplicates Skipped',
          text: `${newFilesArray.length - uniqueFiles.length} file(s) are already in the list.`
        })
      }
      const updatedList = [...prevFiles, ...uniqueFiles]
      if (updatedList.length > 0) setFile(updatedList[0])
      return updatedList
    })
    if (e.target && e.target.value) e.target.value = ""
  }

  const handleClearFiles = () => {
    setFiles([])
    setFile(null)
    const input = document.getElementById('fileInput')
    if (input) input.value = ""
  }

  const handleUpload = async () => {
    if (!checkAuth()) return;
    if (files.length === 0) {
      Toast.fire({ icon: 'warning', title: 'Please select files first' })
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setStatus("Uploading...")

    const formData = new FormData()
    for (let i = 0; i < files.length; i++) formData.append('files', files[i])

    try {
      const res = await axios.post(`${API_URL}/upload-cv`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const rawPercent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setUploadProgress(Math.min(rawPercent, 90))
        }
      })

      setUploadProgress(100)
      setStatus("Finalizing...")
      fetchCredits();

      const count = res.data.details.length
      const secondsPerCv = 15
      const totalSeconds = count * secondsPerCv
      let timeMsg = totalSeconds < 60 ? `~${totalSeconds} seconds` : `~${Math.ceil(totalSeconds / 60)} minutes`

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
          showConfirmButton: true
        })
        fetchCandidates()
        handleClearFiles()
      }, 1000)

    } catch (error) {
      console.error(error)
      setIsUploading(false)
      setStatus("Upload failed.")
      if (error.response && error.response.status === 401) {
        Toast.fire({ icon: 'error', title: 'Session Expired', text: 'Please login again.' })
        handleLogout()
      } else {
        Toast.fire({ icon: 'error', title: 'Upload Failed' })
      }
    }
  }

  const handleCardClick = useCallback((person) => {
    if (selectMode) {
      toggleSelection(person._id)
      return
    }
    setExpandedId(prev => prev === person._id ? null : person._id)
    setSelectedPerson(person)
    if (window.innerWidth >= 1024) loadPdfIntoView(person)
  }, [selectMode, toggleSelection])

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

  const handleRetry = useCallback(async (person, e) => {
    e.stopPropagation()
    Toast.fire({ icon: 'info', title: 'Re-analyzing CV...' })
    try {
      const res = await axios.post(`${API_URL}/candidates/${person._id}/retry`)
      if (res.data.status === "success") {
        Toast.fire({ icon: 'success', title: 'Updated!' })
        fetchCandidates(currentPage)
        if (editingCandidate && editingCandidate._id === person._id) {
          setEditingCandidate(prev => ({ ...prev, ...res.data.data }))
        }
      } else {
        Toast.fire({ icon: 'error', title: 'Failed', text: res.data.message })
      }
    } catch (error) {
      Toast.fire({ icon: 'error', title: 'Server Error' })
    }
  }, [editingCandidate])

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
    if (selectedIds.length === 0) return;

    const result = await MySwal.fire({
      title: 'Bulk Delete',
      text: `Permanently delete ${selectedIds.length} candidates?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#000',
      confirmButtonText: 'Delete'
    });

    if (result.isConfirmed) {
      try {
        const response = await axios.post(`${API_URL}/candidates/bulk-delete`, {
          candidate_ids: selectedIds
        });
        if (response.data.status === "success") {
          fetchCandidates();
          clearSelection();
          Toast.fire({ icon: 'success', title: 'Deleted', text: response.data.message });
        } else {
          Toast.fire({ icon: 'error', title: 'Error', text: response.data.message });
        }
      } catch (error) {
        Toast.fire({ icon: 'error', title: 'Failed to delete' });
      }
    }
  }

  const handleClearPreview = useCallback(() => {
    setPreviewUrl(null)
    setFileType("")
    setSelectedPerson(null)
    setExpandedId(null)
    if (editingCandidate) setEditingCandidate(null)
  }, [editingCandidate])

  const fetchAllForAction = async () => {
    try {
      const BATCH_SIZE = 50;
      const firstRes = await axios.get(`${API_URL}/candidates`, {
        params: { page: 1, limit: BATCH_SIZE, search: searchTerm }
      })
      let allData = firstRes.data.data || [];
      const totalItems = firstRes.data.total;
      const totalPages = Math.ceil(totalItems / BATCH_SIZE);

      if (totalPages > 1) {
        Toast.fire({ icon: 'info', title: 'Downloading...', text: `Fetching ${totalItems} items...` });
        const promises = [];
        for (let p = 2; p <= totalPages; p++) {
          promises.push(axios.get(`${API_URL}/candidates`, { params: { page: p, limit: BATCH_SIZE, search: searchTerm } }));
        }
        const responses = await Promise.all(promises);
        responses.forEach(res => { if (res.data.data) allData = [...allData, ...res.data.data]; });
      }
      return allData;
    } catch (error) { return []; }
  }

  const handleExport = async () => {
    Toast.fire({ icon: 'info', title: 'Downloading...', text: 'Please wait.' })
    const allData = await fetchAllForAction()
    if (!allData || allData.length === 0) return

    let finalData = []
    if (selectedIds.length > 0) {
      finalData = allData.filter(c => selectedIds.includes(c._id))
    } else {
      finalData = allData
    }

    if (finalData.length === 0) {
      Toast.fire({ icon: 'warning', title: 'Selection Error', text: 'Items not found.' })
      return
    }

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
    setCandidates(prevList => prevList.map(c => c._id === person._id ? { ...c, locked: !c.locked } : c))
    try {
      await axios.put(`${API_URL}/candidates/${person._id}/lock`, { locked: !person.locked })
    } catch (error) {
      setCandidates(prevList => prevList.map(c => c._id === person._id ? { ...c, locked: person.locked } : c))
      Toast.fire({ icon: 'error', title: 'Lock failed' })
    }
  }, [])

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
      fetchCandidates(currentPage)
    } catch (error) { alert("Failed to save") }
  }

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
      candidatesToCopy = processedCandidates.filter(c => selectedIds.includes(c._id))
    } else {
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

  const stats = {
    total: totalItems,
    selected: selectedIds.length,
  }

  return (
    <div
      onDragOver={handleGlobalDragOver}
      onDragLeave={handleGlobalDragLeave}
      onDrop={handleGlobalDrop}
      className="flex flex-col h-screen bg-white text-black font-sans selection:bg-black selection:text-white overflow-hidden select-none relative"
    >
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
        currentUser={
          (appSettings.profile?.displayName && appSettings.profile.displayName.trim() !== "")
            ? appSettings.profile.displayName
            : currentUser
        }
        isAuthenticated={isAuthenticated}
        setShowLoginModal={setShowLoginModal}
        handleLogout={handleLogout}
        onOpenSettings={() => setShowSettings(true)}
        autoDeleteEnabled={appSettings.autoDelete}
        credits={credits}
      />

      <main className="flex-1 flex overflow-hidden max-w-[1920px] mx-auto w-full relative">
        <div className={`flex flex-col w-full lg:w-[500px] xl:w-[550px] border-r border-zinc-200 h-full transition-all duration-300 z-10 bg-white
          ${showMobilePreview ? 'hidden lg:flex' : 'flex'}
        `}>
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
            handleBulkCopy={handleBulkCopy}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            isAuthenticated={isAuthenticated}
            batchStats={batchStats}
          />

          <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24 scroll-smooth">
            {loading ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <SkeletonLoader key={i} />
                ))}
              </div>
            ) : (
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

        <div className={`flex-1 bg-zinc-100 relative flex flex-col h-full overflow-hidden
            ${showMobilePreview ? 'fixed inset-0 z-50 bg-white' : 'hidden lg:flex'}
        `}>
          <div className="absolute inset-0 z-0">
            <DashboardPanel stats={stats} candidates={candidates} />
          </div>

          <AnimatePresence>
            {(previewUrl || editingCandidate) && (
              <motion.div
                initial={{ x: "100%", opacity: 1 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "100%", opacity: 1 }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                className="absolute inset-0 z-10 bg-zinc-100 flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.1)]"
              >
                <div className={`flex-1 flex flex-col overflow-hidden ${editingCandidate ? 'h-1/2' : 'h-full'}`}>
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
                </div>

                {editingCandidate && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "50%" }}
                    exit={{ height: 0 }}
                    className="bg-white border-t-4 border-black flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-20"
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
              </motion.div>
            )}
          </AnimatePresence>

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

      {/* Settings Page with AnimatePresence handled internally in Settings.jsx, but wrapped here for conditional render */}
      {showSettings && (
        <SettingsPage
          onClose={() => setShowSettings(false)}
          initialSettings={appSettings}
          onSave={saveSettings}
          onPaymentSuccess={() => fetchCredits()}
          currentCredits={credits}
        />
      )}

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

// ==================== NAVBAR ====================
const Navbar = ({
  deferredPrompt, handleInstallClick, isAuthenticated, setShowLoginModal,
  handleLogout, currentUser, onOpenSettings, autoDeleteEnabled, credits
}) => {
  const [showMenu, setShowMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const userInitial = (currentUser && currentUser.length > 0) ? currentUser.charAt(0).toUpperCase() : "?"

  // --- MENU ANIMATIONS ---
  const menuVariants = {
    closed: {
      x: "100%",
      transition: { type: "spring", stiffness: 400, damping: 40 }
    },
    open: {
      x: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
        staggerChildren: 0.05, // Reduced from 0.07 (faster sequence)
        delayChildren: 0.05    // Reduced from 0.2 (starts almost immediately)
      }
    }
  };

  const itemVariants = {
    // Start slightly closer (20px instead of 50px) so the travel distance is shorter
    closed: { x: 20, opacity: 0 },
    open: { x: 0, opacity: 1, transition: { duration: 0.2 } }
  };

  return (
    <nav className="flex-none h-14 px-4 border-b border-zinc-100 bg-white flex items-center justify-between z-50 sticky top-0 select-none">
      <div className="flex items-center gap-2 lg:gap-3 min-w-0 flex-1">
        <img src="/logo.svg" alt="Logo" className="w-8 h-8 object-contain shrink-0" onError={(e) => { e.target.style.display = 'none' }} />
        <div className="flex flex-col justify-center min-w-0">
          <div className="flex items-center gap-1.5 lg:gap-2">
            <span className="text-xs text-zinc-400 leading-none mb-0.5">Welcome Back,</span>
            {isAuthenticated && autoDeleteEnabled && (
              <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 bg-green-50 border border-green-200 rounded text-[8px] lg:text-[9px] font-bold text-green-700 uppercase tracking-wide cursor-help shrink-0">
                <FaUserShield size={8} className="lg:w-[9px] lg:h-[9px]" />
                <span>Auto-Delete</span>
              </div>
            )}
          </div>
          <span className="text-xl font-bold text-black tracking-tight leading-none">{currentUser || "Guest"}.</span>
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-3 shrink-0">
        {deferredPrompt && (
          <button onClick={handleInstallClick} className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-blue-600 rounded-md text-[10px] font-bold uppercase hover:bg-blue-50 transition">
            <FaDownload size={10} /> Install App
          </button>
        )}

        {isAuthenticated ? (
          <>
            <div className="hidden md:flex items-center gap-3">
              <CreditBadge credits={credits} onClick={onOpenSettings} />
              <div className="relative">
                <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-1.5 outline-none group">
                  <div className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-600 group-hover:bg-zinc-200 group-hover:text-black transition">
                    {userInitial}
                  </div>
                  <FaChevronDown size={9} className="text-zinc-300 group-hover:text-zinc-500 transition" />
                </button>
                <AnimatePresence>
                  {showMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        className="absolute right-0 top-12 w-48 bg-white rounded-lg shadow-xl border border-zinc-100 overflow-hidden z-50 py-1"
                      >
                        <div className="px-4 py-2 border-b border-zinc-50">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase">Signed in as</p>
                          <p className="text-xs font-bold text-black truncate">{currentUser}</p>
                        </div>
                        <button onClick={() => { setShowMenu(false); onOpenSettings(); }} className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition text-left">
                          <FaCog className="text-zinc-400" /> Settings
                        </button>
                        <div className="h-px bg-zinc-100 my-1"></div>
                        <button onClick={() => { setShowMenu(false); handleLogout(); }} className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition text-left">
                          <FaSignOutAlt /> Sign Out
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <button onClick={() => setShowMobileMenu(true)} className="md:hidden p-2 text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200 rounded-lg transition">
              <FaBars size={18} />
            </button>

            <AnimatePresence>
              {showMobileMenu && (
                <>
                  {/* Overlay */}
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => setShowMobileMenu(false)}
                    className="md:hidden fixed inset-0 bg-black/30 z-50 will-change-opacity"
                  />
                  {/* Sliding Menu */}
                  <motion.div
                    variants={menuVariants}
                    initial="closed" animate="open" exit="closed"
                    className="md:hidden fixed top-0 right-0 bottom-0 w-full bg-white shadow-2xl z-60 flex flex-col will-change-transform"
                  >
                    <div className="h-20 flex items-end justify-between px-6 pb-4 border-b border-zinc-100 bg-zinc-50 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-sm font-bold shadow-sm">
                          {userInitial}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-black">{currentUser}</p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Free Plan</p>
                        </div>
                      </div>
                      <button onClick={() => setShowMobileMenu(false)} className="p-2 bg-white rounded-full shadow-sm text-zinc-400 hover:text-black">
                        <FaTimes size={14} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      <motion.div variants={itemVariants} className="p-4 bg-zinc-900 rounded-xl text-white mb-6 shadow-lg">
                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1">Available Credits</p>
                        <div className="flex justify-between items-end">
                          <span className="text-3xl font-bold">{credits}</span>
                          <button onClick={() => { setShowMobileMenu(false); onOpenSettings(); }} className="text-[10px] font-bold bg-white text-black px-2 py-1 rounded">ADD MORE</button>
                        </div>
                      </motion.div>

                      <button onClick={() => { setShowMobileMenu(false); onOpenSettings(); }} className="w-full flex items-center gap-4 px-4 py-3 text-sm font-bold text-zinc-700 hover:bg-zinc-50 rounded-xl transition">
                        <FaUser className="text-zinc-400" /> Account Settings
                      </button>

                      {deferredPrompt && (
                        <motion.button variants={itemVariants} onClick={() => { setShowMobileMenu(false); handleInstallClick(); }} className="w-full flex items-center gap-4 px-4 py-3 text-sm font-bold text-blue-600 bg-blue-50 rounded-xl transition">
                          <FaDownload /> Install App
                        </motion.button>
                      )}
                    </div>

                    <motion.div variants={itemVariants} className="p-6 border-t border-zinc-100">
                      <button onClick={() => { setShowMobileMenu(false); handleLogout(); }} className="w-full flex items-center justify-center gap-2 px-4 py-4 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 active:bg-red-200 rounded-xl transition">
                        <FaSignOutAlt /> Sign Out
                      </button>
                    </motion.div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </>
        ) : (
          <button onClick={() => setShowLoginModal(true)} className="px-3 lg:px-4 py-1.5 lg:py-2 bg-black text-white rounded text-[10px] lg:text-xs font-bold uppercase hover:bg-zinc-800 active:bg-zinc-900 transition">
            Login
          </button>
        )}
      </div>
    </nav>
  )
}

// ==================== REST OF THE HELPERS (UNCHANGED) ====================

const SkeletonLoader = () => (
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

const StatusBar = ({ loading, totalItems }) => {
  const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' }
  const today = new Date().toLocaleDateString('en-US', dateOptions)
  return (
    <div className="flex-none px-4 h-10 border-b border-zinc-100 bg-white flex items-center justify-between z-10 select-none">
      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{today}</span>
      <div className="text-[10px]">
        <span className="font-bold text-zinc-400 uppercase tracking-wider mr-2">Candidates</span>
        <span className="font-bold text-black">{loading ? "..." : totalItems}</span>
      </div>
    </div>
  )
}

const ControlPanel = ({
  files, loading, status, searchTerm, sortOption, selectMode, selectedIds, processedCandidates,
  handleFileChange, handleUpload, handleClearFiles, setSearchTerm, setSortOption, setSelectMode,
  toggleSelectAll, handleExitMode, handleBulkDelete, handleBulkCopy, isUploading, uploadProgress,
  isAuthenticated, handleExport
}) => {
  const pageIds = processedCandidates.filter(c => !c.locked).map(c => c._id);
  const isPageFullySelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));
  const isSelectionActive = selectedIds.length > 0;
  const onCopyClick = () => isSelectionActive ? handleBulkCopy('selected') : handleBulkCopy('all');

  return (
    <div className="relative flex-none p-3 space-y-3 border-b border-zinc-100 bg-white shadow-sm z-20">
      <div className="flex gap-2 h-9">
        <div className="relative flex-1 h-full">
          <input id="fileInput" type="file" multiple accept="application/pdf,image/jpeg,image/png" onChange={handleFileChange} className="hidden" disabled={isUploading} />
          <label htmlFor="fileInput" className={`w-full h-full flex justify-center items-center gap-2 border rounded text-xs font-bold transition select-none ${isUploading ? 'opacity-50 cursor-not-allowed bg-zinc-50 border-zinc-100 text-zinc-400' : 'border-zinc-200 cursor-pointer bg-zinc-50 text-zinc-600 hover:border-black hover:text-black hover:bg-white'}`}>
            {files.length > 0 ? <><FaCheck className="text-green-500" /> {files.length} File(s) Ready</> : <><FaCloudUploadAlt className="text-md" /> UPLOAD CV <span className='text-xs font-normal text-zinc-400'>( pdf/img )</span></>}
          </label>
        </div>
        {files.length > 0 && !isUploading && (
          <>
            <button onClick={handleUpload} className="px-5 bg-black text-white rounded text-xs font-medium uppercase hover:bg-zinc-800 transition shadow-sm">Start</button>
            <button onClick={handleClearFiles} className="px-3 bg-white border border-zinc-200 hover:border-red-300 hover:bg-red-50 hover:text-red-500 rounded text-zinc-500 transition"><FaTrash size={12} /></button>
          </>
        )}
        <button onClick={handleExport} title={isSelectionActive ? `Export ${selectedIds.length} Selected` : "Export All to Excel"} className={`px-4 w-28 h-full border rounded transition flex items-center justify-center gap-2 ${isSelectionActive ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-white border-zinc-200 text-zinc-600 hover:border-green-500 hover:text-green-600'}`}>
          <FaFileExcel size={14} /><span className="hidden xl:inline text-xs font-bold uppercase">Export</span>
        </button>
      </div>

      <AnimatePresence>
        {isUploading && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-zinc-50 border border-zinc-200 rounded p-2 my-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{status || "Uploading..."}</span>
                <span className="text-[10px] font-bold text-black">{uploadProgress}%</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-200 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${uploadProgress}%` }} transition={{ ease: "easeOut", duration: 0.3 }} className={`h-full rounded-full ${uploadProgress >= 90 ? 'bg-green-500' : 'bg-black'}`} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <FaSearch className="absolute left-2.5 top-2.5 text-zinc-400" size={10} />
          <input type="text" placeholder="Search name, phone, school..." className="w-full pl-8 pr-2 h-8 bg-white border border-zinc-200 rounded text-xs font-medium focus:border-black focus:ring-1 focus:ring-black outline-none transition placeholder:text-zinc-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="relative w-28">
          <select className="w-full h-8 pl-2 pr-6 bg-white border border-zinc-200 rounded text-xs font-medium text-zinc-600 outline-none cursor-pointer focus:border-black appearance-none" value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="nameAsc">Name (A-Z)</option>
            <option value="scoreDesc">High Score</option>
          </select>
          <FaChevronDown className="absolute right-2 top-2.5 text-zinc-400 pointer-events-none" size={8} />
        </div>
      </div>

      <div className='grid grid-cols-2 gap-2 pt-1 border-t border-zinc-50'>
        <button onClick={onCopyClick} className={`w-full h-8 rounded text-xs font-bold uppercase transition flex items-center justify-center gap-1.5 border ${isSelectionActive ? 'bg-black text-white border-black hover:bg-zinc-800' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'}`}>
          <FaCopy size={10} />{isSelectionActive ? `Copy (${selectedIds.length})` : 'Copy All'}
        </button>
        <div className="flex gap-1.5">
          <button onClick={selectMode ? handleExitMode : () => setSelectMode(true)} className={`h-8 text-xs font-bold uppercase rounded border transition flex items-center justify-center gap-1 ${selectMode ? 'w-8 bg-zinc-100 text-zinc-600 border-zinc-300 hover:bg-zinc-200' : 'flex-1 bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'}`}>
            {selectMode ? <FaTimes size={12} /> : 'Select'}
          </button>
          {selectMode && (
            <>
              <button onClick={toggleSelectAll} className="flex-1 h-8 px-2 text-xs font-bold uppercase rounded border border-zinc-200 hover:border-black transition truncate bg-white text-black">{isPageFullySelected ? 'None' : 'All'}</button>
              <button onClick={handleBulkDelete} disabled={!isSelectionActive || !isAuthenticated} className={`h-8 px-3 text-white text-xs font-bold uppercase rounded transition border ${isSelectionActive && isAuthenticated ? 'bg-red-500 border-red-500 hover:bg-red-600' : 'bg-zinc-100 border-zinc-100 text-zinc-300 cursor-not-allowed'}`}><FaTrash size={10} /></button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const CandidateCard = memo(({ person, expandedId, selectedIds, selectMode, copiedId, handleCardClick, toggleSelection, toggleLock, startEditing, handleDelete, handleCopy, handleOpenPdfMobile, handleRetry }) => {
  const isExpanded = expandedId === person._id;
  const isSelected = selectedIds.includes(person._id);
  const isProcessing = person.status === "Processing";

  return (
    <div onClick={() => !isProcessing && handleCardClick(person)} className={`group relative p-3 rounded border cursor-pointer overflow-hidden transform-gpu transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] ${isProcessing ? 'bg-zinc-50 opacity-90 border-zinc-100 cursor-wait' : isExpanded ? 'bg-zinc-50 border-black ring-1 ring-black shadow-md z-10' : 'bg-white border-zinc-200 hover:border-zinc-400 hover:shadow-sm'} ${isSelected && selectMode ? 'ring-1 ring-blue-500 border-blue-500 bg-blue-50/10' : ''}`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2.5 w-full">
          <div className="relative w-8 h-8 flex-none">
            <button onClick={(e) => { e.stopPropagation(); toggleSelection(person._id); }} disabled={isProcessing} className={`absolute inset-0 w-full h-full flex items-center justify-center border rounded transition-all duration-300 transform ${selectMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50 pointer-events-none'} ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-zinc-300'} ${isProcessing ? 'cursor-not-allowed opacity-50' : ''}`}>
              <FaCheck size={12} className={`transition-transform duration-200 ${isSelected ? 'scale-100' : 'scale-0'}`} />
            </button>
            <div className={`absolute inset-0 w-full h-full flex items-center justify-center text-xs font-bold border rounded transition-all duration-300 transform ${!selectMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'} ${isExpanded ? 'bg-black text-white border-black' : 'bg-white text-black border-zinc-200'} ${isProcessing ? 'border-green-200 bg-green-50 text-green-600' : ''}`}>
              {isProcessing ? <FaSpinner className="animate-spin" size={12} /> : person.Name.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {isProcessing ? (
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
                <>
                  <h3 className="text-xs font-semibold text-black uppercase truncate leading-none transition-colors">{person.Name}</h3>
                  {person.status === "Ready" && <ConfidencePie score={person.Confidence} />}
                  {person.locked && <FaLock className="text-amber-500 shrink-0 animate-pulse" size={8} />}
                </>
              )}
            </div>
            {!isProcessing && person.Position && person.Position !== "N/A" && <p className="text-[10px] font-bold text-blue-600 truncate mt-0.5 uppercase">{person.Position}</p>}
            <p className="text-xs text-zinc-500 font-medium truncate leading-tight mt-1">{isProcessing ? "AI is reading document..." : (person.School || "N/A")}</p>
          </div>
        </div>
        {!selectMode && (
          <div className={`flex gap-1 z-20 transition-all duration-300 ease-out pl-2 ${isExpanded || isProcessing ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none lg:pointer-events-auto lg:group-hover:opacity-100 lg:group-hover:translate-y-0'}`}>
            <button disabled={isProcessing} onClick={(e) => toggleLock(person, e)} className={`p-2 rounded transition-colors duration-200 border ${person.locked ? 'text-amber-600 border-amber-200 bg-amber-50' : 'text-zinc-400 hover:text-black bg-white border-zinc-100 hover:border-black'} ${isProcessing ? 'opacity-30 cursor-not-allowed' : ''}`}>
              {person.locked ? <FaLock size={10} /> : <FaUnlock size={10} />}
            </button>
            <button disabled={isProcessing} onClick={(e) => startEditing(person, e)} className={`p-2 text-zinc-400 hover:text-black bg-white border border-zinc-100 hover:border-black rounded transition-colors duration-200 ${isProcessing ? 'opacity-30 cursor-not-allowed' : ''}`}>
              <FaEdit size={10} />
            </button>
            <button onClick={(e) => handleDelete(person._id, person.Name, e)} className="p-2 text-zinc-400 hover:text-red-600 bg-white border border-zinc-100 hover:border-red-500 rounded transition-colors duration-200" disabled={person.locked}>
              <FaTrash size={10} />
            </button>
            <button onClick={(e) => handleRetry(person, e)} title="Retry AI Parsing" disabled={isProcessing} className={`p-2 text-blue-400 hover:text-blue-600 bg-white border border-zinc-100 hover:border-blue-500 rounded transition-colors duration-200 ${isProcessing ? 'animate-pulse opacity-50 cursor-wait' : ''}`}>
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

const ConfidencePie = ({ score }) => {
  const safeScore = score || 0;
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeScore / 100) * circumference;
  let colorClass = "text-green-500";
  if (safeScore < 80) colorClass = "text-amber-500";
  if (safeScore < 50) colorClass = "text-red-500";
  return (
    <div className="flex items-center gap-1.5 ml-2" title={`AI Confidence: ${safeScore}%`}>
      <div className="relative w-3.5 h-3.5 flex-none">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 18 18">
          <circle cx="9" cy="9" r={radius} fill="transparent" stroke="#f4f4f5" strokeWidth="2.5" />
          <circle cx="9" cy="9" r={radius} fill="transparent" stroke="currentColor" strokeWidth="2.5" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className={`transition-all duration-500 ease-out ${colorClass}`} />
        </svg>
      </div>
      <span className={`text-[9px] font-bold ${colorClass}`}>{safeScore}%</span>
    </div>
  );
};

const DashboardPanel = ({ stats, candidates }) => {
  const [filter, setFilter] = useState("");
  const filteredData = candidates.filter(c => {
    if (!filter) return true;
    const searchStr = filter.toLowerCase();
    return (
      (c.Name && c.Name.toLowerCase().includes(searchStr)) ||
      (c.Position && c.Position.toLowerCase().includes(searchStr)) ||
      (c.School && c.School.toLowerCase().includes(searchStr)) ||
      (c.Location && c.Location.toLowerCase().includes(searchStr))
    );
  });
  const activeTotal = filteredData.length;
  const activeProcessing = filteredData.filter(c => c.status === "Processing").length;
  const activeReady = activeTotal - activeProcessing;
  const getTopDistribution = (field) => {
    if (!filteredData || filteredData.length === 0) return [];
    const counts = {};
    filteredData.forEach(c => {
      let val = c[field] || "Unknown";
      val = val.trim();
      if (val.length < 2) val = "Unknown";
      counts[val] = (counts[val] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count, percent: Math.round((count / activeTotal) * 100) }));
  };
  const topSchools = getTopDistribution("School");
  const topLocations = getTopDistribution("Location");
  const topPositions = getTopDistribution("Position");

  return (
    <div className="h-full w-full bg-white select-text overflow-hidden flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-6xl flex flex-col h-full max-h-[650px] justify-between">
        <div className="flex flex-col md:flex-row justify-between items-end border-b border-zinc-100 pb-4 gap-4">
          <div>
            <h1 className="text-2xl font-light text-black tracking-tight">Analytics</h1>
            <div className="h-0.5 w-8 bg-black mt-1"></div>
          </div>
          <div className="relative w-full md:w-64 group">
            <FaSearch className="absolute left-3 top-2.5 text-zinc-400 group-focus-within:text-black transition-colors" size={12} />
            <input type="text" placeholder="Filter by Role, Location..." value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded pl-9 pr-3 py-1.5 text-xs text-black focus:border-black focus:ring-0 outline-none transition-all placeholder:text-zinc-400" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-6 py-4">
          <MinimalStat label={filter ? "Matches" : "Total"} value={activeTotal} />
          <MinimalStat label="Positions" value={topPositions.length > 0 ? topPositions.length + "+" : "0"} />
          <MinimalStat label="Processing" value={activeProcessing} />
          <div className="hidden md:block">
            <StatusDonut total={activeTotal} ready={activeReady} processing={activeProcessing} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-zinc-50 pt-6">
          <div>
            <h3 className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-3 pb-1 border-b border-zinc-50 flex items-center gap-2"><FaBriefcase /> Top Roles</h3>
            <div className="space-y-3">{topPositions.map((item, i) => <MinimalBar key={i} label={item.name} count={item.count} percent={item.percent} />)}{topPositions.length === 0 && <EmptyMsg />}</div>
          </div>
          <div>
            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3 pb-1 border-b border-zinc-50 flex items-center gap-2"><FaUniversity /> Universities</h3>
            <div className="space-y-3">{topSchools.map((item, i) => <MinimalBar key={i} label={item.name} count={item.count} percent={item.percent} />)}{topSchools.length === 0 && <EmptyMsg />}</div>
          </div>
          <div>
            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3 pb-1 border-b border-zinc-50 flex items-center gap-2"><FaMapMarkerAlt /> Locations</h3>
            <div className="space-y-3">{topLocations.map((item, i) => <MinimalBar key={i} label={item.name} count={item.count} percent={item.percent} />)}{topLocations.length === 0 && <EmptyMsg />}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
const EmptyMsg = () => <p className="text-xs text-zinc-300 italic">No data found</p>;
const MinimalStat = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{label}</span>
    <span className="text-4xl font-light text-black tracking-tighter leading-none">{value}</span>
  </div>
)
const MinimalBar = ({ label, count, percent }) => (
  <div className="group w-full">
    <div className="flex justify-between items-baseline mb-1">
      <span className="text-xs font-medium text-zinc-700 truncate w-[85%]" title={label}>{label}</span>
      <span className="text-xs font-bold text-black">{count}</span>
    </div>
    <div className="h-px w-full bg-zinc-100">
      <motion.div initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 1.0, ease: "circOut" }} className="h-full bg-black" />
    </div>
  </div>
)
const StatusDonut = ({ total, ready, processing }) => {
  if (total === 0) return null;
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const readyPercent = (ready / total) * 100;
  const offset = circumference - (readyPercent / 100) * circumference;
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-10 h-10 transform -rotate-90">
        <svg className="w-full h-full" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r={radius} stroke="#f4f4f5" strokeWidth="4" fill="transparent" />
          <motion.circle initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }} transition={{ duration: 1.5, ease: "easeOut" }} cx="22" cy="22" r={radius} stroke="black" strokeWidth="4" fill="transparent" strokeDasharray={circumference} strokeLinecap="round" />
        </svg>
      </div>
      <div className="flex flex-col justify-center text-[10px] leading-tight">
        <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-black rounded-full"></div><span className="font-bold text-zinc-600">Ready</span></div>
        <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-zinc-200 rounded-full"></div><span className="font-bold text-zinc-400">Processing</span></div>
      </div>
    </div>
  )
}

const PDFViewer = memo(({ previewUrl, fileType, zoom, setZoom, showMobilePreview, setShowMobilePreview, editingCandidate, onClear }) => {
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

const EditForm = ({ editingCandidate, setEditingCandidate, saveEdit, handleEditChange, formatDateForInput, isMobile }) => {
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

const LoginModal = ({ onClose, onSuccess, API_URL }) => {
  const [isRegistering, setIsRegistering] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError(""); setSuccessMsg("")
    try {
      if (isRegistering) {
        await axios.post(`${API_URL}/register`, { username, password })
        setSuccessMsg("Account created! Please log in.")
        setIsRegistering(false); setPassword("")
      } else {
        const formData = new FormData()
        formData.append('username', username)
        formData.append('password', password)
        const res = await axios.post(`${API_URL}/token`, formData)
        onSuccess(res.data.access_token, username)
      }
    } catch (err) {
      if (isRegistering) setError(err.response?.data?.detail || "Registration failed.")
      else setError("Invalid username or password")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true); setError("")
    try {
      const res = await axios.post(`${API_URL}/auth/google`, {
        token: credentialResponse.credential
      });
      onSuccess(res.data.access_token, res.data.username);
    } catch (err) {
      setError("Google Sign-In failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="fixed inset-0 z-999 flex items-center justify-center p-4 bg-zinc-100/60 backdrop-blur-md select-none">
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2 }} className="bg-white w-full max-w-[420px] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden relative border border-white">
          <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-40 h-40 bg-green-500/10 blur-[60px] rounded-full pointer-events-none"></div>
          <button onClick={onClose} className="absolute top-5 right-5 text-zinc-400 hover:text-black transition z-10"><BsXLg size={14} /></button>
          <div className="p-8 relative z-0">
            <div className="text-center mb-8">
              <img src="/logo.svg" alt="Logo" className="w-12 h-12 mx-auto mb-4 object-contain drop-shadow-md" />
              <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">{isRegistering ? "Create Account" : "Welcome back"}</h2>
              <p className="text-zinc-500 text-sm mt-1">{isRegistering ? "Please enter details to sign up" : "Please enter your details to sign in"}</p>
            </div>
            <div className="flex justify-center mb-6">
              <div className="w-full flex justify-center">
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError("Google Sign-In Failed")} theme="outline" size="large" shape="pill" width="350" text="continue_with" />
              </div>
            </div>
            <div className="relative flex py-1 items-center mb-6">
              <div className="grow border-t border-zinc-100"></div>
              <span className="shrink-0 mx-3 text-[10px] font-bold text-zinc-300 uppercase tracking-widest">OR</span>
              <div className="grow border-t border-zinc-100"></div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 ml-1">Username or Email</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-white border border-zinc-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-zinc-300 hover:border-zinc-300" placeholder="Enter your username" required />
              </div>
              <div className="space-y-1.5 relative">
                <label className="text-xs font-semibold text-zinc-700 ml-1">Password</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white border border-zinc-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-zinc-300 hover:border-zinc-300 pr-10" placeholder="••••••••" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-zinc-400 hover:text-black transition">{showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}</button>
                </div>
              </div>
              {!isRegistering && (
                <div className="flex justify-between items-center text-xs mt-2 px-1">
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-500 hover:text-zinc-800 transition">
                    <input type="checkbox" className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500" /> Remember me
                  </label>
                  <button type="button" className="font-semibold text-zinc-900 hover:underline">Forgot password?</button>
                </div>
              )}
              {error && <p className="text-red-500 text-xs font-bold text-center mt-2">{error}</p>}
              {successMsg && <p className="text-green-600 text-xs font-bold text-center mt-2">{successMsg}</p>}
              <button disabled={loading} className="w-full bg-zinc-900 text-white font-bold py-3.5 rounded-xl text-sm tracking-wide hover:bg-black hover:shadow-lg hover:shadow-zinc-900/20 active:scale-[0.99] transition-all duration-200 mt-2">
                {loading ? <FaSpinner className="animate-spin mx-auto" /> : (isRegistering ? "Create account" : "Sign in")}
              </button>
            </form>
            <div className="mt-8 text-center text-sm text-zinc-500">
              {isRegistering ? "Already have an account?" : "Don't have an account?"}
              <button onClick={() => { setIsRegistering(!isRegistering); setError(""); setSuccessMsg(""); }} className="ml-1.5 font-bold text-zinc-900 hover:underline">{isRegistering ? "Sign in" : "Sign up"}</button>
            </div>
          </div>
        </motion.div>
      </div>
    </GoogleOAuthProvider>
  )
}