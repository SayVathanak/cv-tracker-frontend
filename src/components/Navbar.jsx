import { FaRobot, FaFileExcel } from 'react-icons/fa'

const Navbar = ({ handleExport, selectedCount, selectMode }) => {
  return (
    <nav className="flex-none border-b-2 border-zinc-100 px-6 h-16 flex items-center justify-between z-20 bg-white">
      <div className="flex items-center gap-2">
        <div className="bg-black text-white p-2 rounded cursor-pointer">
          <FaRobot size={18} />
        </div>
        <span className="font-bold text-xl tracking-tight">
          CV<span className="text-zinc-400">Tracker</span>
        </span>
      </div>
      
      <div className="flex items-center gap-4">
        <button 
          onClick={handleExport} 
          className="hidden sm:flex items-center gap-2 px-4 py-2 border border-zinc-200 rounded font-bold text-xs hover:bg-black hover:text-white transition uppercase"
        >
          <FaFileExcel /> 
          Export {selectedCount > 0 ? `(${selectedCount})` : ''}
        </button>
        
        <div className="text-xs font-bold text-black border border-zinc-200 px-3 py-1.5 rounded flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> 
          {selectMode ? `${selectedCount} SELECTED` : 'ONLINE'}
        </div>
      </div>
    </nav>
  )
}

export default Navbar