import { useState, useEffect } from 'react';
import { Clock, Loader2, ChevronDown, ChevronUp, PlayCircle, BookOpen, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
// ... (imports)
import { collection, onSnapshot, query, where, getDocs, orderBy } from 'firebase/firestore';

interface PurchasedTest {
    id: string; // Purchase ID
    seriesId?: string; // New field
    testId: string; // Legacy/Fallback
    testTitle: string; // or seriesTitle
    seriesTitle?: string;
    category?: string;
    price: number;
    purchaseDate: any;
}

interface TestItem {
    id: string;
    name: string;
    settings: {
        duration: number;
    };
    questions?: any[];
    questionIds?: string[];
    omrTemplate?: { totalQuestions: number };
}

interface Attempt {
    id: string;
    testId: string;
    score: number;
    attemptDate: any;
}



const SeriesCard = ({ purchase, attemptsMap }: { purchase: PurchasedTest, attemptsMap: Record<string, Attempt[]> }) => {
    const navigate = useNavigate();
    const [tests, setTests] = useState<TestItem[]>([]);
    const [loadingTests, setLoadingTests] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);


    // Identify the series ID
    const seriesId = purchase.seriesId || purchase.testId;
    const title = purchase.seriesTitle || purchase.testTitle;

    useEffect(() => {
        const fetchTests = async () => {
            if (!seriesId) return;
            setLoadingTests(true);
            try {
                // Fetch tests belonging to this series
                const q = query(
                    collection(db, 'tests'),
                    where('seriesId', '==', seriesId)
                    // orderBy('createdAt', 'asc') // safe to add if index exists, otherwise filtering is enough
                );
                const snapshot = await getDocs(q);
                const fetchedTests = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as TestItem[];
                setTests(fetchedTests);
            } catch (error) {
                console.error("Failed to fetch tests for series", seriesId, error);
            } finally {
                setLoadingTests(false);
            }
        };

        if (isExpanded) {
            fetchTests();
        }
    }, [seriesId, isExpanded]);

    return (
        <div
            className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-sm"
        >
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-5 flex items-center justify-between cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors"
            >
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-teal-100 text-teal-600 rounded-md">
                        <BookOpen size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                            <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                {purchase.category || 'Series'}
                            </span>
                        </div>
                        <p className="text-slate-500 text-sm mt-0.5">
                            Purchased on {purchase.purchaseDate?.toDate().toLocaleDateString()}
                        </p>
                    </div>
                </div>
                <button className="p-2 text-slate-400 hover:text-teal-600 transition-colors">
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
            </div>

            {isExpanded && (
                <div className="border-t border-slate-100">
                    {loadingTests ? (
                        <div className="p-8 flex justify-center">
                            <Loader2 className="animate-spin text-teal-500" size={24} />
                        </div>
                    ) : tests.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-sm">
                            No tests currently available in this series.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {tests.map((test) => {
                                const testAttempts = attemptsMap[test.id] || [];
                                const hasAttempted = testAttempts.length > 0;

                                return (
                                    <div key={test.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50 transition-colors pl-4 md:pl-20 gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-md ${hasAttempted ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                                {hasAttempted ? <Award size={18} /> : <Clock size={18} />}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-slate-800">{test.name}</h4>
                                                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-1">
                                                    <span>{test.settings?.duration || 180} mins</span>
                                                    <span>•</span>
                                                    <span>{test.questionIds?.length || 0} Questions</span>

                                                    {hasAttempted && (
                                                        <>
                                                            <span className="hidden md:inline">•</span>
                                                            {Math.max(...testAttempts.map(a => a.score)) > 0 ? (
                                                                <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">
                                                                    Best Score: {Math.max(...testAttempts.map(a => a.score))}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-full">
                                                                    Attempted
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 self-end md:self-auto flex-wrap justify-end">

                                            {hasAttempted && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate('/dashboard/results');
                                                    }}
                                                    className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-bold rounded-md hover:bg-slate-100 transition-colors"
                                                >
                                                    View Result
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/dashboard/attempt/${test.id}`);
                                                }}
                                                className={`px-4 py-2 text-white text-sm font-bold rounded-md transition-colors flex items-center gap-2 ${hasAttempted
                                                    ? 'bg-slate-800 hover:bg-slate-900'
                                                    : 'bg-teal-600 hover:bg-teal-700'
                                                    }`}
                                            >
                                                <PlayCircle size={16} />
                                                {hasAttempted ? 'Re-Attempt' : 'Start Test'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const StudentTestsPage = () => {
    const navigate = useNavigate();
    const authContext = useAuth();
    const currentUser = authContext?.currentUser;
    const [purchasedTests, setPurchasedTests] = useState<PurchasedTest[]>([]);
    const [attemptsMap, setAttemptsMap] = useState<Record<string, Attempt[]>>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (currentUser) {
            // Fetch Purchases
            const unsubscribePurchases = onSnapshot(collection(db, 'users', currentUser.uid, 'purchases'), (snapshot) => {
                const tests = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as PurchasedTest[];
                setPurchasedTests(tests);
                setIsLoading(false);
            });

            // Fetch Attempts from both locations
            const attemptsRef = collection(db, 'users', currentUser.uid, 'attempts');
            const legacyResultsRef = collection(db, 'testResults');

            const qUser = query(attemptsRef, orderBy('attemptDate', 'desc'));
            const qLegacyUser = query(legacyResultsRef, where('userId', '==', currentUser.uid));
            const qLegacyStudent = query(legacyResultsRef, where('studentId', '==', currentUser.uid));

            const updateAttempts = (snapshot: any) => {
                setAttemptsMap(prev => {
                    const newMap = { ...prev };
                    snapshot.docs.forEach((doc: any) => {
                        const data = doc.data();
                        const attempt = { id: doc.id, ...data } as Attempt;
                        if (!attempt.testId) return;

                        if (!newMap[attempt.testId]) {
                            newMap[attempt.testId] = [attempt];
                        } else {
                            // Check if this specific attempt (by id) is already in the list
                            const exists = newMap[attempt.testId].some(a => a.id === attempt.id);
                            if (!exists) {
                                newMap[attempt.testId] = [...newMap[attempt.testId], attempt].sort((a, b) => {
                                    const aTime = a.attemptDate?.toMillis ? a.attemptDate.toMillis() : 0;
                                    const bTime = b.attemptDate?.toMillis ? b.attemptDate.toMillis() : 0;
                                    return bTime - aTime;
                                });
                            }
                        }
                    });
                    return newMap;
                });
            };

            const unsubscribeUser = onSnapshot(qUser, updateAttempts);
            const unsubscribeLegacyUser = onSnapshot(qLegacyUser, updateAttempts);
            const unsubscribeLegacyStudent = onSnapshot(qLegacyStudent, updateAttempts);

            return () => {
                unsubscribePurchases();
                unsubscribeUser();
                unsubscribeLegacyUser();
                unsubscribeLegacyStudent();
            };
        }
    }, [currentUser]);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">My Test Series</h1>
                    <p className="text-slate-500 mt-1">Access your purchased content and start practicing.</p>
                </div>
                <button
                    onClick={() => navigate('/dashboard/market')}
                    className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-md hover:bg-slate-800 transition-colors"
                >
                    Browse Market
                </button>
            </div>

            {/* Active Series List */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="animate-spin text-teal-600" size={30} />
                    </div>
                ) : purchasedTests.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 rounded-md border border-dashed border-slate-300">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                            <BookOpen size={30} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">No Series Purchased</h3>
                        <p className="text-slate-500 mb-6 max-w-md mx-auto">
                            You haven't enrolled in any test series yet. Visit the market to find high-quality tests for your preparation.
                        </p>
                        <button
                            onClick={() => navigate('/dashboard/market')}
                            className="bg-teal-600 text-white px-6 py-3 rounded-md font-bold hover:bg-teal-700 transition-colors"
                        >
                            Explore Market
                        </button>
                    </div>
                ) : (
                    purchasedTests.map((purchase) => (
                        <SeriesCard key={purchase.id} purchase={purchase} attemptsMap={attemptsMap} />
                    ))
                )}
            </div>
        </div>
    );
};

export default StudentTestsPage;
