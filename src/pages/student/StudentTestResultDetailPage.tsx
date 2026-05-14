import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, CheckCircle, XCircle, MinusCircle, Clock,
    Award, Loader2, BookOpen, Download
} from 'lucide-react';
import { db } from '../../firebase';
import { doc, getDoc, collection, query, where, documentId, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';

interface Question {
    id: string;
    text: string;
    options: string[];
    correctAnswer: number | string;
    subject: string;
    type: 'MCQ' | 'Numerical';
    explanation?: string;
    section?: string;
}

interface AttemptData {
    id: string;
    testId: string;
    testTitle: string;
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    attemptedQuestions: number;
    duration: number;
    timeTakenSeconds?: number;
    answers: Record<number, number | string>;
    attemptDate: any;
    isOMR?: boolean;
}

interface TestData {
    id: string;
    omrTemplate?: {
        totalQuestions: number;
        sections: { name: string; questionStartIndex: number; questionEndIndex: number; questionCount: number }[];
    };
    questionMappings?: { serialNumber: number; correctOption: string; subject?: string }[];
}

const StudentTestResultDetailPage = () => {
    const { attemptId } = useParams();
    const navigate = useNavigate();
    const auth = useAuth();
    const currentUser = auth?.currentUser;

    const [attempt, setAttempt] = useState<AttemptData | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<'all' | 'correct' | 'incorrect' | 'unattempted'>('all');

    useEffect(() => {
        const fetchData = async () => {
            if (!attemptId || !auth?.currentUser) return;

            try {
                // Strip "legacy-" prefix if present (used for internal mapping but not in DB)
                const realAttemptId = attemptId.startsWith('legacy-') ? attemptId.replace('legacy-', '') : attemptId;

                // 1. Fetch Attempt Data
                let attemptData: AttemptData | null = null;
                
                try {
                    const attemptRef = doc(db, 'users', auth.currentUser.uid, 'attempts', realAttemptId);
                    const attemptSnap = await getDoc(attemptRef);

                    if (attemptSnap.exists()) {
                        attemptData = { id: attemptSnap.id, ...attemptSnap.data() } as AttemptData;
                    }
                } catch (err) {
                    console.warn("Primary attempt fetch failed, trying legacy fallback:", err);
                }

                if (!attemptData) {
                    // Backward compatibility: some older digital attempts were stored in top-level testResults
                    // Use a query instead of getDoc to satisfy security rules
                    try {
                        const legacyRef = collection(db, 'testResults');
                        const [userSnap, studentSnap] = await Promise.all([
                            getDocs(query(legacyRef, where('userId', '==', auth.currentUser.uid), where('__name__', '==', realAttemptId))),
                            getDocs(query(legacyRef, where('studentId', '==', auth.currentUser.uid), where('__name__', '==', realAttemptId)))
                        ]);

                        const foundDoc = userSnap.docs[0] || studentSnap.docs[0];

                        if (foundDoc) {
                            attemptData = {
                                id: foundDoc.id,
                                ...foundDoc.data(),
                            } as AttemptData;
                        }
                    } catch (err) {
                        console.warn("Legacy attempt fetch failed:", err);
                    }
                }

                if (!attemptData) {
                    setError("Result not found. It may have been deleted or you don't have permission to view it.");
                    setIsLoading(false);
                    return;
                }

                setAttempt(attemptData);

                // 2. Fetch Test Metadata
                if (attemptData.testId) {
                    try {
                        const testRef = doc(db, 'tests', attemptData.testId);
                        const testSnap = await getDoc(testRef);
                        
                        if (testSnap.exists()) {
                            const tData = { id: testSnap.id, ...testSnap.data() } as TestData;
    
                            // ── BRIDGE: Unified Results Logic ──
    
                            // Digital-style attempt: Needs full questions content
                            let questionIds = (tData as any).questionIds || [];
                            
                            if (questionIds.length === 0 && tData.questionMappings?.length) {
                                const loadedQuestions = tData.questionMappings.map(m => ({
                                    id: `omr-${m.serialNumber}`,
                                    text: (m as any).questionText || `Question ${m.serialNumber}`,
                                    options: (m as any).options || ['Option A', 'Option B', 'Option C', 'Option D'],
                                    correctAnswer: (m as any).correctOption || 'A',
                                    subject: m.subject || 'General',
                                    type: 'MCQ'
                                } as Question));
                                setQuestions(loadedQuestions);
                            } else if (questionIds.length > 0) {
                                try {
                                    const loadedQuestions: Question[] = [];
                                    const chunks = [];
                                    for (let i = 0; i < questionIds.length; i += 30) {
                                        chunks.push(questionIds.slice(i, i + 30));
                                    }
                                    
                                    for (const chunk of chunks) {
                                        const q = query(collection(db, 'questions'), where(documentId(), 'in', chunk));
                                        const snapshot = await getDocs(q);
                                        snapshot.docs.forEach(docSnap => {
                                            loadedQuestions.push({ id: docSnap.id, ...docSnap.data() } as Question);
                                        });
                                    }
                                    
                                    const orderedQuestions = questionIds.map((questionId: string) => 
                                        loadedQuestions.find(q => q.id === questionId)
                                    ).filter(Boolean) as Question[];
                                    
                                    setQuestions(orderedQuestions);
                                } catch (err) {
                                    console.warn("Failed to load digital questions:", err);
                                }
                            }
                        }
                    } catch (err) {
                        console.warn("Failed to load test metadata:", err);
                    }
                } else {
                    console.warn("No testId found in attempt data");
                }

            } catch (error) {
                console.error("Error loading result details:", error);
                setError(error instanceof Error ? error.message : "An unexpected error occurred");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [attemptId, auth?.currentUser, navigate]);

    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours}h ${minutes}m ${secs}s`;
    };

    const formatDate = (date: any) => {
        if (!date) return 'N/A';
        try {
            const d = date.toDate ? date.toDate() : new Date(date);
            return d.toLocaleDateString();
        } catch (e) {
            return 'N/A';
        }
    };

    const getAnswerStatus = (questionIndex: number, question: Question) => {
        if (!attempt?.answers) return 'unattempted';
        const userAnswer = attempt.answers[questionIndex];

        if (userAnswer === undefined || userAnswer === null || userAnswer === '') return 'unattempted';

        if (String(userAnswer) === String(question.correctAnswer)) return 'correct';
        return 'incorrect';
    };

    const filteredQuestions = questions.map((q, idx) => ({ ...q, index: idx, status: getAnswerStatus(idx, q) }))
        .filter(q => activeFilter === 'all' || q.status === activeFilter);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="animate-spin text-teal-600" size={40} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <XCircle size={48} className="text-red-500 mb-4" />
                <h2 className="text-xl font-bold text-slate-800 mb-2">Failed to Load Details</h2>
                <p className="text-slate-600 mb-6 max-w-md">{error}</p>
                <div className="flex gap-4">
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 transition-colors"
                    >
                        Try Again
                    </button>
                    <button
                        onClick={() => navigate('/dashboard/results')}
                        className="px-6 py-2 bg-slate-100 text-slate-700 rounded-md font-bold hover:bg-slate-200 transition-colors"
                    >
                        Back to Results
                    </button>
                </div>
            </div>
        );
    }

    if (!attempt) return null;

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 print-container">
            {/* Print Only Header (Certificate Style) */}
            <div className="hidden print:block mb-10 text-center border-b-4 border-double border-slate-900 pb-8">
                <div className="flex flex-col items-center">
                    <h1 className="text-5xl font-black text-slate-900 tracking-[0.2em] mb-2">DHItantra</h1>
                    <div className="w-24 h-1 bg-gradient-to-r from-teal-500 to-teal-500 mb-4"></div>
                    <p className="text-slate-500 font-black uppercase tracking-[0.4em] text-[10px]">Official Performance Statement</p>
                </div>
                
                <div className="mt-10 grid grid-cols-3 gap-8 text-center max-w-3xl mx-auto border border-slate-200 p-6 rounded-md bg-slate-50/50">
                    <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">CANDIDATE</p>
                        <p className="text-lg font-black text-slate-900 uppercase leading-none">{currentUser?.displayName || 'Student'}</p>
                        <p className="text-[10px] text-slate-500 mt-1 font-medium">{currentUser?.email}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">TIME TAKEN</p>
                        <p className="text-lg font-black text-slate-900 leading-none">{formatDuration(attempt.timeTakenSeconds || attempt.duration || 0)}</p>
                        <p className="text-[10px] text-slate-500 mt-1 font-medium">Duration</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">ISSUE DATE</p>
                        <p className="text-lg font-black text-slate-900 leading-none">{new Date().toLocaleDateString()}</p>
                        <p className="text-[10px] text-slate-500 mt-1 font-medium">Ref: {attempt.id.substring(0, 8).toUpperCase()}</p>
                    </div>
                </div>

                <div className="mt-10 text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">ASSESSMENT TITLE</p>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">{attempt.testTitle}</h2>
                    <div className="mt-2 inline-block px-4 py-1 bg-slate-900 text-white text-[10px] font-black rounded-full uppercase tracking-widest">
                        DIGITAL INTERACTIVE ATTEMPT
                    </div>
                </div>
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/dashboard/results')}
                        className="p-2 hover:bg-slate-100 rounded-md text-slate-500 transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{attempt.testTitle} - Result Analysis</h1>
                        <p className="text-slate-500 text-sm">
                            Attempted on {formatDate(attempt.attemptDate)}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-md font-bold hover:bg-slate-800 transition-all shadow-sm"
                >
                    <Download size={18} />
                    Download Report
                </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-md border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-teal-50 text-teal-600 rounded-md">
                        <Award size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Score</p>
                        <h3 className="text-2xl font-bold text-slate-800">
                            {attempt.score || 0} <span className="text-sm text-slate-400 font-normal">/ {(questions.length || attempt.totalQuestions || 0) * 4}</span>
                        </h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-md border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-md">
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Correct</p>
                        <h3 className="text-2xl font-bold text-slate-800">
                            {attempt.correctAnswers ?? (attempt as any).correctCount ?? 0}
                        </h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-md border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-red-50 text-red-600 rounded-md">
                        <XCircle size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Incorrect</p>
                        <h3 className="text-2xl font-bold text-slate-800">
                            {(attempt as any).wrongCount ?? (attempt.attemptedQuestions - attempt.correctAnswers)}
                        </h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-md border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-md">
                        <Clock size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Time Taken</p>
                        <h3 className="text-2xl font-bold text-slate-800">{formatDuration(attempt.timeTakenSeconds || attempt.duration || 0)}</h3>
                    </div>
                </div>
            </div>
            


            {/* Digital Analysis Section (Standard List) */}
            <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden">

                <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <BookOpen size={20} className="text-teal-500" />
                        Question Analysis
                    </h2>

                    <div className="flex bg-slate-100 p-1 rounded-md">
                        {(['all', 'correct', 'incorrect', 'unattempted'] as const).map(filter => (
                            <button
                                key={filter}
                                onClick={() => setActiveFilter(filter)}
                                className={`px-4 py-1.5 rounded-md text-sm font-semibold capitalize transition-all ${activeFilter === filter
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="divide-y divide-slate-100">
                    {filteredQuestions.map((q) => {
                        const status = q.status;
                        const userAnswer = attempt.answers ? attempt.answers[q.index] : undefined;

                        return (
                            <div key={q.id} className="p-6 hover:bg-slate-50 transition-colors">
                                <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${status === 'correct' ? 'bg-green-100 text-green-700' :
                                            status === 'incorrect' ? 'bg-red-100 text-red-700' :
                                                'bg-slate-100 text-slate-500'
                                            }`}>
                                            {q.index + 1}
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-3">
                                        <div className="flex flex-wrap gap-2 items-center text-xs mb-1">
                                            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium">
                                                {q.subject}
                                            </span>
                                            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium">
                                                {q.type}
                                            </span>
                                            {status === 'correct' && (
                                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                                                    <CheckCircle size={12} /> Correct (+4)
                                                </span>
                                            )}
                                            {status === 'incorrect' && (
                                                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                                                    <XCircle size={12} /> Incorrect (-1)
                                                </span>
                                            )}
                                            {status === 'unattempted' && (
                                                <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                                                    <MinusCircle size={12} /> Unattempted (0)
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-slate-800 font-medium text-lg leading-relaxed">
                                            {q.text}
                                        </p>

                                        {q.type === 'MCQ' ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {q.options.map((opt, optIdx) => {
                                                    const isSelected = userAnswer === optIdx;
                                                    const isCorrect = String(q.correctAnswer) === String(optIdx);

                                                    let className = "p-3 rounded-md border text-sm flex items-center gap-3 ";
                                                    if (isCorrect) className += "border-green-500 bg-green-50 text-green-900";
                                                    else if (isSelected && !isCorrect) className += "border-red-500 bg-red-50 text-red-900";
                                                    else className += "border-slate-100 text-slate-600 opacity-70";

                                                    return (
                                                        <div key={optIdx} className={className}>
                                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isCorrect ? 'border-green-600 bg-green-600 text-white' :
                                                                isSelected ? 'border-red-600 bg-red-600 text-white' :
                                                                    'border-slate-300'
                                                                }`}>
                                                                {(isCorrect || isSelected) && <div className="w-2 h-2 bg-white rounded-full" />}
                                                            </div>
                                                            <span className="font-medium">{opt}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="flex gap-4">
                                                <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                                                    <span className="text-xs text-slate-500 block">Your Answer</span>
                                                    <span className={`font-mono font-bold ${status === 'correct' ? 'text-green-600' :
                                                        status === 'incorrect' ? 'text-red-600' : 'text-slate-400'
                                                        }`}>
                                                        {userAnswer ?? 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="p-3 bg-green-50 rounded-md border border-green-200">
                                                    <span className="text-xs text-green-600 block">Correct Answer</span>
                                                    <span className="font-mono font-bold text-green-700">{q.correctAnswer}</span>
                                                </div>
                                            </div>
                                        )}

                                        {q.explanation && (
                                            <div className="mt-4 p-4 bg-teal-50 rounded-md border border-teal-100 text-teal-800 text-sm">
                                                <p className="font-bold mb-1 flex items-center gap-2">
                                                    <BookOpen size={16} /> Explanation:
                                                </p>
                                                {q.explanation}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filteredQuestions.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                        No questions found matching this filter.
                    </div>
                )}
            </div>

            <div className="mt-8 text-center text-slate-400 text-xs hidden print:block pt-8 border-t border-slate-100">
                This is a computer-generated document. No signature required.
                <br />
                Generated by DHItantra Education Platform.
            </div>

            <style>{`
                @media print {
                    @page {
                        margin: 0;
                        size: A4;
                    }
                    body, html {
                        background: white !important;
                        overflow: hidden !important;
                        height: auto !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    /* Remove scrollbars from layout containers */
                    aside, nav, .overflow-y-auto, .overflow-auto, main {
                        overflow: visible !important;
                        height: auto !important;
                    }
                    ::-webkit-scrollbar {
                        display: none !important;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    /* Main Print Container Padding */
                    .print-container {
                        padding: 20mm !important;
                    }
                    
                    /* Background colors manually for some engines */
                    .bg-white { background-color: white !important; }
                    .bg-slate-50 { background-color: #f8fafc !important; }
                    .bg-slate-900 { background-color: #0f172a !important; }
                    
                    /* Stats Grid for print */
                    .grid-cols-1.md\\:grid-cols-4 {
                        display: grid !important;
                        grid-template-columns: repeat(4, 1fr) !important;
                        gap: 15px !important;
                    }
                    
                    /* OMR Bubble visibility on print */
                    .bg-green-500 { background-color: #22c55e !important; }
                    .bg-red-500 { background-color: #ef4444 !important; }
                    .border-green-500 { border-color: #22c55e !important; }
                    .border-red-500 { border-color: #ef4444 !important; }
                    
                    /* Avoid page breaks inside cards */
                    .bg-white.rounded-md {
                        page-break-inside: avoid;
                        break-inside: avoid;
                        margin-bottom: 20px !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default StudentTestResultDetailPage;

