import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Timer, ArrowLeft, Save, Loader2, ChevronLeft, ChevronRight, Flag
} from 'lucide-react';
import { db } from '../../firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';

interface Question {
    id: string;
    text: string;
    options: string[]; // For MCQ
    correctAnswer: number | string; // index for MCQ, value for Numerical
    subject: 'Physics' | 'Chemistry' | 'Mathematics';
    chapter: string;
    type: 'MCQ' | 'Numerical';
    section: 'A' | 'B'; // Added for JEE Mains structure
}

interface TestData {
    id: string;
    title: string;
    questions: Question[];
    duration?: number; // in minutes
    testPattern?: string;
}

type QuestionStatus = 'notVisited' | 'notAnswered' | 'answered' | 'markedForReview' | 'answeredAndMarked';

const StudentTestAttemptPage = () => {
    const { testId } = useParams();
    const navigate = useNavigate();
    const authContext = useAuth();
    const currentUser = authContext?.currentUser;

    const [testData, setTestData] = useState<TestData | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [activeSubject, setActiveSubject] = useState<'Physics' | 'Chemistry' | 'Mathematics'>('Physics');

    // Answers storage
    const [answers, setAnswers] = useState<Record<number, number | string>>({}); // questionIndex -> answer
    const [markedForReview, setMarkedForReview] = useState<Set<number>>(new Set());
    const [visitedQuestions, setVisitedQuestions] = useState<Set<number>>(new Set([0]));

    // Section B selections (5 out of 10)
    const [sectionBSelections, setSectionBSelections] = useState<{
        Physics: Set<number>;
        Chemistry: Set<number>;
        Mathematics: Set<number>;
    }>({
        Physics: new Set(),
        Chemistry: new Set(),
        Mathematics: new Set()
    });

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState(3 * 60 * 60); // Default 3 hours
    const [showInstructions, setShowInstructions] = useState(true);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

    const getStorageKey = () => {
        if (!currentUser || !testId) return '';
        return `dhitantra_test_progress_${currentUser.uid}_${testId}`;
    };

    const saveProgress = () => {
        const key = getStorageKey();
        if (!key) return;

        const payload = {
            answers,
            markedForReview: Array.from(markedForReview),
            visitedQuestions: Array.from(visitedQuestions),
            sectionBSelections: {
                Physics: Array.from(sectionBSelections.Physics),
                Chemistry: Array.from(sectionBSelections.Chemistry),
                Mathematics: Array.from(sectionBSelections.Mathematics),
            },
            currentQuestionIndex,
            activeSubject,
            timeRemaining,
        };

        localStorage.setItem(key, JSON.stringify(payload));
    };

    const clearProgress = () => {
        const key = getStorageKey();
        if (key) localStorage.removeItem(key);
    };

    useEffect(() => {
        const fetchTest = async () => {
            if (testId) {
                try {
                    // Fetch Test Document
                    const docRef = doc(db, 'tests', testId);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        const rawData = { id: docSnap.id, ...docSnap.data() } as any;

                        // Fetch actual questions
                        const questionIds = rawData.questionIds || [];
                        const questionMappings = rawData.questionMappings || [];
                        let fullQuestions: Question[] = [];

                        if (questionIds.length > 0) {
                            // Fetch all questions from the database
                            const questionPromises = questionIds.map((id: string) => getDoc(doc(db, 'questions', id)));
                            const questionSnaps = await Promise.all(questionPromises);

                            fullQuestions = questionSnaps
                                .filter(snap => snap.exists())
                                .map(snap => {
                                    const qData = snap.data() as any;
                                    return {
                                        id: snap.id,
                                        ...qData,
                                        section: qData.section || (qData.type === 'MCQ' ? 'A' : 'B')
                                    } as Question;
                                });
                        } else if (questionMappings.length > 0) {
                            // Convert OMR Mappings to Interactive Questions
                            fullQuestions = questionMappings.map((m: any) => ({
                                id: `omr-${m.serialNumber}`,
                                text: m.questionText || `Question ${m.serialNumber}`,
                                options: m.options || ['Option A', 'Option B', 'Option C', 'Option D'],
                                correctAnswer: m.correctAnswer || 'A',
                                subject: m.subject || 'General',
                                chapter: m.chapter || 'OMR Test',
                                type: 'MCQ',
                                section: m.sectionId || 'A'
                            } as Question));
                        }

                        const data: TestData = {
                            id: rawData.id,
                            title: rawData.name,
                            questions: fullQuestions,
                            duration: rawData.settings?.duration || rawData.duration || 180,
                            testPattern: rawData.testPattern || (fullQuestions.some(q => q.type === 'Numerical') ? 'JEE_MAINS' : 'STANDARD')
                        };

                        setTestData(data);

                        // Set timer
                        if (data.duration) {
                            setTimeRemaining(data.duration * 60);
                        }
                    } else {
                        alert('Test not found');
                        navigate('/dashboard/tests');
                    }
                } catch (error) {
                    console.error("Error fetching test:", error);
                    alert("Error loading test content");
                } finally {
                    setIsLoading(false);
                }
            }
        };
        fetchTest();
    }, [testId, navigate]);

    useEffect(() => {
        if (!testData || !currentUser || !testId) return;

        const key = getStorageKey();
        if (!key) return;

        const stored = localStorage.getItem(key);
        if (!stored) return;

        try {
            const parsed = JSON.parse(stored);
            setAnswers(parsed.answers || {});
            setMarkedForReview(new Set(parsed.markedForReview || []));
            setVisitedQuestions(new Set(parsed.visitedQuestions || [0]));
            setSectionBSelections({
                Physics: new Set(parsed.sectionBSelections?.Physics || []),
                Chemistry: new Set(parsed.sectionBSelections?.Chemistry || []),
                Mathematics: new Set(parsed.sectionBSelections?.Mathematics || []),
            });
            setCurrentQuestionIndex(Math.max(0, Math.min(parsed.currentQuestionIndex ?? 0, testData.questions.length - 1)));
            setActiveSubject(parsed.activeSubject || 'Physics');
            if (parsed.timeRemaining !== undefined) {
                setTimeRemaining(parsed.timeRemaining);
            }
        } catch (error) {
            console.warn('Failed to restore saved test progress:', error);
        }
    }, [testData, currentUser, testId]);

    // Timer Logic
    useEffect(() => {
        if (!showInstructions && timeRemaining > 0) {
            const timer = setInterval(() => {
                setTimeRemaining(prev => {
                    const newTime = Math.max(0, prev - 1);
                    if (newTime === 0) {
                        handleSubmit(true); // Auto-submit when time's up
                    }
                    return newTime;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [showInstructions, timeRemaining]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const getQuestionStatus = (qIndex: number): QuestionStatus => {
        if (!visitedQuestions.has(qIndex)) return 'notVisited';

        const isAnswered = answers[qIndex] !== undefined;
        const isMarked = markedForReview.has(qIndex);

        if (isAnswered && isMarked) return 'answeredAndMarked';
        if (isAnswered) return 'answered';
        if (isMarked) return 'markedForReview';
        return 'notAnswered';
    };

    const getStatusColor = (status: QuestionStatus) => {
        switch (status) {
            case 'notVisited': return 'bg-white border-slate-300 text-slate-700';
            case 'notAnswered': return 'bg-red-50 border-red-300 text-red-700';
            case 'answered': return 'bg-green-50 border-green-500 text-green-700';
            case 'markedForReview': return 'bg-purple-50 border-purple-500 text-purple-700';
            case 'answeredAndMarked': return 'bg-teal-50 border-teal-500 text-teal-700';
        }
    };

    const handleAnswer = (answer: number | string) => {
        setAnswers(prev => ({ ...prev, [currentQuestionIndex]: answer }));

        const currentQ = testData?.questions[currentQuestionIndex];
        if (currentQ?.section === 'B' && currentQ.subject) {
            const subject = currentQ.subject;
            setSectionBSelections(prev => {
                const newSelections = { ...prev };
                // Safety: initialize subject set if it doesn't exist (cases like 'General' or misc subjects)
                if (!newSelections[subject]) {
                    (newSelections as any)[subject] = new Set();
                }
                newSelections[subject] = new Set(newSelections[subject]);
                newSelections[subject].add(currentQuestionIndex);
                return newSelections;
            });
        }
    };

    const clearResponse = () => {
        setAnswers(prev => {
            const newAnswers = { ...prev };
            delete newAnswers[currentQuestionIndex];
            return newAnswers;
        });

        const currentQ = testData?.questions[currentQuestionIndex];
        if (currentQ?.section === 'B' && currentQ.subject) {
            const subject = currentQ.subject;
            setSectionBSelections(prev => {
                const newSelections = { ...prev };
                if (newSelections[subject]) {
                    newSelections[subject] = new Set(newSelections[subject]);
                    newSelections[subject].delete(currentQuestionIndex);
                }
                return newSelections;
            });
        }
    };

    const toggleMarkForReview = () => {
        setMarkedForReview(prev => {
            const newSet = new Set(prev);
            if (newSet.has(currentQuestionIndex)) {
                newSet.delete(currentQuestionIndex);
            } else {
                newSet.add(currentQuestionIndex);
            }
            return newSet;
        });
    };

    const goToQuestion = (qIndex: number) => {
        setCurrentQuestionIndex(qIndex);
        setVisitedQuestions(prev => new Set(prev).add(qIndex));

        // Auto-switch subject if needed
        if (testData?.questions[qIndex]) {
            setActiveSubject(testData.questions[qIndex].subject);
        }
    };

    const nextQuestion = () => {
        if (testData && currentQuestionIndex < testData.questions.length - 1) {
            goToQuestion(currentQuestionIndex + 1);
        }
    };

    const previousQuestion = () => {
        if (currentQuestionIndex > 0) {
            goToQuestion(currentQuestionIndex - 1);
        }
    };

    const getFirstQuestionIndexForSubject = (subject: 'Physics' | 'Chemistry' | 'Mathematics') => {
        if (!testData) return -1;

        const unansweredSubjectIndex = testData.questions.findIndex((q, idx) => q.subject === subject && answers[idx] === undefined);
        if (unansweredSubjectIndex !== -1) {
            return unansweredSubjectIndex;
        }

        return testData.questions.findIndex(q => q.subject === subject);
    };

    const getNextQuestionIndexInSubject = () => {
        if (!testData) return null;
        const currentSubject = testData.questions[currentQuestionIndex]?.subject;
        if (!currentSubject) return null;

        const subjectIndices = testData.questions
            .map((q, idx) => q.subject === currentSubject ? idx : -1)
            .filter(idx => idx !== -1);

        const currentPosition = subjectIndices.indexOf(currentQuestionIndex);
        if (currentPosition !== -1 && currentPosition < subjectIndices.length - 1) {
            return subjectIndices[currentPosition + 1];
        }
        return null;
    };

    const saveAndNext = () => {
        saveProgress();
        const nextSubjectIndex = getNextQuestionIndexInSubject();
        if (nextSubjectIndex !== null) {
            goToQuestion(nextSubjectIndex);
        } else {
            nextQuestion();
        }
    };

    useEffect(() => {
        if (!testData) return;
        const currentSubject = testData.questions[currentQuestionIndex]?.subject;
        if (currentSubject && currentSubject !== activeSubject) {
            setActiveSubject(currentSubject);
        }
    }, [currentQuestionIndex, testData, activeSubject]);

    const subjectQuestions = useMemo(
        () => testData ? testData.questions.filter(q => q.subject === activeSubject) : [],
        [testData, activeSubject]
    );

    const handleSubmit = async (autoSubmit = false) => {
        if (!currentUser || !testData) return;

        // Validate Section B selections for JEE Mains pattern
        if (testData.testPattern === 'JEE_MAINS') {
            const subjects: ('Physics' | 'Chemistry' | 'Mathematics')[] = ['Physics', 'Chemistry', 'Mathematics'];
            for (const subject of subjects) {
                if (sectionBSelections[subject].size > 5) {
                    alert(`You have selected ${sectionBSelections[subject].size} questions in ${subject} Section B. Only 5 will be evaluated.`);
                }
            }
        }

        if (!autoSubmit && !window.confirm("Are you sure you want to submit the test?")) return;

        setIsSubmitting(true);
        try {
            // Calculate Score
            let score = 0;
            let correctCount = 0;
            let attemptedCount = 0;

            testData.questions.forEach((q, idx) => {
                // For Section B, only count first 5 selected answers
                if (q.section === 'B') {
                    const subjectSelections = Array.from(sectionBSelections[q.subject]);
                    if (!subjectSelections.includes(idx) || subjectSelections.indexOf(idx) >= 5) {
                        return; // Skip this question in scoring
                    }
                }

                if (answers[idx] !== undefined) {
                    attemptedCount++;
                    if (String(answers[idx]) === String(q.correctAnswer)) {
                        score += 4;
                        correctCount++;
                    } else {
                        score -= 1; // Negative marking
                    }
                }
            });

            const resultData = {
                testId: testData.id,
                testTitle: testData.title,
                userId: currentUser.uid,
                score: score,
                totalQuestions: testData.questions.length,
                correctAnswers: correctCount,
                attemptedQuestions: attemptedCount,
                attemptDate: serverTimestamp(),
                duration: (testData.duration ? testData.duration * 60 : 180 * 60) - timeRemaining,
                answers: answers,
                markedForReview: Array.from(markedForReview),
                // Only include sectionBSelections for JEE-pattern tests
                ...(testData.testPattern === 'JEE_MAINS' && {
                    sectionBSelections: Object.fromEntries(
                        Object.entries(sectionBSelections).map(([subj, set]) => [subj, Array.from(set)])
                    )
                })
            };

            // Write to top-level testResults (covered by Firestore rules)
            await addDoc(collection(db, 'testResults'), resultData);
            clearProgress();

            setShowSubmitConfirm(false);
            alert(`Test Submitted!${autoSubmit ? ' (Time Up)' : ''}\n\nYour Score: ${score}\nCorrect: ${correctCount}\nAttempted: ${attemptedCount}`);
            navigate('/dashboard/tests');

        } catch (error: any) {
            console.error("Error submitting test:", error);
            alert("Failed to submit test: " + (error?.message || 'Please try again.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-teal-600" size={40} />
                    <p className="text-slate-500 font-medium">Loading your test environment...</p>
                </div>
            </div>
        );
    }

    if (!testData || testData.questions.length === 0) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="text-center p-6 bg-white rounded-md shadow-sm border border-slate-200">
                    <h2 className="text-xl font-bold text-slate-900 mb-2">No questions available</h2>
                    <p className="text-slate-600">This test currently has no questions assigned. Please contact support or try another test.</p>
                </div>
            </div>
        );
    }

    // Instructions Overlay
    if (showInstructions) {
        return (
            <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
                <div
                    className="bg-white w-full max-w-3xl rounded-md shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto"
                >
                    <div className="bg-linear-to-r from-teal-600 to-indigo-600 p-6 text-white">
                        <h2 className="text-2xl font-bold">{testData.title}</h2>
                        <p className="text-teal-100 mt-1">Please read the instructions carefully before starting</p>
                    </div>

                    <div className="p-6 space-y-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 mb-3">Test Pattern</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-4 rounded-lg">
                                    <div className="text-2xl font-bold text-teal-600">{testData.questions.length}</div>
                                    <div className="text-sm text-slate-600">Total Questions</div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-lg">
                                    <div className="text-2xl font-bold text-green-600">
                                        {testData.duration ? `${testData.duration} Mins` : formatTime(timeRemaining)}
                                    </div>
                                    <div className="text-sm text-slate-600">Duration</div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-lg">
                                    <div className="text-2xl font-bold text-purple-600">+4 / -1</div>
                                    <div className="text-sm text-slate-600">Marking Scheme</div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-lg">
                                    <div className="text-2xl font-bold text-teal-600">{testData.questions.length * 4}</div>
                                    <div className="text-sm text-slate-600">Total Marks</div>
                                </div>
                            </div>
                        </div>

                        {testData.testPattern === 'JEE_MAINS' && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <h4 className="font-bold text-yellow-900 mb-2">Section B Instructions</h4>
                                <p className="text-sm text-yellow-800">
                                    Each subject has 10 Numerical questions in Section B. You must attempt <strong>any 5 out of 10</strong>.
                                    Only the first 5 selected answers will be evaluated.
                                </p>
                            </div>
                        )}

                        <div>
                            <h3 className="text-lg font-bold text-slate-800 mb-3">General Instructions</h3>
                            <ul className="space-y-2 text-sm text-slate-600">
                                <li className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 bg-teal-600 rounded-full mt-2"></div>
                                    <span>The test will auto-submit when the timer reaches 00:00:00</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 bg-teal-600 rounded-full mt-2"></div>
                                    <span>You can navigate between questions using the question palette</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 bg-teal-600 rounded-full mt-2"></div>
                                    <span>Mark questions for review to revisit them later</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 bg-teal-600 rounded-full mt-2"></div>
                                    <span>Ensure stable internet connection throughout the test</span>
                                </li>
                            </ul>
                        </div>

                        <button
                            onClick={() => setShowInstructions(false)}
                            className="w-full py-3 bg-teal-600 text-white font-bold rounded-md hover:bg-teal-700 transition-colors"
                        >
                            I understand, Start Test
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const currentQuestion = testData.questions[currentQuestionIndex];
    const sectionBCount = sectionBSelections[activeSubject]?.size || 0;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Top Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 md:px-6 py-3 shadow-sm">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                if (window.confirm('Are you sure you want to exit? Your progress will be lost.')) {
                                    navigate('/dashboard/tests');
                                }
                            }}
                            className="p-2 hover:bg-slate-100 rounded-md text-slate-500"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-sm md:text-lg font-bold text-slate-800">{testData.title}</h1>
                            <p className="text-xs text-slate-500">Question {currentQuestionIndex + 1} of {testData.questions.length}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 md:gap-6">
                        <div className={`flex items-center gap-2 font-mono text-sm md:text-lg font-bold px-3 md:px-4 py-2 rounded-md ${timeRemaining < 300 ? 'bg-red-50 text-red-600' :
                            timeRemaining < 600 ? 'bg-teal-50 text-teal-600' :
                                'bg-slate-100 text-slate-700'
                            }`}>
                            <Timer size={18} />
                            <span className="hidden md:inline">{formatTime(timeRemaining)}</span>
                            <span className="md:hidden">{Math.floor(timeRemaining / 60)}m</span>
                        </div>
                        <button
                            onClick={() => setShowSubmitConfirm(true)}
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-4 md:px-6 py-2 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 transition-colors text-sm md:text-base"
                        >
                            <Save size={16} />
                            <span className="hidden md:inline">Submit</span>
                        </button>
                    </div>
                </div>

                {/* Subject Tabs */}
                <div className="mt-3 flex gap-2 overflow-x-auto">
                    {(['Physics', 'Chemistry', 'Mathematics'] as const).map(subject => (
                        <button
                            key={subject}
                            onClick={() => {
                                setActiveSubject(subject);
                                const targetQuestionIndex = getFirstQuestionIndexForSubject(subject);
                                if (targetQuestionIndex !== -1) goToQuestion(targetQuestionIndex);
                            }}
                            className={`px-4 py-2 rounded-md font-semibold whitespace-nowrap transition-colors ${activeSubject === subject
                                ? 'bg-teal-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            {subject}
                        </button>
                    ))}
                </div>
            </header>

            <div className="flex-1 flex flex-col md:flex-row">
                {/* Main Question Area */}
                <main className="flex-1 p-4 md:p-6 overflow-y-auto">
                        <div
                            key={currentQuestionIndex}
                            className="bg-white rounded-md border border-slate-200 shadow-sm p-6 md:p-8 max-w-4xl mx-auto"
                        >
                            {/* Question Header */}
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-3">
                                    <span className="shrink-0 w-10 h-10 bg-slate-800 text-white font-bold rounded-md flex items-center justify-center">
                                        {currentQuestionIndex + 1}
                                    </span>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-500">
                                            {currentQuestion.subject} • Section {currentQuestion.section}
                                        </p>
                                        <p className="text-xs text-slate-400">{currentQuestion.chapter}</p>
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${currentQuestion.type === 'MCQ' ? 'bg-teal-100 text-teal-700' : 'bg-teal-100 text-teal-700'
                                    }`}>
                                    {currentQuestion.type}
                                </span>
                            </div>

                            {/* Question Text */}
                            <div className="mb-6">
                                <p className="text-lg md:text-xl font-medium text-slate-900 leading-relaxed">
                                    {currentQuestion.text}
                                </p>
                            </div>

                            {/* Answer Options */}
                            {currentQuestion.type === 'MCQ' ? (
                                <div className="space-y-3">
                                    {currentQuestion.options.map((option, oIdx) => (
                                        <label
                                            key={oIdx}
                                            className={`flex items-start gap-3 p-4 rounded-md border-2 cursor-pointer transition-all ${answers[currentQuestionIndex] === oIdx
                                                ? 'bg-teal-50 border-teal-500'
                                                : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                                }`}
                                        >
                                            <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${answers[currentQuestionIndex] === oIdx
                                                ? 'border-teal-600 bg-teal-600'
                                                : 'border-slate-300 bg-white'
                                                }`}>
                                                {answers[currentQuestionIndex] === oIdx && (
                                                    <div className="w-2 h-2 bg-white rounded-full"></div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-slate-700">
                                                        {String.fromCharCode(65 + oIdx)}.
                                                    </span>
                                                    <span className="text-slate-800">{option}</span>
                                                </div>
                                            </div>
                                            <input
                                                type="radio"
                                                name={`q-${currentQuestionIndex}`}
                                                className="hidden"
                                                checked={answers[currentQuestionIndex] === oIdx}
                                                onChange={() => handleAnswer(oIdx)}
                                            />
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Enter your answer (numerical value):
                                    </label>
                                    <input
                                        type="text"
                                        value={answers[currentQuestionIndex] || ''}
                                        onChange={(e) => handleAnswer(e.target.value)}
                                        className="w-full md:w-1/2 px-4 py-3 border border-slate-300 rounded-md focus:outline-none focus:border-teal-500 text-lg font-mono"
                                        placeholder="e.g., 9.8 or 100"
                                    />
                                    {currentQuestion.section === 'B' && sectionBCount >= 5 && !sectionBSelections[activeSubject].has(currentQuestionIndex) && (
                                        <p className="mt-2 text-sm text-teal-600 font-semibold">
                                            ⚠️ You've already selected 5 questions in Section B. This answer won't be evaluated.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="mt-8 flex flex-wrap gap-3">
                                <button
                                    onClick={toggleMarkForReview}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-md font-semibold transition-colors ${markedForReview.has(currentQuestionIndex)
                                        ? 'bg-purple-100 text-purple-700 border border-purple-500'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                >
                                    <Flag size={16} />
                                    {markedForReview.has(currentQuestionIndex) ? 'Marked' : 'Mark for Review'}
                                </button>
                                <button
                                    onClick={clearResponse}
                                    disabled={answers[currentQuestionIndex] === undefined}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-md font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
                                >
                                    Clear Response
                                </button>
                            </div>
                        </div>

                    {/* Navigation Buttons */}
                    <div className="flex justify-between items-center mt-6 max-w-4xl mx-auto">
                        <button
                            onClick={previousQuestion}
                            disabled={currentQuestionIndex === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-md font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={20} />
                            Previous
                        </button>
                        <button
                            onClick={saveAndNext}
                            disabled={currentQuestionIndex === testData.questions.length - 1}
                            className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-md font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Save & Next
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </main>

                {/* Question Palette Sidebar */}
                <aside className="w-full md:w-80 bg-white border-t md:border-l border-slate-200 p-4 overflow-y-auto">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Question Palette</h3>

                    {/* Section B Counter */}
                    {testData.testPattern === 'JEE_MAINS' && (
                        <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-md">
                            <p className="text-sm font-semibold text-teal-900">
                                Section B ({activeSubject}): {sectionBSelections[activeSubject]?.size || 0}/5 selected
                            </p>
                        </div>
                    )}

                    {/* Status Legend */}
                    <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded border-2 bg-white border-slate-300"></div>
                            <span className="text-slate-600">Not Visited</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-red-50 border-2 border-red-300"></div>
                            <span className="text-slate-600">Not Answered</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-green-50 border-2 border-green-500"></div>
                            <span className="text-slate-600">Answered</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-purple-50 border-2 border-purple-500"></div>
                            <span className="text-slate-600">Marked</span>
                        </div>
                    </div>

                    {/* Question Grid */}
                    <div className="space-y-4">
                        {testData.testPattern === 'JEE_MAINS' ? (
                            <>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-700 mb-2">Section A (MCQ)</h4>
                                    <div className="grid grid-cols-5 gap-2">
                                        {subjectQuestions.filter(q => q.section === 'A').map((q) => {
                                            const globalIdx = testData.questions.indexOf(q);
                                            const status = getQuestionStatus(globalIdx);
                                            return (
                                                <button
                                                    key={globalIdx}
                                                    onClick={() => goToQuestion(globalIdx)}
                                                    className={`w-full aspect-square rounded-lg border-2 font-bold text-sm transition-all ${globalIdx === currentQuestionIndex
                                                        ? 'ring-2 ring-teal-500 scale-110'
                                                        : ''
                                                        } ${getStatusColor(status)}`}
                                                >
                                                    {globalIdx + 1}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-700 mb-2">Section B (Numerical)</h4>
                                    <div className="grid grid-cols-5 gap-2">
                                        {subjectQuestions.filter(q => q.section === 'B').map((q) => {
                                            const globalIdx = testData.questions.indexOf(q);
                                            const status = getQuestionStatus(globalIdx);
                                            return (
                                                <button
                                                    key={globalIdx}
                                                    onClick={() => goToQuestion(globalIdx)}
                                                    className={`w-full aspect-square rounded-lg border-2 font-bold text-sm transition-all ${globalIdx === currentQuestionIndex
                                                        ? 'ring-2 ring-teal-500 scale-110'
                                                        : ''
                                                        } ${getStatusColor(status)}`}
                                                >
                                                    {globalIdx + 1}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="grid grid-cols-5 gap-2">
                                {testData.questions.map((_, idx) => {
                                    const status = getQuestionStatus(idx);
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => goToQuestion(idx)}
                                            className={`w-full aspect-square rounded-lg border-2 font-bold text-sm transition-all ${idx === currentQuestionIndex
                                                ? 'ring-2 ring-teal-500 scale-110'
                                                : ''
                                                } ${getStatusColor(status)}`}
                                        >
                                            {idx + 1}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </aside>
            </div>

            {/* Submit Confirmation Modal */}
            <AnimatePresence>
                {showSubmitConfirm && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6"
                        >
                            <h3 className="text-xl font-bold text-slate-800 mb-4">Submit Test?</h3>

                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Total Questions:</span>
                                    <span className="font-bold">{testData.questions.length}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Answered:</span>
                                    <span className="font-bold text-green-600">{Object.keys(answers).length}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Not Answered:</span>
                                    <span className="font-bold text-red-600">
                                        {testData.questions.length - Object.keys(answers).length}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Marked for Review:</span>
                                    <span className="font-bold text-purple-600">{markedForReview.size}</span>
                                </div>
                            </div>

                            <p className="text-sm text-slate-600 mb-6">
                                Once submitted, you cannot change your answers. Are you sure you want to submit?
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowSubmitConfirm(false)}
                                    className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleSubmit(false)}
                                    disabled={isSubmitting}
                                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 shadow-lg shadow-green-500/20 disabled:opacity-70"
                                >
                                    {isSubmitting ? 'Submitting...' : 'Yes, Submit'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default StudentTestAttemptPage;
