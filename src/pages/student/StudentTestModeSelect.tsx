import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Monitor, FileText, Clock, HelpCircle, ArrowLeft, ChevronRight } from 'lucide-react';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';

interface TestPreview {
    id: string;
    name: string;
    isOMR?: boolean;
    settings?: { duration: number };
    questionIds?: string[];
    omrTemplate?: { totalQuestions: number };
}

const StudentTestModeSelect = () => {
    const { testId } = useParams();
    const navigate = useNavigate();
    const [test, setTest] = useState<TestPreview | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selected, setSelected] = useState<'digital' | 'omr' | null>(null);

    useEffect(() => {
        const fetchTest = async () => {
            if (!testId) return;
            try {
                const snap = await getDoc(doc(db, 'tests', testId));
                if (snap.exists()) {
                    setTest({ id: snap.id, ...snap.data() } as TestPreview);
                } else {
                    alert('Test not found!');
                    navigate(-1);
                }
            } catch (err) {
                console.error(err);
                alert('Error loading test');
                navigate(-1);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTest();
    }, [testId, navigate]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-teal-600" size={40} />
                    <p className="text-slate-500 font-medium">Loading test...</p>
                </div>
            </div>
        );
    }

    if (!test) return null;

    const totalQuestions = test.questionIds?.length || test.omrTemplate?.totalQuestions || 0;
    const duration = test.settings?.duration || 180;
    const hasOMR = !!test.isOMR;
    const hasDigital = !!test.questionIds && test.questionIds.length > 0;

    const handleStart = () => {
        if (!selected) return;
        if (selected === 'digital') {
            navigate(`/dashboard/attempt/${testId}`);
        } else {
            navigate(`/dashboard/omr-attempt/${testId}`);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                {/* Back Button */}
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors font-medium text-sm"
                >
                    <ArrowLeft size={18} /> Back to Tests
                </button>

                {/* Test Info Card */}
                <div className="bg-white/10 border border-white/20 rounded-md p-5 mb-6 text-white shadow-sm">
                    <h1 className="text-xl font-bold mb-3">{test.name}</h1>
                    <div className="flex items-center gap-6 text-sm text-slate-300">
                        <div className="flex items-center gap-2">
                            <HelpCircle size={15} />
                            <span>{totalQuestions} Questions</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock size={15} />
                            <span>{duration} minutes</span>
                        </div>
                    </div>
                </div>

                {/* Mode Selection Title */}
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white">Choose Test Mode</h2>
                    <p className="text-slate-400 mt-1 text-sm">Select how you want to attempt this test</p>
                </div>

                {/* Mode Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Digital Mode */}
                    <button
                        onClick={() => hasDigital ? setSelected('digital') : undefined}
                        className={`relative flex flex-col items-start p-6 rounded-md border text-left transition-all ${
                            !hasDigital
                                ? 'border-white/10 bg-white/5 opacity-50 cursor-not-allowed'
                                : selected === 'digital'
                                ? 'border-teal-500 bg-teal-500/10 shadow-sm'
                                : 'border-white/20 bg-white/5 hover:bg-white/10'
                        }`}
                    >
                        {selected === 'digital' && (
                            <div className="absolute top-4 right-4 w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-[10px] font-bold">✓</span>
                            </div>
                        )}
                        {!hasDigital && (
                            <div className="absolute top-4 right-4 text-[10px] bg-white/10 text-slate-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                Unavailable
                            </div>
                        )}
                        <div className={`w-12 h-12 rounded-md flex items-center justify-center mb-4 ${hasDigital ? 'bg-teal-500/20 border border-teal-500/30' : 'bg-white/10 border border-white/10'}`}>
                            <Monitor size={24} className={hasDigital ? 'text-teal-400' : 'text-slate-500'} />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Digital Mode</h3>
                        <p className="text-slate-400 text-xs leading-relaxed">
                            Standard online test with navigation panel and mark for review. Matches professional exam portals.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {['Question Panel', 'Mark for Review'].map(tag => (
                                <span key={tag} className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${hasDigital ? 'bg-teal-500/20 text-teal-300' : 'bg-white/10 text-slate-500'}`}>
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </button>

                    {/* OMR Mode */}
                    <button
                        onClick={() => hasOMR ? setSelected('omr') : undefined}
                        className={`relative flex flex-col items-start p-6 rounded-md border text-left transition-all ${
                            !hasOMR
                                ? 'border-white/10 bg-white/5 opacity-50 cursor-not-allowed'
                                : selected === 'omr'
                                ? 'border-teal-500 bg-teal-500/10 shadow-sm'
                                : 'border-white/20 bg-white/5 hover:bg-white/10'
                        }`}
                    >
                        {selected === 'omr' && (
                            <div className="absolute top-4 right-4 w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-[10px] font-bold">✓</span>
                            </div>
                        )}
                        {!hasOMR && (
                            <div className="absolute top-4 right-4 text-[10px] bg-white/10 text-slate-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                Unavailable
                            </div>
                        )}
                        <div className={`w-12 h-12 rounded-md flex items-center justify-center mb-4 ${hasOMR ? 'bg-teal-500/20 border border-teal-500/30' : 'bg-white/10 border border-white/10'}`}>
                            <FileText size={24} className={hasOMR ? 'text-teal-400' : 'text-slate-500'} />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">OMR Mode</h3>
                        <p className="text-slate-400 text-xs leading-relaxed">
                            Bubble sheet simulation. Practice with pen-paper feel on screen. Matches offline exam patterns.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {['Bubble Sheet', 'Paper Feel'].map(tag => (
                                <span key={tag} className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${hasOMR ? 'bg-teal-500/20 text-teal-300' : 'bg-white/10 text-slate-500'}`}>
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </button>
                </div>

                {/* Start Button */}
                <button
                    onClick={handleStart}
                    disabled={!selected}
                    className={`w-full py-4 rounded-md font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                        selected
                            ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm'
                            : 'bg-white/10 text-slate-500 cursor-not-allowed'
                    }`}
                >
                    {selected
                        ? `Start ${selected === 'digital' ? 'Digital' : 'OMR'} Test`
                        : 'Select a mode to continue'}
                    {selected && <ChevronRight size={22} />}
                </button>
            </div>
        </div>
    );
};

export default StudentTestModeSelect;
