import React, { useMemo } from 'react';
import useWindowWidth from '../../../hooks/useWindowWidth';

const ContributionGraph = ({ contributions = {} }) => {
    const windowWidth = useWindowWidth();
    const isMobile = windowWidth < 640;

    const { weeks, monthLabels } = useMemo(() => {
        const today = new Date();
        const startDate = new Date();
        // 364 days ago (52 weeks)
        startDate.setDate(today.getDate() - 364);
        
        // Align to previous Sunday
        const dayOfWeek = startDate.getDay();
        startDate.setDate(startDate.getDate() - dayOfWeek);

        const weeksList = [];
        let currentDate = new Date(startDate);

        for (let w = 0; w < 53; w++) {
            const week = [];
            for (let d = 0; d < 7; d++) {
                const dateStr = currentDate.toISOString().split('T')[0];
                const isFuture = currentDate > today;
                const count = contributions[dateStr] || 0;

                week.push({
                    date: dateStr,
                    count,
                    isFuture,
                    dateObj: new Date(currentDate)
                });

                currentDate.setDate(currentDate.getDate() + 1);
            }
            weeksList.push(week);
        }

        const activeWeeks = isMobile ? weeksList.slice(-16) : weeksList;

        const labels = [];
        let lastMonth = -1;

        activeWeeks.forEach((week, wIdx) => {
            const firstDay = week[0].dateObj;
            const monthVal = firstDay.getMonth();
            if (monthVal !== lastMonth) {
                labels.push({
                    text: firstDay.toLocaleDateString(undefined, { month: 'short' }),
                    colIndex: wIdx
                });
                lastMonth = monthVal;
            }
        });

        return {
            weeks: activeWeeks,
            monthLabels: labels
        };
    }, [contributions, isMobile]);

    const getCellColor = (count, isFuture) => {
        if (isFuture) return 'rgba(0, 0, 0, 0.05)';
        if (count === 0) return 'var(--surface-3)';
        if (count === 1) return 'rgba(99, 102, 241, 0.25)'; // Indigo 25%
        if (count === 2) return 'rgba(99, 102, 241, 0.55)'; // Indigo 55%
        return '#6366f1'; // Solid Indigo
    };

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="flex flex-col bg-[var(--surface-2)] p-2 rounded-2xl border border-[var(--border-color)] w-full select-none shadow-sm mt-1">
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black uppercase text-[var(--text-sub)] tracking-widest flex items-center gap-1.5">
                    <i className="pi pi-calendar text-[11px] text-[#808bf5]"></i> Consistency Graph
                </span>
                <span className="text-[10px] text-[var(--text-sub)] font-semibold">
                    {isMobile ? 'Last 16 weeks' : 'Last 12 months'}
                </span>
            </div>

            <div className="flex gap-2">
                {/* Y-Axis Days of Week Labels (Only shown on desktop to save space) */}
                {!isMobile && (
                    <div className="grid grid-rows-7 text-[8px] text-[var(--text-sub)] font-bold pr-1 pt-4 h-[72px] items-center">
                        {daysOfWeek.map((day, idx) => (
                            <span key={day} className={idx % 2 === 0 ? 'opacity-0' : 'opacity-60'}>
                                {day}
                            </span>
                        ))}
                    </div>
                )}

                <div className="flex-1 overflow-x-auto no-scrollbar">
                    {/* Month Headers */}
                    <div 
                        className="grid text-[8px] text-[var(--text-sub)] font-bold mb-1 opacity-70 h-3 relative"
                        style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
                    >
                        {monthLabels.map((lbl, idx) => (
                            <span 
                                key={`${lbl.text}-${idx}`} 
                                style={{ gridColumnStart: lbl.colIndex + 1 }}
                                className="absolute truncate"
                            >
                                {lbl.text}
                            </span>
                        ))}
                    </div>

                    {/* The Grid itself */}
                    <div 
                        className="grid gap-[3px] h-[72px]"
                        style={{ 
                            gridTemplateRows: 'repeat(7, minmax(0, 1fr))',
                            gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
                            gridAutoFlow: 'column'
                        }}
                    >
                        {weeks.flat().map((day) => (
                            <div
                                key={day.date}
                                style={{ 
                                    background: getCellColor(day.count, day.isFuture),
                                    borderRadius: '2px'
                                }}
                                className="w-full aspect-square transition-all duration-200 hover:scale-125 hover:z-10 cursor-pointer border border-transparent hover:border-[#6366f1]/50"
                                title={
                                    day.isFuture 
                                        ? 'Future date'
                                        : `${day.count} post${day.count !== 1 ? 's' : ''} on ${day.dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                                }
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-end gap-1.5 mt-2.5 text-[9px] text-[var(--text-sub)] font-bold opacity-85 pr-1">
                <span>Less</span>
                <div className="w-2 h-2 rounded-[1.5px] bg-[var(--surface-3)]" />
                <div className="w-2 h-2 rounded-[1.5px] bg-[rgba(99, 102, 241, 0.25)]" />
                <div className="w-2 h-2 rounded-[1.5px] bg-[rgba(99, 102, 241, 0.55)]" />
                <div className="w-2 h-2 rounded-[1.5px] bg-[#6366f1]" />
                <span>More</span>
            </div>
        </div>
    );
};

export default ContributionGraph;
