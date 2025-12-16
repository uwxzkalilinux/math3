import React from 'react';
import { ViewState } from '../types';
import { BrainCircuit, Image as ImageIcon, ScanLine, Globe, Calculator, X, Presentation } from 'lucide-react';

interface NavigationProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  onClose?: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentView, setView, onClose }) => {
  const navItems = [
    { id: ViewState.TUTOR, label: 'المعلم الذكي', icon: BrainCircuit, desc: 'تفكير عميق مع Gemini 3 Pro' },
    { id: ViewState.VISUALIZER, label: 'المرسم الهندسي', icon: ImageIcon, desc: 'رسوم بيانية وهندسية دقيقة' },
    { id: ViewState.SOLVER, label: 'ماسح الفروض', icon: ScanLine, desc: 'حل المسائل من الصور' },
    { id: ViewState.EXPLORER, label: 'المستكشف السريع', icon: Globe, desc: 'بحث وشرح المفاهيم بسرعة' },
    { id: ViewState.PRESENTATION, label: 'صانع العروض', icon: Presentation, desc: 'إنشاء عروض PowerPoint' },
  ];

  const handleNavClick = (id: ViewState) => {
    setView(id);
    if (onClose) onClose();
  };

  return (
    <div className="w-full md:w-64 bg-slate-900 border-l border-slate-800 flex flex-col h-full shadow-2xl md:shadow-none">
      <div className="p-6 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg">
             <Calculator className="text-white" size={20} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">MathMind</h1>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 md:hidden">
            <X size={24} />
          </button>
        )}
      </div>
      
      <div className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full text-right px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-200 group ${
                isActive 
                  ? 'bg-indigo-600/10 text-indigo-300 border border-indigo-600/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon size={20} className={isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-white'} />
              <div>
                <div className="font-medium text-sm">{item.label}</div>
                <div className="text-[10px] opacity-70 leading-tight">{item.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
      
      <div className="p-4 border-t border-slate-800">
        <div className="text-xs text-slate-500 text-center">
          مدعوم بواسطة Gemini 2.5 & 3.0
        </div>
      </div>
    </div>
  );
};

export default Navigation;