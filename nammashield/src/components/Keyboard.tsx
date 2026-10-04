import { ShieldAlert, Delete, ArrowBigUp, CornerDownLeft } from 'lucide-react';
import { cn } from '../lib/utils';

export function Keyboard({ className }: { className?: string }) {
  const row1 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
  const row2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'];
  const row3 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M'];

  const Key = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <button className={cn(
      "h-12 flex-1 flex items-center justify-center bg-white rounded shadow-[0_1px_1px_rgba(0,0,0,0.1)] active:bg-stone-100 text-stone-800 font-medium text-lg touch-manipulation transition-colors",
      className
    )}>
      {children}
    </button>
  );

  return (
    <div className={cn(
      "w-full max-w-[400px] mx-auto bg-stone-200/90 backdrop-blur-md p-2 pb-6 flex flex-col gap-2 rounded-t-xl select-none",
      className
    )}>
      
      {/* Row 1 */}
      <div className="flex gap-1.5 justify-center w-full">
        {row1.map(key => (
          <Key key={key}>{key}</Key>
        ))}
      </div>

      {/* Row 2 */}
      <div className="flex gap-1.5 justify-center w-[90%] mx-auto">
        {row2.map(key => (
          <Key key={key}>{key}</Key>
        ))}
      </div>

      {/* Row 3 */}
      <div className="flex gap-1.5 justify-center w-full">
        <Key className="flex-[1.5] bg-stone-300 text-stone-700">
          <ArrowBigUp className="w-6 h-6" />
        </Key>
        {row3.map(key => (
          <Key key={key}>{key}</Key>
        ))}
        <Key className="flex-[1.5] bg-stone-300 text-stone-700">
          <Delete className="w-6 h-6" />
        </Key>
      </div>

      {/* Row 4 (Bottom) */}
      <div className="flex gap-1.5 justify-center w-full mt-1">
        <div className="flex-1 flex items-center justify-center">
          <ShieldAlert className="w-6 h-6 text-stone-500" strokeWidth={2.5} />
        </div>
        <Key className="flex-1 text-sm bg-stone-300 text-stone-700 font-normal">?123</Key>
        <Key className="flex-1 text-sm bg-stone-300 text-stone-700 font-normal">,</Key>
        <Key className="flex-[4] text-sm text-stone-400 font-normal">English</Key>
        <Key className="flex-1 text-sm bg-stone-300 text-stone-700 font-normal">.</Key>
        <Key className="flex-[1.5] bg-blue-600 text-white shadow-blue-700/50 active:bg-blue-700">
          <CornerDownLeft className="w-5 h-5" />
        </Key>
      </div>

    </div>
  );
}
