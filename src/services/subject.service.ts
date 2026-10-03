import { Subject, ApiResponse } from '../types';
import { storage } from './storage';

export const subjectService = {
  async getSubjects(): Promise<ApiResponse<Subject[]>> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const subjects = storage.getSubjects();
    const materials = storage.getMaterials();
    const quizzes = storage.getQuizzes();
    const flashcards = storage.getFlashcards();

    // Dynamically calculate counts and mastery
    const enriched = subjects.map((sub) => {
      const subMats = materials.filter((m) => m.subjectId === sub.id);
      const subQuizzes = quizzes.filter((q) => q.subjectId === sub.id);
      const subCards = flashcards.filter((f) => f.subjectId === sub.id);
      return {
        ...sub,
        materialsCount: subMats.length,
        quizzesCount: subQuizzes.length,
        flashcardsCount: subCards.length,
      };
    });

    return { success: true, data: enriched };
  },

  async getSubjectById(id: string): Promise<ApiResponse<Subject | null>> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const subjects = storage.getSubjects();
    const found = subjects.find((s) => s.id === id);
    if (!found) return { success: false, data: null, error: 'Subject not found' };
    return { success: true, data: found };
  },

  async createSubject(params: {
    name: string;
    code: string;
    color: string;
    description: string;
  }): Promise<ApiResponse<Subject>> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const user = storage.getUser();
    const subjects = storage.getSubjects();
    const newSubject: Subject = {
      id: `sub-${Date.now().toString(36)}`,
      userId: user?.id || 'usr-student-01',
      name: params.name,
      code: params.code.toUpperCase(),
      color: params.color || '#6366f1',
      description: params.description,
      createdAt: new Date().toISOString(),
      materialsCount: 0,
      quizzesCount: 0,
      flashcardsCount: 0,
      masteryScore: 0,
    };
    subjects.unshift(newSubject);
    storage.setSubjects(subjects);
    return { success: true, data: newSubject, message: 'Subject created successfully' };
  },

  async updateSubject(id: string, updates: Partial<Subject>): Promise<ApiResponse<Subject>> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const subjects = storage.getSubjects();
    const idx = subjects.findIndex((s) => s.id === id);
    if (idx === -1) return { success: false, data: null as any, error: 'Subject not found' };
    subjects[idx] = { ...subjects[idx], ...updates };
    storage.setSubjects(subjects);
    return { success: true, data: subjects[idx], message: 'Subject updated' };
  },

  async deleteSubject(id: string): Promise<ApiResponse<null>> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const subjects = storage.getSubjects().filter((s) => s.id !== id);
    storage.setSubjects(subjects);
    // Cascade delete linked materials
    const materials = storage.getMaterials().filter((m) => m.subjectId !== id);
    storage.setMaterials(materials);
    return { success: true, data: null, message: 'Subject deleted' };
  },
};
