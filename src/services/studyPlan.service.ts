import { StudyPlan, ApiResponse } from '../types';
import { storage } from './storage';

export const studyPlanService = {
  async getStudyPlans(subjectId?: string): Promise<ApiResponse<StudyPlan[]>> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    let plans = storage.getStudyPlans();
    if (subjectId) {
      plans = plans.filter((p) => p.subjectId === subjectId);
    }
    return { success: true, data: plans };
  },

  async createPlan(params: {
    subjectId: string;
    title: string;
    targetExamDate?: string;
    topics: string[];
    availableHoursPerDay: number;
  }): Promise<ApiResponse<StudyPlan>> {
    await new Promise((resolve) => setTimeout(resolve, 600)); // AI schedule synthesis
    const user = storage.getUser();
    const planId = `plan-${Date.now().toString(36)}`;

    // Build 5-day adaptive schedule
    const days = [1, 2, 3, 4, 5].map((dayNum) => {
      const targetTopic = params.topics[(dayNum - 1) % params.topics.length] || 'Core Review';
      const date = new Date(Date.now() + (dayNum - 1) * 86400000);
      return {
        dayNumber: dayNum,
        dateStr: date.toISOString().split('T')[0],
        dayName: dayNum === 1 ? 'Day 1 (Today)' : `Day ${dayNum}`,
        tasks: [
          {
            id: `task-${planId}-${dayNum}-1`,
            title: `Review lecture notes on ${targetTopic}`,
            topic: targetTopic,
            estimatedMinutes: Math.round(params.availableHoursPerDay * 30),
            completed: false,
          },
          {
            id: `task-${planId}-${dayNum}-2`,
            title: `Complete 10 practice questions & flashcards for ${targetTopic}`,
            topic: 'Active Recall',
            estimatedMinutes: Math.round(params.availableHoursPerDay * 30),
            completed: false,
          },
        ],
      };
    });

    const newPlan: StudyPlan = {
      id: planId,
      userId: user?.id || 'usr-student-01',
      subjectId: params.subjectId,
      title: params.title,
      targetExamDate: params.targetExamDate,
      days,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const plans = storage.getStudyPlans();
    plans.unshift(newPlan);
    storage.setStudyPlans(plans);

    return {
      success: true,
      data: newPlan,
      message: 'AI personalized study plan created successfully',
    };
  },

  async toggleTask(planId: string, taskId: string): Promise<ApiResponse<StudyPlan>> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const plans = storage.getStudyPlans();
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return { success: false, data: null as any, error: 'Plan not found' };

    for (const day of plan.days) {
      const task = day.tasks.find((t) => t.id === taskId);
      if (task) {
        task.completed = !task.completed;
        break;
      }
    }

    storage.setStudyPlans(plans);
    return { success: true, data: plan };
  },

  async deletePlan(planId: string): Promise<ApiResponse<null>> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const plans = storage.getStudyPlans().filter((p) => p.id !== planId);
    storage.setStudyPlans(plans);
    return { success: true, data: null, message: 'Plan removed' };
  },
};
