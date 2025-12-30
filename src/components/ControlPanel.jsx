import { motion, AnimatePresence } from 'framer-motion'
import { 
  FaCheck, FaCloudUploadAlt, FaTrash, FaFileExcel, 
  FaSearch, FaChevronDown, FaCopy, FaTimes, FaPlay 
} from 'react-icons/fa'

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
          <input id="fileInput" type="file" multiple
            accept="application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            onChange={handleFileChange} className="hidden" disabled={isUploading} />
          <label htmlFor="fileInput" className={`w-full h-full flex justify-center items-center gap-2 border rounded text-xs font-bold transition select-none ${isUploading ? 'opacity-50 cursor-not-allowed bg-zinc-50 border-zinc-100 text-zinc-400' : 'border-zinc-200 cursor-pointer bg-zinc-50 text-zinc-600 hover:border-black hover:text-black hover:bg-white'}`}>
            {files.length > 0 ? <><FaCheck className="text-green-500" /> {files.length} File(s) Ready</> : <><FaCloudUploadAlt className="text-md" /> UPLOAD CV <span className='text-xs font-normal text-zinc-400'>( pdf/docx/img )</span></>}
          </label>
        </div>
        {files.length > 0 && !isUploading && (
          <>
            <button onClick={handleUpload} className="px-4 bg-white border border-green-500 text-green-500 rounded hover:bg-green-50 transition shadow-sm">
              <FaPlay size={12} />
            </button>
            <button onClick={handleClearFiles} className="px-4 bg-white border border-zinc-200 hover:border-red-300 hover:bg-red-50 hover:text-red-500 rounded text-zinc-500 transition"><FaTrash size={12} /></button>
          </>
        )}
        <button onClick={handleExport} title={isSelectionActive ? `Export ${selectedIds.length} Selected` : "Export All to Excel"} className={`px-4 w-28 h-full border rounded transition flex items-center justify-center gap-2 ${isSelectionActive ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-white border-zinc-200 text-zinc-600 hover:border-green-500 hover:text-green-600'}`}>
          <FaFileExcel size={14} /><span className="text-xs font-bold uppercase">Export</span>
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
          <input type="text" placeholder="Search name, phone, role..." className="w-full pl-8 pr-2 h-8 bg-white border border-zinc-200 rounded text-[10px] md:text-xs focus:border-black focus:ring-1 focus:ring-black outline-none transition placeholder:text-zinc-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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

export default ControlPanel