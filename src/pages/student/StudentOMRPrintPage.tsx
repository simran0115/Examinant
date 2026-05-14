import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Printer } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface OMRSection {
    id: string;
    name: string;
    questionCount: number;
    optionsPerQuestion: number;
    questionStartIndex: number;
    questionEndIndex: number;
}

interface TestData {
    id: string;
    name: string;
    omrTemplate?: {
        totalQuestions: number;
        sections: OMRSection[];
    };
    questionIds?: string[];
    settings?: {
        duration: number;
    };
}

const StudentOMRPrintPage = () => {
    const { testId } = useParams();
    const auth = useAuth();
    const [studentName, setStudentName] = useState<string>('Student');
    const [testData, setTestData] = useState<TestData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadStudentName = async () => {
            const uid = auth?.currentUser?.uid;
            const fallback = auth?.currentUser?.displayName || auth?.currentUser?.email || 'Student';
            if (!uid) {
                setStudentName(fallback);
                return;
            }
            try {
                const snap = await getDoc(doc(db, 'users', uid));
                const profile = snap.exists() ? (snap.data() as any) : undefined;
                const nameFromProfile = (profile?.displayName || profile?.fullName || profile?.name) as string | undefined;
                setStudentName((nameFromProfile && nameFromProfile.trim()) || fallback);
            } catch (e) {
                console.error('Failed to load student profile name:', e);
                setStudentName(fallback);
            }
        };
        loadStudentName();
    }, [auth?.currentUser?.uid, auth?.currentUser?.displayName, auth?.currentUser?.email]);

    useEffect(() => {
        const fetchTest = async () => {
            if (!testId) return;
            try {
                const snap = await getDoc(doc(db, 'tests', testId));
                if (snap.exists()) {
                    const data = { id: snap.id, ...snap.data() } as TestData;
                    
                    // Fallback template for Digital tests
                    if (!data.omrTemplate) {
                        const totalQs = data.questionIds?.length || 0;
                        data.omrTemplate = {
                            totalQuestions: totalQs,
                            sections: [
                                {
                                    id: 'sec1',
                                    name: 'General Section',
                                    questionCount: totalQs,
                                    optionsPerQuestion: 4,
                                    questionStartIndex: 1,
                                    questionEndIndex: totalQs
                                }
                            ]
                        };
                    }
                    setTestData(data);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTest();
    }, [testId]);

    // Auto-trigger print when loaded
    useEffect(() => {
        if (!isLoading && testData) {
            const timer = setTimeout(() => {
                window.print();
            }, 800); // Small delay to ensure QR code and styles are fully rendered
            return () => clearTimeout(timer);
        }
    }, [isLoading, testData]);

    const handlePrint = () => {
        window.print();
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <Loader2 className="animate-spin text-teal-600 mx-auto mb-4" size={40} />
                    <p className="text-slate-600 font-medium">Preparing OMR Sheet...</p>
                </div>
            </div>
        );
    }

    if (!testData || !testData.omrTemplate) {
        return <div className="p-10 text-center">Test not found or no questions.</div>;
    }

    const { omrTemplate } = testData;

    return (
        <div className="min-h-screen bg-slate-100 py-10 print:bg-white print:py-0">
            {/* Control Bar (Hidden on Print) */}
            <div className="max-w-[210mm] mx-auto mb-6 flex justify-between items-center px-4 print:hidden">
                <div className="flex items-center gap-2 text-slate-600">
                    <Printer size={20} />
                    <span className="text-sm font-medium">A4 Portrait Recommended</span>
                </div>
                <button
                    onClick={handlePrint}
                    className="px-6 py-2 bg-teal-600 text-white font-bold rounded-md hover:bg-teal-700 shadow-sm transition-all flex items-center gap-2"
                >
                    <Printer size={18} />
                    Print OMR Sheet
                </button>
            </div>

            {/* OMR Sheet (A4 Size) */}
            <div className="omr-sheet-container bg-white shadow-2xl mx-auto p-[15mm] print:shadow-none print:p-[10mm] relative" 
                 style={{ width: '210mm', minHeight: '297mm' }}>
                
                {/* Scanning Anchors (Top Left, Top Right, Bottom Left, Bottom Right) */}
                <div className="absolute top-4 left-4 w-6 h-6 bg-slate-900 rounded-sm print:bg-black"></div>
                <div className="absolute top-4 right-4 w-6 h-6 bg-slate-900 rounded-sm print:bg-black"></div>
                <div className="absolute bottom-4 left-4 w-6 h-6 bg-slate-900 rounded-sm print:bg-black"></div>
                <div className="absolute bottom-4 right-4 w-6 h-6 bg-slate-900 rounded-sm print:bg-black"></div>

                {/* Header Section */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-900 rounded-md flex items-center justify-center text-white font-black text-2xl tracking-tighter">Ex</div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">DHItantra</h1>
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-xl font-bold text-slate-800 uppercase leading-none">{testData.name}</h2>
                            <p className="text-xs text-slate-500 font-bold tracking-widest uppercase">Official Practice OMR Sheet</p>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <div className="border-2 border-slate-900 p-1 rounded-md bg-white">
                            <QRCodeSVG 
                                value={`TEST_ID:${testData.id}`} 
                                size={80} 
                                level="H"
                                includeMargin={false}
                            />
                        </div>
                        <span className="text-[8px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                            ID: {testData.id.toUpperCase()}
                        </span>
                    </div>
                </div>

                {/* Student Info Blocks */}
                <div className="grid grid-cols-2 gap-8 mb-10">
                    <div className="space-y-4">
                         <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Candidate Name</label>
                            <div className="h-10 border-b-2 border-slate-900 w-full flex items-end pb-1">
                                <span className="text-sm font-bold text-slate-800 tracking-wide">{studentName}</span>
                            </div>
                         </div>
                    </div>
                    <div className="grid grid-cols-10 gap-1 content-start">
                        <div className="col-span-10 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Marking Instructions</div>
                        <div className="col-span-10 flex flex-col gap-2">
                            <div className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full bg-slate-900"></div>
                                <span className="text-[10px] text-slate-600 font-medium">Correct Method</span>
                            </div>
                            <div className="flex items-center gap-3 grayscale opacity-40">
                                <div className="w-4 h-4 rounded-full border-2 border-slate-400 flex items-center justify-center text-[8px]">❌</div>
                                <div className="w-4 h-4 rounded-full border-2 border-slate-400 flex items-center justify-center text-[8px]">✓</div>
                                <span className="text-[10px] text-slate-600 font-medium">Incorrect Methods</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Answer Sections */}
                <div className="space-y-10">
                    {omrTemplate.sections.map((section) => (
                        <div key={section.id} className="relative">
                            <div className="flex items-center gap-4 mb-4">
                                <h3 className="text-sm font-black text-white bg-slate-900 px-3 py-1 rounded-md tracking-widest uppercase">{section.name}</h3>
                                <div className="flex-1 h-[2px] bg-slate-100"></div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Questions {section.questionStartIndex} - {section.questionEndIndex}</span>
                            </div>

                            <div className="grid grid-cols-4 gap-x-8 gap-y-4">
                                {Array.from({ length: section.questionCount }, (_, i) => section.questionStartIndex + i).map(qNum => {
                                    const isNumerical = section.optionsPerQuestion === 0;
                                    
                                    return (
                                        <div key={qNum} className="flex items-center gap-4 py-2 border-b border-slate-50">
                                            <span className="text-xs font-bold text-slate-800 w-6">{qNum}</span>
                                            {isNumerical ? (
                                                <div className="flex-1 flex gap-1">
                                                    {[...Array(5)].map((_, idx) => (
                                                        <div key={idx} className="w-6 h-8 border border-slate-300 rounded-md text-center leading-8 text-[10px] text-slate-200">
                                                            {idx === 1 ? '.' : ''}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    {['A', 'B', 'C', 'D'].slice(0, section.optionsPerQuestion || 4).map(opt => (
                                                        <div key={opt} className="w-6 h-6 rounded-full border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                                            {opt}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="mt-20 pt-8 border-t border-slate-100 text-center">
                    <p className="text-[10px] font-bold text-slate-400 tracking-[0.3em] uppercase mb-2">Designed by DHItantra Platform</p>
                    <div className="flex justify-center items-center gap-10 grayscale opacity-30">
                        <div className="w-32 h-10 border-2 border-dashed border-slate-300 rounded-md flex items-center justify-center text-[8px] font-bold">Candidate Signature</div>
                        <div className="w-32 h-10 border-2 border-dashed border-slate-300 rounded-md flex items-center justify-center text-[8px] font-bold">Invigilator Signature</div>
                    </div>
                </div>
            </div>

            <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 0;
                    }
                    body {
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .omr-sheet-container {
                        width: 210mm !important;
                        height: 297mm !important;
                        padding: 10mm !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                }
                .omr-sheet-container {
                    page-break-after: always;
                }
            `}</style>
        </div>
    );
};

export default StudentOMRPrintPage;

