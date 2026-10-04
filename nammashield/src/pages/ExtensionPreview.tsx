import { ExtensionPopup } from "../extension/components/ExtensionPopup";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function ExtensionPreview() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-stone-100 p-4 flex flex-col items-center justify-center">
      <div className="mb-6 max-w-[380px] w-full flex items-center justify-between">
        <Link to="/" className="inline-flex items-center text-[13px] font-semibold text-stone-500 hover:text-stone-900 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Dashboard
        </Link>
        <span className="text-[10px] font-bold uppercase tracking-widest text-teal-600 bg-teal-100/50 px-2.5 py-1 rounded-full">Interactive Demo</span>
      </div>

      <div className="rounded-2xl overflow-hidden shadow-2xl max-w-[380px] w-full border border-stone-200/60 bg-[#F9F8F6] relative">
        {/* Simulate browser extension toolbar gap */}
        <div className="h-1.5 w-full bg-stone-200/50 border-b border-stone-200/50"></div>
        <ExtensionPopup />
      </div>
    </div>
  );
}
