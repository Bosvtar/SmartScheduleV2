import React from 'react';
import { CalendarDays, Users, PlusCircle } from 'lucide-react';

export type NavTabType = 'home' | 'classes' | 'add';

interface NavBarProps {
  currentTab: NavTabType;
  onTabChange: (tab: NavTabType) => void;
  classesCount?: number;
}

const NavBar: React.FC<NavBarProps> = ({ currentTab, onTabChange, classesCount = 0 }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 pb-safe-area z-40">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
        <button 
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            currentTab === 'home' ? 'text-indigo-600 font-semibold' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <CalendarDays size={22} className={currentTab === 'home' ? 'scale-105' : ''} />
          <span className="text-[11px] mt-1">Lịch dạy</span>
        </button>

        <button 
          onClick={() => onTabChange('classes')}
          className={`flex flex-col items-center justify-center flex-1 h-full relative transition-colors ${
            currentTab === 'classes' ? 'text-indigo-600 font-semibold' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <div className="relative">
            <Users size={22} className={currentTab === 'classes' ? 'scale-105' : ''} />
            {classesCount > 0 && (
              <span className="absolute -top-1 -right-2.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {classesCount}
              </span>
            )}
          </div>
          <span className="text-[11px] mt-1">Quản lý lớp</span>
        </button>
        
        <button 
          onClick={() => onTabChange('add')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            currentTab === 'add' ? 'text-indigo-600 font-semibold' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <PlusCircle size={22} className={currentTab === 'add' ? 'scale-105' : ''} />
          <span className="text-[11px] mt-1">Thêm mới</span>
        </button>
      </div>
    </div>
  );
};

export default NavBar;
