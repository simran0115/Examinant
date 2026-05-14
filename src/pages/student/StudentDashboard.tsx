import { useState, useEffect } from 'react';
import { PlayCircle, Clock, Award, BarChart2, TrendingUp, ChevronRight, BookOpen, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    getStudentStats,
    getRecommendedSeries,
    formatDurationHours,
    type StudentStats,
    type RecommendedSeries
} from '../../services/studentDashboardService';

const StudentDashboard = () => {
    const navigate = useNavigate();
    const auth = useAuth();
    const currentUser = auth?.currentUser;

    const [stats, setStats] = useState<StudentStats>({
        totalTests: 0,
        averageScore: 0,
        totalTimeSpent: 0,
        testsTrend: 'Start now',
        scoreTrend: '-',
        timeTrend: '-'
    });
    const [recommendations, setRecommendations] = useState<RecommendedSeries[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) return;

        // 1. Fetch static data
        const loadStats = async () => {
            try {
                const [statsData, recData] = await Promise.all([
                    getStudentStats(currentUser.uid),
                    getRecommendedSeries()
                ]);
                setStats(statsData);
                setRecommendations(recData);
            } catch (error) {
                console.error("Failed to load stats", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadStats();
    }, [currentUser]);

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="animate-spin text-teal-600" size={40} />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8">
            {/* Welcome Section */}
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">
                    Welcome back, {currentUser?.displayName || 'Student'}!
                </h1>
                <p className="text-slate-500 font-medium text-sm">
                    Logged in as: <span className="text-teal-600 font-bold">{currentUser?.email}</span>
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {[
                    {
                        label: 'Tests Completed',
                        value: stats.totalTests.toString(),
                        icon: Award,
                        color: 'text-teal-500',
                        bg: 'bg-teal-50',
                        trend: stats.testsTrend,
                        trendColor: 'text-green-600'
                    },
                    {
                        label: 'Average Score',
                        value: `${stats.averageScore}%`,
                        icon: TrendingUp,
                        color: 'text-emerald-500',
                        bg: 'bg-emerald-50',
                        trend: stats.scoreTrend,
                        trendColor: 'text-green-600'
                    },
                    {
                        label: 'Practice Time',
                        value: formatDurationHours(stats.totalTimeSpent),
                        icon: Clock,
                        color: 'text-indigo-500',
                        bg: 'bg-indigo-50',
                        trend: stats.timeTrend,
                        trendColor: 'text-slate-400'
                    }
                ].map((stat, idx) => (
                    <div
                        key={idx}
                        className="bg-white p-6 rounded-md border border-slate-200 shadow-sm flex flex-col justify-between"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-md ${stat.bg} ${stat.color}`}>
                                <stat.icon size={24} />
                            </div>
                            <span className={`text-xs font-bold ${stat.trendColor} bg-slate-50 px-2 py-1 rounded`}>
                                {stat.trend}
                            </span>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                            <h3 className="text-3xl font-black text-slate-800 mt-1">{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Actions & Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                {/* Featured / Recommended */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <BookOpen className="text-teal-600" size={24} />
                            Recommended for You
                        </h2>
                        <button
                            onClick={() => navigate('/dashboard/market')}
                            className="text-sm font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                        >
                            View All <ChevronRight size={16} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {recommendations.length > 0 ? (
                            recommendations.map((series) => (
                                <div
                                    key={series.id}
                                    className="bg-white border border-slate-200 rounded-md p-5 hover:border-teal-400 transition-all cursor-pointer group shadow-sm flex flex-col"
                                    onClick={() => navigate('/dashboard/market')}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded-md uppercase tracking-wider">
                                            {series.examCategory || 'General'}
                                        </span>
                                        <span className="text-teal-600 font-bold text-sm">
                                            {series.pricing?.amount ? `₹${series.pricing.amount}` : 'Free'}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-slate-800 group-hover:text-teal-600 transition-colors mb-4 line-clamp-2 min-h-[3rem]">
                                        {series.name}
                                    </h3>
                                    <div className="flex items-center gap-4 text-xs text-slate-500 font-medium mt-auto">
                                        <div className="flex items-center gap-1">
                                            <Clock size={14} />
                                            <span>Full Syllabus</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Award size={14} />
                                            <span>{series.testIds?.length || 0} Tests</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-2 text-center py-12 bg-slate-50 rounded-md border border-dashed border-slate-200">
                                <p className="text-slate-500 text-sm">No recommendations available yet.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Shortcuts */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <BarChart2 className="text-teal-600" size={24} />
                        Quick Access
                    </h2>
                    <div className="space-y-3">
                        {[
                            { label: 'My Purchased Tests', path: '/dashboard/tests', icon: BookOpen, desc: 'Access your test series' },
                            { label: 'Analytics & Progress', path: '/dashboard/analytics', icon: TrendingUp, desc: 'Track your performance' },
                            { label: 'Test Results', path: '/dashboard/results', icon: Award, desc: 'Review past attempts' }
                        ].map((item, idx) => (
                            <button
                                key={idx}
                                onClick={() => navigate(item.path)}
                                className="w-full flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-md hover:border-teal-400 hover:bg-slate-50 transition-all text-left shadow-sm group"
                            >
                                <div className="p-3 bg-slate-50 text-slate-600 rounded-md group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
                                    <item.icon size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">{item.label}</p>
                                    <p className="text-xs text-slate-500 font-medium">{item.desc}</p>
                                </div>
                                <ChevronRight className="ml-auto text-slate-300 group-hover:text-teal-600 transition-colors" size={18} />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentDashboard;
