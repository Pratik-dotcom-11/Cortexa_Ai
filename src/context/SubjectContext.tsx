import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext.tsx';
import { Subject } from '../types/app.types.ts';

interface SubjectContextType {
  subjects: Subject[];
  activeSubject: Subject | null;
  loading: boolean;
  setActiveSubject: (subject: Subject | null) => void;
  fetchSubjects: () => Promise<void>;
  createNewSubject: (data: { name: string; code?: string; color?: string; description?: string }) => Promise<Subject>;
  removeSubject: (id: number) => Promise<void>;
}

const SubjectContext = createContext<SubjectContextType | null>(null);

export const SubjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, apiFetch } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSubjects = useCallback(async () => {
    if (!isAuthenticated) {
      setSubjects([]);
      setActiveSubject(null);
      return;
    }

    try {
      setLoading(true);
      const res = await apiFetch('/api/subjects');
      if (res.ok) {
        const raw = await res.json();
        const list: Subject[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
          ? raw.data
          : [];
        setSubjects(list);
        if (list.length > 0 && !activeSubject) {
          setActiveSubject(list[0]);
        } else if (activeSubject) {
          const currentStillExists = list.find((s: Subject) => s.id === activeSubject.id);
          setActiveSubject(currentStillExists || (list.length > 0 ? list[0] : null));
        }
      }
    } catch (err) {
      console.error('Error fetching subjects:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, apiFetch, activeSubject]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSubjects();
    }
  }, [isAuthenticated]);

  const createNewSubject = async (data: {
    name: string;
    code?: string;
    color?: string;
    description?: string;
  }): Promise<Subject> => {
    const res = await apiFetch('/api/subjects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || err.message || 'Failed to create subject');
    }
    const raw = await res.json();
    const created: Subject = raw?.data ?? raw;
    setSubjects((prev) => [created, ...(Array.isArray(prev) ? prev : [])]);
    setActiveSubject(created);
    return created;
  };

  const removeSubject = async (id: number) => {
    const res = await apiFetch(`/api/subjects/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setSubjects((prev) => {
        const remaining = Array.isArray(prev) ? prev.filter((s) => s.id !== id) : [];
        if (activeSubject?.id === id) {
          setActiveSubject(remaining.length > 0 ? remaining[0] : null);
        }
        return remaining;
      });
    }
  };

  return (
    <SubjectContext.Provider
      value={{
        subjects,
        activeSubject,
        loading,
        setActiveSubject,
        fetchSubjects,
        createNewSubject,
        removeSubject,
      }}
    >
      {children}
    </SubjectContext.Provider>
  );
};

export const useSubject = () => {
  const context = useContext(SubjectContext);
  if (!context) {
    throw new Error('useSubject must be used within a SubjectProvider');
  }
  return context;
};
