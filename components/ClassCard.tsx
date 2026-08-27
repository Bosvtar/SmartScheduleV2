
import React from 'react';
import { ScheduleItem, getPeriodLabelFromTime, getClassColorTheme, ClassColorTheme } from '../types';
import { Clock, MapPin, CalendarDays, Users, BookOpen } from 'lucide-react';

interface ClassCardProps {
  item: ScheduleItem;
  onClick: () => void;
  isToday?: boolean;
  customColorMap?: Record<string, string>;
  colorTheme?: ClassColorTheme;
}

const ClassCard: React.FC<ClassCardProps> = ({ 
  item, 
  onClick, 
  isToday, 
  customColorMap = {},
  colorTheme 
}) => {
  const theme = colorTheme || getClassColorTheme(item.className, customColorMap);
  const periodLabel = getPeriodLabelFromTime(item.startTime, item.endTime);

  return (
    <div 
      onClick={onClick}
      className={`relative p-4 mb-3 rounded-2xl border cursor-pointer transition-all active:scale-[0.98] overflow-hidden ${
        isToday 
        ? `${theme.cardBg} ${theme.cardBorder} shadow-sm ring-1 ring-inset ${theme.ring}` 
        : 'bg-white border-gray-200/80 shadow-xs hover:border-gray-300'
      }`}
    >
      {/* Left Color Accent Bar */}
      <div 
        className={`absolute left-0 top-0 bottom-0 w-1.5 ${theme.accentBar}`} 
        style={{ backgroundColor: theme.dotColor }}
      />

      {isToday && (
        <span 
          className={`absolute top-3 right-3 px-2 py-0.5 ${theme.badgeBg} ${theme.badgeText} text-[10px] font-bold uppercase tracking-wider rounded-full flex items-center shadow-2xs`}
        >
          <span 
            className="w-1.5 h-1.5 rounded-full mr-1 animate-pulse" 
            style={{ backgroundColor: theme.dotColor }} 
          />
          Hôm nay
        </span>
      )}
      
      <div className="pl-1.5">
        <h3 className="text-base font-bold text-gray-900 pr-16 truncate">{item.subject}</h3>

        {/* Lesson Name (Bài số & Nội dung) */}
        {item.lessonName && (
          <div className="flex items-start mt-1.5 text-gray-800 bg-gray-50/90 px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-gray-200/60">
            <BookOpen size={14} className="mr-2 text-indigo-600 shrink-0 mt-0.5" />
            <span className="leading-snug">{item.lessonName}</span>
          </div>
        )}
        
        {/* Class Badge & Date row */}
        <div className="flex items-center flex-wrap gap-2 mt-2">
          {item.className && (
            <span 
              className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold ${theme.tagBg} ${theme.tagText} border ${theme.cardBorder}`}
            >
              <span 
                className="w-2 h-2 rounded-full mr-1.5 shrink-0" 
                style={{ backgroundColor: theme.dotColor }} 
              />
              Lớp: {item.className}
            </span>
          )}

          {item.date && (
            <div className="flex items-center text-xs font-semibold text-gray-600">
              <CalendarDays size={14} className="mr-1 text-indigo-500" />
              <span>{item.date}</span>
            </div>
          )}
        </div>

        {/* Time and Location */}
        <div className="flex items-center mt-2.5 text-gray-600 text-xs flex-wrap gap-2 pt-1 border-t border-gray-100">
          <div className="flex items-center">
            <Clock size={14} className="mr-1 text-gray-400" />
            <span className="font-medium">{item.startTime} - {item.endTime}</span>
          </div>
          {periodLabel && (
            <span className="px-1.5 py-0.2 bg-gray-100 text-gray-700 rounded text-[11px] font-semibold">
              {periodLabel}
            </span>
          )}
          <div className="flex items-center text-gray-500 ml-auto">
            <MapPin size={13} className="mr-1 text-gray-400" />
            <span className="font-medium truncate max-w-[130px]">{item.location}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassCard;
