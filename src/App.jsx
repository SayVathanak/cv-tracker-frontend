import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { pdfjs } from 'react-pdf'
import { motion, AnimatePresence } from 'framer-motion'
import Swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'
import { FaCloudUploadAlt, FaPhoneAlt, FaEdit } from 'react-icons/fa'

// Components
import SettingsPage from './components/Settings'
import Navbar from './components/Navbar'
import StatusBar from './components/StatusBar'
import ControlPanel from './components/ControlPanel'
import CandidateCard from './components/CandidateCard'
import DashboardPanel from './components/DashboardPanel'
import PDFViewer from './components/PDFViewer'
import EditForm from './components/EditForm'
import LoginModal from './components/LoginModal'
import SkeletonLoader from './components/SkeletonLoader'
import CreditModal from './components/CreditModal';
import UploadModal from './components/UploadModal';
import AdminDashboard from './components/AdminDashboard';
import WelcomeModal from './components/WelcomeModal';

// Utils
import { getUserFromToken, formatDOB } from './utils/helpers'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

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
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [batchStats, setBatchStats] = useState({ total: 0, processed: 0, active: false });
  const [filters, setFilters] = useState({ location: "", position: "", education: "", gender: "" });
  const [showWelcome, setShowWelcome] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadError, setUploadError] = useState(null);
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

  const fetchCredits = async () => {
    try {
      const token = localStorage.getItem("cv_token");
      if (!token) return;

      const res = await axios.get(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setCredits(res.data.current_credits);

      // --- LOGIC: TRIGGER WELCOME MODAL ---
      // If user has exactly 10 credits (the sign-up bonus) 
      // AND we haven't shown them the welcome screen yet.
      const hasSeenWelcome = localStorage.getItem("cv_welcome_seen");

      // We assume if credits == 10 and they haven't uploaded anything (lifetime_uploads check optional), 
      // they are new.
      if (!hasSeenWelcome && res.data.current_credits === 10) {
        setShowWelcome(true);
      }

      // 2. Update App Settings from Cloud (NEW ADDITION)
      if (res.data.settings && Object.keys(res.data.settings).length > 0) {
        setAppSettings(prev => ({
          ...prev,
          ...res.data.settings,
          profile: {
            ...prev.profile,
            ...res.data.settings.profile,
            // Ensure we don't accidentally overwrite the username if the DB sends a partial object
            username: res.data.username || prev.profile.username
          }
        }));

        // Optional: Sync local storage immediately so it persists on reload
        localStorage.setItem('cv_app_settings', JSON.stringify(res.data.settings));
      }

    } catch (e) { console.error(e); }
  };

  const handleCloseWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem("cv_welcome_seen", "true"); // Mark as seen
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
        const matchesPosition = person.Position && person.Position.toLowerCase().includes(lowerSearch);
        if (!matchesName && !matchesTel && !matchesPosition) return false;
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

  // --- MODIFIED FUNCTION ---
  const handleLoginSuccess = (token, username) => {
    localStorage.setItem("cv_token", token)
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    setIsAuthenticated(true)
    setCurrentUser(username)
    setShowLoginModal(false)

    // Force a reload to ensure fresh state for the new user
    window.location.reload()
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
    if (!isAuthenticated && !localStorage.getItem("cv_token")) {
      return;
    }

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
      if (error.response && error.response.status === 401) {
        handleLogout();
      } else {
        console.error(error)
      }
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

  const handleBuyCredits = () => {
    setShowCreditModal(true);
  };

  const handleUpload = async () => {
    if (!checkAuth()) return;

    if (files.length === 0) {
      Toast.fire({ icon: 'warning', title: 'Please select files first' });
      return;
    }

    if (credits < files.length) {
      MySwal.fire({
        icon: 'error',
        title: 'Insufficient Credits',
        text: `You have ${credits} credits, but you are trying to upload ${files.length} files.`,
        showCancelButton: true,
        confirmButtonText: 'Top Up Now',
        confirmButtonColor: '#000'
      }).then((result) => {
        if (result.isConfirmed) {
          setShowCreditModal(true);
        }
      });
      return;
    }

    setUploadError(null);
    setUploadProgress(0);
    setStatus("Preparing files...");
    setIsUploading(true);
    setShowUploadModal(true);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const res = await axios.post(`${API_URL}/upload-cv`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const rawPercent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(Math.min(rawPercent, 95));
        }
      });

      setUploadProgress(100);
      const count = res.data.details.length;
      setStatus(`Successfully uploaded ${count} files. Processing started.`);

      fetchCredits();

      setTimeout(() => {
        handleClearFiles();
        fetchCandidates();
        setIsUploading(false);
      }, 1000);

    } catch (error) {
      console.error("Upload Error:", error);
      setIsUploading(false);

      let serverMsg = "An unexpected error occurred.";
      const errStatus = error.response?.status;

      if (error.response?.data?.detail) serverMsg = error.response.data.detail;

      if (errStatus === 402) {
        setShowUploadModal(false);

        MySwal.fire({
          icon: 'error',
          title: 'Insufficient Credits',
          text: serverMsg,
          showCancelButton: true,
          confirmButtonText: 'Top Up Now',
          confirmButtonColor: '#000'
        }).then((result) => {
          if (result.isConfirmed) {
            setShowCreditModal(true);
          }
        });
        return;
      }

      setUploadError(serverMsg);
      setStatus("Upload Failed");
    }
  };

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
      className="flex flex-col h-screen bg-white text-black font-sans selection:bg-zinc-800 selection:text-white overflow-hidden select-none relative"
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
        userEmail={currentUser}
        isAuthenticated={isAuthenticated}
        setShowLoginModal={setShowLoginModal}
        handleLogout={handleLogout}
        onOpenSettings={() => setShowSettings(true)}
        onOpenAdmin={() => setShowAdminPanel(true)}
        autoDeleteEnabled={appSettings.autoDelete}
        credits={credits}
        onBuyCredits={handleBuyCredits}
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

          <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24 scroll-smooth custom-scrollbar">
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

      {showAdminPanel && (
        <AdminDashboard onClose={() => setShowAdminPanel(false)} />
      )}

      <UploadModal
        isOpen={showUploadModal}
        progress={uploadProgress}
        status={status}
        error={uploadError}
        onClose={() => setShowUploadModal(false)}
        fileCount={files.length}
      />

      <CreditModal
        isOpen={showCreditModal}
        onClose={() => setShowCreditModal(false)}
        onSuccess={() => fetchCredits()}
        userEmail={currentUser}
        apiUrl={API_URL}
      />

      <WelcomeModal isOpen={showWelcome} onClose={handleCloseWelcome} />

    </div>
  )
}
export default App