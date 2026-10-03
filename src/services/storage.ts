import {
  User,
  Subject,
  StudyMaterial,
  Quiz,
  QuizAttempt,
  Flashcard,
  TopicProgress,
  StudyPlan,
  StudySession,
  DashboardStats,
} from '../types';

const STORAGE_KEYS = {
  USER: 'studyai_user',
  SUBJECTS: 'studyai_subjects',
  MATERIALS: 'studyai_materials',
  QUIZZES: 'studyai_quizzes',
  ATTEMPTS: 'studyai_attempts',
  FLASHCARDS: 'studyai_flashcards',
  TOPIC_PROGRESS: 'studyai_topic_progress',
  STUDY_PLANS: 'studyai_study_plans',
  SESSIONS: 'studyai_sessions',
};

// Initial Seed Data
const DEFAULT_USER: User = {
  id: 'usr-student-01',
  email: 'alex.chen@university.edu',
  fullName: 'Alex Chen',
  university: 'Stanford University',
  major: 'Computer Science & AI',
  weeklyGoalHours: 20,
  createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
};

const DEFAULT_SUBJECTS: Subject[] = [
  {
    id: 'sub-cs201',
    userId: 'usr-student-01',
    name: 'Data Structures & Algorithms',
    code: 'CS 201',
    color: '#6366f1', // Indigo
    description: 'Algorithmic complexity, balanced search trees, dynamic programming, and graph theory.',
    createdAt: new Date(Date.now() - 28 * 86400000).toISOString(),
    materialsCount: 3,
    quizzesCount: 2,
    flashcardsCount: 16,
    masteryScore: 78,
  },
  {
    id: 'sub-cs240',
    userId: 'usr-student-01',
    name: 'Computer Systems & Architecture',
    code: 'CS 240',
    color: '#06b6d4', // Cyan
    description: 'Memory hierarchy, pipelining, virtual memory, cache coherency, and assembly programming.',
    createdAt: new Date(Date.now() - 24 * 86400000).toISOString(),
    materialsCount: 2,
    quizzesCount: 1,
    flashcardsCount: 12,
    masteryScore: 62,
  },
  {
    id: 'sub-math210',
    userId: 'usr-student-01',
    name: 'Linear Algebra & Optimization',
    code: 'MATH 210',
    color: '#f59e0b', // Amber
    description: 'Eigenvalues, SVD decomposition, vector spaces, gradient descent, and quadratic forms.',
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    materialsCount: 2,
    quizzesCount: 1,
    flashcardsCount: 10,
    masteryScore: 85,
  },
];

const DEFAULT_MATERIALS: StudyMaterial[] = [
  {
    id: 'mat-dijkstra-notes',
    userId: 'usr-student-01',
    subjectId: 'sub-cs201',
    title: 'Shortest Path & Graph Traversal Guide',
    fileType: 'pdf',
    fileSizeBytes: 2450000,
    rawText: `Dijkstra's Algorithm finds the shortest path between nodes in a weighted graph with non-negative edge weights.
Using a binary min-heap priority queue, Dijkstra's algorithm runs in O((V + E) log V) time, where V is the number of vertices and E is the number of edges.
If implemented with a Fibonacci heap, the theoretical complexity improves to O(E + V log V).
Key properties:
1. Greedy approach: At each step, selects the unvisited node with the smallest tentative distance.
2. Limitation: Fails in graphs with negative edge weights. For negative weights, Bellman-Ford algorithm must be used (running in O(V * E) time).
3. A* Search heuristic: An extension of Dijkstra that uses a heuristic function h(n) to prioritize promising paths towards a specific target.`,
    summary: 'Comprehensive analysis of Dijkstra shortest path algorithm, priority queue implementations (Binary vs Fibonacci heap), limitations with negative weights, and comparison with Bellman-Ford and A* search.',
    keyConcepts: ["Dijkstra's Algorithm", 'Min-Heap Priority Queue', 'Time Complexity O((V+E) log V)', 'Bellman-Ford', 'A* Search Heuristic'],
    chunksCount: 3,
    chunks: [
      {
        id: 'chk-dijkstra-1',
        materialId: 'mat-dijkstra-notes',
        chunkIndex: 0,
        content: `Dijkstra's Algorithm finds the shortest path between nodes in a weighted graph with non-negative edge weights. Using a binary min-heap priority queue, it runs in O((V + E) log V) time.`,
        tokenCount: 140,
        pageNumber: 1,
      },
      {
        id: 'chk-dijkstra-2',
        materialId: 'mat-dijkstra-notes',
        chunkIndex: 1,
        content: `If implemented with a Fibonacci heap, the theoretical complexity improves to O(E + V log V). It selects the unvisited vertex with the smallest tentative distance at each step.`,
        tokenCount: 120,
        pageNumber: 2,
      },
      {
        id: 'chk-dijkstra-3',
        materialId: 'mat-dijkstra-notes',
        chunkIndex: 2,
        content: `Limitation: It fails in graphs with negative edge weights. For negative weights, Bellman-Ford algorithm must be used (running in O(V * E) time). A* search adds heuristic h(n) guidance.`,
        tokenCount: 135,
        pageNumber: 3,
      },
    ],
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  {
    id: 'mat-cache-notes',
    userId: 'usr-student-01',
    subjectId: 'sub-cs240',
    title: 'Cache Memory Hierarchy & Mapping Techniques',
    fileType: 'notes',
    fileSizeBytes: 1820000,
    rawText: `Modern computer architectures use a multi-level cache hierarchy (L1, L2, L3) to bridge the speed disparity between processor execution and main memory (DRAM).
Cache Organization:
1. Direct-Mapped Cache: Each memory block maps to exactly one cache line. Index = (Block Address) mod (Number of Cache Lines). Prone to conflict misses.
2. Set-Associative Cache: Each memory block maps to a set of K lines (e.g., 4-way or 8-way set associative). Significantly reduces conflict misses.
3. Fully-Associative Cache: Any block can reside in any cache line. Requires associative search hardware, used for small buffers like TLB.
Cache Misses (The 3 Cs):
- Compulsory Miss: First access to a block (cold start).
- Capacity Miss: Working set exceeds cache capacity.
- Conflict Miss: Multiple memory locations compete for the same cache line.`,
    summary: 'Detailed explanation of L1/L2/L3 cache architectures, mapping policies (direct, set-associative, fully-associative), and analysis of the 3 C misses (Compulsory, Capacity, Conflict).',
    keyConcepts: ['Memory Hierarchy', 'Set-Associative Mapping', 'Compulsory Miss', 'Capacity Miss', 'Conflict Miss', 'TLB'],
    chunksCount: 2,
    chunks: [
      {
        id: 'chk-cache-1',
        materialId: 'mat-cache-notes',
        chunkIndex: 0,
        content: `Modern computer architectures use a multi-level cache hierarchy (L1, L2, L3) to bridge the speed disparity between processor execution and main memory (DRAM). Direct-mapped caches map each block to one line.`,
        tokenCount: 150,
        pageNumber: 1,
      },
      {
        id: 'chk-cache-2',
        materialId: 'mat-cache-notes',
        chunkIndex: 1,
        content: `Set-associative and fully-associative reduce conflict misses. The 3 C's of cache misses: Compulsory (cold start), Capacity (cache full), and Conflict (collision in same set).`,
        tokenCount: 160,
        pageNumber: 2,
      },
    ],
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 'mat-eigen-notes',
    userId: 'usr-student-01',
    subjectId: 'sub-math210',
    title: 'Eigenvalues, Eigenvectors & SVD Decomposition',
    fileType: 'pdf',
    fileSizeBytes: 3100000,
    rawText: `Let A be an n x n matrix. A non-zero vector v is an eigenvector with corresponding eigenvalue lambda if:
A * v = lambda * v, or (A - lambda * I) * v = 0.
Characteristic Equation: det(A - lambda * I) = 0.
Singular Value Decomposition (SVD):
For any m x n matrix A, SVD decomposes it into A = U * Sigma * V^T, where:
- U is an m x m orthogonal matrix of left singular vectors (eigenvectors of A * A^T).
- Sigma is an m x n rectangular diagonal matrix of singular values (square roots of eigenvalues of A^T * A).
- V is an n x n orthogonal matrix of right singular vectors (eigenvectors of A^T * A).
Applications: Dimensionality reduction (PCA), image compression, and latent semantic indexing.`,
    summary: 'Mathematical formulation of characteristic equations, spectral theorem, and Singular Value Decomposition (SVD) with applications in PCA and dimensionality reduction.',
    keyConcepts: ['Characteristic Equation', 'Eigenvectors', 'Singular Value Decomposition (SVD)', 'Orthogonal Matrices', 'PCA'],
    chunksCount: 2,
    chunks: [
      {
        id: 'chk-eigen-1',
        materialId: 'mat-eigen-notes',
        chunkIndex: 0,
        content: `Let A be an n x n matrix. A non-zero vector v is an eigenvector if A * v = lambda * v. Solved using det(A - lambda * I) = 0.`,
        tokenCount: 110,
        pageNumber: 1,
      },
      {
        id: 'chk-eigen-2',
        materialId: 'mat-eigen-notes',
        chunkIndex: 1,
        content: `SVD factorizes any matrix A = U * Sigma * V^T. Used extensively in Principal Component Analysis (PCA) and data compression.`,
        tokenCount: 130,
        pageNumber: 2,
      },
    ],
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
];

const DEFAULT_QUIZZES: Quiz[] = [
  {
    id: 'quiz-dijkstra-01',
    userId: 'usr-student-01',
    subjectId: 'sub-cs201',
    materialId: 'mat-dijkstra-notes',
    title: 'Graph Algorithms & Shortest Path Assessment',
    difficulty: 'medium',
    totalQuestions: 4,
    lastAttemptScore: 75,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    questions: [
      {
        id: 'q-1',
        quizId: 'quiz-dijkstra-01',
        questionText: "What is the time complexity of Dijkstra's algorithm implemented with a standard binary min-heap?",
        topicTag: 'Algorithmic Complexity',
        options: ['O(V^2)', 'O((V + E) log V)', 'O(E + V log V)', 'O(V * E)'],
        correctOptionIndex: 1,
        explanation: 'With a binary min-heap, extracting min takes O(log V) per vertex and decrease-key takes O(log V) per edge, yielding O((V + E) log V).',
      },
      {
        id: 'q-2',
        quizId: 'quiz-dijkstra-01',
        questionText: "Why can't standard Dijkstra's algorithm handle graphs with negative edge weights?",
        topicTag: 'Graph Constraints',
        options: [
          'It causes a stack overflow error',
          'It assumes visited nodes already have their finalized minimal distances',
          'Min-heaps cannot store negative numbers',
          'Edges must always be directed',
        ],
        correctOptionIndex: 1,
        explanation: "Dijkstra is greedy: once a node is marked visited, its distance is considered finalized. Negative edges can provide a later shortcut, violating this assumption.",
      },
      {
        id: 'q-3',
        quizId: 'quiz-dijkstra-01',
        questionText: 'Which algorithm is best suited for graphs that contain negative edge weights without negative cycles?',
        topicTag: 'Alternative Algorithms',
        options: ['Floyd-Warshall only', 'Prim Algorithm', 'Bellman-Ford Algorithm', 'Kruskal Algorithm'],
        correctOptionIndex: 2,
        explanation: 'Bellman-Ford relaxes all edges V-1 times and can safely handle negative weights while detecting negative weight cycles.',
      },
      {
        id: 'q-4',
        quizId: 'quiz-dijkstra-01',
        questionText: 'How does A* search improve upon standard Dijkstra in pathfinding?',
        topicTag: 'A* Heuristics',
        options: [
          'By using multiple priority queues',
          'By guiding search towards the goal using an admissible heuristic function h(n)',
          'By ignoring edge weights entirely',
          'By converting the graph into an undirected tree',
        ],
        correctOptionIndex: 1,
        explanation: 'A* evaluates f(n) = g(n) + h(n), where h(n) estimates cost to target, pruning search space toward the destination.',
      },
    ],
  },
];

const DEFAULT_ATTEMPTS: QuizAttempt[] = [
  {
    id: 'att-01',
    quizId: 'quiz-dijkstra-01',
    userId: 'usr-student-01',
    quizTitle: 'Graph Algorithms & Shortest Path Assessment',
    subjectId: 'sub-cs201',
    score: 75,
    correctAnswers: 3,
    totalQuestions: 4,
    timeTakenSeconds: 165,
    completedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    userAnswers: [
      { questionId: 'q-1', selectedOptionIndex: 1, isCorrect: true },
      { questionId: 'q-2', selectedOptionIndex: 0, isCorrect: false }, // Missed Graph Constraints
      { questionId: 'q-3', selectedOptionIndex: 2, isCorrect: true },
      { questionId: 'q-4', selectedOptionIndex: 1, isCorrect: true },
    ],
  },
];

const DEFAULT_FLASHCARDS: Flashcard[] = [
  {
    id: 'fc-1',
    userId: 'usr-student-01',
    subjectId: 'sub-cs201',
    materialId: 'mat-dijkstra-notes',
    frontText: "What is the time complexity of Dijkstra's algorithm using a Fibonacci Heap?",
    backText: 'O(E + V log V). The amortized time for decrease-key operations is reduced to O(1).',
    topicTag: 'Heap Structures',
    difficultyLevel: 'hard',
    repetitionBox: 2,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 'fc-2',
    userId: 'usr-student-01',
    subjectId: 'sub-cs201',
    materialId: 'mat-dijkstra-notes',
    frontText: 'What is an Admissible Heuristic in A* Search?',
    backText: 'An admissible heuristic h(n) NEVER overestimates the actual cost to reach the goal from node n.',
    topicTag: 'A* Heuristics',
    difficultyLevel: 'medium',
    repetitionBox: 4,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 'fc-3',
    userId: 'usr-student-01',
    subjectId: 'sub-cs240',
    materialId: 'mat-cache-notes',
    frontText: 'Define the 3 Cs of Cache Misses.',
    backText: '1. Compulsory (Cold start)\n2. Capacity (Working set exceeds cache)\n3. Conflict (Multiple blocks contend for same set/line).',
    topicTag: 'Cache Misses',
    difficultyLevel: 'medium',
    repetitionBox: 3,
    createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
  {
    id: 'fc-4',
    userId: 'usr-student-01',
    subjectId: 'sub-cs240',
    materialId: 'mat-cache-notes',
    frontText: 'What is Spatial Locality vs Temporal Locality?',
    backText: 'Temporal: Recently accessed items are likely to be accessed again soon.\nSpatial: Items near recently accessed items in memory are likely to be accessed soon.',
    topicTag: 'Locality Principles',
    difficultyLevel: 'easy',
    repetitionBox: 5,
    createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
  {
    id: 'fc-5',
    userId: 'usr-student-01',
    subjectId: 'sub-math210',
    materialId: 'mat-eigen-notes',
    frontText: 'In SVD A = U * Sigma * V^T, what do the columns of U represent?',
    backText: 'Left singular vectors of A, which are the orthonormal eigenvectors of the square matrix (A * A^T).',
    topicTag: 'SVD Decomposition',
    difficultyLevel: 'hard',
    repetitionBox: 1,
    createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
];

const DEFAULT_TOPIC_PROGRESS: TopicProgress[] = [
  {
    id: 'tp-1',
    userId: 'usr-student-01',
    subjectId: 'sub-cs201',
    topicName: 'Graph Constraints & Negative Weights',
    totalQuestionsAttempted: 5,
    totalCorrect: 2,
    accuracyPercentage: 40,
    masteryStatus: 'needs_focus',
    lastPracticedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'tp-2',
    userId: 'usr-student-01',
    subjectId: 'sub-cs240',
    topicName: 'Cache Mapping & Conflict Misses',
    totalQuestionsAttempted: 6,
    totalCorrect: 3,
    accuracyPercentage: 50,
    masteryStatus: 'needs_focus',
    lastPracticedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'tp-3',
    userId: 'usr-student-01',
    subjectId: 'sub-cs201',
    topicName: 'Algorithmic Complexity',
    totalQuestionsAttempted: 8,
    totalCorrect: 7,
    accuracyPercentage: 87.5,
    masteryStatus: 'mastered',
    lastPracticedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'tp-4',
    userId: 'usr-student-01',
    subjectId: 'sub-math210',
    topicName: 'Eigenvalues & Characteristic Equation',
    totalQuestionsAttempted: 10,
    totalCorrect: 9,
    accuracyPercentage: 90,
    masteryStatus: 'mastered',
    lastPracticedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
];

const DEFAULT_STUDY_PLANS: StudyPlan[] = [
  {
    id: 'plan-midterm-01',
    userId: 'usr-student-01',
    subjectId: 'sub-cs201',
    title: 'Midterm Prep: Advanced Algorithms & Data Structures',
    targetExamDate: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
    isActive: true,
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    days: [
      {
        dayNumber: 1,
        dateStr: new Date(Date.now()).toISOString().split('T')[0],
        dayName: 'Today',
        tasks: [
          { id: 't1', title: "Review Dijkstra's vs Bellman-Ford negative edge proof", topic: 'Graph Constraints', estimatedMinutes: 30, completed: true },
          { id: 't2', title: 'Complete 10-question practice quiz on Shortest Paths', topic: 'Quiz Review', estimatedMinutes: 20, completed: false },
        ],
      },
      {
        dayNumber: 2,
        dateStr: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        dayName: 'Tomorrow',
        tasks: [
          { id: 't3', title: 'Read Chapter 4 on Red-Black Tree invariant rotations', topic: 'Balanced Trees', estimatedMinutes: 45, completed: false },
          { id: 't4', title: 'Flashcard review: Tree rotations and balance factors', topic: 'Flashcards', estimatedMinutes: 15, completed: false },
        ],
      },
      {
        dayNumber: 3,
        dateStr: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
        dayName: 'Day 3',
        tasks: [
          { id: 't5', title: 'Solve 3 dynamic programming memoization problems', topic: 'Dynamic Programming', estimatedMinutes: 60, completed: false },
        ],
      },
    ],
  },
];

const DEFAULT_SESSIONS: StudySession[] = [
  {
    id: 'ses-1',
    userId: 'usr-student-01',
    subjectId: 'sub-cs201',
    activityType: 'read_material',
    durationMinutes: 45,
    startedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    notes: 'Reviewed Dijkstra heap properties',
  },
  {
    id: 'ses-2',
    userId: 'usr-student-01',
    subjectId: 'sub-cs201',
    activityType: 'quiz',
    durationMinutes: 20,
    startedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    notes: 'Quiz attempt on Shortest Paths',
  },
  {
    id: 'ses-3',
    userId: 'usr-student-01',
    subjectId: 'sub-cs240',
    activityType: 'flashcard_review',
    durationMinutes: 25,
    startedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    notes: 'Cache misses and locality',
  },
];

export const storage = {
  getUser(): User | null {
    const data = localStorage.getItem(STORAGE_KEYS.USER);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(DEFAULT_USER));
      return DEFAULT_USER;
    }
    return JSON.parse(data);
  },
  setUser(user: User | null): void {
    if (!user) {
      localStorage.removeItem(STORAGE_KEYS.USER);
    } else {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    }
  },

  getSubjects(): Subject[] {
    const data = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(DEFAULT_SUBJECTS));
      return DEFAULT_SUBJECTS;
    }
    return JSON.parse(data);
  },
  setSubjects(subjects: Subject[]): void {
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
  },

  getMaterials(): StudyMaterial[] {
    const data = localStorage.getItem(STORAGE_KEYS.MATERIALS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(DEFAULT_MATERIALS));
      return DEFAULT_MATERIALS;
    }
    return JSON.parse(data);
  },
  setMaterials(materials: StudyMaterial[]): void {
    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(materials));
  },

  getQuizzes(): Quiz[] {
    const data = localStorage.getItem(STORAGE_KEYS.QUIZZES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(DEFAULT_QUIZZES));
      return DEFAULT_QUIZZES;
    }
    return JSON.parse(data);
  },
  setQuizzes(quizzes: Quiz[]): void {
    localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(quizzes));
  },

  getAttempts(): QuizAttempt[] {
    const data = localStorage.getItem(STORAGE_KEYS.ATTEMPTS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(DEFAULT_ATTEMPTS));
      return DEFAULT_ATTEMPTS;
    }
    return JSON.parse(data);
  },
  setAttempts(attempts: QuizAttempt[]): void {
    localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(attempts));
  },

  getFlashcards(): Flashcard[] {
    const data = localStorage.getItem(STORAGE_KEYS.FLASHCARDS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.FLASHCARDS, JSON.stringify(DEFAULT_FLASHCARDS));
      return DEFAULT_FLASHCARDS;
    }
    return JSON.parse(data);
  },
  setFlashcards(flashcards: Flashcard[]): void {
    localStorage.setItem(STORAGE_KEYS.FLASHCARDS, JSON.stringify(flashcards));
  },

  getTopicProgress(): TopicProgress[] {
    const data = localStorage.getItem(STORAGE_KEYS.TOPIC_PROGRESS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.TOPIC_PROGRESS, JSON.stringify(DEFAULT_TOPIC_PROGRESS));
      return DEFAULT_TOPIC_PROGRESS;
    }
    return JSON.parse(data);
  },
  setTopicProgress(progress: TopicProgress[]): void {
    localStorage.setItem(STORAGE_KEYS.TOPIC_PROGRESS, JSON.stringify(progress));
  },

  getStudyPlans(): StudyPlan[] {
    const data = localStorage.getItem(STORAGE_KEYS.STUDY_PLANS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.STUDY_PLANS, JSON.stringify(DEFAULT_STUDY_PLANS));
      return DEFAULT_STUDY_PLANS;
    }
    return JSON.parse(data);
  },
  setStudyPlans(plans: StudyPlan[]): void {
    localStorage.setItem(STORAGE_KEYS.STUDY_PLANS, JSON.stringify(plans));
  },

  getSessions(): StudySession[] {
    const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(DEFAULT_SESSIONS));
      return DEFAULT_SESSIONS;
    }
    return JSON.parse(data);
  },
  setSessions(sessions: StudySession[]): void {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  },

  resetAll(): void {
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.SUBJECTS);
    localStorage.removeItem(STORAGE_KEYS.MATERIALS);
    localStorage.removeItem(STORAGE_KEYS.QUIZZES);
    localStorage.removeItem(STORAGE_KEYS.ATTEMPTS);
    localStorage.removeItem(STORAGE_KEYS.FLASHCARDS);
    localStorage.removeItem(STORAGE_KEYS.TOPIC_PROGRESS);
    localStorage.removeItem(STORAGE_KEYS.STUDY_PLANS);
    localStorage.removeItem(STORAGE_KEYS.SESSIONS);
  },
};
