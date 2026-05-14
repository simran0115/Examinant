import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Upload, Camera, Loader2, CheckCircle, AlertCircle,
    ArrowLeft, RefreshCw, Send, Edit3
} from 'lucide-react';
import { db } from '../../firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { scanOMR } from '../../utils/omrScanner';
import { convertPdfToImage } from '../../utils/pdfConverter';

type Stage = 'upload' | 'converting' | 'scanning' | 'verify' | 'error';

const StudentOMRUploadPage = () => {
    const navigate = useNavigate();
    const auth = useAuth();
    const currentUser = auth?.currentUser;

    const [stage, setStage] = useState<Stage>('upload');
    const [preview, setPreview] = useState<string | null>(null);
    const [scanResult, setScanResult] = useState<any>(null);
    const [testData, setTestData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Hold the image source (Blob/File) for the second-pass bubble scan
    const imageBlobRef = useRef<File | Blob | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const reset = useCallback(() => {
        if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
        setPreview(null);
        setScanResult(null);
        setTestData(null);
        setError(null);
        setStage('upload');
        imageBlobRef.current = null;
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [preview]);

    // ── Full scan pipeline ──────────────────────────────────────────────────
    const runScan = async (imageSource: File | Blob) => {
        try {
            // Pass 1: QR only
            setStage('scanning');
            const pass1 = await scanOMR(imageSource);

            // Fetch test from Firestore
            const snap = await getDoc(doc(db, 'tests', pass1.testId));
            if (!snap.exists()) {
                throw new Error(
                    `Test not found (ID: ${pass1.testId}). Please ensure you uploaded the correct OMR sheet.`
                );
            }
            const tData: any = { id: snap.id, ...snap.data() };

            // Fallback template for tests that don't have omrTemplate saved (matches StudentOMRPrintPage logic)
            if (!tData.omrTemplate) {
                const totalQs =
                    (tData.questionIds?.length as number | undefined) ||
                    (tData.questionMappings?.length as number | undefined) ||
                    0;

                if (totalQs > 0) {
                    tData.omrTemplate = {
                        totalQuestions: totalQs,
                        sections: [
                            {
                                id: 'sec1',
                                name: 'General Section',
                                questionCount: totalQs,
                                optionsPerQuestion: 4,
                                questionStartIndex: 1,
                                questionEndIndex: totalQs,
                            },
                        ],
                    };
                }
            }
            setTestData(tData);

            // Pass 2: Bubble scan using test template
            const pass2 = await scanOMR(imageSource, tData);
            setScanResult(pass2);
            setStage('verify');
        } catch (err: any) {
            console.error('Scan failed:', err);
            setError(err.message || 'Scanning failed. Please try again.');
            setStage('error');
        }
    };

    // ── File input handler ──────────────────────────────────────────────────
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);

        try {
            if (file.type === 'application/pdf') {
                // Show a placeholder preview while converting
                setPreview(null);
                setStage('converting');
                const imageBlob = await convertPdfToImage(file);
                imageBlobRef.current = imageBlob;
                const url = URL.createObjectURL(imageBlob);
                setPreview(url);
                await runScan(imageBlob);
            } else if (file.type.startsWith('image/')) {
                imageBlobRef.current = file;
                const url = URL.createObjectURL(file);
                setPreview(url);
                await runScan(file);
            } else {
                throw new Error('Unsupported file. Please upload a JPG, PNG, or PDF.');
            }
        } catch (err: any) {
            console.error('File processing error:', err);
            setError(err.message || 'Failed to process file.');
            setStage('error');
        }
    };

    // ── Manual answer correction ────────────────────────────────────────────
    const handleAnswerChange = (qNum: number, opt: string) => {
        setScanResult((prev: any) => ({
            ...prev,
            answers: {
                ...prev.answers,
                [qNum]: prev.answers[qNum] === opt ? '' : opt,
            },
        }));
    };

    // ── Submit & calculate score ────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!currentUser || !testData || !scanResult) return;
        setIsSubmitting(true);
        try {
            const sections: any[] = testData.omrTemplate?.sections || [];
            const mappings: any[] = testData.questionMappings || [];
            const answers = scanResult.answers as Record<number, string>;

            let totalScore = 0;
            let correct = 0, wrong = 0, unattempted = 0;
            const sectionWise: Record<string, any> = {};

            sections.forEach((sec) => {
                let secScore = 0, secCorrect = 0, secWrong = 0, secUnattempted = 0;
                for (let i = sec.questionStartIndex; i <= sec.questionEndIndex; i++) {
                    const mapping = mappings.find((m) => m.serialNumber === i);
                    const studentAns = answers[i];

                    if (!studentAns) {
                        secUnattempted++;
                        unattempted++;
                        secScore += sec.marksUnattempted || 0;
                    } else if (
                        mapping?.correctOption &&
                        studentAns.trim().toLowerCase() === mapping.correctOption.trim().toLowerCase()
                    ) {
                        secCorrect++;
                        correct++;
                        secScore += sec.marksCorrect || 0;
                    } else {
                        secWrong++;
                        wrong++;
                        secScore += sec.marksWrong || 0;
                    }
                }
                totalScore += secScore;
                sectionWise[sec.name] = {
                    score: secScore,
                    correct: secCorrect,
                    wrong: secWrong,
                    unattempted: secUnattempted,
                };
            });

            const totalMarks = sections.reduce(
                (s, sec) => s + (sec.questionCount * (sec.marksCorrect || 0)),
                0
            );

            const payload = {
                testId: testData.id,
                testName: testData.name,
                testTitle: testData.name,   // result detail page reads testTitle
                isOMR: true,
                isScanned: true,
                studentId: currentUser.uid,
                answers,
                score: totalScore,
                totalMarks,
                totalQuestions: testData.omrTemplate?.totalQuestions || 0,
                correctAnswers: correct,     // result page reads correctAnswers
                correctCount: correct,
                wrongCount: wrong,
                unattemptedCount: unattempted,
                attemptedQuestions: correct + wrong,
                sectionWiseScore: sectionWise,
                attemptDate: serverTimestamp(),
            };

            const docRef = await addDoc(
                collection(db, 'users', currentUser.uid, 'attempts'),
                payload
            );
            navigate(`/dashboard/results/${docRef.id}`);
        } catch (err) {
            console.error('Submission failed:', err);
            alert('Failed to save results. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/dashboard/tests')}
                        className="p-2 hover:bg-white rounded-md text-slate-500 transition-all shadow-sm border border-slate-100"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Upload OMR Sheet</h1>
                        <p className="text-slate-500 text-sm">
                            Upload a photo (JPG/PNG) or a PDF of your filled OMR to get instant results
                        </p>
                    </div>
                </div>

                {/* ── UPLOAD STATE ── */}
                {stage === 'upload' && (
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-md p-12 text-center">
                        <div className="w-20 h-20 bg-teal-50 text-teal-600 rounded-md flex items-center justify-center mx-auto mb-6">
                            <Upload size={40} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Upload Your OMR Sheet</h2>
                        <p className="text-slate-500 mb-2 max-w-sm mx-auto">
                            Accepts <strong>Photo (JPG/PNG)</strong> or <strong>PDF</strong>
                        </p>
                        <p className="text-slate-400 text-sm mb-8 max-w-sm mx-auto">
                            Make sure the <strong>QR code</strong> at the top-right corner is clearly visible and not blurry.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-8 py-3 bg-teal-600 text-white font-bold rounded-md hover:bg-teal-700 transition-all flex items-center gap-2"
                            >
                                <Camera size={20} />
                                Select Image / PDF
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="image/*,application/pdf"
                                className="hidden"
                            />
                        </div>
                    </div>
                )}

                {/* ── CONVERTING / SCANNING STATES ── */}
                {(stage === 'converting' || stage === 'scanning') && (
                    <div className="bg-white rounded-md p-12 text-center border border-slate-200 shadow-sm">
                        <div className="relative w-24 h-24 mx-auto mb-6">
                            <div className="w-24 h-24 rounded-full border-4 border-teal-100 border-t-teal-600 animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center text-3xl">
                                {stage === 'converting' ? '📄' : '🔍'}
                            </div>
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">
                            {stage === 'converting' ? 'Converting PDF...' : 'Scanning OMR Sheet...'}
                        </h2>
                        <p className="text-slate-500 text-sm">
                            {stage === 'converting'
                                ? 'Rendering PDF to high-resolution image for analysis'
                                : 'Reading QR code and detecting bubble answers'}
                        </p>

                        {preview && (
                            <div className="mt-8 max-w-xs mx-auto rounded-md overflow-hidden border border-slate-200 shadow-sm relative">
                                <img src={preview} alt="OMR Preview" className="w-full object-contain max-h-64" />
                            </div>
                        )}
                    </div>
                )}

                {/* ── ERROR STATE ── */}
                {stage === 'error' && (
                    <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden">
                        {preview && (
                            <img src={preview} alt="OMR Preview" className="w-full max-h-64 object-contain bg-slate-50" />
                        )}
                        <div className="p-8">
                            <div className="flex items-center gap-3 text-red-600 mb-3">
                                <AlertCircle size={28} />
                                <h3 className="text-lg font-bold">Scanning Failed</h3>
                            </div>
                            <p className="text-red-700 text-sm mb-6 bg-red-50 p-4 rounded-md">{error}</p>

                            <div className="flex gap-3">
                                <button
                                    onClick={reset}
                                    className="flex-1 py-3 border border-slate-300 text-slate-700 font-bold rounded-md hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                >
                                    <RefreshCw size={16} />
                                    Upload Different File
                                </button>
                                {imageBlobRef.current && (
                                    <button
                                        onClick={() => runScan(imageBlobRef.current!)}
                                        className="flex-1 py-3 bg-teal-600 text-white font-bold rounded-md hover:bg-teal-700 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Loader2 size={16} />
                                        Retry Scan
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── VERIFY STATE ── */}
                {stage === 'verify' && testData && scanResult && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left: Image preview */}
                        <div className="space-y-4">
                            <div className="bg-white p-2 rounded-md shadow-sm border border-slate-200 overflow-hidden">
                                {preview && (
                                    <img src={preview} alt="OMR Sheet" className="w-full object-contain max-h-[500px] rounded-md" />
                                )}
                            </div>
                            <button
                                onClick={reset}
                                className="w-full py-3 text-slate-500 font-medium hover:text-slate-800 transition-colors flex items-center justify-center gap-2"
                            >
                                <RefreshCw size={16} />
                                Upload Different Sheet
                            </button>
                        </div>

                        {/* Right: Results panel */}
                        <div className="space-y-4">
                            {/* Test identified */}
                            <div className="bg-white p-5 rounded-md border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-3 text-green-600 mb-3">
                                    <CheckCircle size={22} />
                                    <h3 className="font-bold">Test Identified ✓</h3>
                                </div>
                                <p className="text-lg font-bold text-slate-800">{testData.name}</p>
                                <div className="flex gap-6 mt-3 text-sm">
                                    <div>
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Questions</p>
                                        <p className="font-bold text-slate-700">
                                            {typeof testData.omrTemplate?.totalQuestions === 'number'
                                                ? testData.omrTemplate.totalQuestions
                                                : '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Bubbles Detected</p>
                                        <p className="font-bold text-teal-600">{Object.keys(scanResult.answers).length}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Verify answers */}
                            <div className="bg-white p-5 rounded-md border border-slate-200 shadow-sm flex-1">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                        <Edit3 size={16} className="text-teal-500" />
                                        Verify &amp; Correct Answers
                                    </h3>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-1 rounded-md">
                                        Tap to change
                                    </span>
                                </div>

                                <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1">
                                    {testData.omrTemplate?.sections?.map((sec: any) => (
                                        <div key={sec.id || sec.name}>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1 mb-2">
                                                {sec.name}
                                            </p>
                                            <div className="space-y-1.5">
                                                {Array.from(
                                                    { length: sec.questionCount },
                                                    (_, i) => sec.questionStartIndex + i
                                                ).map((qNum) => {
                                                    const ans = scanResult.answers[qNum];
                                                    return (
                                                         <div
                                                            key={qNum}
                                                            className="flex items-center justify-between px-3 py-2 rounded-md bg-slate-50 border border-slate-100"
                                                        >
                                                            <span className="text-sm font-bold text-slate-500 w-8">
                                                                Q{qNum}
                                                            </span>
                                                            <div className="flex gap-1.5">
                                                                {['A', 'B', 'C', 'D'].slice(0, sec.optionsPerQuestion || 4).map((opt) => (
                                                                    <button
                                                                        key={opt}
                                                                        onClick={() => handleAnswerChange(qNum, opt)}
                                                                        className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                                                                            ans === opt
                                                                                ? 'bg-teal-600 text-white shadow-md scale-110'
                                                                                : 'bg-white text-slate-400 border border-slate-200 hover:border-teal-300'
                                                                        }`}
                                                                    >
                                                                        {opt}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="w-full py-4 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        Calculating Score...
                                    </>
                                ) : (
                                    <>
                                        <Send size={20} />
                                        Submit &amp; See My Score
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentOMRUploadPage;
