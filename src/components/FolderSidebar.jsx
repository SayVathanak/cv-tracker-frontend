import { useState } from "react";
import {
  FaFolder,
  FaFolderOpen,
  FaPlus,
  FaTrash,
  FaLayerGroup,
  FaChevronRight,
  FaChevronLeft,
} from "react-icons/fa";
import Swal from "sweetalert2";

const FolderSidebar = ({
  folders,
  activeFolder,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  isOpen,
  setIsOpen,
}) => {
  const handleCreate = async () => {
    const { value: folderName } = await Swal.fire({
      title: "New Folder",
      input: "text",
      inputLabel: 'Folder Name (e.g., "1-Jan-2026")',
      showCancelButton: true,
      confirmButtonColor: "#000",
      inputValidator: (value) => !value && "You need to write something!",
    });

    if (folderName) onCreateFolder(folderName);
  };

  const handleDelete = (e, folderId, name) => {
    e.stopPropagation();
    Swal.fire({
      title: "Delete Folder?",
      text: `This will delete "${name}" and ALL CVs inside it.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    }).then((result) => {
      if (result.isConfirmed) onDeleteFolder(folderId);
    });
  };

  return (
    <div
      // CHANGE 1: Main Background to Light Gray
      className={`h-full bg-white text-zinc-600 flex flex-col transition-all duration-300 relative border-r border-zinc-200 ${
        isOpen ? "w-64" : "w-16"
      }`}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute -right-3 top-6 bg-white border border-zinc-200 text-zinc-400 hover:text-black rounded-full p-1 shadow-sm z-50 hover:bg-zinc-50 transition-colors"
      >
        {isOpen ? <FaChevronLeft size={10} /> : <FaChevronRight size={10} />}
      </button>

      {/* Header */}
      <div className="p-4 flex items-center gap-3 border-b border-zinc-200 h-16">
        <div className="w-8 h-8 rounded bg-black flex items-center justify-center shrink-0 shadow-sm">
          <FaLayerGroup size={14} className="text-white" />
        </div>
        {isOpen && (
          <span className="font-bold tracking-tight text-black">
            Workspaces
          </span>
        )}
      </div>

      {/* Folders List */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1 px-2 custom-scrollbar">
        {/* "All Candidates" Option */}
        <div
          onClick={() => onSelectFolder(null)}
          // CHANGE 2: Active State is White Card with Shadow
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
            activeFolder === null
              ? "text-black bg-zinc-100 font-semibold"
              : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100"
          }`}
        >
          <FaLayerGroup
            size={14}
            className={activeFolder === null ? "text-black" : "text-zinc-400"}
          />
          {isOpen && (
            <div className="flex justify-between w-full">
              <span className="text-xs">All Candidates</span>
            </div>
          )}
        </div>

        {/* Dynamic Folders */}
        {folders.map((folder) => (
          <div
            key={folder.id}
            onClick={() => onSelectFolder(folder.id)}
            className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
              activeFolder === folder.id
                ? "bg-white shadow-sm ring-1 ring-zinc-200 text-black font-semibold"
                : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100"
            }`}
          >
            {activeFolder === folder.id ? (
              <FaFolderOpen size={14} className="text-black" />
            ) : (
              <FaFolder
                size={14}
                className="text-zinc-400 group-hover:text-zinc-500"
              />
            )}

            {isOpen && (
              <div className="flex justify-between w-full items-center">
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs truncate w-28">{folder.name}</span>
                  <span className="text-[9px] text-zinc-400">
                    {folder.count} files
                  </span>
                </div>
                <button
                  onClick={(e) => handleDelete(e, folder.id, folder.name)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-zinc-300 hover:text-red-500 rounded transition"
                >
                  <FaTrash size={10} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer / Add Button */}
      <div className="p-3 border-t border-zinc-200 bg-zinc-50">
        <button
          onClick={handleCreate}
          // CHANGE 3: Button is Black (High Contrast)
          className={`w-full flex items-center justify-center gap-2 bg-black hover:bg-zinc-800 text-white p-2.5 rounded-lg shadow-sm transition-all ${
            isOpen ? "" : "px-0"
          }`}
        >
          <FaPlus size={10} />{" "}
          {isOpen && (
            <span className="text-xs font-bold uppercase tracking-wider">
              New Folder
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

export default FolderSidebar;
