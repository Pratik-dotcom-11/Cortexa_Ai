import { useState, useEffect, useRef, useCallback } from 'react';

// Web Speech API interface definitions for TypeScript
export interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

export interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

export interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  durationSeconds: number;
  startListening: (options?: UseSpeechRecognitionOptions) => void;
  stopListening: () => void;
  resetTranscript: () => void;
  setTranscript: React.Dispatch<React.SetStateAction<string>>;
  appendCustomText: (text: string) => void;
  clearError: () => void;
}

export const useSpeechRecognition = (): UseSpeechRecognitionReturn => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const intentionalStopRef = useRef(false);
  const timerRef = useRef<any>(null);
  const currentOptionsRef = useRef<UseSpeechRecognitionOptions>({
    lang: 'en-US',
    continuous: true,
    interimResults: true,
  });

  // Check if Web Speech API is supported in the browser
  const isSupported =
    typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // Clean timer
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    stopTimer();
    timerRef.current = setInterval(() => {
      setDurationSeconds((prev) => prev + 1);
    }, 1000);
  };

  // Safe stop listening
  const stopListening = useCallback(() => {
    intentionalStopRef.current = true;
    isListeningRef.current = false;
    stopTimer();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore stop error
      }
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setDurationSeconds(0);
    setError(null);
  }, []);

  const appendCustomText = useCallback((text: string) => {
    if (!text) return;
    setTranscript((prev) => {
      if (!prev.trim()) return text;
      const needsSpace = !prev.endsWith(' ') && !prev.endsWith('\n');
      return prev + (needsSpace ? ' ' : '') + text;
    });
  }, []);

  const startListening = useCallback(
    (options?: UseSpeechRecognitionOptions) => {
      if (!isSupported) {
        setError(
          'Web Speech API is not supported in this browser. Please use Chrome, Edge, or Safari for voice dictation.'
        );
        return;
      }

      setError(null);
      intentionalStopRef.current = false;
      const mergedOptions: UseSpeechRecognitionOptions = {
        ...currentOptionsRef.current,
        ...options,
      };
      currentOptionsRef.current = mergedOptions;

      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      // If already running, stop previous instance
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }

      try {
        const recognition = new SpeechRecognitionClass();
        recognition.continuous = mergedOptions.continuous !== false;
        recognition.interimResults = mergedOptions.interimResults !== false;
        recognition.lang = mergedOptions.lang || 'en-US';

        recognition.onstart = () => {
          isListeningRef.current = true;
          setIsListening(true);
          startTimer();
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let interim = '';
          let finalBatch = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const result = event.results[i];
            const text = result[0]?.transcript || '';
            if (result.isFinal) {
              finalBatch += text;
            } else {
              interim += text;
            }
          }

          if (finalBatch) {
            setTranscript((prev) => {
              const trimmed = finalBatch.trim();
              if (!prev) return trimmed;
              const needsSpace = !prev.endsWith(' ') && !prev.endsWith('\n');
              return prev + (needsSpace ? ' ' : '') + trimmed;
            });
          }

          setInterimTranscript(interim);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.warn('Speech recognition error event:', event.error);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setError(
              'Microphone permission was denied. Please allow microphone access in your browser address bar to dictate.'
            );
            stopListening();
          } else if (event.error === 'audio-capture') {
            setError('No microphone was detected. Please connect or enable your microphone.');
            stopListening();
          } else if (event.error === 'network') {
            setError('Network connection error occurred during speech-to-text recognition.');
          } else if (event.error === 'no-speech') {
            // Non-fatal: user just paused, keep listening if not stopped
          } else if (event.error === 'aborted') {
            // Intentional abort, do nothing
          } else {
            setError(`Speech recognition notice: ${event.error}`);
          }
        };

        recognition.onend = () => {
          setInterimTranscript('');
          // If the user did not intentionally stop and continuous is expected, attempt to keep listening
          if (!intentionalStopRef.current && isListeningRef.current) {
            try {
              recognition.start();
            } catch (e) {
              setIsListening(false);
              stopTimer();
            }
          } else {
            isListeningRef.current = false;
            setIsListening(false);
            stopTimer();
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err: any) {
        console.error('Failed to initialize SpeechRecognition:', err);
        setError(err.message || 'Could not start speech recognition.');
        setIsListening(false);
        stopTimer();
      }
    },
    [isSupported, stopListening]
  );

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      intentionalStopRef.current = true;
      isListeningRef.current = false;
      stopTimer();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    durationSeconds,
    startListening,
    stopListening,
    resetTranscript,
    setTranscript,
    appendCustomText,
    clearError,
  };
};
