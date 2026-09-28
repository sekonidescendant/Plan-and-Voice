'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionHook {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

function friendlyError(error: string): string {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was blocked. Click the Brave shield icon in your address bar and allow microphone access, then try again.';
    case 'audio-capture':
      return 'No microphone was found. Make sure a microphone is connected and not in use by another app.';
    case 'network':
      return 'The browser blocked the speech recognition service. In Brave: go to Settings > Privacy and security > Google Web Speech API, or click the shield icon in the address bar and disable "Prevent sites from connecting to speech recognition services." You can also use the "type instead" option below.';
    case 'language-not-supported':
      return 'The selected language is not supported for speech recognition.';
    case 'no-speech':
      return '';
    case 'aborted':
      return '';
    default:
      return `Speech recognition error: ${error}`;
  }
}

export function useSpeechRecognition(): SpeechRecognitionHook {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef('');
  const lastInterimRef = useRef('');
  const manualStopRef = useRef(false);
  const retryCountRef = useRef(0);
  const shouldRestartRef = useRef(false);

  useEffect(() => {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setError(
        'Speech recognition is not supported in this browser. Try Chrome or Brave, or use the "type instead" option.'
      );
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let interim = '';
      let finalChunk = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalChunk += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (finalChunk) {
        finalTranscriptRef.current += finalChunk;
        setTranscript(finalTranscriptRef.current.trim());
        retryCountRef.current = 0;
      }
      if (interim) {
        lastInterimRef.current = interim;
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }

      if (event.error === 'network') {
        if (retryCountRef.current < 2 && !manualStopRef.current) {
          retryCountRef.current++;
          shouldRestartRef.current = true;
          return;
        }
      }

      const msg = friendlyError(event.error);
      if (msg) {
        setError(msg);
      }
    };

    recognition.onend = () => {
      if (shouldRestartRef.current && !manualStopRef.current) {
        shouldRestartRef.current = false;
        try {
          recognition.start();
          return;
        } catch {
          // fall through to end
        }
      }

      setIsListening(false);
      const finalText = finalTranscriptRef.current || lastInterimRef.current;
      if (finalText.trim()) {
        setTranscript(finalText.trim());
      }
    };

    recognitionRef.current = recognition;

    return () => {
      manualStopRef.current = true;
      shouldRestartRef.current = false;
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    finalTranscriptRef.current = '';
    lastInterimRef.current = '';
    manualStopRef.current = false;
    shouldRestartRef.current = false;
    retryCountRef.current = 0;
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e: any) {
      if (e?.name === 'InvalidStateError') {
        try {
          recognitionRef.current.stop();
          setTimeout(() => {
            try {
              recognitionRef.current.start();
              setIsListening(true);
            } catch {
              setError('Could not start speech recognition. Try again.');
            }
          }, 200);
        } catch {
          // ignore
        }
      } else {
        setError('Could not start speech recognition. Try again.');
      }
    }
  }, []);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    manualStopRef.current = true;
    shouldRestartRef.current = false;
    try {
      recognitionRef.current.stop();
    } catch {
      // ignore
    }
    setIsListening(false);
    const finalText = finalTranscriptRef.current || lastInterimRef.current;
    if (finalText.trim()) {
      setTranscript(finalText.trim());
    }
  }, []);

  const reset = useCallback(() => {
    finalTranscriptRef.current = '';
    lastInterimRef.current = '';
    manualStopRef.current = false;
    shouldRestartRef.current = false;
    retryCountRef.current = 0;
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    start,
    stop,
    reset,
  };
}
