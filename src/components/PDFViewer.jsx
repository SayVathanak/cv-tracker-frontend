import { memo } from 'react'
import { Document, Page } from 'react-pdf'
import { FaArrowLeft, FaFilePdf, FaSearchMinus, FaSearchPlus, FaRedo, FaSpinner, FaCopy } from 'react-icons/fa'
import { BsXLg } from "react-icons/bs";
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

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

export default PDFViewer