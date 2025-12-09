import { FaChevronLeft, FaChevronRight, FaLayerGroup } from 'react-icons/fa';

const MobilePagination = ({ 
  currentPage, 
  totalPages, 
  totalItems, 
  loading, 
  showMobilePreview, 
  onPageChange 
}) => {
  return (
    <div 
      className={`lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-md border-t border-zinc-200 z-40 flex items-center justify-between px-6 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] transition-transform duration-300 ${
        showMobilePreview ? 'translate-y-full' : 'translate-y-0'
      }`}
    >
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || loading}
        className="w-10 h-10 flex items-center justify-center bg-zinc-50 text-zinc-600 rounded-full hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-zinc-50 transition active:scale-95"
      >
        <FaChevronLeft size={14} />
      </button>
      
      <div className="flex flex-col items-center select-none">
         <div className="flex items-center gap-2 mb-0.5">
            <FaLayerGroup size={10} className="text-zinc-400" />
            <span className="text-xs font-bold text-zinc-900">
              Page {currentPage} <span className="text-zinc-400">/ {totalPages}</span>
            </span>
         </div>
         <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide">
            {totalItems} Total
         </span>
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || loading}
        className="w-10 h-10 flex items-center justify-center bg-black text-white rounded-full hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 transition shadow-lg active:scale-95"
      >
        <FaChevronRight size={14} />
      </button>
    </div>
  );
};

export default MobilePagination;