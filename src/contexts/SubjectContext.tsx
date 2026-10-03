import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Subject } from '../types';
import { subjectService } from '../services/subject.service';

interface SubjectContextType {
  subjects: Subject[];
  activeSubjectId: string | null;
  setActiveSubjectId: (id: string | null) => void;
  activeSubject: Subject | null;
  isLoading: boolean;
  refreshSubjects: () => Promise<void>;
}

const SubjectContext = createContext<SubjectContextType | undefined>(undefined);

export function SubjectProvider({ children }: { children: React.ReactNode }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshSubjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await subjectService.getSubjects();
      if (res.success) {
        setSubjects(Array.isArray(res.data) ? res.data : []);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSubjects();
  }, [refreshSubjects]);

  const activeSubject = (Array.isArray(subjects) ? subjects : []).find((s) => s.id === activeSubjectId) || null;

  return (
    <SubjectContext.Provider
      value={{
        subjects,
        activeSubjectId,
        setActiveSubjectId,
        activeSubject,
        isLoading,
        refreshSubjects,
      }}
    >
      {children}
    </SubjectContext.Provider>
  );
}

export function useSubjects() {
  const context = useContext(SubjectContext);
  if (!context) {
    throw new Error('useSubjects must be used within a SubjectProvider');
  }
  return context;
}
