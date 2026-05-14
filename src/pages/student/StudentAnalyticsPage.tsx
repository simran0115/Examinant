import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Calendar, Award, Target, BookOpen, TrendingUp, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    Radar
} from 'recharts';

interface Attempt {
    id: string;
    testTitle: string;
    score: number;
    totalQuestions: number;
    attemptDate: any;
    duration?: number; // in seconds
    attemptedQuestions?: number;
}

const StudentAnalyticsPage = () => {
    const navigate = useNavigate();
    const authContext = useAuth();
    const currentUser = authContext?.currentUser;
    const [attempts, setAttempts] = useState<Attempt[]>([]);
    const [stats, setStats] = useState({
        totalTests: 0,
        averageScore: 0,
        bestScore: 0,
        timeEfficiency: '--'
    });

    useEffect(() => {
        if (currentUser) {
            const q = query(collection(db, 'users', currentUser.uid, 'attempts'), orderBy('attemptDate', 'desc'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedAttempts = snapshot.docs.map(doc => {
                    const data = doc.data();
                    const totalQs = data.totalQuestions || (data.correctCount + data.wrongCount + data.unattemptedCount) || 0;
                    const maxScore = data.totalMarks || (totalQs * 4) || 1; // Avoid divide by zero
                    
                    return {
                        id: doc.id,
                        testTitle: data.testTitle || data.testName || 'Unknown Test',
                        score: data.score || 0,
                        totalQuestions: totalQs,
                        maxScore: maxScore,
                        attemptDate: data.attemptDate,
                        duration: data.duration || data.timeTakenSeconds || 0,
                        attemptedQuestions: data.attemptedQuestions || (data.correctCount + data.wrongCount) || 0,
                        sectionWiseScore: data.sectionWiseScore || {}
                    };
                }) as any[];

                setAttempts(fetchedAttempts);

                // Calculate Stats
                if (fetchedAttempts.length > 0) {
                    const total = fetchedAttempts.length;
                    const totalScorePercentage = fetchedAttempts.reduce((acc, curr) => {
                        return acc + ((curr.score / curr.maxScore) * 100);
                    }, 0);

                    const avg = totalScorePercentage / total;
                    const best = Math.max(...fetchedAttempts.map(a => (a.score / a.maxScore) * 100));

                    // Time Efficiency
                    let totalTime = 0;
                    let totalAttempted = 0;
                    fetchedAttempts.forEach(a => {
                        totalTime += a.duration;
                        totalAttempted += a.attemptedQuestions;
                    });

                    let timeEffStr = '--';
                    if (totalAttempted > 0) {
                        const avgSecondsPerQ = totalTime / totalAttempted;
                        if (avgSecondsPerQ < 60) {
                            timeEffStr = `${Math.round(avgSecondsPerQ)}s / q`;
                        } else {
                            const m = Math.floor(avgSecondsPerQ / 60);
                            const s = Math.round(avgSecondsPerQ % 60);
                            timeEffStr = `${m}m ${s}s / q`;
                        }
                    }

                    setStats({
                        totalTests: total,
                        averageScore: Math.round(avg),
                        bestScore: Math.round(best),
                        timeEfficiency: timeEffStr
                    });
                }
            });
            return () => unsubscribe();
        }
    }, [currentUser]);

    // Prepare Chart Data
    const chartData = [...attempts].reverse().map(attempt => ({
        name: attempt.testTitle.substring(0, 10),
        score: Math.round((attempt.score / (attempt as any).maxScore) * 100),
        date: attempt.attemptDate?.toDate ? attempt.attemptDate.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''
    }));

    // Prepare Subject Mastery Data
    const subjectDataMap: Record<string, { totalScore: number; maxScore: number }> = {};
    attempts.forEach(a => {
        const sections = (a as any).sectionWiseScore || {};
        Object.entries(sections).forEach(([subject, data]: [string, any]) => {
            if (!subjectDataMap[subject]) subjectDataMap[subject] = { totalScore: 0, maxScore: 0 };
            subjectDataMap[subject].totalScore += (typeof data === 'number' ? data : (data?.score || 0));
            subjectDataMap[subject].maxScore += 100;
        });
    });

    const masteryData = Object.entries(subjectDataMap).map(([subject, data]) => ({
        subject: subject || 'General',
        A: attempts.length > 0 ? Math.round((data.totalScore / (attempts.length * 100)) * 100) : 0,
        fullMark: 100
    }));

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
    };

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Performance Analytics</h1>
                <p className="text-slate-500 mt-1">Track your progress and identify areas for improvement.</p>
            </div>

            {/* Key Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-md border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-teal-100 text-teal-600 rounded-md">
                            <BookOpen size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Tests Taken</p>
                            <h3 className="text-2xl font-bold text-slate-800">{stats.totalTests}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-md border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-purple-100 text-purple-600 rounded-md">
                            <Target size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Average Score</p>
                            <h3 className="text-2xl font-bold text-slate-800">{stats.averageScore}%</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-md border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-teal-100 text-teal-600 rounded-md">
                            <Award size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Best Score</p>
                            <h3 className="text-2xl font-bold text-slate-800">{stats.bestScore}%</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-md border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-green-100 text-green-600 rounded-md">
                            <Clock size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Time Efficiency</p>
                            <h3 className="text-2xl font-bold text-slate-800">{stats.timeEfficiency}</h3>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Score Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-md border border-slate-200 shadow-sm flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <TrendingUp size={20} className="text-teal-600" />
                            Performance Trend
                        </h3>
                        <span className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-500 rounded">Progress over time</span>
                    </div>
                    <div className="h-72 w-full">
                        {attempts.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                    <XAxis
                                        dataKey="date"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: '#94A3B8' }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: '#94A3B8' }}
                                        domain={[0, 100]}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="score"
                                        stroke="#3B82F6"
                                        fillOpacity={1}
                                        fill="url(#colorScore)"
                                        strokeWidth={4}
                                        dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4, stroke: '#fff' }}
                                        activeDot={{ r: 6, strokeWidth: 0 }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                Not enough data to show trend
                            </div>
                        )}
                    </div>
                </div>

                {/* Subject Mastery Radar */}
                <div className="bg-white p-6 rounded-md border border-slate-200 shadow-sm flex flex-col">
                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Target size={20} className="text-teal-500" />
                        Subject Mastery
                    </h3>
                    <div className="h-72 w-full flex items-center justify-center">
                        {masteryData.length >= 3 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={masteryData}>
                                    <PolarGrid stroke="#F1F5F9" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748B' }} />
                                    <Radar
                                        name="Score"
                                        dataKey="A"
                                        stroke="#F59E0B"
                                        fill="#F59E0B"
                                        fillOpacity={0.4}
                                        strokeWidth={3}
                                    />
                                    <Tooltip />
                                </RadarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-center p-6 space-y-3">
                                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-400">
                                    <Target size={24} />
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                                    Attempt more tests with different subjects to see your mastery radar.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
                {/* Recent Activity Table */}
                <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800">Historical Performance</h3>
                        <button 
                            onClick={() => window.print()}
                            className="text-xs font-bold text-teal-600 hover:underline print:hidden"
                        >
                            Download Report
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <div className="min-w-[640px]">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Test Name</th>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4 text-center">Outcome</th>
                                    <th className="px-6 py-4 text-center">Score</th>
                                    <th className="px-6 py-4 text-center">Efficiency</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {attempts.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <div className="max-w-xs mx-auto">
                                                <TrendingUp size={40} className="mx-auto text-slate-200 mb-4" />
                                                <p className="text-slate-400 font-medium">No attempts found. Start your first test to see analytics.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    attempts.map((attempt) => {
                                        const perc = Math.round((attempt.score / (attempt as any).maxScore) * 100);
                                        return (
                                            <tr key={attempt.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-700 group-hover:text-teal-600 transition-colors">
                                                        {attempt.testTitle}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-xs text-slate-500 font-bold flex items-center gap-1.5 uppercase">
                                                        <Calendar size={12} className="text-slate-400" />
                                                        {attempt.attemptDate?.toDate ? attempt.attemptDate.toDate().toLocaleDateString() : 'N/A'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${perc >= 60 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {perc >= 60 ? 'Success' : 'Need Work'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="text-sm font-bold text-slate-800">
                                                        {perc}%
                                                        <span className="block text-xs text-slate-400 font-medium mt-0.5">{attempt.score} / {(attempt as any).maxScore}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="text-xs font-bold text-slate-600">
                                                        {attempt.duration ? `${Math.round(attempt.duration / 60)}m` : '--'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button 
                                                        onClick={() => navigate(`/dashboard/results/${attempt.id}`)}
                                                        className="text-teal-600 hover:text-teal-700 font-bold text-xs flex items-center gap-1 justify-end ml-auto"
                                                    >
                                                        Details
                                                        <ArrowRight size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`
                @media print {
                    @page { margin: 15mm; size: A4 landscape; }
                    body { background: white !important; -webkit-print-color-adjust: exact; }
                    .print\\:hidden, aside, nav, button { display: none !important; }
                    .bg-white { background-color: white !important; }
                    .border { border: 1px solid #e2e8f0 !important; }
                    .shadow-sm { box-shadow: none !important; }
                    .grid { gap: 1rem !important; }
                    /* Force charts to stay on one page if possible */
                    .lg\\:col-span-2 { width: 100% !important; }
                }
            `}</style>
        </div>
    );
};

export default StudentAnalyticsPage;
