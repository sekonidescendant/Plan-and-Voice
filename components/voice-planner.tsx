'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, ArrowRight, RotateCcw, Loader2, X, Keyboard } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { Waveform } from '@/components/waveform';
import { ScheduleTimeline } from '@/components/schedule-timeline';
import type { Phase, ScheduleBlock, GeminiResponse } from '@/lib/types';

const GENERATING_MESSAGES = [
  'Finding your tasks…',
  'Checking the clock…',
  'Blocking your time…',
  'Balancing your breaks…',
  'Finalizing your day…',
];

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function getDuration(start: string, end: string): number {
  return timeToMinutes(end) - timeToMinutes(start);
}

export function VoicePlanner() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [timer, setTimer] = useState(0);
  const [generatingMessage, setGeneratingMessage] = useState(0);
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
  const [tasks, setTasks] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [breakMinutes, setBreakMinutes] = useState(15);
  const [showSettings, setShowSettings] = useState(false);
  const [reminderShown, setReminderShown] = useState(false);

  const {
    isListening,
    transcript,
    interimTranscript,
    error: speechError,
    start,
    stop,
    reset,
  } = useSpeechRecognition();

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer for listening phase
  useEffect(() => {
    if (isListening) {
      setTimer(0);
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isListening]);

  // Handle speech recognition state transitions
  useEffect(() => {
    if (isListening && phase !== 'listening') {
      setPhase('listening');
    }
    if (!isListening && phase === 'listening') {
      const finalText = transcript || interimTranscript;
      if (finalText.trim()) {
        setTextInput(finalText.trim());
        setPhase('confirm');
      } else if (speechError) {
        setError(speechError);
        setPhase('idle');
      } else {
        setError('No speech detected. Please try again.');
        setPhase('idle');
      }
    }
  }, [isListening, transcript, interimTranscript, speechError, phase]);

  // Generating message cycling
  useEffect(() => {
    if (phase !== 'generating') return;
    const interval = setInterval(() => {
      setGeneratingMessage((m) => (m + 1) % GENERATING_MESSAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [phase]);

  // Reminder toast after schedule loads
  useEffect(() => {
    if (phase === 'schedule' && !reminderShown && schedule.length > 0) {
      const t = setTimeout(() => {
        setReminderShown(true);
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [phase, reminderShown, schedule]);

  const handleMicClick = useCallback(() => {
    setError(null);
    reset();
    start();
  }, [start, reset]);

  const handleStopListening = useCallback(() => {
    stop();
  }, [stop]);

  const handleTryAgain = useCallback(() => {
    reset();
    setTextInput('');
    setShowTextInput(false);
    setError(null);
    setPhase('idle');
  }, [reset]);

  const handlePlanMyDay = useCallback(async () => {
    const finalTranscript = textInput.trim();
    if (!finalTranscript) return;

    setPhase('generating');
    setError(null);
    setGeneratingMessage(0);

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: finalTranscript,
          startTime,
          endTime,
          breakMinutes,
        }),
      });

      const data: GeminiResponse | { error: string } = await res.json();

      if (!res.ok) {
        const errMsg = (data as { error: string }).error || 'Failed to generate plan';
        setError(errMsg);
        setPhase('confirm');
        return;
      }

      const typedData = data as GeminiResponse;
      setSchedule(typedData.schedule || []);
      setTasks(typedData.tasks || []);
      setNotes(typedData.notes || '');
      setReminderShown(false);
      setPhase('schedule');
    } catch (err: any) {
      setError(err?.message ?? 'Network error. Please try again.');
      setPhase('confirm');
    }
  }, [textInput, startTime, endTime, breakMinutes]);

  const handleAddTime = useCallback(
    (index: number) => {
      setSchedule((prev) => {
        const updated = [...prev];
        const block = updated[index];
        const duration = getDuration(block.start, block.end);
        const newEnd = addMinutesToTime(block.end, 30);

        updated[index] = { ...block, end: newEnd };

        for (let i = index + 1; i < updated.length; i++) {
          const cur = updated[i];
          const curDuration = getDuration(cur.start, cur.end);
          const newStart = addMinutesToTime(updated[i - 1].end, 0);
          const newEndForThis = addMinutesToTime(newStart, curDuration);
          updated[i] = { ...cur, start: newStart, end: newEndForThis };
        }

        return updated;
      });
    },
    []
  );

  const handleRegenerate = useCallback(() => {
    handlePlanMyDay();
  }, [handlePlanMyDay]);

  const handleEditSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const applySettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  const displayTranscript = textInput;

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8 sm:py-12">
      {/* Header */}
      <header className="w-full max-w-3xl flex items-center justify-between mb-12 sm:mb-16">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{
              background: 'rgba(232, 163, 61, 0.12)',
              border: '1px solid rgba(232, 163, 61, 0.25)',
            }}
          >
            <Mic size={16} strokeWidth={1.6} style={{ color: '#E8A33D' }} />
          </div>
          <span className="eyebrow">Voice-to-Plan</span>
        </div>
        {phase === 'schedule' && (
          <button
            onClick={handleEditSettings}
            className="press-scale eyebrow hover:text-white transition-colors"
          >
            Settings
          </button>
        )}
      </header>

      {/* Main content */}
      <main className="w-full max-w-2xl flex-1 flex flex-col items-center">
        {phase === 'idle' && (
          <IdlePhase
            onMicClick={handleMicClick}
            showTextInput={showTextInput}
            setShowTextInput={setShowTextInput}
            textInput={textInput}
            setTextInput={setTextInput}
            error={error}
            onPlanFromText={() => {
              if (textInput.trim()) {
                setPhase('confirm');
              }
            }}
          />
        )}

        {phase === 'listening' && (
          <ListeningPhase
            timer={timer}
            interimTranscript={interimTranscript}
            transcript={transcript}
            onStop={handleStopListening}
          />
        )}

        {phase === 'confirm' && (
          <ConfirmPhase
            transcript={displayTranscript}
            onEdit={(val) => {
              setTextInput(val);
            }}
            onTryAgain={handleTryAgain}
            onPlan={handlePlanMyDay}
            error={error}
            startTime={startTime}
            endTime={endTime}
            breakMinutes={breakMinutes}
            setStartTime={setStartTime}
            setEndTime={setEndTime}
            setBreakMinutes={setBreakMinutes}
          />
        )}

        {phase === 'generating' && (
          <GeneratingPhase message={GENERATING_MESSAGES[generatingMessage]} />
        )}

        {phase === 'schedule' && (
          <SchedulePhase
            blocks={schedule}
            tasks={tasks}
            notes={notes}
            onAddTime={handleAddTime}
            onRegenerate={handleRegenerate}
            onEdit={handleEditSettings}
            showReminder={reminderShown}
            startTime={startTime}
            endTime={endTime}
            breakMinutes={breakMinutes}
            setStartTime={setStartTime}
            setEndTime={setEndTime}
            setBreakMinutes={setBreakMinutes}
            showSettings={showSettings}
            setShowSettings={setShowSettings}
            applySettings={applySettings}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-3xl mt-16 pt-8 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between">
          <span className="eyebrow">Powered by Gemini</span>
          <span className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
            Voice-to-Plan
          </span>
        </div>
      </footer>
    </div>
  );
}

function IdlePhase({
  onMicClick,
  showTextInput,
  setShowTextInput,
  textInput,
  setTextInput,
  error,
  onPlanFromText,
}: {
  onMicClick: () => void;
  showTextInput: boolean;
  setShowTextInput: (v: boolean) => void;
  textInput: string;
  setTextInput: (v: string) => void;
  error: string | null;
  onPlanFromText: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center" style={{ animation: 'status-fade 0.5s ease-out' }}>
      <span className="eyebrow mb-6">Voice-to-Plan</span>
      <h1
        className="font-display text-4xl sm:text-[44px] font-medium tracking-tight mb-3"
        style={{ color: 'var(--text-primary)', lineHeight: 1.15 }}
      >
        What do you want to get<br />done today?
      </h1>
      <p className="text-base mb-12 max-w-md" style={{ color: 'var(--text-secondary)' }}>
        Speak naturally about your tasks, meetings, and constraints. I&apos;ll build you a schedule.
      </p>

      {/* Mic button */}
      <div className="relative mb-8">
        <div className="mic-pulse-ring" style={{ width: 88, height: 88, left: -6, top: -6 }} />
        <div className="mic-pulse-ring" style={{ width: 88, height: 88, left: -6, top: -6, animationDelay: '1s' }} />
        <button
          onClick={onMicClick}
          className="press-scale relative flex items-center justify-center rounded-full"
          style={{
            width: 76,
            height: 76,
            background: 'var(--amber)',
            boxShadow: '0 4px 20px rgba(232, 163, 61, 0.3)',
          }}
        >
          <Mic size={28} strokeWidth={1.6} style={{ color: '#1B1D29' }} />
        </button>
      </div>

      {/* Type instead link */}
      {!showTextInput ? (
        <button
          onClick={() => setShowTextInput(true)}
          className="text-sm transition-colors hover:underline"
          style={{ color: 'var(--text-secondary)' }}
        >
          or type instead
        </button>
      ) : (
        <div className="w-full max-w-lg mt-2" style={{ animation: 'status-fade 0.3s ease-out' }}>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="I need to finish the quarterly report, have lunch at 12:30, exercise for 45 minutes, and no work after 8pm..."
            className="w-full rounded-lg p-4 text-sm resize-none"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              boxShadow: 'var(--card-shadow)',
              color: 'var(--text-primary)',
              minHeight: 120,
              fontFamily: 'Inter, sans-serif',
              lineHeight: 1.6,
            }}
            autoFocus
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={onPlanFromText}
              disabled={!textInput.trim()}
              className="press-scale flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all disabled:opacity-40"
              style={{
                background: 'var(--amber)',
                color: '#1B1D29',
              }}
            >
              Plan my day
              <ArrowRight size={15} strokeWidth={1.6} />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          className="mt-6 rounded-lg px-4 py-3 text-sm max-w-md"
          style={{
            background: 'rgba(196, 89, 46, 0.1)',
            border: '1px solid rgba(196, 89, 46, 0.25)',
            color: '#C4592E',
          }}
        >
          {error}
        </div>
      )}

      {!error && (
        <p className="mt-6 text-xs max-w-sm" style={{ color: 'var(--text-dim)' }}>
          Tip: If the mic doesn&apos;t work, click the Brave shield icon in your address bar and make sure microphone access is allowed.
        </p>
      )}
    </div>
  );
}

function ListeningPhase({
  timer,
  interimTranscript,
  transcript,
  onStop,
}: {
  timer: number;
  interimTranscript: string;
  transcript: string;
  onStop: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center w-full" style={{ animation: 'status-fade 0.4s ease-out' }}>
      <span className="eyebrow mb-6" style={{ color: '#E8A33D' }}>
        Listening
      </span>

      {/* Timer */}
      <div className="font-mono text-2xl mb-8" style={{ color: 'var(--text-secondary)' }}>
        {formatTimer(timer)}
      </div>

      {/* Waveform */}
      <Waveform active={true} />

      {/* Stop button */}
      <button
        onClick={onStop}
        className="press-scale mt-8 flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-all"
        style={{
          background: 'rgba(232, 163, 61, 0.12)',
          border: '1px solid rgba(232, 163, 61, 0.25)',
          color: '#E8A33D',
        }}
      >
        <MicOff size={16} strokeWidth={1.6} />
        Stop recording
      </button>

      {/* Live transcript */}
      {(interimTranscript || transcript) && (
        <div className="mt-10 w-full max-w-lg">
          <div
            className="rounded-lg p-4 text-left text-sm"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              boxShadow: 'var(--card-shadow)',
              minHeight: 60,
              color: 'var(--text-primary)',
              lineHeight: 1.6,
            }}
          >
            {transcript && (
              <span style={{ color: 'var(--text-primary)' }}>{transcript} </span>
            )}
            {interimTranscript && (
              <span style={{ color: 'var(--text-dim)' }}>{interimTranscript}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfirmPhase({
  transcript,
  onEdit,
  onTryAgain,
  onPlan,
  error,
  startTime,
  endTime,
  breakMinutes,
  setStartTime,
  setEndTime,
  setBreakMinutes,
}: {
  transcript: string;
  onEdit: (val: string) => void;
  onTryAgain: () => void;
  onPlan: () => void;
  error: string | null;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  setStartTime: (v: string) => void;
  setEndTime: (v: string) => void;
  setBreakMinutes: (v: number) => void;
}) {
  const [editText, setEditText] = useState(transcript);

  return (
    <div className="w-full max-w-xl flex flex-col" style={{ animation: 'status-fade 0.4s ease-out' }}>
      <span className="eyebrow mb-4 text-center">Confirm your plan</span>

      <textarea
        value={editText}
        onChange={(e) => {
          setEditText(e.target.value);
          onEdit(e.target.value);
        }}
        className="w-full rounded-lg p-4 text-sm resize-none mb-4"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          boxShadow: 'var(--card-shadow)',
          color: 'var(--text-primary)',
          minHeight: 140,
          fontFamily: 'Inter, sans-serif',
          lineHeight: 1.6,
        }}
        autoFocus
      />

      {/* Settings row */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label className="eyebrow" style={{ fontSize: 10 }}>Start</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="font-mono text-xs rounded-md px-2.5 py-1.5"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="eyebrow" style={{ fontSize: 10 }}>End</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="font-mono text-xs rounded-md px-2.5 py-1.5"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="eyebrow" style={{ fontSize: 10 }}>Break</label>
          <input
            type="number"
            value={breakMinutes}
            onChange={(e) => setBreakMinutes(Number(e.target.value))}
            min={0}
            max={60}
            className="font-mono text-xs rounded-md px-2.5 py-1.5 w-16"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-primary)',
            }}
          />
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>min</span>
        </div>
      </div>

      {error && (
        <div
          className="mb-4 rounded-lg px-4 py-3 text-sm"
          style={{
            background: 'rgba(196, 89, 46, 0.1)',
            border: '1px solid rgba(196, 89, 46, 0.25)',
            color: '#C4592E',
          }}
        >
          {error}
        </div>
      )}

      {/* Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={onTryAgain}
          className="press-scale flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all"
          style={{
            background: 'transparent',
            border: '1px solid var(--card-border)',
            color: 'var(--text-secondary)',
          }}
        >
          <RotateCcw size={15} strokeWidth={1.6} />
          Try again
        </button>
        <button
          onClick={onPlan}
          disabled={!editText.trim()}
          className="press-scale flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-all disabled:opacity-40"
          style={{
            background: 'var(--amber)',
            color: '#1B1D29',
            boxShadow: '0 4px 16px rgba(232, 163, 61, 0.25)',
          }}
        >
          Plan my day
          <ArrowRight size={15} strokeWidth={1.6} />
        </button>
      </div>
    </div>
  );
}

function GeneratingPhase({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center text-center" style={{ animation: 'status-fade 0.4s ease-out' }}>
      <span className="eyebrow mb-8" style={{ color: '#E8A33D' }}>
        Generating
      </span>

      <div className="relative mb-8">
        <Loader2
          size={48}
          strokeWidth={1.5}
          className="animate-spin"
          style={{ color: '#E8A33D' }}
        />
      </div>

      <div
        key={message}
        className="status-fade font-display text-2xl font-medium"
        style={{ color: 'var(--text-primary)' }}
      >
        {message}
      </div>

      <div className="flex gap-1.5 mt-6">
        {GENERATING_MESSAGES.map((_, i) => (
          <div
            key={i}
            className="h-1 rounded-full transition-all duration-500"
            style={{
              width: i === 0 ? 24 : 6,
              background: i === 0 ? '#E8A33D' : 'rgba(255,255,255,0.1)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SchedulePhase({
  blocks,
  tasks,
  notes,
  onAddTime,
  onRegenerate,
  onEdit,
  showReminder,
  startTime,
  endTime,
  breakMinutes,
  setStartTime,
  setEndTime,
  setBreakMinutes,
  showSettings,
  setShowSettings,
  applySettings,
}: {
  blocks: ScheduleBlock[];
  tasks: string[];
  notes: string;
  onAddTime: (index: number) => void;
  onRegenerate: () => void;
  onEdit: () => void;
  showReminder: boolean;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  setStartTime: (v: string) => void;
  setEndTime: (v: string) => void;
  setBreakMinutes: (v: number) => void;
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  applySettings: () => void;
}) {
  const nextBlock = blocks.length > 1 ? blocks[1] : null;

  return (
    <div className="w-full max-w-xl" style={{ animation: 'status-fade 0.4s ease-out' }}>
      {/* Reminder toast */}
      {showReminder && nextBlock && (
        <div
          className="fixed top-6 right-6 z-50 rounded-lg px-4 py-3 text-sm flex items-center gap-3"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid rgba(232, 163, 61, 0.25)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            animation: 'status-fade 0.4s ease-out',
            maxWidth: 320,
          }}
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: 'rgba(232, 163, 61, 0.12)',
              border: '1px solid rgba(232, 163, 61, 0.25)',
            }}
          >
            <Mic size={14} strokeWidth={1.6} style={{ color: '#E8A33D' }} />
          </div>
          <div>
            <div className="font-medium" style={{ color: 'var(--text-primary)', fontSize: 13 }}>
              Time to move on
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Next up: {nextBlock.title}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="eyebrow">Your schedule</span>
          <h2
            className="font-display text-2xl font-medium mt-1"
            style={{ color: 'var(--text-primary)' }}
          >
            {blocks.length} blocks planned
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRegenerate}
            className="press-scale flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-all"
            style={{
              background: 'transparent',
              border: '1px solid var(--card-border)',
              color: 'var(--text-secondary)',
            }}
          >
            <RotateCcw size={13} strokeWidth={1.6} />
            Regenerate
          </button>
          <button
            onClick={onEdit}
            className="press-scale flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-all"
            style={{
              background: 'transparent',
              border: '1px solid var(--card-border)',
              color: 'var(--text-secondary)',
            }}
          >
            <Keyboard size={13} strokeWidth={1.6} />
            Edit
          </button>
        </div>
      </div>

      {/* Timeline */}
      <ScheduleTimeline blocks={blocks} onAddTime={onAddTime} />

      {/* Notes */}
      {notes && (
        <div
          className="mt-6 rounded-lg p-4 text-sm"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            boxShadow: 'var(--card-shadow)',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}
        >
          <div className="eyebrow mb-2">Notes</div>
          {notes}
        </div>
      )}

      {/* Tasks list */}
      {tasks.length > 0 && (
        <div className="mt-6">
          <div className="eyebrow mb-3">Tasks identified</div>
          <div className="flex flex-wrap gap-2">
            {tasks.map((task, i) => (
              <span
                key={i}
                className="rounded-md px-3 py-1.5 text-xs font-medium"
                style={{
                  background: 'rgba(199, 146, 63, 0.08)',
                  border: '1px solid rgba(199, 146, 63, 0.2)',
                  color: '#C7923F',
                }}
              >
                {task}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowSettings(false)}
        >
          <div
            className="w-full max-w-md rounded-xl p-6"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
                Schedule settings
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="press-scale rounded-md p-1"
                style={{ color: 'var(--text-dim)' }}
              >
                <X size={18} strokeWidth={1.6} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="eyebrow block mb-2">Start time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="font-mono text-sm w-full rounded-md px-3 py-2"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--card-border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div>
                <label className="eyebrow block mb-2">End time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="font-mono text-sm w-full rounded-md px-3 py-2"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--card-border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div>
                <label className="eyebrow block mb-2">Break length (minutes)</label>
                <input
                  type="number"
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(Number(e.target.value))}
                  min={0}
                  max={60}
                  className="font-mono text-sm w-full rounded-md px-3 py-2"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--card-border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="press-scale flex-1 rounded-lg py-2.5 text-sm font-medium"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--card-border)',
                  color: 'var(--text-secondary)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  applySettings();
                  onRegenerate();
                }}
                className="press-scale flex-1 rounded-lg py-2.5 text-sm font-medium"
                style={{
                  background: 'var(--amber)',
                  color: '#1B1D29',
                }}
              >
                Apply & regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
