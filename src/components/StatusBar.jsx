const StatusBar = ({ loading, totalItems }) => {
  const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' }
  const today = new Date().toLocaleDateString('en-US', dateOptions)
  return (
    <div className="flex-none px-4 h-8 border-b border-zinc-100 bg-white flex items-center justify-between z-10 select-none">
      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{today}</span>
      <div className="text-[10px]">
        <span className="font-bold text-zinc-400 uppercase tracking-wider mr-2">Candidates</span>
        <span className="font-bold text-black">{loading ? "..." : totalItems}</span>
      </div>
    </div>
  )
}

export default StatusBar