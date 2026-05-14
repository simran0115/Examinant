import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, TrendingUp, Award, BarChart3, ArrowRight, BookOpen, Target, Zap } from 'lucide-react';
import { db } from '../../firebase';
import { collection, query, orderBy, limit, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';

const MAX_RESULTS = 50;

interface TestAttempt {
    id: string;
    attemptId: string;
    source: 'user_attempts' | 'legacy_test_results';
    testTitle: string;
    score: number;
    totalQuestions: number;
    maxScore: number;
    correctAnswers: number;
    attemptDate: any;
    duration?: number;
}

const StudentTestResultsPage = () => {
    const navigate = useNavigate();
    const authContext = useAuth();
    const currentUser = authContext?.currentUser;

    const [attempts, setAttempts] = useState<TestAttempt[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({
        totalAttempts: 0,
        averageScore: 0,
        bestScore: 0,
        totalTimeSpent: 0
    });

    const normalizeAttempt = (
        docId: string,
        data: any,
        source: 'user_attempts' | 'legacy_test_results'
    ): TestAttempt => {
        const correctCount = data.correctAnswers ?? data.correctCount ?? 0;
        const unattemptedCount = data.unattemptedCount ?? 0;
        
        const totalQs = data.totalQuestions || (correctCount + (data.wrongCount || 0) + unattemptedCount) || 0;
        const maxScore = data.totalMarks ?? (totalQs * 4);

        return {
            id: source === 'legacy_test_results' ? `legacy-${docId}` : docId,
            attemptId: docId,
            source,
            testTitle: data.testTitle || data.testName || 'Unknown Test',
            score: data.score ?? 0,
            totalQuestions: totalQs,
            maxScore: maxScore,
            correctAnswers: correctCount,
            attemptDate: data.attemptDate,
            duration: data.duration ?? data.timeTakenSeconds ?? 0
        };
    };

    useEffect(() => {
        if (!currentUser) return;

        const unsubscribeFunctions: (() => void)[] = [];

        // 1. Fetch user-specific attempts (modern way)
        const attemptsRef = collection(db, 'users', currentUser.uid, 'attempts');
        const qUser = query(attemptsRef, orderBy('attemptDate', 'desc'), limit(MAX_RESULTS));

        // 2. Fetch legacy results (where user is identified by userId or studentId)
        const legacyRef = collection(db, 'testResults');
        const qLegacyUser = query(legacyRef, where('userId', '==', currentUser.uid), limit(MAX_RESULTS));
        const qLegacyStudent = query(legacyRef, where('studentId', '==', currentUser.uid), limit(MAX_RESULTS));

        const attemptMap = new Map<string, TestAttempt>();

        const handleSnapshot = (snapshot: any, source: 'user_attempts' | 'legacy_test_results') => {
            snapshot.docs.forEach((doc: any) => {
                const normalized = normalizeAttempt(doc.id, doc.data(), source);
                attemptMap.set(normalized.id, normalized);
            });

            const sortedAttempts = Array.from(attemptMap.values()).sort((a, b) => {
                const aTime = a.attemptDate?.toMillis ? a.attemptDate.toMillis() : (a.attemptDate ? new Date(a.attemptDate).getTime() : 0);
                const bTime = b.attemptDate?.toMillis ? b.attemptDate.toMillis() : (b.attemptDate ? new Date(b.attemptDate).getTime() : 0);
                return bTime - aTime;
            });

            setAttempts(sortedAttempts);

            // Recalculate Statistics
            if (sortedAttempts.length > 0) {
                const totalScore = sortedAttempts.reduce((sum, a) => sum + (a.score || 0), 0);
                const bestScore = Math.max(...sortedAttempts.map(a => a.score || 0));
                const totalTime = sortedAttempts.reduce((sum, a) => sum + (a.duration || 0), 0);

                setStats({
                    totalAttempts: sortedAttempts.length,
                    averageScore: Math.round(totalScore / sortedAttempts.length),
                    bestScore: bestScore,
                    totalTimeSpent: totalTime
                });
            }
            setIsLoading(false);
        };

        unsubscribeFunctions.push(onSnapshot(qUser, (snap) => handleSnapshot(snap, 'user_attempts'), (err) => {
            console.error("User attempts listener error:", err);
            if (err.code === 'permission-denied') {
                console.warn("Permission denied for users/{uid}/attempts. Please check your Firestore security rules.");
            }
            setIsLoading(false);
        }));

        unsubscribeFunctions.push(onSnapshot(qLegacyUser, (snap) => handleSnapshot(snap, 'legacy_test_results'), (err) => {
            console.error("Legacy user results listener error:", err);
        }));

        unsubscribeFunctions.push(onSnapshot(qLegacyStudent, (snap) => handleSnapshot(snap, 'legacy_test_results'), (err) => {
            console.error("Legacy student results listener error:", err);
        }));

        return () => {
            unsubscribeFunctions.forEach(unsub => unsub());
        };
    }, [currentUser]);

    const formatDuration = (seconds: number | undefined | null) => {
        if (!seconds || isNaN(seconds)) return '0h 0m';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getScoreColor = (score: number, total: number) => {
        const percentage = (score / total) * 100;
        if (percentage >= 80) return 'text-green-600 bg-green-50';
        if (percentage >= 60) return 'text-teal-600 bg-teal-50';
        if (percentage >= 40) return 'text-teal-600 bg-teal-50';
        return 'text-red-600 bg-red-50';
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Test Results & History</h1>
                <p className="text-slate-500 mt-2">Track your performance and progress over time</p>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div
                    className="bg-teal-600 rounded-md p-6 text-white shadow-sm"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-teal-100 text-sm font-medium">Total Tests</p>
                            <h3 className="text-4xl font-bold mt-2">{stats.totalAttempts}</h3>
                        </div>
                        <BookOpen size={40} className="opacity-80" />
                    </div>
                </div>

                <div
                    className="bg-green-600 rounded-md p-6 text-white shadow-sm"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-100 text-sm font-medium">Average Score</p>
                            <h3 className="text-4xl font-bold mt-2">{stats.averageScore}</h3>
                        </div>
                        <TrendingUp size={40} className="opacity-80" />
                    </div>
                </div>

                <div
                    className="bg-purple-600 rounded-md p-6 text-white shadow-sm"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-purple-100 text-sm font-medium">Best Score</p>
                            <h3 className="text-4xl font-bold mt-2">{stats.bestScore}</h3>
                        </div>
                        <Award size={40} className="opacity-80" />
                    </div>
                </div>

                <div
                    className="bg-teal-500 rounded-md p-6 text-white shadow-sm"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-teal-100 text-sm font-medium">Time Spent</p>
                            <h3 className="text-2xl font-bold mt-2">{formatDuration(stats.totalTimeSpent)}</h3>
                        </div>
                        <Clock size={40} className="opacity-80" />
                    </div>
                </div>
            </div>

            {/* Results Table */}
            <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800">Test History</h2>
                </div>

                {attempts.length === 0 ? (
                    <div className="p-12 text-center">
                        <BarChart3 className="mx-auto text-slate-300 mb-4" size={64} />
                        <h3 className="text-lg font-bold text-slate-600 mb-2">No tests attempted yet</h3>
                        <p className="text-slate-500 mb-6">Start your first test to see results here</p>
                        <button
                            onClick={() => navigate('/dashboard/market')}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white font-bold rounded-md hover:bg-teal-700"
                        >
                            <Target size={20} />
                            Browse Tests
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <div className="min-w-[680px]">
                        <table className="w-full">
                            <thead className="bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 text-left">Test Name</th>
                                    <th className="px-6 py-4 text-left">Date & Time</th>
                                    <th className="px-6 py-4 text-center">Score</th>
                                    <th className="px-6 py-4 text-center">Correct</th>
                                    <th className="px-6 py-4 text-center">Accuracy</th>
                                    <th className="px-6 py-4 text-center">Duration</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {attempts.map((attempt) => {
                                    const maxScore = attempt.maxScore;
                                    const accuracy = attempt.totalQuestions > 0 ? ((attempt.correctAnswers / attempt.totalQuestions) * 100).toFixed(1) : '0.0';

                                    return (
                                        <tr key={attempt.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-slate-800">{attempt.testTitle}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {formatDate(attempt.attemptDate)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center">
                                                    <span className={`px-3 py-1 rounded-full font-bold text-sm ${getScoreColor(attempt.score, maxScore)}`}>
                                                        {attempt.score} / {maxScore}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="font-semibold text-green-600">
                                                    {attempt.correctAnswers}/{attempt.totalQuestions}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="font-semibold text-teal-600">{accuracy}%</span>
                                            </td>
                                            <td className="px-6 py-4 text-center text-sm text-slate-600">
                                                {attempt.duration ? formatDuration(attempt.duration) : 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 font-semibold text-sm"
                                                    onClick={() => navigate(`/dashboard/results/${attempt.id}`)}
                                                >
                                                    View Details
                                                    <ArrowRight size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            {attempts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                        onClick={() => navigate('/dashboard/analytics')}
                        className="p-6 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors group"
                    >
                        <BarChart3 className="text-indigo-600 mb-3" size={32} />
                        <h3 className="font-bold text-slate-800 mb-1">View Analytics</h3>
                        <p className="text-sm text-slate-600">Detailed performance insights</p>
                    </button>

                    <button
                        onClick={() => navigate('/dashboard/tests')}
                        className="p-6 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 transition-colors group"
                    >
                        <Zap className="text-teal-600 mb-3" size={32} />
                        <h3 className="font-bold text-slate-800 mb-1">Practice More</h3>
                        <p className="text-sm text-slate-600">Continue improving your skills</p>
                    </button>

                    <button
                        onClick={() => navigate('/dashboard')}
                        className="p-6 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 transition-colors group"
                    >
                        <Target className="text-green-600 mb-3" size={32} />
                        <h3 className="font-bold text-slate-800 mb-1">Dashboard</h3>
                        <p className="text-sm text-slate-600">View your study progress</p>
                    </button>
                </div>
            )}
        </div>
    );
};

export default StudentTestResultsPage;
