import { memo } from 'react'
import { 
  FaCheck, FaSpinner, FaLock, FaUnlock, FaEdit, 
  FaTrash, FaSync, FaPhoneAlt, FaBirthdayCake, 
  FaVenusMars, FaMapMarkerAlt, FaFilePdf, FaCopy 
} from 'react-icons/fa'
import { formatDOB } from '../utils/helpers'

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
            {!isProcessing && person.Position && person.Position !== "N/A" && <p className="text-[10px] font-bold text-blue-600 truncate tracking-wider mt-0.5 uppercase">{person.Position}</p>}
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

export default CandidateCard