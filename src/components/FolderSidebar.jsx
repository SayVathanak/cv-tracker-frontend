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
      className={`h-full bg-zinc-900 text-white flex flex-col transition-all duration-300 relative border-r border-zinc-800 ${
        isOpen ? "w-64" : "w-16"
      }`}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute -right-3 top-6 bg-white border border-zinc-200 text-black rounded-full p-1 shadow-md z-50 hover:bg-zinc-100"
      >
        {isOpen ? <FaChevronLeft size={10} /> : <FaChevronRight size={10} />}
      </button>

      {/* Header */}
      <div className="p-4 flex items-center gap-3 border-b border-zinc-800 h-16">
        <div className="w-8 h-8 rounded bg-linear-to-tr from-blue-500 to-purple-500 flex items-center justify-center shrink-0">
          <FaLayerGroup size={14} className="text-white" />
        </div>
        {isOpen && <span className="font-bold tracking-wide">Workspaces</span>}
      </div>

      {/* Folders List */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1 custom-scrollbar">
        {/* "All Candidates" Option */}
        <div
          onClick={() => onSelectFolder(null)}
          className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-l-2 ${
            activeFolder === null
              ? "bg-zinc-800 border-blue-500 text-white"
              : "border-transparent text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
        >
          <FaLayerGroup size={16} />
          {isOpen && (
            <div className="flex justify-between w-full">
              <span className="text-sm font-medium">All Candidates</span>
            </div>
          )}
        </div>

        {/* Dynamic Folders */}
        {folders.map((folder) => (
          <div
            key={folder.id}
            onClick={() => onSelectFolder(folder.id)}
            className={`group flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-l-2 ${
              activeFolder === folder.id
                ? "bg-zinc-800 border-blue-500 text-white"
                : "border-transparent text-zinc-400 hover:text-white hover:bg-zinc-800"
            }`}
          >
            {activeFolder === folder.id ? (
              <FaFolderOpen size={16} className="text-blue-400" />
            ) : (
              <FaFolder size={16} />
            )}

            {isOpen && (
              <div className="flex justify-between w-full items-center">
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-medium truncate w-28">
                    {folder.name}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {folder.count} files
                  </span>
                </div>
                <button
                  onClick={(e) => handleDelete(e, folder.id, folder.name)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded transition"
                >
                  <FaTrash size={10} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer / Add Button */}
      <div className="p-3 border-t border-zinc-800">
        <button
          onClick={handleCreate}
          className={`w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg transition-all ${
            isOpen ? "" : "px-0"
          }`}
        >
          <FaPlus />{" "}
          {isOpen && <span className="text-sm font-bold">New Folder</span>}
        </button>
      </div>
    </div>
  );
};

export default FolderSidebar;
