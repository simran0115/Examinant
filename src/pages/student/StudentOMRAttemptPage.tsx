import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Timer, ArrowLeft, Send, Loader2, AlertCircle } from 'lucide-react';
import { db } from '../../firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp, query, where, documentId, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import type { OMRSection, OMRTest } from '../../types/omr.types';

// ─── Types ────────────────────────────────────────────────────────────────────

type BubbleAnswers = Record<number, string>; // serialNumber → selected option ('A'/'B'/'C'/'D' or numeric string)

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'];

const SUBJECT_COLORS: Record<string, { bg: string; border: string; text: string; light: string }> = {
    Physics:     { bg: 'bg-teal-600',   border: 'border-teal-500',   text: 'text-teal-600',   light: 'bg-teal-50' },
    Chemistry:   { bg: 'bg-green-600',  border: 'border-green-500',  text: 'text-green-600',  light: 'bg-green-50' },
    Mathematics: { bg: 'bg-purple-600', border: 'border-purple-500', text: 'text-purple-600', light: 'bg-purple-50' },
    Biology:     { bg: 'bg-rose-600',   border: 'border-rose-500',   text: 'text-rose-600',   light: 'bg-rose-50' },
    default:     { bg: 'bg-teal-500',  border: 'border-teal-400',  text: 'text-teal-600',  light: 'bg-teal-50' },
};

const getColor = (subject?: string) => SUBJECT_COLORS[subject || ''] || SUBJECT_COLORS.default;

// ─── Main Component ────────────────────────────────────────────────────────────

const StudentOMRAttemptPage = () => {
    const { testId } = useParams();
    const navigate = useNavigate();
    const authContext = useAuth();
    const currentUser = authContext?.currentUser;

    const [testData, setTestData] = useState<OMRTest | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [answers, setAnswers] = useState<BubbleAnswers>({});
    const [timeRemaining, setTimeRemaining] = useState(180 * 60);
    const [showInstructions, setShowInstructions] = useState(true);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeSection, setActiveSection] = useState<OMRSection | null>(null);
    const [highlightedQ, setHighlightedQ] = useState<number | null>(null);
    const questionRefs = useRef<Record<number, HTMLDivElement | null>>({});

    // ── Fetch test ────────────────────────────────────────────────
    useEffect(() => {
        const fetch = async () => {
            if (!testId) return;
            try {
                const snap = await getDoc(doc(db, 'tests', testId));
                if (snap.exists()) {
                    const rawData = snap.data();
                    let data = { id: snap.id, ...rawData } as unknown as OMRTest;
                    
                    // Fallback for Digital tests opened in OMR mode
                    if (!data.omrTemplate) {
                        const totalQuestions = (data as any).questionIds?.length || (data as any).questionConfig?.totalQuestions || 0;
                        data.omrTemplate = {
                            totalQuestions,
                            optionsPerQuestion: (data as any).settings?.optionsPerQuestion || 4,
                            sections: [
                                {
                                    id: 'general',
                                    name: 'General Section',
                                    subject: 'General',
                                    questionCount: totalQuestions,
                                    optionsPerQuestion: 4,
                                    marksCorrect: (data as any).settings?.marksPerQuestion || 4,
                                    marksWrong: (data as any).settings?.negativeMarking || 1,
                                    marksUnattempted: 0,
                                    questionStartIndex: 1,
                                    questionEndIndex: totalQuestions
                                }
                            ],
                            examPattern: 'CUSTOM'
                        };
                    }

                    // ── BRIDGE: Fetch Question Text for Digital Tests ──
                    if ((data as any).questionIds?.length > 0 && (!data.questionMappings || data.questionMappings.length === 0)) {
                        const questionIds = (data as any).questionIds;
                        const loadedQuestions: any[] = [];
                        
                        // Batched Fetching (30 items max per query)
                        const chunks = [];
                        for (let i = 0; i < questionIds.length; i += 30) {
                            chunks.push(questionIds.slice(i, i + 30));
                        }
                        
                        for (const chunk of chunks) {
                            const q = query(
                                collection(db, 'questions'),
                                where(documentId(), 'in', chunk)
                            );
                            const snapshot = await getDocs(q);
                            snapshot.docs.forEach(docSnap => {
                                loadedQuestions.push({ id: docSnap.id, ...docSnap.data() });
                            });
                        }

                        // Map in original order
                        data.questionMappings = questionIds.map((id: string, index: number) => {
                            const q = loadedQuestions.find(ql => ql.id === id);
                            if (q) {
                                return {
                                    serialNumber: index + 1,
                                    questionId: q.id,
                                    questionText: q.text,
                                    options: q.options,
                                    subject: q.subject,
                                    chapter: q.chapter,
                                    type: q.type,
                                    correctOption: String(q.correctAnswer)
                                };
                            }
                            return { serialNumber: index + 1 };
                        });
                    }

                    setTestData(data);
                    setTimeRemaining((data.settings?.duration || 180) * 60);
                    if (data.omrTemplate?.sections?.length) {
                        setActiveSection(data.omrTemplate.sections[0]);
                    }
                } else {
                    alert('Test not found!');
                    navigate('/dashboard/tests');
                }
            } catch (e) {
                console.error(e);
                alert('Error loading test');
                navigate('/dashboard/tests');
            } finally {
                setIsLoading(false);
            }
        };
        fetch();
    }, [testId, navigate]);

    // ── Timer ─────────────────────────────────────────────────────
    useEffect(() => {
        if (showInstructions || !testData) return;
        const interval = setInterval(() => {
            setTimeRemaining(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    handleSubmit(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [showInstructions, testData]);

    const formatTime = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };

    // ── Answer Bubble ─────────────────────────────────────────────
    const toggleBubble = (serialNumber: number, option: string) => {
        setAnswers(prev => ({
            ...prev,
            [serialNumber]: prev[serialNumber] === option ? '' : option,
        }));
    };

    const scrollToQuestion = (q: number) => {
        setHighlightedQ(q);
        questionRefs.current[q]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        const textEl = document.getElementById(`q-text-${q}`);
        if (textEl) {
            textEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        setTimeout(() => setHighlightedQ(null), 1500);
    };

    // ── Submit ────────────────────────────────────────────────────
    const handleSubmit = async (autoSubmit = false) => {
        if (!currentUser || !testData) return;
        if (!autoSubmit && !showSubmitConfirm) { setShowSubmitConfirm(true); return; }

        setIsSubmitting(true);
        try {
            const sections = testData.omrTemplate?.sections || [];
            const mappings = testData.questionMappings || [];

            let totalScore = 0;
            let correct = 0, wrong = 0, unattempted = 0;
            const sectionWise: Record<string, { score: number; correct: number; wrong: number; unattempted: number }> = {};

            sections.forEach(sec => {
                let secScore = 0, secCorrect = 0, secWrong = 0, secUnattempted = 0;
                for (let i = sec.questionStartIndex; i <= sec.questionEndIndex; i++) {
                    const key = mappings.find(m => m.serialNumber === i);
                    const studentAnswer = answers[i];
                    if (!studentAnswer) {
                        secUnattempted++;
                        unattempted++;
                        secScore += sec.marksUnattempted;
                    } else if (key?.correctOption && String(studentAnswer).trim().toLowerCase() === String(key.correctOption).trim().toLowerCase()) {
                        secCorrect++;
                        correct++;
                        secScore += sec.marksCorrect;
                    } else {
                        secWrong++;
                        wrong++;
                        secScore += sec.marksWrong;
                    }
                }
                totalScore += secScore;
                sectionWise[sec.name] = { score: secScore, correct: secCorrect, wrong: secWrong, unattempted: secUnattempted };
            });

            const totalMarks = sections.reduce((s, sec) => s + sec.questionCount * sec.marksCorrect, 0);
            const timeTaken = ((testData?.settings?.duration || 0) * 60) - timeRemaining;

            const resultData = {
                testId: testData?.id,
                testName: testData?.name,
                isOMR: true,
                studentId: currentUser.uid,
                answers,
                score: totalScore,
                totalMarks,
                correctCount: correct,
                wrongCount: wrong,
                unattemptedCount: unattempted,
                sectionWiseScore: sectionWise,
                timeTakenSeconds: timeTaken,
                attemptDate: serverTimestamp(),
            };

            await addDoc(collection(db, 'users', currentUser.uid, 'attempts'), resultData);

            if (testData?.settings?.showResultsImmediately) {
                alert(
                    `✅ OMR Test Submitted!\n\nScore: ${totalScore} / ${totalMarks}\nCorrect: ${correct} | Wrong: ${wrong} | Unattempted: ${unattempted}`
                );
            } else {
                alert('✅ OMR Test Submitted! Results will be shown later.');
            }
            navigate('/dashboard/results');
        } catch (e) {
            console.error(e);
            alert('Error submitting test. Please try again.');
        } finally {
            setIsSubmitting(false);
            setShowSubmitConfirm(false);
        }
    };

    // ── Loading ───────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-teal-500" size={40} />
                    <p className="text-slate-500 font-medium">Loading OMR test environment...</p>
                </div>
            </div>
        );
    }

    if (!testData) return <div className="p-8 text-center text-slate-500">Test failed to load.</div>;

    const sections = testData.omrTemplate?.sections || [];
    const totalQ = testData.omrTemplate?.totalQuestions || 0;
    const answeredCount = Object.values(answers).filter(v => v && v !== '').length;

    // ── Instructions Screen ───────────────────────────────────────
    if (showInstructions) {
        return (
            <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
                <div
                    className="bg-white w-full max-w-2xl rounded-md shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
                >
                    <div className="bg-teal-600 p-6 text-white text-center">
                        <div className="flex flex-col items-center gap-2 mb-1">
                            <div className="w-16 h-16 bg-white/20 rounded-md flex items-center justify-center text-3xl mb-2 backdrop-blur-sm shadow-xl">
                                📄
                            </div>
                            <h2 className="text-2xl font-bold">{testData?.name}</h2>
                        </div>
                        <p className="text-teal-100 text-sm font-medium opacity-90 uppercase tracking-widest">OMR Mode • Bubble Sheet Simulation</p>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { label: 'Questions', value: totalQ, color: 'text-teal-600', bg: 'bg-teal-50' },
                                { label: 'Duration', value: `${testData?.settings?.duration}m`, color: 'text-teal-600', bg: 'bg-teal-50' },
                                { label: 'Sections', value: sections.length, color: 'text-purple-600', bg: 'bg-purple-50' },
                            ].map(({ label, value, color, bg }) => (
                                <div key={label} className={`${bg} rounded-md p-4 text-center`}>
                                    <div className={`text-2xl font-extrabold ${color}`}>{value}</div>
                                    <div className="text-xs text-slate-500 mt-1">{label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Section breakdown */}
                        <div>
                            <h3 className="font-bold text-slate-800 mb-3">Section Breakdown</h3>
                            <div className="space-y-2">
                                {sections.map(sec => {
                                    const color = getColor(sec.subject);
                                    return (
                                        <div key={sec.id} className={`${color.light} border ${color.border} rounded-lg p-3 flex justify-between items-center`}>
                                            <div>
                                                <p className={`font-semibold text-sm ${color.text}`}>{sec.name}</p>
                                                <p className="text-xs text-slate-500">Q{sec.questionStartIndex}–Q{sec.questionEndIndex} • {sec.optionsPerQuestion === 0 ? 'Numerical' : `${sec.optionsPerQuestion} options`}</p>
                                            </div>
                                            <div className="text-right text-xs font-bold">
                                                <p className="text-green-600">+{sec.marksCorrect}</p>
                                                <p className="text-red-500">{sec.marksWrong}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* OMR Instructions */}
                        <div className="bg-teal-50 border border-teal-200 rounded-md p-4">
                            <p className="font-bold text-teal-900 mb-2 text-sm">How to use OMR Mode:</p>
                            <ul className="text-sm text-teal-800 space-y-1.5">
                                <li>• Click on a bubble (A/B/C/D) to fill it — click again to clear</li>
                                <li>• Numerical questions: type the value in the input box</li>
                                <li>• Use section tabs to navigate between sections</li>
                                <li>• Click any question number in the palette to scroll to it</li>
                                <li>• The test auto-submits when the timer reaches 00:00:00</li>
                            </ul>
                        </div>

                        {testData?.settings?.instructions && (
                            <div className="bg-slate-50 rounded-md p-4 text-sm text-slate-700">
                                <p className="font-bold mb-1">Admin Instructions:</p>
                                <p>{testData?.settings?.instructions}</p>
                            </div>
                        )}

                        <button
                            onClick={() => setShowInstructions(false)}
                            className="w-full py-3.5 bg-teal-600 text-white font-bold rounded-md hover:bg-teal-700 transition-all"
                        >
                            I Understand — Start OMR Test 📄
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Main OMR Interface ────────────────────────────────────────
    const activeSectionData = activeSection || sections[0];

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col">

            {/* ── Top Header ── */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 md:px-6 py-3 shadow-sm">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { if (window.confirm('Exit OMR Test? Progress will be lost.')) navigate('/dashboard/tests'); }}
                            className="p-2 hover:bg-teal-50 rounded-md text-slate-400 hover:text-teal-600 transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">Live Exam 📄</p>
                            <h1 className="text-sm md:text-base font-bold text-slate-800 leading-tight">{testData?.name}</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Timer */}
                        <div className={`flex items-center gap-2 font-mono text-sm font-bold px-3 py-2 rounded-lg ${
                            timeRemaining < 300 ? 'bg-red-50 text-red-600 animate-pulse' :
                            timeRemaining < 600 ? 'bg-teal-50 text-teal-600' :
                            'bg-teal-50 text-teal-700'
                        }`}>
                            <Timer size={16} />
                            <span>{formatTime(timeRemaining)}</span>
                        </div>

                        {/* Progress chip */}
                        <div className="hidden md:flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-lg text-sm font-semibold text-slate-700">
                            <span className="text-green-600">{answeredCount}</span>
                            <span className="text-slate-400">/</span>
                            <span>{totalQ}</span>
                        </div>

                        <button
                            onClick={() => setShowSubmitConfirm(true)}
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 transition-colors text-sm"
                        >
                            <Send size={15} />
                            <span className="hidden md:inline">Submit</span>
                        </button>
                    </div>
                </div>

                {/* Section Tabs */}
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {sections.map(sec => {
                        const color = getColor(sec.subject);
                        const isActive = activeSectionData?.id === sec.id;
                        const secAnswered = Object.keys(answers).filter(k => {
                            const n = parseInt(k);
                            return n >= sec.questionStartIndex && n <= sec.questionEndIndex && answers[n];
                        }).length;
                        return (
                            <button
                                key={sec.id}
                                onClick={() => {
                                    setActiveSection(sec);
                                    scrollToQuestion(sec.questionStartIndex);
                                }}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
                                    isActive
                                        ? `${color.bg} text-white`
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {sec.name}
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/20' : 'bg-slate-200 text-slate-600'}`}>
                                    {secAnswered}/{sec.questionCount}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </header>

            <div className="flex-1 flex flex-col xl:flex-row overflow-hidden">

                {/* ── Question Viewer (Left Side) ── */}
                <div className="w-full xl:w-1/2 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col h-[60vh] xl:h-auto overflow-hidden">
                    <div className="bg-slate-800 text-white px-4 py-3 text-xs font-bold flex justify-between items-center z-10 shadow-sm">
                        <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse border border-white/20" />
                             <span>QUESTION PAPER VIEW</span>
                        </div>
                        {testData?.omrTemplate?.questionPdfUrl && (
                            <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-400">PDF Mode</span>
                        )}
                    </div>
                    
                    <div className="flex-1 overflow-hidden flex flex-col bg-slate-100 relative">
                        {testData?.omrTemplate?.questionPdfUrl ? (
                            <div className="flex-1 w-full h-full flex flex-col">
                                <iframe 
                                    src={`${testData?.omrTemplate?.questionPdfUrl}#view=FitH&toolbar=0`}
                                    className="w-full h-full border-none bg-white"
                                    title="Question Paper"
                                />
                            </div>
                        ) : (
                            <div className="flex-1 p-4 md:p-6 space-y-8 overflow-y-auto">
                                {sections.map(sec => (
                                    <div key={`qpaper-${sec.id}`} className="mb-6">
                                        <h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4 sticky top-0 bg-white z-0">{sec.name} <span className="text-sm font-normal text-slate-500">({sec.subject || 'General'})</span></h3>
                                        <div className="space-y-6">
                                            {(testData.questionMappings || [])
                                                .filter(m => m.serialNumber >= sec.questionStartIndex && m.serialNumber <= sec.questionEndIndex)
                                                .map(m => (
                                                    <div key={`qtext-${m.serialNumber}`} className={`p-4 rounded-md border border-slate-200 transition-all ${highlightedQ === m.serialNumber ? 'border-teal-400 bg-teal-50 shadow-sm' : 'border-slate-100 bg-slate-50'}`} id={`q-text-${m.serialNumber}`}>
                                                        <div className="flex items-start gap-4">
                                                            <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-slate-800 text-white font-bold rounded-lg text-sm">
                                                                {m.serialNumber}
                                                            </span>
                                                            <div className="flex-1 min-w-0">
                                                                {m.questionText ? (
                                                                    <div className="text-slate-800 whitespace-pre-wrap text-sm leading-relaxed font-medium">{m.questionText}</div>
                                                                ) : (
                                                                    <div className="text-slate-400 italic text-sm">No question text provided</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── OMR Workspace (Right Side) ── */}
                <div className="flex-1 flex flex-col md:flex-row bg-slate-100 overflow-hidden">
                    {/* ── Content Area ── */}
                    <main className="flex-1 p-4 md:p-6 overflow-y-auto">
                    <div className="max-w-3xl mx-auto space-y-6">
                        {sections.map(sec => {
                            const color = getColor(sec.subject);
                            const isNumerical = sec.optionsPerQuestion === 0;
                            const opts = OPTION_LABELS.slice(0, sec.optionsPerQuestion);

                            return (
                                <div key={sec.id} className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden">
                                    {/* Section Header */}
                                    <div className={`${color.bg} px-5 py-3 flex items-center justify-between`}>
                                        <div>
                                            <p className="text-white font-bold">{sec.name}</p>
                                            <p className="text-white/70 text-xs">Q{sec.questionStartIndex}–Q{sec.questionEndIndex} • {isNumerical ? 'Numerical' : `MCQ ${sec.optionsPerQuestion} opts`} • +{sec.marksCorrect} / {sec.marksWrong}</p>
                                        </div>
                                        <div className="bg-white/20 rounded-lg px-3 py-1 text-white text-xs font-bold">
                                            {Object.keys(answers).filter(k => {
                                                const n = parseInt(k);
                                                return n >= sec.questionStartIndex && n <= sec.questionEndIndex && answers[n];
                                            }).length} / {sec.questionCount}
                                        </div>
                                    </div>

                                    {/* Bubble Grid */}
                                    <div className="p-4 md:p-6 overflow-x-auto">
                                        {isNumerical ? (
                                            /* Numerical Input Grid */
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                {Array.from({ length: sec.questionCount }, (_, i) => sec.questionStartIndex + i).map(qNum => {
                                                    const isHighlighted = highlightedQ === qNum;
                                                    return (
                                                        <div
                                                            key={qNum}
                                                            ref={el => { questionRefs.current[qNum] = el; }}
                                                            className={`flex items-center gap-3 p-3 rounded-md border border-slate-200 transition-all ${
                                                                isHighlighted ? `border-teal-500 ${color.light}` :
                                                                answers[qNum] ? `border-green-300 bg-green-50` :
                                                                'border-slate-100 bg-slate-50'
                                                            }`}
                                                        >
                                                            <span className={`text-xs font-extrabold w-8 text-center ${color.text}`}>Q{qNum}</span>
                                                            <input
                                                                type="text"
                                                                value={answers[qNum] || ''}
                                                                onChange={e => setAnswers(prev => ({ ...prev, [qNum]: e.target.value }))}
                                                                placeholder="Value"
                                                                className="flex-1 px-2 py-1.5 border border-slate-200 rounded-md text-sm font-mono text-center focus:outline-none focus:border-teal-400 bg-white"
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            /* MCQ Bubble Table */
                                            <div className="w-full">
                                                {/* Header Row */}
                                                <div className="grid mb-2 text-xs font-bold text-slate-500 text-center"
                                                    style={{ gridTemplateColumns: `3rem repeat(${opts.length}, 2.5rem)` }}>
                                                    <span className="text-left pl-1">No.</span>
                                                    {opts.map(o => <span key={o}>{o}</span>)}
                                                </div>

                                                {/* Question Rows */}
                                                <div className="space-y-1.5">
                                                    {Array.from({ length: sec.questionCount }, (_, i) => sec.questionStartIndex + i).map(qNum => {
                                                        const isHighlighted = highlightedQ === qNum;
                                                        const answered = answers[qNum];
                                                        return (
                                                            <div
                                                                key={qNum}
                                                                ref={el => { questionRefs.current[qNum] = el; }}
                                                                className={`grid items-center rounded-md transition-all py-2 px-1 ${
                                                                    isHighlighted ? `${color.light} border border-${color.border}` :
                                                                    answered ? 'bg-green-50 border border-green-200' :
                                                                    'bg-slate-50 border border-transparent hover:border-slate-200'
                                                                }`}
                                                                style={{ gridTemplateColumns: `3rem repeat(${opts.length}, 2.5rem)` }}
                                                            >
                                                                {/* Q Number */}
                                                                <span className={`text-xs font-extrabold text-center ${color.text}`}>{qNum}</span>

                                                                {/* Bubbles */}
                                                                {opts.map(opt => {
                                                                    const isFilled = answers[qNum] === opt;
                                                                    return (
                                                                        <div key={opt} className="flex justify-center">
                                                                            <button
                                                                                onClick={() => toggleBubble(qNum, opt)}
                                                                                className={`w-8 h-8 rounded-full border-2 font-bold text-xs transition-all ${
                                                                                    isFilled
                                                                                        ? `${color.bg} border-transparent text-white shadow-md scale-110`
                                                                                        : 'border-slate-300 bg-white text-slate-400 hover:border-slate-400 hover:bg-slate-100'
                                                                                }`}
                                                                                title={`Q${qNum} → ${opt}`}
                                                                            >
                                                                                {isFilled ? opt : <span className="opacity-30">{opt}</span>}
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </main>

                {/* ── Quick Palette Sidebar ── */}
                <aside className="w-full md:w-64 bg-white border-t md:border-l border-slate-200 p-4 overflow-y-auto">
                    <h3 className="text-sm font-bold text-slate-700 mb-3">Quick Navigator</h3>

                    {/* Legend */}
                    <div className="flex gap-3 text-xs mb-4">
                        <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-green-500" />
                            <span className="text-slate-500">Filled</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full border-2 border-slate-300 bg-white" />
                            <span className="text-slate-500">Empty</span>
                        </div>
                    </div>

                    {sections.map(sec => {
                        const color = getColor(sec.subject);
                        return (
                            <div key={sec.id} className="mb-4">
                                <p className={`text-xs font-bold mb-2 ${color.text}`}>{sec.name}</p>
                                <div className="grid grid-cols-5 gap-1.5">
                                    {Array.from({ length: sec.questionCount }, (_, i) => sec.questionStartIndex + i).map(qNum => {
                                        const isFilled = !!(answers[qNum] && answers[qNum] !== '');
                                        return (
                                            <button
                                                key={qNum}
                                                onClick={() => { setActiveSection(sec); scrollToQuestion(qNum); }}
                                                className={`w-full aspect-square text-xs font-bold rounded-md border-2 transition-all ${
                                                    isFilled
                                                        ? `${color.bg} border-transparent text-white`
                                                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400'
                                                }`}
                                            >
                                                {qNum}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    {/* Final Submit Button */}
                    <button
                        onClick={() => setShowSubmitConfirm(true)}
                        className="w-full mt-4 py-3 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 transition-colors shadow-sm text-sm"
                    >
                        Submit OMR Test
                    </button>
                </aside>
                </div>
            </div>

            {/* ── Submit Confirmation Modal ── */}

                {showSubmitConfirm && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div
                            className="bg-white w-full max-w-md rounded-md shadow-2xl p-6"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-teal-100 rounded-md flex items-center justify-center">
                                    <AlertCircle className="text-teal-600" size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Submit OMR Test?</h3>
                                    <p className="text-slate-500 text-sm">This action cannot be undone</p>
                                </div>
                            </div>

                            <div className="space-y-2 mb-5 bg-slate-50 rounded-md p-4">
                                {[
                                    { label: 'Total Questions', value: totalQ, color: 'text-slate-800' },
                                    { label: 'Answered', value: answeredCount, color: 'text-green-600' },
                                    { label: 'Not Answered', value: totalQ - answeredCount, color: 'text-red-500' },
                                ].map(({ label, value, color }) => (
                                    <div key={label} className="flex justify-between text-sm">
                                        <span className="text-slate-500">{label}:</span>
                                        <span className={`font-bold ${color}`}>{value}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowSubmitConfirm(false)}
                                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-md font-semibold hover:bg-slate-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleSubmit(false)}
                                    disabled={isSubmitting}
                                    className="flex-1 py-2.5 bg-green-600 text-white rounded-md font-bold hover:bg-green-700 transition-colors shadow-sm disabled:opacity-70"
                                >
                                    {isSubmitting ? (
                                        <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={16} /> Submitting...</span>
                                    ) : 'Yes, Submit'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

        </div>
    );
};

export default StudentOMRAttemptPage;
