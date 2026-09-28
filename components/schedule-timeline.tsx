'use client';

import { ScheduleBlock } from '@/lib/types';
import { Clock, Plus, Coffee, Lock } from 'lucide-react';

interface ScheduleTimelineProps {
  blocks: ScheduleBlock[];
  onAddTime?: (index: number) => void;
  showAddButton?: boolean;
}

const typeConfig = {
  task: {
    accent: '#C7923F',
    bg: 'transparent',
    icon: Clock,
  label: 'Task',
  showAdd: true,
  showBg: false,
  showIcon: false,
  iconColor: '#C7923F',
  iconBg: 'rgba(199, 146, 63, 0.12)',
  iconBorder: 'rgba(199, 146, 63, 0.25)',
  titleColor: '#E8E6E1',
  timeColor: '#8A8B96',
  hoverBorder: 'rgba(199, 146, 63, 0.3)',
  addButtonBorder: 'rgba(199, 146, 63, 0.3)',
    addButtonHoverBg: 'rgba(199, 146, 63, 0.15)',
    addButtonHoverBorder: 'rgba(199, 146, 63, 0.5)',
    addButtonColor: '#C7923F',
  addButtonHoverColor: '#E8A33D',
    addButtonText: '+30 min',
    showPlusIcon: true,
  },
  break: {
    accent: '#3E7C74',
    bg: 'transparent',
    icon: Coffee,
    label: 'Break',
    showAdd: false,
    showBg: false,
    showIcon: true,
    iconColor: '#3E7C74',
    iconBg: 'rgba(62, 124, 116, 0.12)',
    iconBorder: 'rgba(62, 124, 116, 0.25)',
    titleColor: '#A8B5B2',
    timeColor: '#5A5B66',
    hoverBorder: 'rgba(62, 124, 116, 0.2)',
    addButtonBorder: '',
    addButtonHoverBg: '',
    addButtonHoverBorder: '',
    addButtonColor: '',
    addButtonHoverColor: '',
    addButtonText: '',
    showPlusIcon: false,
  },
  fixed: {
    accent: '#C4592E',
    bg: 'rgba(196, 89, 46, 0.08)',
    icon: Lock,
    label: 'Fixed',
    showAdd: false,
    showBg: true,
    showIcon: true,
    iconColor: '#C4592E',
    iconBg: 'rgba(196, 89, 46, 0.15)',
    iconBorder: 'rgba(196, 89, 46, 0.3)',
    titleColor: '#E8E6E1',
    timeColor: '#C4592E',
    hoverBorder: 'rgba(196, 89, 46, 0.3)',
    addButtonBorder: '',
    addButtonHoverBg: '',
    addButtonHoverBorder: '',
    addButtonColor: '',
    addButtonHoverColor: '',
    addButtonText: '',
    showPlusIcon: false,
  },
} as const;

export function ScheduleTimeline({
  blocks,
  onAddTime,
  showAddButton = true,
}: ScheduleTimelineProps) {
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, i) => {
        const cfg = typeConfig[block.type];
        const Icon = cfg.icon;

        return (
          <div
            key={i}
            className="schedule-row group relative flex items-center gap-4 rounded-lg pl-5 pr-4 py-4 transition-all"
            style={{
              animationDelay: `${i * 50}ms`,
              background: cfg.showBg ? cfg.bg : 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div
              className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
              style={{ background: cfg.accent }}
            />

            {cfg.showIcon && (
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: cfg.iconBg,
                  border: `1px solid ${cfg.iconBorder}`,
                }}
              >
                <Icon
                  size={16}
                  strokeWidth={1.6}
                  style={{ color: cfg.iconColor }}
                />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div
                className="text-[15px] font-medium truncate"
                style={{ color: cfg.titleColor }}
              >
                {block.title}
              </div>
              <div
                className="font-mono text-xs mt-0.5"
                style={{ color: cfg.timeColor }}
              >
                {block.start} — {block.end}
              </div>
            </div>

            {showAddButton && cfg.showAdd && onAddTime && (
              <button
                onClick={() => onAddTime(i)}
                className="press-scale flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  border: `1px solid ${cfg.addButtonBorder}`,
                  color: cfg.addButtonColor,
                  background: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = cfg.addButtonHoverBg;
                  e.currentTarget.style.borderColor = cfg.addButtonHoverBorder;
                  e.currentTarget.style.color = cfg.addButtonHoverColor;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = cfg.addButtonBorder;
                  e.currentTarget.style.color = cfg.addButtonColor;
                }}
              >
                {cfg.showPlusIcon && <Plus size={12} strokeWidth={1.6} />}
                {cfg.addButtonText}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
