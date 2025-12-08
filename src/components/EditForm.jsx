import { FaEdit, FaTimes, FaSave } from 'react-icons/fa'

const SolidInput = ({ label, name, val, onChange, type = "text" }) => (
  <div>
    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">{label}</label>
    <input type={type} name={name} value={val} onChange={onChange} className="w-full bg-white border border-zinc-300 p-2 text-sm font-semibold text-black focus:border-black focus:ring-1 focus:ring-black outline-none transition" />
  </div>
)

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

export default EditForm